import { getSupabaseClient, isSupabaseConfigured } from '../supabase.js';
import { dbService } from '../database.js';
export class MerchantRepository {
    static async findById(id) {
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('merchants')
                .select('*')
                .eq('id', id)
                .single();
            if (!error && data) {
                return data;
            }
        }
        // Fallback to local SQLite store
        const local = dbService.getMerchantById(id);
        if (local) {
            return {
                id: local.id,
                business_name: local.name,
                email: local.email || 'merchant@example.com',
                status: 'ACTIVE',
                webhook_url: local.webhook_url,
                password_hash: local.password_hash || null,
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
                email,
                status: 'ACTIVE',
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
}
