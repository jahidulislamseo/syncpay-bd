import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rateLimit from '@fastify/rate-limit';
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
// Rate limiting to prevent brute-force attacks and DDoS
await server.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1', 'localhost'],
    keyGenerator: (req) => {
        const xff = req.headers['x-forwarded-for'];
        if (typeof xff === 'string') {
            return xff.split(',')[0].trim();
        }
        return req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
    },
    errorResponseBuilder: (_req, context) => ({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
    }),
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
    }
    catch (err) {
        err.statusCode = 400;
        done(err, undefined);
    }
});
// Register API Route Modules
await server.register(deviceRoutes);
await server.register(paymentRoutes);
await server.register(merchantRoutes);
await server.register(adminRoutes);
// Health check
server.get('/health', async (req) => {
    const indexHtmlPath = path.join(publicDir, 'index.html');
    let publicFiles = [];
    try {
        publicFiles = fs.readdirSync(publicDir);
    }
    catch (e) {
        publicFiles = [e.message];
    }
    return {
        status: 'OK',
        publicDir,
        publicFiles,
        indexExists: fs.existsSync(indexHtmlPath),
        indexLength: indexHtmlContent ? indexHtmlContent.length : 0,
        system: 'SyncPay BD Gateway',
    };
});
import fs from 'node:fs';
const publicDir = fs.existsSync(path.resolve(__dirname, '../public'))
    ? path.resolve(__dirname, '../public')
    : fs.existsSync(path.resolve(__dirname, 'public'))
        ? path.resolve(__dirname, 'public')
        : path.resolve(process.cwd(), 'public');
await server.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
    index: false,
});
const indexHtmlPath = path.join(publicDir, 'index.html');
const indexHtmlContent = fs.existsSync(indexHtmlPath) ? fs.readFileSync(indexHtmlPath, 'utf8') : '';
// Canonical Non-WWW & Clean URL Hook: Redirect any www.* or *.html request (301 Permanent Redirect)
server.addHook('onRequest', async (req, reply) => {
    // 1. Enforce Non-WWW Canonical Domain (e.g. www.syncpaybd.site -> syncpaybd.site)
    const host = req.headers.host;
    if (host && /^www\./i.test(host)) {
        const nonWwwHost = host.replace(/^www\./i, '');
        const proto = req.headers['x-forwarded-proto'] || 'https';
        return reply.code(301).redirect(`${proto}://${nonWwwHost}${req.raw.url || req.url}`);
    }
    // 2. Enforce Extensionless Clean URLs (e.g. /dashboard.html -> /dashboard)
    const rawUrl = req.raw.url || req.url || '';
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
server.get('/test-hello', async () => {
    return 'hello world';
});
server.get('/test-index', async (_req, reply) => {
    return reply.type('text/html').sendFile('index.html');
});
server.get('/', async (_req, reply) => {
    return reply.type('text/html').sendFile('index.html');
});
server.get('/index', async (_req, reply) => {
    return reply.type('text/html').sendFile('index.html');
});
server.get('/login', async (_req, reply) => {
    return reply.type('text/html').sendFile('login.html');
});
server.get('/dashboard', async (_req, reply) => {
    return reply.type('text/html').sendFile('dashboard.html');
});
server.get('/admin', async (_req, reply) => {
    return reply.type('text/html').sendFile('admin.html');
});
server.get('/checkout', async (_req, reply) => {
    return reply.type('text/html').sendFile('checkout.html');
});
server.get('/checkout/:slug', async (_req, reply) => {
    return reply.type('text/html').sendFile('checkout.html');
});
server.get('/pay/:slug', async (_req, reply) => {
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
if (!process.env.VERCEL) {
    try {
        await server.listen({ port: PORT, host: HOST });
        console.log(`\n======================================================`);
        console.log(`🚀 SyncPay BD Engine running at: http://localhost:${PORT}`);
        console.log(`📊 Dashboard & Checkout UI:       http://localhost:${PORT}/`);
        console.log(`🌐 Production Domain:             https://syncpaybd.site`);
        console.log(`======================================================\n`);
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
}
export default server;
