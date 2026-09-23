import { getSupabaseClient, isSupabaseConfigured } from '../supabase.js';
import { dbService } from '../database.js';
export class MerchantRepository {
    static async findById(id) {
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
            const targetId = isUuid ? id : '00000000-0000-0000-0000-000000000101';
            const { data, error } = await supabase
                .from('merchants')
                .select('*')
                .eq('id', targetId)
                .maybeSingle();
            if (!error && data) {
                const local = dbService.getMerchantById(id);
                return {
                    ...data,
                    id: id,
                    brand_slug: data.brand_slug || local?.brand_slug || null,
                    custom_domain: data.custom_domain || local?.custom_domain || null,
                    has_custom_domain: data.has_custom_domain !== undefined ? data.has_custom_domain : (local?.has_custom_domain || 0),
                    brand_logo_url: data.brand_logo_url || local?.brand_logo_url || null,
                };
            }
        }
        // Fallback to local SQLite store
        const local = dbService.getMerchantById(id);
        if (local) {
            return {
                id: local.id,
                business_name: local.name,
                email: local.email || 'merchant@example.com',
                phone: local.phone || null,
                status: local.status || 'ACTIVE',
                plan: local.plan || 'FREE',
                payment_status: local.payment_status || 'FREE',
                payment_note: local.payment_note || null,
                webhook_url: local.webhook_url,
                password_hash: local.password_hash || null,
                brand_slug: local.brand_slug || null,
                custom_domain: local.custom_domain || null,
                has_custom_domain: local.has_custom_domain || 0,
                brand_logo_url: local.brand_logo_url || null,
            };
        }
        return null;
    }
    static async findByEmail(email) {
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('merchants')
                .select('*')
                .eq('email', email)
                .maybeSingle();
            if (!error && data) {
                return data;
            }
        }
        // Local SQLite fallback
        const all = dbService.getAdminMerchants();
        const local = all.find((m) => m.email === email || m.id === email || m.name.toLowerCase() === email.toLowerCase());
        if (local) {
            return {
                id: local.id,
                business_name: local.name,
                email: local.email || email,
                phone: local.phone || null,
                status: local.status || 'ACTIVE',
                plan: local.plan || 'FREE',
                payment_status: local.payment_status || 'FREE',
                payment_note: local.payment_note || null,
                webhook_url: local.webhook_url,
                password_hash: local.password_hash || null,
            };
        }
        // Check demo accounts
        if (email === 'demo@syncpaybd.site' || email === 'merchant@example.com') {
            return {
                id: '00000000-0000-0000-0000-000000000101',
                business_name: 'Demo Merchant Store',
                email,
                status: 'ACTIVE',
                plan: 'PRO',
                payment_status: 'PAID',
            };
        }
        return null;
    }
    static async create(params) {
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const payload = {
                business_name: params.business_name,
                email: params.email,
                phone: params.phone || null,
                password_hash: params.password_hash || null,
                webhook_url: params.webhook_url || null,
                redirect_url: params.redirect_url || null,
                status: 'ACTIVE',
            };
            if (params.id)
                payload.id = params.id;
            const { data, error } = await supabase
                .from('merchants')
                .insert(payload)
                .select()
                .single();
            if (error)
                throw new Error(error.message);
            return data;
        }
        // Local SQLite fallback
        const id = params.id || 'm_' + Math.random().toString(36).substring(2, 10);
        const merchant = {
            id,
            business_name: params.business_name,
            email: params.email,
            phone: params.phone || null,
            password_hash: params.password_hash || null,
            status: 'ACTIVE',
            webhook_url: params.webhook_url || null,
            redirect_url: params.redirect_url || null,
        };
        return merchant;
    }
    static async findBySlug(slug) {
        if (!slug)
            return null;
        const cleanSlug = slug.toLowerCase().trim();
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('merchants')
                .select('*')
                .eq('brand_slug', cleanSlug)
                .maybeSingle();
            if (!error && data) {
                return data;
            }
        }
        const local = dbService.getMerchantBySlug(cleanSlug);
        if (local) {
            return {
                id: local.id,
                business_name: local.name,
                email: local.email || 'merchant@example.com',
                phone: local.phone || null,
                status: local.status || 'ACTIVE',
                plan: local.plan || 'FREE',
                payment_status: local.payment_status || 'FREE',
                payment_note: local.payment_note || null,
                webhook_url: local.webhook_url,
                password_hash: local.password_hash || null,
                brand_slug: local.brand_slug || null,
                custom_domain: local.custom_domain || null,
                has_custom_domain: local.has_custom_domain || 0,
                brand_logo_url: local.brand_logo_url || null,
            };
        }
        return null;
    }
    static async findByDomain(domain) {
        if (!domain)
            return null;
        const cleanDomain = domain.toLowerCase().trim().replace(/:\d+$/, '');
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('merchants')
                .select('*')
                .eq('custom_domain', cleanDomain)
                .maybeSingle();
            if (!error && data) {
                return data;
            }
        }
        const local = dbService.getMerchantByDomain(cleanDomain);
        if (local) {
            return {
                id: local.id,
                business_name: local.name,
                email: local.email || 'merchant@example.com',
                phone: local.phone || null,
                status: local.status || 'ACTIVE',
                plan: local.plan || 'FREE',
                payment_status: local.payment_status || 'FREE',
                payment_note: local.payment_note || null,
                webhook_url: local.webhook_url,
                password_hash: local.password_hash || null,
                brand_slug: local.brand_slug || null,
                custom_domain: local.custom_domain || null,
                has_custom_domain: local.has_custom_domain || 0,
                brand_logo_url: local.brand_logo_url || null,
            };
        }
        return null;
    }
    static async updateBranding(id, params) {
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const payload = { updated_at: new Date().toISOString() };
            if (params.brand_slug !== undefined)
                payload.brand_slug = params.brand_slug ? params.brand_slug.toLowerCase().trim() : null;
            if (params.custom_domain !== undefined)
                payload.custom_domain = params.custom_domain ? params.custom_domain.toLowerCase().trim() : null;
            if (params.has_custom_domain !== undefined)
                payload.has_custom_domain = Boolean(params.has_custom_domain);
            if (params.brand_logo_url !== undefined)
                payload.brand_logo_url = params.brand_logo_url ? params.brand_logo_url.trim() : null;
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
            const targetId = isUuid ? id : '00000000-0000-0000-0000-000000000101';
            const { error } = await supabase.from('merchants').update(payload).eq('id', targetId);
            if (error) {
                console.error('Failed to update Supabase merchant branding:', error);
            }
        }
        // Update local SQLite store
        dbService.updateMerchantBranding(id, params);
        return true;
    }
}
