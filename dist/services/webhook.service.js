import { CryptoUtil } from '../utils/crypto.js';
import { getSupabaseClient } from '../db/supabase.js';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export class WebhookService {
    /**
     * Dispatches signed webhook payload to merchant endpoint with retry safety & exponential backoff
     */
    static async dispatch(params) {
        const secret = params.webhookSecret || 'whsec_default_fallback_key';
        const payloadStr = JSON.stringify(params.payload);
        const signature = CryptoUtil.signWebhook(payloadStr, secret);
        const maxRetries = params.maxRetries ?? 3;
        let responseStatus;
        let responseBody;
        let isSuccess = false;
        let attempts = 0;
        const backoffDelays = [0, 2000, 5000]; // immediate, 2s, 5s
        for (let i = 0; i < maxRetries; i++) {
            attempts++;
            if (backoffDelays[i] > 0) {
                await sleep(backoffDelays[i]);
            }
            try {
                const response = await fetch(params.webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'SyncPayBD-Webhook-Engine/2.0',
                        'X-SyncPay-Signature': signature,
                        'X-SyncPay-Invoice-Id': params.invoiceId,
                        'X-Payflow-Signature': signature,
                        'X-Payflow-Invoice-Id': params.invoiceId,
                    },
                    body: payloadStr,
                    signal: AbortSignal.timeout(5000), // 5 second timeout per attempt
                });
                responseStatus = response.status;
                responseBody = await response.text();
                isSuccess = response.ok;
                if (isSuccess) {
                    break; // Successfully delivered!
                }
            }
            catch (err) {
                responseBody = `Error: ${err.message}`;
                console.warn(`[Webhook Delivery Attempt ${attempts} Failed] ${params.webhookUrl} for invoice ${params.invoiceId}:`, err.message);
            }
        }
        // Record audit log if Supabase is active
        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                await supabase.from('webhook_deliveries').insert({
                    merchant_id: params.merchantId,
                    invoice_id: params.invoiceId,
                    webhook_url: params.webhookUrl,
                    payload: params.payload,
                    signature,
                    response_status: responseStatus || 0,
                    response_body: responseBody?.substring(0, 1000),
                    status: isSuccess ? 'DELIVERED' : 'FAILED',
                });
            }
            catch (logErr) {
                console.error('[Webhook Audit Log Error]:', logErr);
            }
        }
        return {
            success: isSuccess,
            status: responseStatus,
            signature,
            attempts,
            error: isSuccess ? undefined : responseBody,
        };
    }
}
