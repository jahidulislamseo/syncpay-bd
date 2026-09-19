import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { deviceRoutes } from './routes/device.routes.js';
import { paymentRoutes } from './routes/payment.routes.js';
import { merchantRoutes } from './routes/merchant.routes.js';
import { adminRoutes } from './routes/admin.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = Fastify({
  logger: true,
});

// Enable CORS
await server.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
});

// Allow empty json body gracefully without FST_ERR_CTP_EMPTY_JSON_BODY
server.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  if (!body || typeof body !== 'string' || body.trim() === '') {
    done(null, {});
    return;
  }
  try {
    const json = JSON.parse(body);
    done(null, json);
  } catch (err: any) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

// Serve Static Frontend (Dashboard & Checkout UI)
await server.register(fastifyStatic, {
  root: path.resolve(__dirname, '../public'),
  prefix: '/',
});

// Register API Route Modules
await server.register(deviceRoutes);
await server.register(paymentRoutes);
await server.register(merchantRoutes);
await server.register(adminRoutes);

// Health check
server.get('/health', async () => {
  return { status: 'OK', timestamp: new Date().toISOString(), system: 'SyncPay BD Gateway', domain: 'syncpaybd.xyz' };
});

// Canonical Clean URL Hook: Redirect any *.html request to its clean URL (301 Permanent Redirect)
server.addHook('onRequest', async (req, reply) => {
  const rawUrl = req.raw.url || '';
  const [pathname, search] = rawUrl.split('?');
  if (pathname && pathname.endsWith('.html')) {
    let cleanPath = pathname.slice(0, -5);
    if (cleanPath === '/index') {
      cleanPath = '/';
    }
    const target = cleanPath + (search ? `?${search}` : '');
    return reply.code(301).redirect(target);
  }
});

// Dashboard & App clean routes (serve HTML directly without extension in URL)
server.get('/dashboard', async (_req, reply) => {
  return reply.type('text/html').sendFile('dashboard.html');
});

server.get('/admin', async (_req, reply) => {
  return reply.type('text/html').sendFile('admin.html');
});

server.get('/checkout', async (_req, reply) => {
  return reply.type('text/html').sendFile('checkout.html');
});

server.get('/download', async (_req, reply) => {
  return reply.type('text/html').sendFile('download.html');
});

server.get('/app', async (_req, reply) => {
  return reply.type('text/html').sendFile('download.html');
});

server.get('/docs/api', async (_req, reply) => {
  return reply.type('text/html').sendFile('docs/api.html');
});

server.get('/docs/trx-verification', async (_req, reply) => {
  return reply.type('text/html').sendFile('docs/trx-verification.html');
});

server.get('/docs/webhook', async (_req, reply) => {
  return reply.type('text/html').sendFile('docs/webhook.html');
});

const PORT = Number(process.env.PORT) || 4000;
const HOST = '0.0.0.0';

try {
  await server.listen({ port: PORT, host: HOST });
  console.log(`\n======================================================`);
  console.log(`🚀 SyncPay BD Engine running at: http://localhost:${PORT}`);
  console.log(`📊 Dashboard & Checkout UI:       http://localhost:${PORT}/`);
  console.log(`🌐 Production Domain:             https://syncpaybd.xyz`);
  console.log(`======================================================\n`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
