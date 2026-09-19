import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DeviceService } from '../services/device.service.js';
import { TransactionService } from '../services/transaction.service.js';
import { MfsParser } from '../parsers/mfs.parser.js';

const ingestSchema = z.object({
  device_id: z.string().min(1, 'device_id is required'),
  sms: z.string().min(1, 'sms body is required'),
  sender: z.string().optional(),
  received_at: z.string().optional(),
});

const legacySyncSchema = z.object({
  device_token: z.string(),
  sender: z.string().optional(),
  raw_sms: z.string(),
});

export async function deviceRoutes(fastify: FastifyInstance) {
  /**
   * Android Forwarder Ingestion API:
   * Enforces 9-Step Verification & Instant Invoice Matching
   * POST /api/v1/device/sms/ingest
   */
  fastify.post('/api/v1/device/sms/ingest', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = ingestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        step_failed: 'Payload Validation',
        errors: parseResult.error.errors,
      });
    }

    const { device_id, sms, sender } = parseResult.data;

    // STEP 1, 2 & 3: Device valid, active and belongs to active merchant?
    const auth = await DeviceService.authenticateDevice(device_id);
    if (!auth.authenticated || !auth.device || !auth.merchant) {
      const isUnregistered = auth.error?.includes('not registered') || auth.error?.includes('invalid token');
      return reply.status(isUnregistered ? 401 : 403).send({
        success: false,
        step_failed: isUnregistered ? 'Step 1: Device Authentication' : 'Step 3: Merchant Verification',
        error: auth.error,
      });
    }

    // Update heartbeat
    await DeviceService.recordHeartbeat(device_id);

    // Run Ingestion Pipeline (Step 4 through 9)
    const ingest = await TransactionService.ingestSms({
      merchantId: auth.merchant.id,
      deviceId: auth.device.id,
      sms,
      sender,
      webhookSecret: (auth.merchant as any).webhook_secret,
    });

    if (ingest.isDuplicate) {
      return reply.status(200).send({
        success: true,
        step: 'Step 4/9: Anti-Replay Duplicate Protection',
        isDuplicate: true,
        message: 'Transaction already recorded in ledger. Double-spend blocked.',
        trxId: ingest.parsed?.trxId,
      });
    }

    if (!ingest.success) {
      return reply.status(422).send({
        success: false,
        step_failed: ingest.stepFailed,
        error: ingest.error,
        raw: sms,
      });
    }

    return reply.status(201).send({
      success: true,
      message: 'Transaction successfully ingested and ledger updated',
      transaction: {
        provider: ingest.parsed?.provider,
        trx_id: ingest.parsed?.trxId,
        amount: ingest.parsed?.amount,
        sender: ingest.parsed?.sender,
      },
      matched_invoice_id: ingest.matchedInvoice?.invoice_id || null,
    });
  });

  /**
   * Backward-compatible legacy sync route
   */
  fastify.post('/api/v1/device/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = legacySyncSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ success: false, error: 'Invalid payload structure' });
    }

    const { device_token, sender, raw_sms } = parseResult.data;
    const auth = await DeviceService.authenticateDevice(device_token);
    if (!auth.authenticated || !auth.device || !auth.merchant) {
      return reply.status(401).send({ success: false, error: 'Unauthorized device token' });
    }

    await DeviceService.recordHeartbeat(device_token);

    const ingest = await TransactionService.ingestSms({
      merchantId: auth.merchant.id,
      deviceId: auth.device.id,
      sms: raw_sms,
      sender,
    });

    if (!ingest.success && !ingest.isDuplicate) {
      return reply.status(422).send({ success: false, error: ingest.error || 'Unrecognized SMS' });
    }

    return reply.status(ingest.isDuplicate ? 200 : 201).send({
      success: true,
      isDuplicate: ingest.isDuplicate || false,
      trxId: ingest.parsed?.trxId,
      amount: ingest.parsed?.amount,
    });
  });

  /**
   * Device Heartbeat Endpoint
   */
  fastify.post('/api/v1/device/heartbeat', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { device_token?: string; device_id?: string };
    const token = body?.device_token || body?.device_id;
    if (!token) {
      return reply.status(400).send({ success: false, error: 'device_token or device_id required' });
    }

    const auth = await DeviceService.authenticateDevice(token);
    if (!auth.authenticated || !auth.device) {
      return reply.status(401).send({ success: false, error: 'Device not found' });
    }

    await DeviceService.recordHeartbeat(token);
    return reply.send({ success: true, status: 'ONLINE', device_name: auth.device.device_name });
  });
}
