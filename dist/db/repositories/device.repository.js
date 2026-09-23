import { getSupabaseClient, isSupabaseConfigured } from '../supabase.js';
import { CryptoUtil } from '../../utils/crypto.js';
import { dbService } from '../database.js';
export class DeviceRepository {
    static async findByToken(token) {
        const tokenHash = CryptoUtil.hashToken(token);
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
            let query = supabase.from('devices').select('*');
            if (isUuid) {
                query = query.or(`device_token_hash.eq.${tokenHash},id.eq.${token}`);
            }
            else {
                query = query.eq('device_token_hash', tokenHash);
            }
            const { data, error } = await query.maybeSingle();
            if (!error && data) {
                return data;
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
    static async create(params) {
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
                    status: 'ONLINE',
                })
                    .select()
                    .single();
                if (!error && data) {
                    return { entity: data, rawToken: params.rawToken };
                }
            }
            catch (err) {
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
        const entity = {
            id,
            merchant_id: params.merchantId,
            device_name: params.deviceName,
            device_token_hash: tokenHash,
            status: 'ONLINE',
            created_at: new Date().toISOString(),
        };
        return { entity, rawToken: params.rawToken };
    }
    static async updateHeartbeat(deviceIdOrToken, telemetry) {
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
    static async listByMerchant(merchantId) {
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('devices')
                .select('*')
                .eq('merchant_id', merchantId)
                .order('created_at', { ascending: false });
            if (!error && data)
                return data;
        }
        const localDevices = dbService.getAllDevices(merchantId);
        return localDevices.map((d) => ({
            id: d.id,
            merchant_id: d.merchant_id,
            device_name: d.device_name,
            device_token_hash: CryptoUtil.hashToken(d.device_token),
            status: d.status,
            last_seen_at: d.last_seen,
        }));
    }
    static async delete(id, merchantId) {
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
