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
        const targetMerchantId = isUuid ? params.merchantId : '00000000-0000-0000-0000-000000000101';
        if (supabase && isSupabaseConfigured()) {
            try {
                const { data, error } = await supabase
                    .from('devices')
                    .insert({
                    merchant_id: targetMerchantId,
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
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deviceIdOrToken);
            try {
                let query = supabase
                    .from('devices')
                    .update({ last_seen_at: new Date().toISOString(), status: 'ONLINE', updated_at: new Date().toISOString() });
                if (isUuid) {
                    query = query.or(`id.eq.${deviceIdOrToken},device_token_hash.eq.${tokenHash}`);
                }
                else {
                    query = query.eq('device_token_hash', tokenHash);
                }
                await query;
            }
            catch (_) { }
        }
        dbService.updateDeviceHeartbeat(deviceIdOrToken, telemetry);
    }
    static async listByMerchant(merchantId) {
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(merchantId);
            const targetMerchantId = isUuid ? merchantId : '00000000-0000-0000-0000-000000000101';
            try {
                const { data, error } = await supabase
                    .from('devices')
                    .select('*')
                    .eq('merchant_id', targetMerchantId)
                    .order('created_at', { ascending: false });
                if (!error && data && data.length > 0) {
                    return data.map((d) => ({
                        id: d.id,
                        merchant_id: merchantId,
                        device_name: d.device_name,
                        device_token_hash: d.device_token_hash,
                        status: d.status,
                        last_seen: d.last_seen_at,
                        last_seen_at: d.last_seen_at,
                        sim_number: d.sim_number || '017•••••••',
                        device_model: d.device_model || null,
                        android_version: d.android_version || null,
                        battery_level: d.battery_level !== undefined ? d.battery_level : null,
                        battery_temp: d.battery_temp !== undefined ? d.battery_temp : null,
                        is_charging: d.is_charging === 1 || d.is_charging === true,
                        charger_type: d.charger_type || null,
                        free_ram_mb: d.free_ram_mb || null,
                        sim_slots: typeof d.sim_slots === 'string' ? (() => { try {
                            return JSON.parse(d.sim_slots);
                        }
                        catch (_) {
                            return null;
                        } })() : (d.sim_slots || null),
                        sms_count: d.sms_count || 0,
                    }));
                }
            }
            catch (_) { }
        }
        const localDevices = dbService.getAllDevices(merchantId);
        return localDevices.map((d) => ({
            id: d.id,
            merchant_id: d.merchant_id,
            device_name: d.device_name,
            device_token_hash: CryptoUtil.hashToken(d.device_token || d.id),
            status: d.status,
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
            sim_slots: typeof d.sim_slots === 'string' ? (() => { try {
                return JSON.parse(d.sim_slots);
            }
            catch (_) {
                return null;
            } })() : (d.sim_slots || null),
            sms_count: d.sms_count || 0,
        }));
    }
    static async delete(id, merchantId) {
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(merchantId);
            const targetMerchantId = isUuid ? merchantId : '00000000-0000-0000-0000-000000000101';
            try {
                const { error } = await supabase
                    .from('devices')
                    .delete()
                    .eq('id', id)
                    .eq('merchant_id', targetMerchantId);
                if (!error)
                    return true;
            }
            catch (_) { }
        }
        dbService.deleteDevice(id, merchantId);
        return true;
    }
}
