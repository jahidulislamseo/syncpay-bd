import { getSupabaseClient, isSupabaseConfigured } from '../supabase.js';
import { dbService } from '../database.js';

export interface MerchantEntity {
  id: string;
  business_name: string;
  email: string;
  phone?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'PAYMENT_REQUIRED';
  plan?: string;
  payment_status?: string;
  payment_note?: string;
  webhook_url?: string | null;
  redirect_url?: string | null;
  password_hash?: string | null;
  created_at?: string;
  updated_at?: string;
}

export class MerchantRepository {
  public static async findById(id: string): Promise<MerchantEntity | null> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        return data as MerchantEntity;
      }
    }

    // Fallback to local SQLite store
    const local = dbService.getMerchantById(id);
    if (local) {
      return {
        id: local.id,
        business_name: local.name,
        email: (local as any).email || 'merchant@example.com',
        phone: (local as any).phone || null,
        status: ((local as any).status as any) || 'ACTIVE',
        plan: (local as any).plan || 'FREE',
        payment_status: (local as any).payment_status || 'FREE',
        payment_note: (local as any).payment_note || null,
        webhook_url: local.webhook_url,
        password_hash: (local as any).password_hash || null,
      };
    }
    return null;
  }

  public static async findByEmail(email: string): Promise<MerchantEntity | null> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (!error && data) {
        return data as MerchantEntity;
      }
    }

    // Local SQLite fallback
    const all = dbService.getAdminMerchants();
    const local = all.find(
      (m: any) => m.email === email || m.id === email || m.name.toLowerCase() === email.toLowerCase()
    );
    if (local) {
      return {
        id: local.id,
        business_name: local.name,
        email: local.email || email,
        phone: local.phone || null,
        status: (local.status as any) || 'ACTIVE',
        plan: local.plan || 'FREE',
        payment_status: local.payment_status || 'FREE',
        payment_note: local.payment_note || null,
        webhook_url: local.webhook_url,
        password_hash: (local as any).password_hash || null,
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

  public static async create(params: {
    id?: string;
    business_name: string;
    email: string;
    phone?: string;
    password_hash?: string;
    webhook_url?: string;
    redirect_url?: string;
  }): Promise<MerchantEntity> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      const payload: any = {
        business_name: params.business_name,
        email: params.email,
        phone: params.phone || null,
        password_hash: params.password_hash || null,
        webhook_url: params.webhook_url || null,
        redirect_url: params.redirect_url || null,
        status: 'ACTIVE',
      };
      if (params.id) payload.id = params.id;

      const { data, error } = await supabase
        .from('merchants')
        .insert(payload)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as MerchantEntity;
    }

    // Local SQLite fallback
    const id = params.id || 'm_' + Math.random().toString(36).substring(2, 10);
    const merchant = {
      id,
      business_name: params.business_name,
      email: params.email,
      phone: params.phone || null,
      password_hash: params.password_hash || null,
      status: 'ACTIVE' as const,
      webhook_url: params.webhook_url || null,
      redirect_url: params.redirect_url || null,
    };
    return merchant;
  }
}
