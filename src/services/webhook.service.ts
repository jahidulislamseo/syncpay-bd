import { CryptoUtil } from '../utils/crypto.js';
import { getSupabaseClient } from '../db/supabase.js';

export interface WebhookPayload {
  invoice_id: string;
  status: 'true' | 'false';
  provider?: string;
  trx_id?: string;
  amount?: number;
  timestamp?: string;
}

export class WebhookService {
  /**
   * Dispatches signed webhook payload to merchant endpoint with retry safety
   */
  public static async dispatch(params: {
    merchantId: string;
    invoiceId: string;
    webhookUrl: string;
    webhookSecret?: string;
    payload: WebhookPayload;
  }): Promise<{ success: boolean; status?: number; signature: string; error?: string }> {
    const secret = params.webhookSecret || 'whsec_default_fallback_key';
    const payloadStr = JSON.stringify(params.payload);
    const signature = CryptoUtil.signWebhook(payloadStr, secret);

    let responseStatus: number | undefined;
    let responseBody: string | undefined;
    let isSuccess = false;

    try {
      const response = await fetch(params.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SyncPayBD-Webhook-Engine/1.0',
          'X-Payflow-Signature': signature,
          'X-Payflow-Invoice-Id': params.invoiceId,
        },
        body: payloadStr,
        signal: AbortSignal.timeout(6000), // 6 second safety timeout
      });

      responseStatus = response.status;
      responseBody = await response.text();
      isSuccess = response.ok;
    } catch (err: any) {
      responseBody = `Error: ${err.message}`;
      console.warn(`[Webhook Delivery Failure] ${params.webhookUrl} for invoice ${params.invoiceId}:`, err.message);
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
      } catch (logErr) {
        console.error('[Webhook Audit Log Error]:', logErr);
      }
    }

    return {
      success: isSuccess,
      status: responseStatus,
      signature,
      error: isSuccess ? undefined : responseBody,
    };
  }
}
