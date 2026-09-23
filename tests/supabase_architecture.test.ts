import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify, { FastifyInstance } from 'fastify';
import { getSupabaseClient, isSupabaseConfigured } from '../src/db/supabase.js';
import { MerchantRepository } from '../src/db/repositories/merchant.repository.js';
import { ApiKeyRepository } from '../src/db/repositories/api-key.repository.js';
import { DeviceRepository } from '../src/db/repositories/device.repository.js';
import { InvoiceRepository } from '../src/db/repositories/invoice.repository.js';
import { TransactionRepository } from '../src/db/repositories/transaction.repository.js';
import { DeviceService } from '../src/services/device.service.js';
import { paymentRoutes } from '../src/routes/payment.routes.js';
import { deviceRoutes } from '../src/routes/device.routes.js';
import { CryptoUtil } from '../src/utils/crypto.js';

describe('Supabase PostgreSQL Architecture & Migration Test Suite', { concurrency: 1 }, () => {
  let app: FastifyInstance;
  const testTenantA = '00000000-0000-0000-0000-000000000101';
  const testTenantB = '00000000-0000-0000-0000-000000000999';
  const rawKeyTenantA = 'live_demo_sec_99410';
  const rawKeyTenantB = 'sandbox_test_8f4c9a2e7b31';

  before(async () => {
    app = Fastify();
    await app.register(paymentRoutes);
    await app.register(deviceRoutes);
    await app.ready();
  });

  after(async () => {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('devices').delete().eq('merchant_id', testTenantA);
        await supabase.from('transactions').delete().eq('merchant_id', testTenantA);
        await supabase.from('invoices').delete().eq('merchant_id', testTenantA);
        await supabase.from('invoices').delete().eq('merchant_id', testTenantB);
        await supabase.from('merchants').delete().like('email', 'merchant_%@example.com');
      } catch (_) {}
    }
    await app.close();
  });

  // Test 1: Supabase connection and driver resolution
  test('1. Supabase connection & driver initialization test', () => {
    const configured = isSupabaseConfigured();
    // System reliably defaults to SQLite when Supabase cloud envs are not yet set up
    assert.strictEqual(typeof configured, 'boolean');
    const client = getSupabaseClient();
    if (configured) {
      assert.ok(client);
    } else {
      assert.strictEqual(client, null);
    }
  });

  // Test 2: Merchant creation test
  test('2. Merchant creation test', async () => {
    const randomEmail = `merchant_${Date.now()}@example.com`;
    const merchant = await MerchantRepository.create({
      business_name: 'SuperTech BD',
      email: randomEmail,
      phone: '01899001122',
      webhook_url: 'https://supertech.com/webhook',
    });

    assert.ok(merchant);
    assert.strictEqual(merchant.business_name, 'SuperTech BD');
    assert.strictEqual(merchant.email, randomEmail);
    assert.strictEqual(merchant.status, 'ACTIVE');
  });

  // Test 3: API key validation test
  test('3. API key validation test with SHA-256 token hashing', async () => {
    const keyRecord = await ApiKeyRepository.findByKey(rawKeyTenantA);
    assert.ok(keyRecord, 'API Key should be found by raw token string');
    assert.strictEqual(keyRecord.merchant_id, testTenantA);
    assert.strictEqual(keyRecord.status, 'active');
    assert.strictEqual(keyRecord.key_hash, CryptoUtil.hashToken(rawKeyTenantA));
  });

  // Test 4: Device registration test
  test('4. Device registration test with hashed token storage', async () => {
    const rawToken = 'test_token_' + Math.random().toString(36).substring(2, 10);
    const { entity, rawToken: tokenOut } = await DeviceRepository.create({
      merchantId: testTenantA,
      deviceName: 'Redmi Note 12 Forwarder',
      rawToken,
      deviceModel: '22111317G',
      androidVersion: 'Android 13',
      mfsProvider: 'bKash+Nagad',
      status: 'ONLINE',
    } as any);

    assert.ok(entity);
    assert.strictEqual(entity.device_name, 'Redmi Note 12 Forwarder');
    assert.strictEqual(entity.status, 'ONLINE');
    assert.strictEqual(tokenOut, rawToken);

    // Verify lookup by token
    const found = await DeviceRepository.findByToken(rawToken);
    assert.ok(found);
    assert.strictEqual(found.id, entity.id);
  });

  // Test 5: Invoice creation test
  test('5. Invoice creation test with unique invoice_id', async () => {
    const invId = 'INV_' + Date.now().toString(36).toUpperCase();
    const invoice = await InvoiceRepository.create({
      merchantId: testTenantA,
      invoiceId: invId,
      customerName: 'Rahim Uddin',
      customerEmail: 'rahim@example.com',
      amount: 2500,
      redirectUrl: 'https://merchant.com/success',
    });

    assert.ok(invoice);
    assert.strictEqual(invoice.invoice_id, invId);
    assert.strictEqual(invoice.customer_name, 'Rahim Uddin');
    assert.strictEqual(invoice.amount, 2500);
    assert.strictEqual(invoice.status, 'PENDING');

    const retrieved = await InvoiceRepository.findByInvoiceId(invId);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.amount, 2500);
  });

  // Test 6: Transaction insertion test
  test('6. Transaction insertion test into financial ledger', async () => {
    const trxId = 'BKTRX' + Date.now().toString(36).toUpperCase();
    const result = await TransactionRepository.insert({
      merchantId: testTenantA,
      deviceId: '00000000-0000-0000-0000-000000000001',
      provider: 'bKash',
      trxId,
      amount: 1500,
      senderNumber: '01711223344',
      rawSms: `You have received Tk 1,500.00 from 01711223344. TrxID ${trxId}`,
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.id);

    const found = await TransactionRepository.findByTrxId(testTenantA, trxId);
    assert.ok(found);
    assert.strictEqual(found.trx_id, trxId);
    assert.strictEqual(found.amount, 1500);
  });

  // Test 7: Duplicate TrxID rejection test (Anti-Replay / Double-Spend Protection)
  test('7. Duplicate TrxID rejection test (Anti-Replay UNIQUE merchant_id, trx_id)', async () => {
    const trxId = 'REPLAY_' + Date.now().toString(36).toUpperCase();

    // First insertion succeeds
    const first = await TransactionRepository.insert({
      merchantId: testTenantA,
      provider: 'Nagad',
      trxId,
      amount: 800,
      rawSms: `Received Amount: Tk 800.00. TxnID: ${trxId}`,
    });
    assert.strictEqual(first.success, true);

    // Duplicate insertion with same merchantId and trxId is rejected
    const duplicate = await TransactionRepository.insert({
      merchantId: testTenantA,
      provider: 'Nagad',
      trxId,
      amount: 800,
      rawSms: `Received Amount: Tk 800.00. TxnID: ${trxId}`,
    });
    assert.strictEqual(duplicate.success, false);
    assert.strictEqual(duplicate.isDuplicate, true);
  });

  // Test 8: Merchant data isolation test (Tenant A cannot access Tenant B)
  test('8. Merchant data isolation test (Cross-Tenant Access Gating)', async () => {
    // Tenant B creates an invoice
    const invB = 'INV_TENANT_B_' + Date.now().toString(36).toUpperCase();
    await InvoiceRepository.create({
      merchantId: testTenantB,
      invoiceId: invB,
      customerName: 'Secret Customer B',
      amount: 9999,
      redirectUrl: 'https://tenantb.com/return',
    });

    // Tenant A attempts to verify Tenant B's invoice using Tenant A's API key
    const res = await app.inject({
      method: 'POST',
      url: '/v1/payment/verify',
      headers: {
        'payflow-api-key': rawKeyTenantA, // Tenant A key
      },
      payload: {
        invoice_id: invB,
      },
    });

    // Must be rejected with 404
    assert.strictEqual(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, false);
    assert.match(body.message, /not found or does not belong to this merchant/i);
  });

  // Test 9: Invalid device rejection test
  test('9. Invalid device rejection test', async () => {
    const auth = await DeviceService.authenticateDevice('fake_invalid_token_999');
    assert.strictEqual(auth.authenticated, false);
    assert.match(auth.error || '', /not registered or invalid token/i);

    // API test
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/device/sms/ingest',
      payload: {
        device_id: 'fake_invalid_token_999',
        sms: 'You have received Tk 500.00. TrxID 99AA88',
      },
    });
    assert.strictEqual(res.statusCode, 401);
  });

  // Test 10: Existing payment API regression test
  test('10. Existing payment API regression test (POST /v1/payment/create & /verify)', async () => {
    // 1. Create Invoice
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/payment/create',
      headers: {
        'payflow-api-key': rawKeyTenantB,
      },
      payload: {
        cus_name: 'Kazi Nazrul',
        cus_email: 'nazrul@example.com',
        amount: 3200,
        redirect_url: 'https://merchant.com/done',
      },
    });

    assert.strictEqual(createRes.statusCode, 201);
    const createBody = JSON.parse(createRes.body);
    assert.strictEqual(createBody.status, true);
    assert.match(createBody.payment_url, /\/(?:checkout|pay\/[^\s?]+)(\.html)?\?invoice_id=PF/);

    const invoiceId = createBody.payment_url.split('invoice_id=')[1];

    // 2. Verify Invoice
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/v1/payment/verify',
      headers: {
        'payflow-api-key': rawKeyTenantB,
      },
      payload: {
        invoice_id: invoiceId,
      },
    });

    assert.strictEqual(verifyRes.statusCode, 200);
    const verifyBody = JSON.parse(verifyRes.body);
    assert.strictEqual(verifyBody.cus_name, 'Kazi Nazrul');
    assert.strictEqual(verifyBody.cus_email, 'nazrul@example.com');
    assert.strictEqual(verifyBody.amount, 3200);
    assert.strictEqual(verifyBody.status, 'PENDING');
  });
});
