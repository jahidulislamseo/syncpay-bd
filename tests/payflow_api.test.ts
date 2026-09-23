import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify, { FastifyInstance } from 'fastify';
import { paymentRoutes } from '../src/routes/payment.routes.js';
import { merchantRoutes } from '../src/routes/merchant.routes.js';
import { dbService } from '../src/db/database.js';

describe('PayFlow Sandbox API v1.0 Suite', () => {
  let app: FastifyInstance;
  const SANDBOX_KEY = 'sandbox_test_8f4c9a2e7b31';

  before(async () => {
    app = Fastify();
    await app.register(paymentRoutes);
    await app.register(merchantRoutes);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('POST /v1/payment/create without API key should return 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/payment/create',
      payload: {
        amount: 1200,
        redirect_url: 'https://merchant.com/payment/success',
      },
    });

    assert.strictEqual(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, false);
    assert.match(body.message, /Missing API key/i);
  });

  test('POST /v1/payment/create with invalid API key should return 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/payment/create',
      headers: {
        'payflow-api-key': 'invalid_secret_key_123',
      },
      payload: {
        amount: 1200,
        redirect_url: 'https://merchant.com/payment/success',
      },
    });

    assert.strictEqual(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, false);
    assert.match(body.message, /Invalid API Key/i);
  });

  test('POST /v1/payment/create with valid PayFlow headers should create invoice and return payment_url', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/payment/create',
      headers: {
        'Content-Type': 'application/json',
        'payflow-api-key': SANDBOX_KEY,
      },
      payload: {
        cus_name: 'John Doe',
        cus_email: 'john@example.com',
        amount: 1200,
        metadata: {
          order_id: 'ORD-1001',
          customer_id: 'CUS-9001',
        },
        redirect_url: 'https://merchant.com/payment/success',
        cancel_url: 'https://merchant.com/payment/cancel',
        webhook_url: 'https://merchant.com/api/payflow/webhook',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, true);
    assert.strictEqual(body.message, 'Invoice created successfully.');
    assert.match(body.payment_url, /\/(?:checkout|pay\/[^\s?]+)(\.html)?\?invoice_id=PF/);
  });

  test('POST /v1/payment/verify for pending invoice returns status PENDING', async () => {
    // 1. Create Invoice
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/payment/create',
      headers: {
        'payflow-api-key': SANDBOX_KEY,
      },
      payload: {
        cus_name: 'Alice Johnson',
        cus_email: 'alice@example.com',
        amount: 850,
        redirect_url: 'https://merchant.com/payment/success',
      },
    });
    const createBody = JSON.parse(createRes.body);
    const invoiceId = createBody.payment_url.split('invoice_id=')[1];

    // 2. Verify status
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/v1/payment/verify',
      headers: {
        'payflow-api-key': SANDBOX_KEY,
      },
      payload: {
        invoice_id: invoiceId,
      },
    });

    assert.strictEqual(verifyRes.statusCode, 200);
    const verifyBody = JSON.parse(verifyRes.body);
    assert.strictEqual(verifyBody.invoice_id, invoiceId);
    assert.strictEqual(verifyBody.amount, 850);
    assert.strictEqual(verifyBody.status, 'PENDING');
    assert.strictEqual(verifyBody.cus_name, 'Alice Johnson');
    assert.strictEqual(verifyBody.cus_email, 'alice@example.com');
  });

  test('Full End-to-End Cycle: Create Invoice -> Ingest SMS -> Settle Checkout -> Verify COMPLETED status', async () => {
    const testTrxId = 'PF' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const amount = 1500;

    // 1. Merchant creates invoice
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/payment/create',
      headers: {
        'payflow-api-key': SANDBOX_KEY,
      },
      payload: {
        cus_name: 'Shahriar Khan',
        cus_email: 'shahriar@example.com',
        amount,
        redirect_url: 'https://mystore.com/checkout/thank-you',
      },
    });
    const invoiceId = JSON.parse(createRes.body).payment_url.split('invoice_id=')[1];

    // 2. Telephony daemon receives SMS from bKash
    const merchant = dbService.getMerchantByApiKey(SANDBOX_KEY)!;
    dbService.insertTransaction({
      merchantId: merchant.id,
      deviceId: 'dev_phone_1',
      provider: 'bKash',
      trxId: testTrxId,
      amount,
      sender: '01700000000',
      rawSms: `You have received Tk ${amount}.00 from 01700000000. Fee Tk 0.00. TrxID ${testTrxId}`,
    });

    // 3. Customer submits TrxID on checkout page
    const checkoutSettleRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/verify',
      headers: {
        'payflow-api-key': SANDBOX_KEY,
      },
      payload: {
        invoice_id: invoiceId,
        trx_id: testTrxId,
        expected_amount: amount,
      },
    });
    assert.strictEqual(checkoutSettleRes.statusCode, 200);
    const settleData = JSON.parse(checkoutSettleRes.body);
    assert.strictEqual(settleData.success, true);
    assert.strictEqual(settleData.verified, true);
    assert.strictEqual(settleData.redirect_url, 'https://mystore.com/checkout/thank-you');

    // 4. Merchant calls /v1/payment/verify to verify payment status
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/v1/payment/verify',
      headers: {
        'payflow-api-key': SANDBOX_KEY,
      },
      payload: {
        invoice_id: invoiceId,
      },
    });
    assert.strictEqual(verifyRes.statusCode, 200);
    const verifyData = JSON.parse(verifyRes.body);
    assert.strictEqual(verifyData.status, 'COMPLETED');
    assert.strictEqual(verifyData.transaction_id, testTrxId);
    assert.strictEqual(verifyData.amount, amount);
    assert.strictEqual(verifyData.payment_method, 'bkash');
  });
});
