export interface TelegramAlertParams {
  amount: number;
  provider: string;
  trxId: string;
  invoiceId: string;
  customerName?: string;
  customerPhone?: string;
  merchantName?: string;
  botToken?: string;
  chatId?: string;
}

export class TelegramService {
  /**
   * Sends an instant payment alert message to merchant or admin Telegram
   */
  public static async sendPaymentAlert(params: TelegramAlertParams): Promise<boolean> {
    const token = params.botToken || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = params.chatId || process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      // Telegram credentials not configured, fail gracefully
      return false;
    }

    const timeStr = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Dhaka',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const message = `🎉 *SyncPay BD — New Payment Received!*
━━━━━━━━━━━━━━━━━━━━━
💰 *Amount:* ৳${params.amount.toLocaleString('en-IN')} BDT
📱 *Provider:* ${params.provider.toUpperCase()}
🔑 *TrxID:* \`${params.trxId.toUpperCase()}\`
🧾 *Invoice:* \`#${params.invoiceId}\`
👤 *Customer:* ${params.customerName || 'Valued Customer'}${params.customerPhone ? ` (${params.customerPhone})` : ''}
🏢 *Merchant:* ${params.merchantName || 'SyncPay Merchant'}
🕒 *Time:* ${timeStr} (BST)
━━━━━━━━━━━━━━━━━━━━━
✅ _Transaction verified & secured by SyncPay BD Engine_`;

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn('[TelegramService] Telegram API error:', response.status, errText);
        return false;
      }

      return true;
    } catch (err: any) {
      console.warn('[TelegramService] Delivery failed:', err.message);
      return false;
    }
  }
}
