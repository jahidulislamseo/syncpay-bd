import { MerchantRepository } from '../db/repositories/merchant.repository.js';
import { ApiKeyRepository } from '../db/repositories/api-key.repository.js';
import { InvoiceRepository } from '../db/repositories/invoice.repository.js';
import { TransactionRepository } from '../db/repositories/transaction.repository.js';
import { DeviceRepository } from '../db/repositories/device.repository.js';
export class MerchantService {
    static async authenticateApiKey(rawApiKey) {
        const keyRecord = await ApiKeyRepository.findByKey(rawApiKey);
        if (!keyRecord) {
            return { authenticated: false, error: 'Invalid API Key' };
        }
        const merchant = await MerchantRepository.findById(keyRecord.merchant_id);
        if (!merchant || merchant.status !== 'ACTIVE') {
            return { authenticated: false, error: 'Merchant account is not active' };
        }
        return { authenticated: true, merchant, apiKeyEntity: keyRecord };
    }
    static async getMerchantStats(merchantId) {
        // Collect stats from transactions & devices
        const txs = await TransactionRepository.listRecent(merchantId, 100);
        const devices = await DeviceRepository.listByMerchant(merchantId);
        const todayDate = new Date().toISOString().slice(0, 10);
        const todayTxs = txs.filter((t) => t.created_at?.startsWith(todayDate));
        const todayRevenue = todayTxs.reduce((sum, t) => sum + (t.status === 'COMPLETED' ? t.amount : 0), 0);
        const totalVerified = txs.filter((t) => t.status === 'COMPLETED').length;
        return {
            todayRevenue,
            todayCount: todayTxs.length,
            totalVerified,
            devices,
        };
    }
    static async getInvoices(merchantId, limit = 50) {
        return InvoiceRepository.listByMerchant(merchantId, limit);
    }
    static async getTransactions(merchantId, limit = 50) {
        return TransactionRepository.listRecent(merchantId, limit);
    }
    static async getApiKeys(merchantId) {
        return ApiKeyRepository.listByMerchant(merchantId);
    }
    static async generateApiKey(merchantId, name) {
        const rawKey = 'live_' + Math.random().toString(36).substring(2, 8) + '_' + Math.random().toString(36).substring(2, 14);
        const { entity, rawKey: generatedKey } = await ApiKeyRepository.create({
            merchantId,
            name,
            rawApiKey: rawKey,
        });
        return { key: generatedKey, entity };
    }
}
