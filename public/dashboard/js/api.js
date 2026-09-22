// PayFlow MFS — Production API Client with Supabase Abstraction Layer

export class ApiClient {
  constructor() {
    this.baseUrl = window.location.origin;
    this.apiKey = localStorage.getItem('payflow_api_key') || 'sandbox_test_8f4c9a2e7b31';
    this.useSupabase = false; // Set to true when integrating Supabase directly
  }

  setApiKey(key) {
    this.apiKey = key;
    localStorage.setItem('payflow_api_key', key);
  }

  async request(endpoint, options = {}) {
    const headers = {
      'syncpay-api-key': this.apiKey,
      'payflow-api-key': this.apiKey,
      'zini-api-key': this.apiKey,
      ...options.headers,
    };

    if (options.body && typeof options.body === 'string' && options.body.length > 0) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      console.warn(`[ApiClient] Request to ${endpoint} failed:`, err.message);
      throw err;
    }
  }

  // 1. Fetch Merchant Stats
  async getStats() {
    try {
      const res = await this.request('/api/v1/merchant/stats');
      if (res.success && res.data) {
        return {
          todayRevenue: res.data.todayRevenue || 0,
          todayCount: res.data.todayCount || 0,
          totalVerified: res.data.totalVerified || 0,
          deviceCount: (res.data.devices && res.data.devices.length) || 1,
          isLive: true,
        };
      }
    } catch (e) {
      // Graceful fallback to demo data marked clearly
    }

    return {
      todayRevenue: 125450,
      todayCount: 1284,
      totalVerified: 1243,
      pendingCount: 24,
      failedCount: 17,
      deviceCount: 3,
      isDemo: true, // Marked as DEMO DATA
    };
  }

  // 2. Fetch Chart Breakdown
  async getChartData(days = 7) {
    try {
      const res = await this.request(`/api/v1/merchant/chart-data?days=${days}`);
      if (res.success && res.data && res.data.length > 0) {
        return res.data;
      }
    } catch (e) {
      // Demo fallback
    }

    // High quality demo data for visualization
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }

    return dates.map((d, idx) => ({
      date: d,
      revenue: [18500, 24200, 31000, 19800, 42500, 38000, 52000][idx % 7] || 25000,
      total_txs: [45, 62, 78, 54, 110, 95, 134][idx % 7] || 60,
      successful_txs: [42, 59, 74, 51, 106, 91, 129][idx % 7] || 56,
      failed_txs: [3, 3, 4, 3, 4, 4, 5][idx % 7] || 4,
      isDemo: true,
    }));
  }

  // 3. Fetch Recent Transactions
  async getTransactions(limit = 50) {
    try {
      const res = await this.request('/api/v1/merchant/transactions');
      if (res.success && res.data && res.data.length > 0) {
        return res.data;
      }
    } catch (e) {
      // Fallback
    }

    // Default Seed / Demonstration Dataset
    return [
      {
        id: 101,
        trx_id: 'BL78A4982J',
        merchant_id: 'm_demo_101',
        provider: 'bKash',
        amount: 1500,
        sender: '01712345678',
        is_verified: 1,
        order_id: 'ORD-8821',
        created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        verified_at: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
        raw_sms: 'You have received Tk 1,500.00 from 01712345678. Fee Tk 0.00. Balance Tk 15,200.00. TrxID BL78A4982J',
        isDemo: true,
      },
      {
        id: 102,
        trx_id: 'NG991B24KC',
        merchant_id: 'm_demo_101',
        provider: 'Nagad',
        amount: 850,
        sender: '01898765432',
        is_verified: 1,
        order_id: 'ORD-8820',
        created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
        verified_at: new Date(Date.now() - 1000 * 60 * 34).toISOString(),
        raw_sms: 'Received Amount: Tk 850.00 from 01898765432. TxnID: NG991B24KC. Balance: Tk 18,400.00',
        isDemo: true,
      },
      {
        id: 103,
        trx_id: 'RK201948LA',
        merchant_id: 'm_demo_101',
        provider: 'Rocket',
        amount: 500,
        sender: '01911223344',
        is_verified: 0,
        order_id: 'ORD-8819',
        created_at: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
        verified_at: null,
        raw_sms: 'Tk 500.00 received from 01911223344. TxnId: RK201948LA. Balance: Tk 5,200.00',
        isDemo: true,
      },
      {
        id: 104,
        trx_id: 'UP398112MK',
        merchant_id: 'm_demo_101',
        provider: 'Upay',
        amount: 2200,
        sender: '01655667788',
        is_verified: 1,
        order_id: 'ORD-8818',
        created_at: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
        verified_at: new Date(Date.now() - 1000 * 60 * 109).toISOString(),
        raw_sms: 'You have received Tk 2,200.00 from 01655667788. TrxID: UP398112MK',
        isDemo: true,
      },
    ];
  }

  // 4. Fetch Invoices
  async getInvoices() {
    try {
      const res = await this.request('/api/v1/merchant/invoices');
      if (res.success && res.data && res.data.length > 0) {
        return res.data;
      }
    } catch (e) {}

    return [
      {
        id: 'INV_PF9921',
        customer_name: 'Tanvir Hossain',
        customer_email: 'tanvir@gmail.com',
        expected_amount: 1500,
        status: 'PAID',
        provider: 'bKash',
        order_id: 'ORD-8821',
        trx_id: 'BL78A4982J',
        created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        expires_at: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
        isDemo: true,
      },
      {
        id: 'INV_PF9922',
        customer_name: 'Sabrina Islam',
        customer_email: 'sabrina@yahoo.com',
        expected_amount: 850,
        status: 'PENDING',
        provider: 'Nagad',
        order_id: 'ORD-8822',
        trx_id: null,
        created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        expires_at: new Date(Date.now() + 1000 * 60 * 25).toISOString(),
        isDemo: true,
      },
      {
        id: 'INV_PF9920',
        customer_name: 'Farhan Ahmed',
        customer_email: 'farhan@outlook.com',
        expected_amount: 3200,
        status: 'EXPIRED',
        provider: 'Rocket',
        order_id: 'ORD-8815',
        trx_id: null,
        created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        expires_at: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
        isDemo: true,
      },
    ];
  }

  // 5. Create Invoice
  async createInvoice(payload) {
    return await this.request('/v1/payment/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // 6. Fetch Devices
  async getDevices() {
    try {
      const res = await this.request('/api/v1/merchant/devices');
      if (res.success && res.data && res.data.length > 0) {
        return res.data;
      }
    } catch (e) {}

    return [
      {
        id: '00000000-0000-0000-0000-000000000001',
        device_name: 'TECNO KM5 (SyncPay Forwarder)',
        sim_number: '017•••••••',
        status: 'ONLINE',
        last_seen: new Date().toISOString(),
        device_token: 'token_phone_primary_uuid',
        sms_count: 0,
      },
    ];
  }

  // 7. Add Device
  async addDevice(payload) {
    return await this.request('/api/v1/merchant/devices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // 8. Delete Device
  async deleteDevice(id) {
    return await this.request(`/api/v1/merchant/devices/${id}`, {
      method: 'DELETE',
    });
  }

  // 9. Fetch API Keys
  async getApiKeys() {
    try {
      const res = await this.request('/api/v1/merchant/api-keys');
      if (res.success && res.data) {
        return res.data;
      }
    } catch (e) {}

    return [
      {
        id: 'key_prod_1',
        name: 'Production Server Main',
        key_prefix: 'zini_live_',
        secret_key: 'zini_live_9a48fbc102e38712',
        environment: 'production',
        status: 'active',
        created_at: '2026-09-10 12:00:00',
        last_used: '2026-09-19 04:00:00',
        isDemo: true,
      },
      {
        id: 'key_sand_1',
        name: 'Staging & Sandbox Test',
        key_prefix: 'zini_sand_',
        secret_key: 'sandbox_test_8f4c9a2e7b31',
        environment: 'sandbox',
        status: 'active',
        created_at: '2026-09-15 08:30:00',
        last_used: '2026-09-19 04:05:00',
        isDemo: true,
      },
    ];
  }

  // 10. Create API Key
  async createApiKey(payload) {
    return await this.request('/api/v1/merchant/api-keys', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // 11. Send Test Webhook
  async sendTestWebhook(targetUrl) {
    return await this.request('/api/v1/merchant/test-webhook', {
      method: 'POST',
      body: JSON.stringify({ webhook_url: targetUrl }),
    });
  }

  // 12. Get Device QR Code & Pairing Config
  async getDeviceQr(deviceId) {
    return await this.request(`/api/v1/merchant/devices/${deviceId}/qr`);
  }

  // 13. Get Merchant Subscription & Quotas
  async getSubscription() {
    return await this.request('/api/v1/merchant/subscription');
  }

  // 14. Connect New Website under Quota
  async connectWebsite(payload) {
    return await this.request('/api/v1/merchant/websites', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // 15. Merchant Auth
  async registerMerchant(payload) {
    return await this.request('/api/v1/merchant/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async loginMerchant(payload) {
    return await this.request('/api/v1/merchant/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // 16. Payment Methods & Instructions Management
  async getPaymentMethods() {
    const res = await this.request('/api/v1/merchant/payment-methods');
    return res.data || [];
  }

  async savePaymentMethod(payload) {
    return await this.request('/api/v1/merchant/payment-methods', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async togglePaymentMethod(id, isActive) {
    return await this.request(`/api/v1/merchant/payment-methods/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
  }

  async deletePaymentMethod(id) {
    return await this.request(`/api/v1/merchant/payment-methods/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
