import { DeviceRepository } from '../db/repositories/device.repository.js';
import { MerchantRepository } from '../db/repositories/merchant.repository.js';
export class DeviceService {
    static async authenticateDevice(deviceTokenOrId) {
        const device = await DeviceRepository.findByToken(deviceTokenOrId);
        if (!device) {
            return { authenticated: false, error: 'Device not registered or invalid token' };
        }
        if (device.status === 'SUSPENDED') {
            return { authenticated: false, error: 'Device is suspended' };
        }
        const merchant = await MerchantRepository.findById(device.merchant_id);
        if (!merchant) {
            return { authenticated: false, error: 'Merchant account not found or suspended' };
        }
        return { authenticated: true, device, merchant };
    }
    static async recordHeartbeat(tokenOrId, telemetry) {
        await DeviceRepository.updateHeartbeat(tokenOrId, telemetry);
    }
    static async registerDevice(params) {
        const rawToken = 'token_' + Math.random().toString(36).substring(2, 14);
        const { entity, rawToken: token } = await DeviceRepository.create({
            merchantId: params.merchantId,
            deviceName: params.deviceName,
            rawToken,
            deviceModel: params.deviceModel,
            androidVersion: params.androidVersion,
            mfsProvider: params.mfsProvider,
        });
        return { device: entity, token };
    }
    static async listMerchantDevices(merchantId) {
        return DeviceRepository.listByMerchant(merchantId);
    }
    static async removeDevice(deviceId, merchantId) {
        return DeviceRepository.delete(deviceId, merchantId);
    }
}
