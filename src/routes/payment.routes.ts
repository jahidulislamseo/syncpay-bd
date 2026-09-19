import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import QRCode from 'qrcode';
import { z } from 'zod';
import { PaymentService } from '../services/payment.service.js';
import { MerchantService } from '../services/merchant.service.js';
import { InvoiceRepository } from '../db/repositories/invoice.repository.js';

// API Key extractor supporting SyncPay / PayFlow headers, query params, or body
function extractApiKey(request: FastifyRequest): string | undefined {
  const headerKey = request.headers['syncpay-api-key'] || request.headers['payflow-api-key'] || request.headers['x-api-key'] || request.headers['zini-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }
  const query = request.query as Record<string, string | undefined>;
  if (query?.apikey && query.apikey.trim()) {
    return query.apikey.trim();
  }
  const body = request.body as Record<string, any> | undefined;
  if (body?.api_key && typeof body.api_key === 'string' && body.api_key.trim()) {
    return body.api_key.trim();
  }
  return undefined;
}

// Request Validation Schemas
const payflowCreateInvoiceSchema = z.object({
  cus_name: z.string().optional(),
  cus_email: z.string().email('Invalid email address format').optional().or(z.literal('')),
  amount: z.number().positive('amount must be greater than 0'),
  metadata: z.record(z.any()).optional().refine((val) => {
    if (!val) return true;
    return JSON.stringify(val).length <= 1024;
  }, 'metadata must be valid JSON and stay within 1 KB'),
  redirect_url: z.string().url('redirect_url must be a valid URL'),
  cancel_url: z.string().url('cancel_url must be a valid URL').optional().or(z.literal('')),
  webhook_url: z.string().url('webhook_url must be a valid URL').optional().or(z.literal('')),
});

const payflowVerifyInvoiceSchema = z.object({
  invoice_id: z.string().min(1, 'invoice_id is required'),
});

const legacyCreateInvoiceSchema = z.object({
  api_key: z.string().optional(),
  customer_name: z.string().default('Valued Customer'),
  expected_amount: z.number().positive(),
  provider: z.enum(['bKash', 'Nagad', 'Rocket', 'Upay']).default('bKash'),
  order_id: z.string().optional(),
});

const legacyVerifySchema = z.object({
  api_key: z.string().optional(),
  trx_id: z.string().min(4),
  expected_amount: z.number().positive(),
  order_id: z.string().optional(),
  invoice_id: z.string().optional(),
});

export async function paymentRoutes(fastify: FastifyInstance) {
  // ==========================================
  // 1. PayFlow Standard API: Create Invoice
  // POST /v1/payment/create & /api/v1/payment/create
  // ==========================================
  const handlePayflowCreateInvoice = async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = extractApiKey(request);
    if (!apiKey) {
      return reply.status(401).send({
        status: false,
        message: 'Missing API key. Please provide syncpay-api-key header or ?apikey query parameter.',
      });
    }

    const authResult = await MerchantService.authenticateApiKey(apiKey);
    if (!authResult.authenticated || !authResult.merchant) {
      return reply.status(401).send({
        status: false,
        message: 'Invalid API Key. Only active merchant brands are allowed.',
      });
    }

    const parseResult = payflowCreateInvoiceSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        status: false,
        message: 'Validation failed.',
        errors: parseResult.error.errors,
      });
    }

    const { cus_name, cus_email, amount, metadata, redirect_url, cancel_url, webhook_url } = parseResult.data;

    const { invoice } = await PaymentService.createInvoice({
      merchantId: authResult.merchant.id,
      customerName: cus_name,
      customerEmail: cus_email || undefined,
      amount,
      metadata,
      redirectUrl: redirect_url,
      cancelUrl: cancel_url || undefined,
      webhookUrl: webhook_url || undefined,
    });

    const host = request.headers.host || 'localhost:4000';
    const protocol = (request.headers['x-forwarded-proto'] as string) || request.protocol || 'http';
    const payment_url = `${protocol}://${host}/checkout?invoice_id=${invoice.invoice_id}`;

    return reply.status(201).send({
      status: true,
      message: 'Invoice created successfully.',
      invoice_id: invoice.invoice_id,
      payment_url,
    });
  };

  fastify.post('/v1/payment/create', handlePayflowCreateInvoice);
  fastify.post('/api/v1/payment/create', handlePayflowCreateInvoice);

  // ==========================================
  // 2. PayFlow Standard API: Verify Invoice
  // POST /v1/payment/verify & /api/v1/payment/verify
  // ==========================================
  const handlePayflowVerifyInvoice = async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = extractApiKey(request);
    if (!apiKey) {
      return reply.status(401).send({
        status: false,
        message: 'Missing API key. Please provide syncpay-api-key header or ?apikey parameter.',
      });
    }

    const authResult = await MerchantService.authenticateApiKey(apiKey);
    if (!authResult.authenticated || !authResult.merchant) {
      return reply.status(401).send({
        status: false,
        message: 'Invalid API Key.',
      });
    }

    const parseResult = payflowVerifyInvoiceSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        status: false,
        message: 'Validation failed.',
        errors: parseResult.error.errors,
      });
    }

    const { invoice_id } = parseResult.data;
    const verifyResult = await PaymentService.verifyInvoice(invoice_id, authResult.merchant.id);

    if (!verifyResult.found || !verifyResult.invoice) {
      return reply.status(404).send({
        status: false,
        message: 'Invoice not found or does not belong to this merchant.',
      });
    }

    const invoice = verifyResult.invoice;
    return reply.send({
      cus_name: invoice.customer_name,
      cus_email: (invoice as any).customer_email || 'customer@example.com',
      amount: invoice.amount,
      invoice_id: invoice.invoice_id,
      payment_method: (invoice as any).payment_method || 'bkash',
      transaction_id: (invoice as any).trx_id || null,
      status: verifyResult.status,
    });
  };

  fastify.post('/v1/payment/verify', handlePayflowVerifyInvoice);
  fastify.post('/api/v1/payment/verify', handlePayflowVerifyInvoice);

  // ==========================================
  // 3. Checkout Settlement Endpoint
  // ==========================================
  fastify.post('/api/v1/payments/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = legacyVerifySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const apiKey = extractApiKey(request);
    const { trx_id, expected_amount, order_id, invoice_id } = parseResult.data;

    let invoice: any;
    if (invoice_id) {
      invoice = await InvoiceRepository.findByInvoiceId(invoice_id);
    }

    let merchantId: string | undefined;
    if (apiKey) {
      const auth = await MerchantService.authenticateApiKey(apiKey);
      if (auth.authenticated) merchantId = auth.merchant?.id;
    } else if (invoice) {
      merchantId = invoice.merchant_id;
    }

    if (!merchantId) {
      return reply.status(401).send({ success: false, error: 'Invalid or missing API Key' });
    }

    const effectiveAmount = invoice ? invoice.amount : expected_amount;
    const effectiveOrderId = order_id || (invoice ? invoice.invoice_id : 'ORD_' + trx_id);

    const settleResult = await PaymentService.settleCheckout({
      merchantId,
      trxId: trx_id,
      amount: effectiveAmount,
      orderId: effectiveOrderId,
      invoiceId: invoice?.invoice_id,
    });

    if (!settleResult.success) {
      return reply.status(400).send({
        success: false,
        verified: false,
        message: settleResult.reason,
      });
    }

    return reply.send({
      success: true,
      verified: true,
      message: 'Payment verified successfully and locked.',
      redirect_url: settleResult.redirect_url,
      data: {
        trx_id: trx_id.toUpperCase(),
        amount: effectiveAmount,
        provider: settleResult.transaction?.provider || 'bKash',
        order_id: effectiveOrderId,
        invoice_id: invoice_id || null,
      },
    });
  });

  // ==========================================
  // 4. Legacy Create Invoice
  // ==========================================
  fastify.post('/api/v1/payments/create-invoice', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = legacyCreateInvoiceSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ success: false, error: 'Validation failed' });
    }

    const apiKey = extractApiKey(request);
    if (!apiKey) {
      return reply.status(401).send({ success: false, error: 'Missing API Key' });
    }

    const auth = await MerchantService.authenticateApiKey(apiKey);
    if (!auth.authenticated || !auth.merchant) {
      return reply.status(401).send({ success: false, error: 'Invalid API Key' });
    }

    const { customer_name, expected_amount, provider } = parseResult.data;
    const { invoice } = await PaymentService.createInvoice({
      merchantId: auth.merchant.id,
      customerName: customer_name,
      amount: expected_amount,
      redirectUrl: 'http://localhost:4000/success',
    });

    const host = request.headers.host || 'localhost:4000';
    const protocol = (request.headers['x-forwarded-proto'] as string) || request.protocol || 'http';

    return reply.status(201).send({
      success: true,
      invoice_id: invoice.invoice_id,
      expected_amount: invoice.amount,
      provider: provider || 'bKash',
      expires_at: invoice.expires_at,
      checkout_url: `${protocol}://${host}/checkout?invoice_id=${invoice.invoice_id}`,
    });
  });

  // ==========================================
  // 5. Query Invoice Details by ID
  // ==========================================
  fastify.get('/api/v1/payments/invoice/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const invoice = await InvoiceRepository.findByInvoiceId(request.params.id);
    if (!invoice) {
      return reply.status(404).send({ success: false, error: 'Invoice not found' });
    }
    return reply.send({ success: true, invoice });
  });

  // ==========================================
  // 6. Generate QR Code for Checkout
  // ==========================================
  fastify.get('/api/v1/payment/qr', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { data?: string; size?: string; raw?: string; format?: string };
    const text = query.data || '01580397069';
    const size = parseInt(query.size || '280', 10);
    try {
      const acceptsImage = request.headers.accept?.includes('image/') || query.raw === '1' || query.format === 'image';
      if (acceptsImage) {
        const buffer = await QRCode.toBuffer(text, {
          margin: 1,
          width: size,
          color: { dark: '#111827', light: '#ffffff' },
        });
        return reply.type('image/png').send(buffer);
      }

      const dataUrl = await QRCode.toDataURL(text, {
        margin: 1,
        width: size,
        color: { dark: '#111827', light: '#ffffff' },
      });
      return reply.send({ success: true, qr: dataUrl });
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message });
    }
  });

  // ==========================================
  // 7. Get Active Payment Methods for Checkout
  // ==========================================
  fastify.get('/api/v1/payments/methods', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { invoice_id?: string; merchant_id?: string };
    let merchantId = query.merchant_id;

    if (query.invoice_id) {
      const invoice = await InvoiceRepository.findByInvoiceId(query.invoice_id);
      if (invoice && invoice.merchant_id) {
        merchantId = invoice.merchant_id;
      }
    }

    if (!merchantId) {
      merchantId = '00000000-0000-0000-0000-000000000101';
    }

    try {
      const { dbService } = await import('../db/database.js');
      let methods = dbService.getPaymentMethods(merchantId, true);
      if (!methods || methods.length === 0) {
        methods = dbService.getPaymentMethods('m_demo_101', true);
      }
      return reply.send({ success: true, methods });
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message });
    }
  });
}
