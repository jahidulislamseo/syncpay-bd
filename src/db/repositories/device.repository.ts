import { getSupabaseClient, isSupabaseConfigured } from '../supabase.js';
import { CryptoUtil } from '../../utils/crypto.js';
import { dbService } from '../database.js';

export interface DeviceEntity {
  id: string;
  merchant_id: string;
  device_name: string;
  device_token_hash: string;
  device_model?: string | null;
  android_version?: string | null;
  mfs_provider?: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'SUSPENDED';
  last_seen_at?: string | null;
  last_seen?: string | null;
  sim_number?: string | null;
  battery_level?: number | null;
  battery_temp?: number | null;
  is_charging?: boolean | null;
  charger_type?: string | null;
  free_ram_mb?: number | null;
  sim_slots?: any;
  sms_count?: number;
  created_at?: string;
  updated_at?: string;
}

export class DeviceRepository {
  public static async findByToken(token: string): Promise<DeviceEntity | null> {
    const tokenHash = CryptoUtil.hashToken(token);
    const supabase = getSupabaseClient();

    if (supabase && isSupabaseConfigured()) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
      let query = supabase.from('devices').select('*');
      if (isUuid) {
        query = query.or(`device_token_hash.eq.${tokenHash},id.eq.${token}`);
      } else {
        query = query.eq('device_token_hash', tokenHash);
      }
      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        return data as DeviceEntity;
      }
    }

    // Local SQLite fallback
    const local = dbService.getDeviceByToken(token);
    if (local) {
      return {
        id: local.id,
        merchant_id: local.merchant_id,
        device_name: local.device_name,
        device_token_hash: tokenHash,
        status: 'ONLINE',
      };
    }

    return null;
  }

  public static async create(params: {
    merchantId: string;
    deviceName: string;
    rawToken: string;
    deviceModel?: string;
    androidVersion?: string;
    mfsProvider?: string;
  }): Promise<{ entity: DeviceEntity; rawToken: string }> {
    const tokenHash = CryptoUtil.hashToken(params.rawToken);
    const supabase = getSupabaseClient();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.merchantId);
    if (supabase && isSupabaseConfigured() && isUuid) {
      try {
        const { data, error } = await supabase
          .from('devices')
          .insert({
            merchant_id: params.merchantId,
            device_name: params.deviceName,
            device_token_hash: tokenHash,
            device_model: params.deviceModel || null,
            android_version: params.androidVersion || null,
            mfs_provider: params.mfsProvider || 'ALL',
            status: 'OFFLINE',
          })
          .select()
          .single();

        if (!error && data) {
          return { entity: data as DeviceEntity, rawToken: params.rawToken };
        }
      } catch (err) {
        // Fall back to local SQLite store
      }
    }

    // Local fallback
    const id = 'dev_' + Math.random().toString(36).substring(2, 9);
    dbService.addDevice({
      id,
      merchantId: params.merchantId,
      deviceName: params.deviceName,
      simNumber: '01700000000',
      deviceToken: params.rawToken,
    });

    const entity: DeviceEntity = {
      id,
      merchant_id: params.merchantId,
      device_name: params.deviceName,
      device_token_hash: tokenHash,
      status: 'OFFLINE',
      created_at: new Date().toISOString(),
    };
    return { entity, rawToken: params.rawToken };
  }

  public static async updateHeartbeat(deviceIdOrToken: string, telemetry?: any): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      const tokenHash = CryptoUtil.hashToken(deviceIdOrToken);
      await supabase
        .from('devices')
        .update({ last_seen_at: new Date().toISOString(), status: 'ONLINE', updated_at: new Date().toISOString() })
        .or(`id.eq.${deviceIdOrToken},device_token_hash.eq.${tokenHash}`);
    }

    dbService.updateDeviceHeartbeat(deviceIdOrToken, telemetry);
  }

  public static async listByMerchant(merchantId: string): Promise<DeviceEntity[]> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });

      if (!error && data) return data as DeviceEntity[];
    }

    const localDevices = dbService.getAllDevices(merchantId);
    return localDevices.map((d: any) => ({
      id: d.id,
      merchant_id: d.merchant_id,
      device_name: d.device_name,
      device_token_hash: CryptoUtil.hashToken(d.device_token || d.id),
      status: d.status as any,
      last_seen: d.last_seen,
      last_seen_at: d.last_seen,
      sim_number: d.sim_number,
      device_model: d.device_model || null,
      android_version: d.android_version || null,
      battery_level: d.battery_level !== undefined ? d.battery_level : null,
      battery_temp: d.battery_temp !== undefined ? d.battery_temp : null,
      is_charging: d.is_charging === 1 || d.is_charging === true,
      charger_type: d.charger_type || null,
      free_ram_mb: d.free_ram_mb || null,
      sim_slots: typeof d.sim_slots === 'string' ? (() => { try { return JSON.parse(d.sim_slots); } catch (_) { return null; } })() : (d.sim_slots || null),
      sms_count: d.sms_count || 0,
    }));
  }

  public static async delete(id: string, merchantId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', id)
        .eq('merchant_id', merchantId);

      return !error;
    }

    dbService.deleteDevice(id, merchantId);
    return true;
  }
}
