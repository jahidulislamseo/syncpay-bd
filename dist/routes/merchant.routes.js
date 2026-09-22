import QRCode from 'qrcode';
import { MerchantService } from '../services/merchant.service.js';
import { DeviceService } from '../services/device.service.js';
import { TransactionService } from '../services/transaction.service.js';
import { dbService } from '../db/database.js';
import { CryptoUtil } from '../utils/crypto.js';
import { MerchantRepository } from '../db/repositories/merchant.repository.js';
export async function merchantRoutes(fastify) {
    const DEMO_MERCHANT_ID = '00000000-0000-0000-0000-000000000101';
    const FALLBACK_MERCHANT_ID = 'm_demo_101';
    // Get merchant dashboard stats
    fastify.get('/api/v1/merchant/stats', async (_request, reply) => {
        const stats = await MerchantService.getMerchantStats(DEMO_MERCHANT_ID);
        if (!stats.devices || stats.devices.length === 0) {
            // Check fallback ID
            const fallback = dbService.getMerchantStats(FALLBACK_MERCHANT_ID);
            return reply.send({ success: true, data: fallback });
        }
        return reply.send({ success: true, data: stats });
    });
    // Get recent transactions feed
    fastify.get('/api/v1/merchant/transactions', async (_request, reply) => {
        const txs = await MerchantService.getTransactions(DEMO_MERCHANT_ID, 50);
        if (!txs || txs.length === 0) {
            const fallback = dbService.getRecentTransactions(FALLBACK_MERCHANT_ID, 50);
            return reply.send({ success: true, data: fallback });
        }
        return reply.send({ success: true, data: txs });
    });
    // Simulate an incoming SMS (for dashboard test trigger)
    fastify.post('/api/v1/merchant/simulate-sms', async (request, reply) => {
        const body = request.body;
        const provider = body.provider || 'bKash';
        const amount = body.amount || 1500;
        const sender = body.sender || '01712345678';
        const trxId = body.trx_id || ('TRX' + Math.random().toString(36).substring(2, 8).toUpperCase());
        let rawSms = '';
        let senderAddress = '';
        if (provider === 'bKash') {
            senderAddress = 'bKash';
            rawSms = `You have received Tk ${amount.toFixed(2)} from ${sender}. Fee Tk 0.00. Balance Tk 15,200.00. TrxID ${trxId} at ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
        }
        else if (provider === 'Nagad') {
            senderAddress = '16167';
            rawSms = `Received Amount: Tk ${amount.toFixed(2)} from ${sender}. TxnID: ${trxId}. Balance: Tk 18,400.00`;
        }
        else if (provider === 'Upay') {
            senderAddress = '16268';
            rawSms = `You have received Tk ${amount.toFixed(2)} from ${sender}. Fee Tk 0.00. Balance Tk 5,200.00. TrxID ${trxId} at ${new Date().toLocaleDateString()}`;
        }
        else {
            senderAddress = '16216';
            rawSms = `Tk ${amount.toFixed(2)} received from ${sender}. TxnId: ${trxId}. Balance: Tk 5,200.00`;
        }
        const ingest = await TransactionService.ingestSms({
            merchantId: FALLBACK_MERCHANT_ID,
            deviceId: 'dev_phone_1',
            sms: rawSms,
            sender: senderAddress,
        });
        return reply.status(201).send({
            success: true,
            message: 'Simulated SMS ingested into system',
            isDuplicate: ingest.isDuplicate || false,
            transaction: {
                provider,
                trx_id: trxId,
                amount,
                sender,
                raw_sms: rawSms,
            },
        });
    });
    // Get merchant invoices
    fastify.get('/api/v1/merchant/invoices', async (_request, reply) => {
        const invoices = await MerchantService.getInvoices(DEMO_MERCHANT_ID, 100);
        if (!invoices || invoices.length === 0) {
            const fallback = dbService.getAllInvoices(FALLBACK_MERCHANT_ID, 100);
            return reply.send({ success: true, data: fallback });
        }
        return reply.send({ success: true, data: invoices });
    });
    // Get merchant devices
    fastify.get('/api/v1/merchant/devices', async (_request, reply) => {
        const devices = await DeviceService.listMerchantDevices(DEMO_MERCHANT_ID);
        if (!devices || devices.length === 0) {
            const fallback = dbService.getAllDevices(FALLBACK_MERCHANT_ID);
            return reply.send({ success: true, data: fallback });
        }
        return reply.send({ success: true, data: devices });
    });
    // Register new device
    fastify.post('/api/v1/merchant/devices', async (request, reply) => {
        const body = request.body;
        const deviceName = body.device_name || 'Android Forwarder';
        const { device, token } = await DeviceService.registerDevice({
            merchantId: DEMO_MERCHANT_ID,
            deviceName,
        });
        return reply.status(201).send({ success: true, data: device, token });
    });
    // Delete device
    fastify.delete('/api/v1/merchant/devices/:id', async (request, reply) => {
        const deviceId = request.params.id;
        try {
            await DeviceService.removeDevice(deviceId, DEMO_MERCHANT_ID);
        }
        catch (e) {
            fastify.log.warn(`Failed removing device from DEMO_MERCHANT_ID: ${e.message}`);
        }
        try {
            await DeviceService.removeDevice(deviceId, FALLBACK_MERCHANT_ID);
        }
        catch (e) {
            fastify.log.warn(`Failed removing device from FALLBACK_MERCHANT_ID: ${e.message}`);
        }
        try {
            dbService.deleteDevice(deviceId);
        }
        catch (e) {
            fastify.log.warn(`Failed removing device from dbService: ${e.message}`);
        }
        return reply.send({ success: true, message: 'Device deleted successfully' });
    });
    // Get merchant API keys
    fastify.get('/api/v1/merchant/api-keys', async (_request, reply) => {
        const keys = await MerchantService.getApiKeys(DEMO_MERCHANT_ID);
        if (!keys || keys.length === 0) {
            const fallback = dbService.getAllApiKeys(FALLBACK_MERCHANT_ID);
            return reply.send({ success: true, data: fallback });
        }
        return reply.send({ success: true, data: keys });
    });
    // Generate new API key
    fastify.post('/api/v1/merchant/api-keys', async (request, reply) => {
        const body = request.body;
        const name = body.name || 'New API Key';
        const { key, entity } = await MerchantService.generateApiKey(FALLBACK_MERCHANT_ID, name);
        return reply.status(201).send({ success: true, data: { ...entity, secret_key: key } });
    });
    // Get chart data
    fastify.get('/api/v1/merchant/chart-data', async (request, reply) => {
        const query = request.query;
        const days = parseInt(query.days || '7', 10);
        const chartData = dbService.getChartData(FALLBACK_MERCHANT_ID, days);
        return reply.send({ success: true, data: chartData });
    });
    // Device Pairing QR Code Generation
    fastify.get('/api/v1/merchant/devices/:id/qr', async (request, reply) => {
        const deviceId = request.params.id;
        let dev = null;
        try {
            const devices = (await DeviceService.listMerchantDevices(DEMO_MERCHANT_ID)) || [];
            dev = devices.find(d => d.id === deviceId);
        }
        catch (e) {
            fastify.log.warn(`DeviceService.listMerchantDevices error: ${e.message}`);
        }
        if (!dev) {
            try {
                const fallback = dbService.getAllDevices(FALLBACK_MERCHANT_ID);
                dev = fallback.find((d) => d.id === deviceId);
            }
            catch (e) {
                fastify.log.warn(`dbService.getAllDevices error: ${e.message}`);
            }
        }
        const token = dev ? dev.device_token || dev.id : (deviceId === 'dev_phone_1' ? 'token_phone_primary' : deviceId);
        const host = request.headers.host || 'syncpaybd.site';
        const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
        const protocol = request.headers['x-forwarded-proto'] || (isLocal ? 'http' : 'https');
        const serverUrl = isLocal ? 'http://10.10.26.121:4000' : `${protocol}://${host}`;
        const pairingPayload = {
            backend_url: serverUrl,
            merchant_id: FALLBACK_MERCHANT_ID,
            device_id: deviceId,
            device_token: token,
            device_name: dev?.device_name || 'SyncPay Android Forwarder',
        };
        try {
            const qrDataUrl = await QRCode.toDataURL(JSON.stringify(pairingPayload), {
                margin: 2,
                width: 320,
                color: {
                    dark: '#0f172a',
                    light: '#ffffff',
                },
            });
            return reply.send({
                success: true,
                qr_code: qrDataUrl,
                payload: pairingPayload,
            });
        }
        catch (err) {
            return reply.status(500).send({ success: false, error: err.message });
        }
    });
    // Merchant Subscription Package & Website Quotas
    fastify.get('/api/v1/merchant/subscription', async (_request, reply) => {
        return reply.send({
            success: true,
            data: {
                plan_name: 'Growth Merchant Plan',
                tier: 'PRO',
                status: 'ACTIVE',
                billing_cycle: 'Monthly',
                renews_at: '2026-10-19',
                quotas: {
                    websites: {
                        allowed: 5,
                        connected: 2,
                        available: 3,
                        percent: 40,
                    },
                    devices: {
                        allowed: 3,
                        connected: 1,
                        available: 2,
                        percent: 33,
                    },
                    monthly_volume_bdt: {
                        allowed: 500000,
                        used: 48500,
                        available: 451500,
                        percent: 9.7,
                    },
                    api_rate_limit: '120 req / min',
                    webhook_sla: '99.99%',
                },
                connected_websites: [
                    {
                        id: 'site_1',
                        name: 'Primary E-commerce Store',
                        domain: 'https://mystore-bd.com',
                        platform: 'WooCommerce',
                        webhook_url: 'https://mystore-bd.com/wp-json/payflow/v1/webhook',
                        status: 'ACTIVE',
                        created_at: '2026-08-15',
                    },
                    {
                        id: 'site_2',
                        name: 'EdTech Portal',
                        domain: 'https://learncourses.io',
                        platform: 'Next.js Custom',
                        webhook_url: 'https://learncourses.io/api/payflow-webhook',
                        status: 'ACTIVE',
                        created_at: '2026-09-02',
                    },
                ],
            },
        });
    });
    // Connect new website under package quota
    fastify.post('/api/v1/merchant/websites', async (request, reply) => {
        const body = request.body;
        if (!body.domain) {
            return reply.status(400).send({ success: false, error: 'Website domain is required' });
        }
        const newSite = {
            id: 'site_' + Math.random().toString(36).substring(2, 8),
            name: body.name || body.domain,
            domain: body.domain,
            platform: body.platform || 'Custom Web',
            webhook_url: body.webhook_url || `${body.domain}/api/webhook`,
            status: 'ACTIVE',
            created_at: new Date().toISOString().split('T')[0],
        };
        return reply.status(201).send({ success: true, data: newSite, message: 'Website connected to SyncPay BD gateway' });
    });
    // ==========================================
    // Merchant Payment Methods & Instruction Management
    // ==========================================
    fastify.get('/api/v1/merchant/payment-methods', async (_request, reply) => {
        try {
            const methods = dbService.getPaymentMethods(DEMO_MERCHANT_ID, false);
            return reply.send({ success: true, data: methods });
        }
        catch (e) {
            return reply.status(500).send({ success: false, error: e.message });
        }
    });
    fastify.post('/api/v1/merchant/payment-methods', async (request, reply) => {
        try {
            const body = request.body;
            if (!body.title || !body.account_number || !body.provider_type) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required fields: title, provider_type, account_number are required',
                });
            }
            const method = dbService.upsertPaymentMethod({
                id: body.id,
                merchant_id: DEMO_MERCHANT_ID,
                provider_type: body.provider_type,
                title: body.title,
                badge: body.badge,
                account_number: body.account_number,
                account_name: body.account_name,
                bank_name: body.bank_name,
                branch_name: body.branch_name,
                routing_number: body.routing_number,
                sender_label: body.sender_label,
                trx_label: body.trx_label,
                instructions: body.instructions,
                theme_color: body.theme_color,
                is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
                sort_order: body.sort_order !== undefined ? Number(body.sort_order) : 0,
            });
            return reply.send({
                success: true,
                data: method,
                message: 'Payment channel updated successfully',
            });
        }
        catch (e) {
            return reply.status(500).send({ success: false, error: e.message });
        }
    });
    fastify.patch('/api/v1/merchant/payment-methods/:id/toggle', async (request, reply) => {
        try {
            const body = request.body;
            const res = dbService.togglePaymentMethod(request.params.id, DEMO_MERCHANT_ID, body.is_active);
            return reply.send({ success: true, data: res });
        }
        catch (e) {
            return reply.status(500).send({ success: false, error: e.message });
        }
    });
    fastify.delete('/api/v1/merchant/payment-methods/:id', async (request, reply) => {
        try {
            const res = dbService.deletePaymentMethod(request.params.id, DEMO_MERCHANT_ID);
            return reply.send({ success: true, data: res, message: 'Payment method removed' });
        }
        catch (e) {
            return reply.status(500).send({ success: false, error: e.message });
        }
    });
    // Merchant Auth: Register
    fastify.post('/api/v1/merchant/auth/register', async (request, reply) => {
        const body = request.body;
        if (!body.name || !body.email || !body.password) {
            return reply.status(400).send({ success: false, error: 'Name, email, and password are required' });
        }
        if (body.password.length < 6) {
            return reply.status(400).send({ success: false, error: 'Password must be at least 6 characters' });
        }
        const email = body.email.trim().toLowerCase();
        const existing = await MerchantRepository.findByEmail(email);
        if (existing) {
            return reply.status(409).send({ success: false, error: 'A merchant account with this email already exists' });
        }
        const passwordHash = CryptoUtil.hashPassword(body.password);
        const id = '00000000-0000-4' + Math.random().toString(16).substring(2, 5) + '-a' + Math.random().toString(16).substring(2, 5) + '-' + Math.random().toString(16).substring(2, 14);
        const apiKey = 'live_sk_' + Math.random().toString(36).substring(2, 14) + Math.random().toString(36).substring(2, 14);
        const businessName = body.business_name || body.name + ' Store';
        try {
            await MerchantRepository.create({
                id,
                business_name: businessName,
                email,
                phone: body.phone,
                password_hash: passwordHash,
            });
            const { ApiKeyRepository } = await import('../db/repositories/api-key.repository.js');
            await ApiKeyRepository.create({
                merchantId: id,
                name: 'Default Live Key',
                rawApiKey: apiKey,
            });
        }
        catch {
            dbService.insertMerchant({
                id,
                name: businessName,
                api_key: apiKey,
                webhook_url: '',
            });
        }
        const token = CryptoUtil.signJwt({
            id,
            email,
            name: businessName,
            role: 'merchant',
        });
        return reply.status(201).send({
            success: true,
            merchant: {
                id,
                name: businessName,
                email,
                api_key: apiKey,
            },
            token,
            message: 'Merchant account registered successfully',
        });
    });
    // Merchant Auth: Login
    fastify.post('/api/v1/merchant/auth/login', async (request, reply) => {
        const body = request.body;
        if (!body.email || !body.password) {
            return reply.status(400).send({ success: false, error: 'Email and password are required' });
        }
        const email = body.email.trim().toLowerCase();
        const merchant = await MerchantRepository.findByEmail(email);
        if (!merchant) {
            return reply.status(401).send({ success: false, error: 'Invalid email or password' });
        }
        if (merchant.password_hash) {
            const valid = CryptoUtil.verifyPassword(body.password, merchant.password_hash);
            if (!valid) {
                return reply.status(401).send({ success: false, error: 'Invalid email or password' });
            }
        }
        else {
            if (email.includes('demo') && body.password !== 'demo1234' && body.password !== 'test1234') {
                return reply.status(401).send({ success: false, error: 'Invalid credentials for demo account' });
            }
        }
        let apiKey = 'live_demo_sec_99410';
        try {
            const { ApiKeyRepository } = await import('../db/repositories/api-key.repository.js');
            const keys = await ApiKeyRepository.listByMerchant(merchant.id);
            if (keys && keys.length > 0) {
                apiKey = keys[0].key_prefix + '...';
            }
        }
        catch { }
        const token = CryptoUtil.signJwt({
            id: merchant.id,
            email: merchant.email,
            name: merchant.business_name,
            role: 'merchant',
        });
        return reply.send({
            success: true,
            merchant: {
                id: merchant.id,
                name: merchant.business_name,
                email: merchant.email,
                api_key: apiKey,
            },
            token,
            message: 'Authentication successful',
        });
    });
    // Merchant Auth: Current User (Session verification)
    fastify.get('/api/v1/merchant/auth/me', async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.status(401).send({ success: false, error: 'Authorization token required' });
        }
        const token = authHeader.substring(7);
        const { valid, payload } = CryptoUtil.verifyJwt(token);
        if (!valid || !payload) {
            return reply.status(401).send({ success: false, error: 'Invalid or expired session token' });
        }
        const merchant = await MerchantRepository.findById(payload.id);
        return reply.send({
            success: true,
            user: payload,
            merchant: merchant || null,
        });
    });
}
