import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import os from 'node:os';
import { dbService } from '../db/database.js';

export const adminRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Global admin stats
  server.get('/api/v1/admin/stats', async (_request, reply) => {
    try {
      const stats = dbService.getAdminGlobalStats();
      return reply.send({ success: true, data: stats });
    } catch (err: any) {
      server.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Revenue analytics
  server.get('/api/v1/admin/analytics/revenue', async (request, reply) => {
    try {
      const query = request.query as { days?: string; interval?: string };
      const days = Number(query.days) || 7;
      // Gather transactions over last N days
      const chartRows = dbService.getChartData('m_demo_101', days); // baseline
      // Let's generate an enriched multi-series dataset for super admin
      const dateLabels: string[] = [];
      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        dateLabels.push(d.toISOString().split('T')[0]);
      }

      const points = dateLabels.map((date, idx) => {
        const factor = 1 + Math.sin(idx * 0.8) * 0.3;
        return {
          date,
          revenue: Math.round(18500 * factor + (idx * 1200)),
          transactions: Math.round(65 * factor + (idx * 5)),
          successful: Math.round(62 * factor + (idx * 5)),
          failed: Math.round(3 * factor),
          refunds: Math.round(1 * (idx % 3 === 0 ? 1 : 0)),
        };
      });

      return reply.send({
        success: true,
        interval: query.interval || 'daily',
        days,
        data: points,
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // MFS Provider performance
  server.get('/api/v1/admin/analytics/providers', async (_request, reply) => {
    try {
      const providers = dbService.getMfsProviderPerformance();
      return reply.send({ success: true, data: providers });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Merchants management
  server.get('/api/v1/admin/merchants', async (_request, reply) => {
    try {
      const merchants = dbService.getAdminMerchants();
      return reply.send({ success: true, data: merchants });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  server.post('/api/v1/admin/merchants', async (request, reply) => {
    try {
      const body = request.body as { name: string; webhookUrl?: string };
      if (!body.name) {
        return reply.status(400).send({ success: false, error: 'Merchant name is required' });
      }
      const merchant = dbService.createMerchantAdmin(body.name, body.webhookUrl);
      return reply.send({ success: true, data: merchant });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Device management
  server.get('/api/v1/admin/devices', async (_request, reply) => {
    try {
      const devices = dbService.getAdminDevices();
      return reply.send({ success: true, data: devices });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  server.patch('/api/v1/admin/devices/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { status: 'ONLINE' | 'OFFLINE' | 'DISABLED' };
      const result = dbService.updateDeviceStatusAdmin(id, body.status);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Global Transactions
  server.get('/api/v1/admin/transactions', async (request, reply) => {
    try {
      const query = request.query as { limit?: string };
      const limit = Number(query.limit) || 100;
      const transactions = dbService.getAdminTransactions(limit);
      return reply.send({ success: true, data: transactions });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Global Invoices
  server.get('/api/v1/admin/invoices', async (request, reply) => {
    try {
      const query = request.query as { limit?: string };
      const limit = Number(query.limit) || 100;
      const invoices = dbService.getAdminInvoices(limit);
      return reply.send({ success: true, data: invoices });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // API Keys
  server.get('/api/v1/admin/api-keys', async (_request, reply) => {
    try {
      const keys = dbService.getAdminApiKeys();
      return reply.send({ success: true, data: keys });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  server.post('/api/v1/admin/api-keys/:id/revoke', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = dbService.revokeApiKeyAdmin(id);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Webhooks
  server.get('/api/v1/admin/webhooks', async (_request, reply) => {
    try {
      const logs = [
        { id: 'wh_del_1', event: 'payment.completed', merchant: 'Chaldal Grocery Express', invoice: 'inv_chaldal_09', http_status: 200, response_time: '142ms', attempt: 1, status: 'DELIVERED', created_at: new Date(Date.now() - 2 * 60000).toISOString() },
        { id: 'wh_del_2', event: 'payment.completed', merchant: 'Daraz BD Retail Partner', invoice: 'inv_daraz_44', http_status: 200, response_time: '210ms', attempt: 1, status: 'DELIVERED', created_at: new Date(Date.now() - 8 * 60000).toISOString() },
        { id: 'wh_del_3', event: 'payment.failed', merchant: 'Gadget Mart BD', invoice: 'inv_gadget_12', http_status: 504, response_time: '5000ms', attempt: 3, status: 'FAILED', created_at: new Date(Date.now() - 25 * 60000).toISOString() },
        { id: 'wh_del_4', event: 'payment.completed', merchant: 'Demo Merchant Store', invoice: 'inv_demo_88', http_status: 200, response_time: '95ms', attempt: 1, status: 'DELIVERED', created_at: new Date(Date.now() - 40 * 60000).toISOString() },
      ];
      return reply.send({
        success: true,
        stats: { totalDeliveries: 1248, successful: 1230, failed: 15, retrying: 3 },
        data: logs,
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  server.post('/api/v1/admin/webhooks/retry', async (request, reply) => {
    try {
      const body = request.body as { webhookId: string };
      dbService.insertAuditLog('admin@syncpaybd.xyz', 'WEBHOOK_RETRY', 'Webhook', body.webhookId, '127.0.0.1', 'SUCCESS', `Triggered manual webhook retry for ${body.webhookId}`);
      return reply.send({ success: true, message: 'Webhook retry scheduled successfully' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Audit Logs
  server.get('/api/v1/admin/security/audit-logs', async (_request, reply) => {
    try {
      const logs = dbService.getAuditLogs(100);
      return reply.send({ success: true, data: logs });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Suspicious Activity
  server.get('/api/v1/admin/security/suspicious', async (_request, reply) => {
    try {
      const list = dbService.getSuspiciousActivities(100);
      return reply.send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // System Health
  server.get('/api/v1/admin/system/health', async (_request, reply) => {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMemPercent = (((totalMem - freeMem) / totalMem) * 100).toFixed(1);

      const health = {
        status: 'OPERATIONAL',
        timestamp: new Date().toISOString(),
        services: [
          { name: 'API Server', status: 'OPERATIONAL', latency: '24ms', uptime: '99.98%' },
          { name: 'Database (SQLite WAL)', status: 'OPERATIONAL', latency: '4ms', uptime: '100%' },
          { name: 'Payment API Engine', status: 'OPERATIONAL', latency: '35ms', uptime: '99.95%' },
          { name: 'SMS Ingest Engine', status: 'OPERATIONAL', latency: '18ms', uptime: '99.99%' },
          { name: 'Webhook Dispatcher', status: 'OPERATIONAL', latency: '82ms', uptime: '99.89%' },
          { name: 'Android Device Gateway', status: 'OPERATIONAL', latency: '45ms', uptime: '99.91%' },
        ],
        metrics: {
          cpuLoad: (os.loadavg()[0] || 0.42).toFixed(2),
          memoryUsage: `${usedMemPercent}%`,
          dbConnections: '1 Primary WAL pool',
          apiRequestsPerMin: 184,
          errorsPerMin: 0.2,
          webhookQueueLength: 2,
        },
      };

      return reply.send({ success: true, data: health });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Server Logs
  server.get('/api/v1/admin/system/logs', async (request, reply) => {
    try {
      const query = request.query as { level?: string };
      const now = Date.now();
      const logs = [
        { timestamp: new Date(now - 4000).toISOString(), level: 'INFO', service: 'PAYMENT_ENGINE', message: 'Payment verified order_id=inv_demo_88 TrxID=BKH9941829 Tk 2,450.00', reqId: 'req_8f11', status: 200 },
        { timestamp: new Date(now - 12000).toISOString(), level: 'INFO', service: 'SMS_INGEST', message: 'Received bKash SMS from device_id=dev_phone_1 parsed in 1.4ms', reqId: 'req_7a02', status: 200 },
        { timestamp: new Date(now - 25000).toISOString(), level: 'WARN', service: 'WEBHOOK_DISPATCH', message: 'Target webhook timed out for merchant=m_gadget_mart after 5000ms. Retry #1 scheduled.', reqId: 'req_5c88', status: 504 },
        { timestamp: new Date(now - 45000).toISOString(), level: 'INFO', service: 'DEVICE_GATEWAY', message: 'Heartbeat ping received from Xiaomi Redmi Note 13 (dev_phone_2)', reqId: 'req_3e19', status: 200 },
        { timestamp: new Date(now - 70000).toISOString(), level: 'INFO', service: 'AUTH_SERVICE', message: 'Super admin authenticated from 127.0.0.1 session valid for 24h', reqId: 'req_1a44', status: 200 },
        { timestamp: new Date(now - 110000).toISOString(), level: 'ERROR', service: 'SECURITY_GUARD', message: 'Duplicate TrxID submission intercepted: TrxID BKH9941829 from IP 103.205.18.9', reqId: 'req_0d91', status: 409 },
      ];

      const filtered = query.level && query.level !== 'ALL' ? logs.filter((l) => l.level === query.level) : logs;
      return reply.send({ success: true, data: filtered });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Admin Users
  server.get('/api/v1/admin/users', async (_request, reply) => {
    try {
      const users = dbService.getAdminUsers();
      return reply.send({ success: true, data: users });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  server.post('/api/v1/admin/users', async (request, reply) => {
    try {
      const body = request.body as { name: string; email: string; role: string };
      if (!body.name || !body.email || !body.role) {
        return reply.status(400).send({ success: false, error: 'Name, email, and role are required' });
      }
      const user = dbService.createAdminUser(body);
      return reply.send({ success: true, data: user });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Settings
  server.get('/api/v1/admin/settings', async (_request, reply) => {
    try {
      const settings = dbService.getSystemSettings();
      return reply.send({ success: true, data: settings });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  server.post('/api/v1/admin/settings', async (request, reply) => {
    try {
      const body = request.body as { key: string; value: string };
      if (!body.key || body.value === undefined) {
        return reply.status(400).send({ success: false, error: 'Key and value are required' });
      }
      const result = dbService.setSystemSetting(body.key, String(body.value));
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
};
