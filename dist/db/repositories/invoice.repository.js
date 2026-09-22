import { getSupabaseClient, isSupabaseConfigured } from '../supabase.js';
import { dbService } from '../database.js';
export class InvoiceRepository {
    static async create(params) {
        const supabase = getSupabaseClient();
        const expiresAt = new Date(Date.now() + (params.expiresInMinutes || 30) * 60000).toISOString();
        if (supabase && isSupabaseConfigured()) {
            const payload = {
                merchant_id: params.merchantId,
                invoice_id: params.invoiceId,
                customer_name: params.customerName,
                amount: params.amount,
                redirect_url: params.redirectUrl || null,
                webhook_url: params.webhookUrl || null,
                customer_email: params.customerEmail || null,
                status: 'PENDING',
                expires_at: expiresAt,
            };
            if (params.id)
                payload.id = params.id;
            const { data, error } = await supabase
                .from('invoices')
                .insert(payload)
                .select()
                .single();
            if (error)
                throw new Error(error.message);
            return {
                ...data,
                customer_email: params.customerEmail || null,
            };
        }
        // Local SQLite fallback
        const local = dbService.createInvoice({
            id: params.invoiceId,
            merchantId: params.merchantId,
            customerName: params.customerName,
            customerEmail: params.customerEmail,
            expectedAmount: params.amount,
            redirectUrl: params.redirectUrl,
            webhookUrl: params.webhookUrl,
            expiresInMinutes: params.expiresInMinutes,
        });
        return {
            id: local.id,
            merchant_id: local.merchant_id,
            invoice_id: local.id,
            customer_name: local.customer_name,
            customer_email: local.customer_email || params.customerEmail || null,
            amount: local.expected_amount,
            redirect_url: local.redirect_url,
            webhook_url: local.webhook_url,
            status: local.status,
            trx_id: local.trx_id || null,
            payment_method: local.payment_method || null,
            expires_at: local.expires_at,
            created_at: local.created_at,
        };
    }
    static async findByInvoiceId(invoiceId) {
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId);
            let query = supabase.from('invoices').select('*');
            if (isUuid) {
                query = query.or(`invoice_id.eq.${invoiceId},id.eq.${invoiceId}`);
            }
            else {
                query = query.eq('invoice_id', invoiceId);
            }
            const { data, error } = await query.maybeSingle();
            if (!error && data) {
                return data;
            }
        }
        const local = dbService.getInvoiceById(invoiceId);
        if (local) {
            return {
                id: local.id,
                merchant_id: local.merchant_id,
                invoice_id: local.id,
                customer_name: local.customer_name,
                customer_email: local.customer_email || null,
                amount: local.expected_amount,
                redirect_url: local.redirect_url,
                webhook_url: local.webhook_url,
                status: local.status,
                trx_id: local.trx_id || null,
                payment_method: local.payment_method || null,
                expires_at: local.expires_at,
                created_at: local.created_at,
            };
        }
        return null;
    }
    static async findPendingByMerchantAndAmount(merchantId, amount) {
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('invoices')
                .select('*')
                .eq('merchant_id', merchantId)
                .eq('amount', amount)
                .eq('status', 'PENDING')
                .order('created_at', { ascending: true });
            if (!error && data) {
                return data;
            }
        }
        const locals = dbService.getPendingInvoicesForMerchant(merchantId, amount);
        return locals.map((l) => ({
            id: l.id,
            merchant_id: l.merchant_id,
            invoice_id: l.id,
            customer_name: l.customer_name,
            customer_email: l.customer_email || null,
            amount: l.expected_amount,
            redirect_url: l.redirect_url,
            webhook_url: l.webhook_url,
            status: l.status,
            trx_id: l.trx_id || null,
            payment_method: l.payment_method || null,
            expires_at: l.expires_at,
            created_at: l.created_at,
        }));
    }
    static async updateStatus(invoiceId, status, trxId, paymentMethod) {
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId);
            const updateData = {
                status,
                updated_at: new Date().toISOString(),
            };
            if (trxId)
                updateData.trx_id = trxId;
            if (paymentMethod)
                updateData.payment_method = paymentMethod;
            let query = supabase.from('invoices').update(updateData);
            if (isUuid) {
                query = query.or(`invoice_id.eq.${invoiceId},id.eq.${invoiceId}`);
            }
            else {
                query = query.eq('invoice_id', invoiceId);
            }
            await query;
        }
        dbService.updateInvoiceStatus(invoiceId, status === 'FAILED' ? 'EXPIRED' : status, trxId, paymentMethod);
    }
    static async listByMerchant(merchantId, limit = 50) {
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('invoices')
                .select('*')
                .eq('merchant_id', merchantId)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (!error && data) {
                return data;
            }
        }
        const locals = dbService.getAllInvoices(merchantId, limit);
        return locals.map((l) => ({
            id: l.id,
            merchant_id: l.merchant_id,
            invoice_id: l.id,
            customer_name: l.customer_name,
            customer_email: l.customer_email || null,
            amount: l.expected_amount,
            redirect_url: l.redirect_url,
            webhook_url: l.webhook_url,
            status: l.status,
            trx_id: l.trx_id || null,
            payment_method: l.payment_method || null,
            expires_at: l.expires_at,
            created_at: l.created_at,
        }));
    }
}
