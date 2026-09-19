import { getSupabaseClient, isSupabaseConfigured } from '../supabase.js';
import { dbService, InvoiceRecord } from '../database.js';

export interface InvoiceEntity {
  id: string;
  merchant_id: string;
  invoice_id: string;
  customer_name: string;
  customer_email?: string | null;
  amount: number;
  redirect_url?: string | null;
  webhook_url?: string | null;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
  trx_id?: string | null;
  payment_method?: string | null;
  expires_at: string;
  created_at?: string;
  updated_at?: string;
}

export class InvoiceRepository {
  public static async create(params: {
    id?: string;
    merchantId: string;
    invoiceId: string;
    customerName: string;
    customerEmail?: string;
    amount: number;
    redirectUrl?: string;
    webhookUrl?: string;
    expiresInMinutes?: number;
  }): Promise<InvoiceEntity> {
    const supabase = getSupabaseClient();
    const expiresAt = new Date(Date.now() + (params.expiresInMinutes || 30) * 60000).toISOString();

    if (supabase && isSupabaseConfigured()) {
      const payload: any = {
        merchant_id: params.merchantId,
        invoice_id: params.invoiceId,
        customer_name: params.customerName,
        amount: params.amount,
        redirect_url: params.redirectUrl || null,
        webhook_url: params.webhookUrl || null,
        status: 'PENDING',
        expires_at: expiresAt,
      };
      if (params.id) payload.id = params.id;

      const { data, error } = await supabase
        .from('invoices')
        .insert(payload)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return {
        ...data,
        customer_email: params.customerEmail || null,
      } as InvoiceEntity;
    }

    // Local SQLite fallback
    const local = dbService.createInvoice({
      id: params.invoiceId,
      merchantId: params.merchantId,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      expectedAmount: params.amount,
      redirectUrl: params.redirectUrl,
      webhookUrl: params.webhookUrl,
      expiresInMinutes: params.expiresInMinutes,
    });

    return {
      id: local.id,
      merchant_id: local.merchant_id,
      invoice_id: local.id,
      customer_name: local.customer_name,
      customer_email: local.customer_email || params.customerEmail || null,
      amount: local.expected_amount,
      redirect_url: local.redirect_url,
      webhook_url: local.webhook_url,
      status: local.status as any,
      trx_id: local.trx_id || null,
      payment_method: local.payment_method || null,
      expires_at: local.expires_at,
      created_at: local.created_at,
    };
  }

  public static async findByInvoiceId(invoiceId: string): Promise<InvoiceEntity | null> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .or(`invoice_id.eq.${invoiceId},id.eq.${invoiceId}`)
        .single();

      if (!error && data) {
        return data as InvoiceEntity;
      }
    }

    const local = dbService.getInvoiceById(invoiceId);
    if (local) {
      return {
        id: local.id,
        merchant_id: local.merchant_id,
        invoice_id: local.id,
        customer_name: local.customer_name,
        customer_email: local.customer_email || null,
        amount: local.expected_amount,
        redirect_url: local.redirect_url,
        webhook_url: local.webhook_url,
        status: local.status as any,
        trx_id: local.trx_id || null,
        payment_method: local.payment_method || null,
        expires_at: local.expires_at,
        created_at: local.created_at,
      };
    }

    return null;
  }

  public static async findPendingByMerchantAndAmount(merchantId: string, amount: number): Promise<InvoiceEntity[]> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('amount', amount)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true });

      if (!error && data) {
        return data as InvoiceEntity[];
      }
    }

    const locals = dbService.getPendingInvoicesForMerchant(merchantId, amount);
    return locals.map((l) => ({
      id: l.id,
      merchant_id: l.merchant_id,
      invoice_id: l.id,
      customer_name: l.customer_name,
      customer_email: l.customer_email || null,
      amount: l.expected_amount,
      redirect_url: l.redirect_url,
      webhook_url: l.webhook_url,
      status: l.status as any,
      trx_id: l.trx_id || null,
      payment_method: l.payment_method || null,
      expires_at: l.expires_at,
      created_at: l.created_at,
    }));
  }

  public static async updateStatus(
    invoiceId: string,
    status: 'PAID' | 'EXPIRED' | 'FAILED',
    trxId?: string,
    paymentMethod?: string
  ): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      await supabase
        .from('invoices')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .or(`invoice_id.eq.${invoiceId},id.eq.${invoiceId}`);
    }

    dbService.updateInvoiceStatus(invoiceId, status === 'FAILED' ? 'EXPIRED' : status, trxId, paymentMethod);
  }

  public static async listByMerchant(merchantId: string, limit: number = 50): Promise<InvoiceEntity[]> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        return data as InvoiceEntity[];
      }
    }

    const locals = dbService.getAllInvoices(merchantId, limit);
    return locals.map((l) => ({
      id: l.id,
      merchant_id: l.merchant_id,
      invoice_id: l.id,
      customer_name: l.customer_name,
      customer_email: l.customer_email || null,
      amount: l.expected_amount,
      redirect_url: l.redirect_url,
      webhook_url: l.webhook_url,
      status: l.status as any,
      trx_id: l.trx_id || null,
      payment_method: l.payment_method || null,
      expires_at: l.expires_at,
      created_at: l.created_at,
    }));
  }
}
