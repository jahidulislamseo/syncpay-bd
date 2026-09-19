import { getSupabaseClient, isSupabaseConfigured } from '../supabase.js';
import { CryptoUtil } from '../../utils/crypto.js';
import { dbService } from '../database.js';

export interface ApiKeyEntity {
  id: string;
  merchant_id: string;
  key_prefix: string;
  key_hash: string;
  name: string;
  status: 'active' | 'revoked';
  last_used_at?: string | null;
  created_at?: string;
  revoked_at?: string | null;
}

export class ApiKeyRepository {
  public static async findByKey(rawApiKey: string): Promise<ApiKeyEntity | null> {
    const keyHash = CryptoUtil.hashToken(rawApiKey);
    const supabase = getSupabaseClient();

    if (supabase && isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('merchant_api_keys')
        .select('*')
        .eq('key_hash', keyHash)
        .eq('status', 'active')
        .single();

      if (!error && data) {
        // Record last used timestamp asynchronously
        supabase
          .from('merchant_api_keys')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', data.id)
          .then();

        return data as ApiKeyEntity;
      }
    }

    // Local fallback: Check SQLite merchants table
    const local = dbService.getMerchantByApiKey(rawApiKey);
    if (local) {
      let merchantId = local.id;
      if (local.id === 'm_demo_101') merchantId = '00000000-0000-0000-0000-000000000101';
      else if (local.id === 'm_payflow_sandbox') merchantId = '00000000-0000-0000-0000-000000000999';

      return {
        id: 'key_' + local.id,
        merchant_id: merchantId,
        key_prefix: rawApiKey.substring(0, 8),
        key_hash: keyHash,
        name: 'Default Key',
        status: 'active',
      };
    }

    return null;
  }

  public static async create(params: {
    merchantId: string;
    name: string;
    rawApiKey: string;
  }): Promise<{ entity: ApiKeyEntity; rawKey: string }> {
    const keyPrefix = params.rawApiKey.substring(0, 8);
    const keyHash = CryptoUtil.hashToken(params.rawApiKey);
    const supabase = getSupabaseClient();

    if (supabase && isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('merchant_api_keys')
        .insert({
          merchant_id: params.merchantId,
          key_prefix: keyPrefix,
          key_hash: keyHash,
          name: params.name,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return { entity: data as ApiKeyEntity, rawKey: params.rawApiKey };
    }

    // Local store fallback
    const entity: ApiKeyEntity = {
      id: 'key_' + Math.random().toString(36).substring(2, 8),
      merchant_id: params.merchantId,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      name: params.name,
      status: 'active',
      created_at: new Date().toISOString(),
    };
    return { entity, rawKey: params.rawApiKey };
  }

  public static async listByMerchant(merchantId: string): Promise<ApiKeyEntity[]> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('merchant_api_keys')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });

      if (!error && data) return data as ApiKeyEntity[];
    }

    const localKeys = dbService.getAllApiKeys(merchantId);
    return localKeys.map((k) => ({
      id: k.id,
      merchant_id: k.merchant_id,
      key_prefix: k.key_prefix,
      key_hash: CryptoUtil.hashToken(k.secret_key),
      name: k.name,
      status: k.status as 'active',
      last_used_at: k.last_used,
      created_at: k.created_at,
    }));
  }

  public static async revoke(keyId: string, merchantId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      const { error } = await supabase
        .from('merchant_api_keys')
        .update({ status: 'revoked', revoked_at: new Date().toISOString() })
        .eq('id', keyId)
        .eq('merchant_id', merchantId);

      return !error;
    }
    return true;
  }
}
