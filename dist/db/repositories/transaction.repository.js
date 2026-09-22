import { getSupabaseClient, isSupabaseConfigured } from '../supabase.js';
import { dbService } from '../database.js';
export class TransactionRepository {
    static async insert(params) {
        const supabase = getSupabaseClient();
        const upperTrxId = params.trxId.toUpperCase();
        if (supabase && isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('transactions')
                .insert({
                merchant_id: params.merchantId,
                device_id: params.deviceId || null,
                invoice_id: params.invoiceId || null,
                provider: params.provider,
                trx_id: upperTrxId,
                sender_number: params.senderNumber || null,
                amount: params.amount,
                raw_sms: params.rawSms,
                status: params.status || 'COMPLETED',
            })
                .select('id')
                .single();
            if (error) {
                // Postgres unique violation code 23505
                if (error.code === '23505' ||
                    error.message.includes('unique constraint') ||
                    error.message.includes('uq_merchant_trx')) {
                    return { success: false, isDuplicate: true };
                }
                throw new Error(error.message);
            }
            return { success: true, id: data.id };
        }
        // Local SQLite fallback
        const localResult = dbService.insertTransaction({
            merchantId: params.merchantId,
            deviceId: params.deviceId || 'dev_phone_1',
            provider: params.provider,
            trxId: upperTrxId,
            amount: params.amount,
            sender: params.senderNumber,
            rawSms: params.rawSms,
            simSlot: params.simSlot,
            carrier: params.carrier,
            source: params.source,
        });
        if (localResult.isDuplicate) {
            return { success: false, isDuplicate: true };
        }
        return { success: true, id: String(localResult.id) };
    }
    static async findByTrxId(merchantId, trxId) {
        const upperTrxId = trxId.toUpperCase();
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('merchant_id', merchantId)
                .eq('trx_id', upperTrxId)
                .single();
            if (!error && data) {
                return data;
            }
        }
        let local = dbService.findTransactionByTrxId(merchantId, upperTrxId);
        if (!local) {
            const aliasMap = {
                '00000000-0000-0000-0000-000000000999': 'm_payflow_sandbox',
                'm_payflow_sandbox': '00000000-0000-0000-0000-000000000999',
                '00000000-0000-0000-0000-000000000101': 'm_demo_101',
                'm_demo_101': '00000000-0000-0000-0000-000000000101',
            };
            const alias = aliasMap[merchantId];
            if (alias) {
                local = dbService.findTransactionByTrxId(alias, upperTrxId);
            }
        }
        if (local) {
            return {
                id: String(local.id),
                merchant_id: local.merchant_id,
                provider: local.provider,
                trx_id: local.trx_id,
                amount: local.amount,
                sender_number: local.sender || null,
                raw_sms: local.raw_sms,
                status: local.is_verified === 1 ? 'COMPLETED' : 'PENDING',
                created_at: local.created_at,
            };
        }
        return null;
    }
    static async verifyAndLock(merchantId, trxId, expectedAmount, orderId) {
        const upperTrxId = trxId.toUpperCase();
        const trx = await this.findByTrxId(merchantId, upperTrxId);
        if (!trx) {
            return { success: false, reason: 'Transaction ID not found. Ensure money has been sent.' };
        }
        if (trx.status === 'COMPLETED') {
            // In local SQLite, check is_verified
            let local = dbService.findTransactionByTrxId(merchantId, upperTrxId);
            if (!local && trx.merchant_id) {
                local = dbService.findTransactionByTrxId(trx.merchant_id, upperTrxId);
            }
            if (local && local.is_verified === 1) {
                return { success: false, reason: 'This Transaction ID has already been used for another order.' };
            }
        }
        if (Math.abs(trx.amount - expectedAmount) > 0.01) {
            return {
                success: false,
                reason: `Amount mismatch. Expected Tk ${expectedAmount.toFixed(2)}, received Tk ${trx.amount.toFixed(2)}.`,
            };
        }
        const supabase = getSupabaseClient();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trx.id);
        if (supabase && isSupabaseConfigured() && isUuid) {
            const { data, error } = await supabase
                .from('transactions')
                .update({
                status: 'COMPLETED',
            })
                .eq('id', trx.id)
                .select()
                .single();
            if (!error && data) {
                return { success: true, transaction: data };
            }
        }
        // Local SQLite fallback
        let localRes = dbService.verifyAndLockTransaction(merchantId, upperTrxId, expectedAmount, orderId);
        if (!localRes.success && trx.merchant_id !== merchantId) {
            localRes = dbService.verifyAndLockTransaction(trx.merchant_id, upperTrxId, expectedAmount, orderId);
        }
        if (!localRes.success) {
            return { success: false, reason: localRes.reason };
        }
        return {
            success: true,
            transaction: {
                id: String(localRes.transaction.id),
                merchant_id: localRes.transaction.merchant_id,
                provider: localRes.transaction.provider,
                trx_id: localRes.transaction.trx_id,
                amount: localRes.transaction.amount,
                sender_number: localRes.transaction.sender || null,
                raw_sms: localRes.transaction.raw_sms,
                status: 'COMPLETED',
            },
        };
    }
    static async listRecent(merchantId, limit = 50) {
        const supabase = getSupabaseClient();
        if (supabase && isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('merchant_id', merchantId)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (!error && data)
                return data;
        }
        const locals = dbService.getRecentTransactions(merchantId, limit);
        return locals.map((l) => ({
            id: String(l.id),
            merchant_id: l.merchant_id,
            provider: l.provider,
            trx_id: l.trx_id,
            amount: l.amount,
            sender_number: l.sender || null,
            raw_sms: l.raw_sms,
            status: l.is_verified === 1 ? 'COMPLETED' : 'PENDING',
            created_at: l.created_at,
        }));
    }
}
