import { InvoiceRepository } from '../db/repositories/invoice.repository.js';
import { TransactionRepository } from '../db/repositories/transaction.repository.js';
import { WebhookService } from './webhook.service.js';
export class PaymentService {
    static async createInvoice(params) {
        const invoiceId = 'PF' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
        const invoice = await InvoiceRepository.create({
            merchantId: params.merchantId,
            invoiceId,
            customerName: params.customerName || 'Valued Customer',
            customerEmail: params.customerEmail,
            amount: params.amount,
            redirectUrl: params.redirectUrl,
            webhookUrl: params.webhookUrl,
            expiresInMinutes: params.expiresInMinutes || 30,
        });
        return {
            invoice,
            payment_url: `/checkout?invoice_id=${invoice.invoice_id}`,
        };
    }
    static async verifyInvoice(invoiceId, merchantId) {
        const invoice = await InvoiceRepository.findByInvoiceId(invoiceId);
        if (!invoice || invoice.merchant_id !== merchantId) {
            return { found: false, status: 'FAILED' };
        }
        const statusMap = {
            PAID: 'COMPLETED',
            PENDING: 'PENDING',
            EXPIRED: 'FAILED',
            FAILED: 'FAILED',
        };
        return {
            found: true,
            invoice,
            status: statusMap[invoice.status] || 'PENDING',
        };
    }
    static async settleCheckout(params) {
        const lockResult = await TransactionRepository.verifyAndLock(params.merchantId, params.trxId, params.amount, params.orderId);
        if (!lockResult.success) {
            return { success: false, reason: lockResult.reason };
        }
        let invoice;
        if (params.invoiceId) {
            await InvoiceRepository.updateStatus(params.invoiceId, 'PAID', params.trxId, lockResult.transaction?.provider?.toLowerCase());
            const found = await InvoiceRepository.findByInvoiceId(params.invoiceId);
            if (found)
                invoice = found;
            // Dispatch webhook
            if (invoice?.webhook_url) {
                WebhookService.dispatch({
                    merchantId: params.merchantId,
                    invoiceId: invoice.invoice_id,
                    webhookUrl: invoice.webhook_url,
                    webhookSecret: params.webhookSecret,
                    payload: {
                        invoice_id: invoice.invoice_id,
                        status: 'true',
                        provider: lockResult.transaction?.provider?.toLowerCase() || 'mfs',
                        trx_id: params.trxId.toUpperCase(),
                        amount: params.amount,
                        timestamp: new Date().toISOString(),
                    },
                });
            }
        }
        return {
            success: true,
            invoice,
            transaction: lockResult.transaction,
            redirect_url: invoice?.redirect_url || null,
        };
    }
}
