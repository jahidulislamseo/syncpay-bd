import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify, { FastifyInstance } from 'fastify';
import { deviceRoutes } from '../src/routes/device.routes.js';
import { paymentRoutes } from '../src/routes/payment.routes.js';
import { CryptoUtil } from '../src/utils/crypto.js';

describe('Android Device Ingestion & HMAC Webhook Suite', () => {
  let app: FastifyInstance;
  const DEVICE_TOKEN = 'token_phone_primary'; // seeded in database.ts for dev_phone_1

  before(async () => {
    app = Fastify();
    await app.register(deviceRoutes);
    await app.register(paymentRoutes);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('POST /api/v1/device/sms/ingest fails with 401 for unregistered device', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/device/sms/ingest',
      payload: {
        device_id: 'non_existent_device_token',
        sms: 'You have received Tk 500.00 from 01700000000. Fee Tk 0.00. Balance Tk 5,500.00. TrxID 9K99ZZ11AA at 19/09/2026 10:00',
      },
    });

    assert.strictEqual(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.step_failed, 'Step 1: Device Authentication');
  });

  test('POST /api/v1/device/sms/ingest fails with 422 for malformed/non-MFS SMS', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/device/sms/ingest',
      payload: {
        device_id: DEVICE_TOKEN,
        sms: 'Your GP recharge of Tk 20 was successful. Validity 30 days.',
      },
    });

    assert.strictEqual(res.statusCode, 422);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.step_failed, 'Step 5: MFS Regex Parsing');
  });

  test('POST /api/v1/device/sms/ingest accepts valid bKash SMS and updates ledger', async () => {
    const trxId = 'BK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
    const validSms = `You have received Tk 750.00 from 01811223344. Fee Tk 0.00. Balance Tk 10,750.00. TrxID ${trxId} at 19/09/2026 10:05`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/device/sms/ingest',
      payload: {
        device_id: DEVICE_TOKEN,
        sms: validSms,
        sender: 'bKash',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.transaction.trx_id, trxId);
    assert.strictEqual(body.transaction.amount, 750);
    assert.strictEqual(body.transaction.provider, 'bKash');
  });

  test('POST /api/v1/device/sms/ingest blocks duplicate TrxID (Anti-Replay / Double-Spend Protection)', async () => {
    const trxId = 'BKRPL' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
    const sms = `You have received Tk 1,200.00 from 01799887766. Fee Tk 0.00. Balance Tk 20,000.00. TrxID ${trxId} at 19/09/2026 10:10`;

    // First attempt -> 201 Created
    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/v1/device/sms/ingest',
      payload: {
        device_id: DEVICE_TOKEN,
        sms,
        sender: 'bKash',
      },
    });
    assert.strictEqual(firstRes.statusCode, 201);

    // Replay attempt -> 200 with isDuplicate: true
    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/v1/device/sms/ingest',
      payload: {
        device_id: DEVICE_TOKEN,
        sms,
        sender: 'bKash',
      },
    });
    assert.strictEqual(secondRes.statusCode, 200);
    const secondBody = JSON.parse(secondRes.body);
    assert.strictEqual(secondBody.isDuplicate, true);
    assert.match(secondBody.message, /Double-spend blocked/i);
  });

  test('HMAC-SHA256 Webhook signature generation and verification', () => {
    const secret = 'whsec_test_secret_998877665544332211';
    const payload = JSON.stringify({
      invoice_id: 'INV_TEST_8899',
      status: 'true',
      amount: 1500,
      trx_id: 'BK99AA88ZZ',
    });

    const signature = CryptoUtil.signWebhook(payload, secret);
    assert.ok(signature.startsWith('sha256='));

    // Valid verification
    const isValid = CryptoUtil.verifyWebhookSignature(payload, signature, secret);
    assert.strictEqual(isValid, true);

    // Tampered payload verification fails
    const tamperedPayload = JSON.stringify({
      invoice_id: 'INV_TEST_8899',
      status: 'true',
      amount: 99999, // tampered amount
      trx_id: 'BK99AA88ZZ',
    });
    const isTamperedValid = CryptoUtil.verifyWebhookSignature(tamperedPayload, signature, secret);
    assert.strictEqual(isTamperedValid, false);

    // Wrong secret verification fails
    const isWrongSecretValid = CryptoUtil.verifyWebhookSignature(payload, signature, 'wrong_secret');
    assert.strictEqual(isWrongSecretValid, false);
  });

  test('POST /api/v1/device/sms/ingest accepts Dual-SIM slot & App Notification source', async () => {
    const trxId = 'NOTIF' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
    const sms = `Received Amount: Tk 350.00 from 01911223344. TxnID: ${trxId}. Balance: Tk 5,350.00`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/device/sms/ingest',
      payload: {
        device_id: DEVICE_TOKEN,
        sms,
        sender: '16167',
        sim_slot: 1,
        carrier: 'Banglalink',
        source: 'APP_NOTIFICATION',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.transaction.trx_id, trxId);
  });

  test('POST /api/v1/device/heartbeat persists hardware telemetry and returns commands', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/device/heartbeat',
      payload: {
        device_token: DEVICE_TOKEN,
        battery_level: 88,
        battery_temp: 33.2,
        is_charging: true,
        charger_type: 'AC',
        free_ram_mb: 1750,
        sim_slots: [
          { slot: 0, carrier: 'Grameenphone', state: 'READY' },
          { slot: 1, carrier: 'Banglalink', state: 'READY' },
        ],
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.status, 'ONLINE');
    assert.ok(Array.isArray(body.commands));
  });
});
