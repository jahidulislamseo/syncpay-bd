import { getSupabaseClient, isSupabaseConfigured } from '../supabase.js';
import { dbService } from '../database.js';

export interface MerchantEntity {
  id: string;
  business_name: string;
  email: string;
  phone?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  webhook_url?: string | null;
  redirect_url?: string | null;
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
        email: 'merchant@example.com',
        status: 'ACTIVE',
        webhook_url: local.webhook_url,
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
        .single();

      if (!error && data) {
        return data as MerchantEntity;
      }
    }
    return null;
  }

  public static async create(params: {
    id?: string;
    business_name: string;
    email: string;
    phone?: string;
    webhook_url?: string;
    redirect_url?: string;
  }): Promise<MerchantEntity> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      const payload: any = {
        business_name: params.business_name,
        email: params.email,
        phone: params.phone || null,
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
      status: 'ACTIVE' as const,
      webhook_url: params.webhook_url || null,
      redirect_url: params.redirect_url || null,
    };
    return merchant;
  }
}
