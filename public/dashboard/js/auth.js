/**
 * SyncPay BD — Auth & Session Manager
 * Handles merchant login, registration, package-based access control
 */

const PLANS = {
  starter: {
    label: 'Starter',
    badge: '🟢 Starter',
    color: '#10b981',
    txLimit: 500,
    deviceLimit: 1,
    siteLimit: 1,
    features: ['transactions', 'invoices', 'devices', 'payment-methods', 'quick-verify', 'sms-logs'],
    locked: ['api-keys', 'webhooks', 'docs', 'plugins', 'reports'],
  },
  growth: {
    label: 'Growth',
    badge: '🔵 Growth',
    color: '#0284c7',
    txLimit: 5000,
    deviceLimit: 3,
    siteLimit: 5,
    features: ['transactions', 'invoices', 'devices', 'payment-methods', 'quick-verify', 'sms-logs', 'api-keys', 'webhooks', 'docs', 'plugins', 'reports'],
    locked: [],
  },
  enterprise: {
    label: 'Enterprise',
    badge: '⚡ Enterprise',
    color: '#8b5cf6',
    txLimit: Infinity,
    deviceLimit: Infinity,
    siteLimit: Infinity,
    features: ['transactions', 'invoices', 'devices', 'payment-methods', 'quick-verify', 'sms-logs', 'api-keys', 'webhooks', 'docs', 'plugins', 'reports'],
    locked: [],
  },
};

const DEMO_ACCOUNTS = [
  {
    id: 'm_demo_101',
    email: 'demo@syncpaybd.xyz',
    password: 'demo1234',
    name: 'Demo Merchant',
    business: 'Demo Store BD',
    plan: 'growth',
    joinedAt: '2025-01-15',
    apiKey: 'live_sk_demo_99410abc',
  },
  {
    id: 'm_starter_001',
    email: 'starter@test.com',
    password: 'test1234',
    name: 'Starter User',
    business: 'My Small Shop',
    plan: 'starter',
    joinedAt: '2026-01-01',
    apiKey: 'live_sk_starter_11111',
  },
  {
    id: 'm_ent_001',
    email: 'enterprise@test.com',
    password: 'ent1234',
    name: 'Enterprise Corp',
    business: 'BigCorp BD Ltd',
    plan: 'enterprise',
    joinedAt: '2024-06-01',
    apiKey: 'live_sk_ent_999abc',
  },
];

export const auth = {
  SESSION_KEY: 'syncpay_session',
  ACCOUNTS_KEY: 'syncpay_accounts',

  getAccounts() {
    const stored = JSON.parse(localStorage.getItem(this.ACCOUNTS_KEY) || '[]');
    const storedEmails = stored.map(a => a.email);
    return [...DEMO_ACCOUNTS.filter(d => !storedEmails.includes(d.email)), ...stored];
  },

  login(email, password) {
    const accounts = this.getAccounts();
    const merchant = accounts.find(a => a.email === email.trim().toLowerCase());
    if (!merchant) return { ok: false, error: 'ইমেইল পাওয়া যায়নি।' };
    if (merchant.password !== password) return { ok: false, error: 'পাসওয়ার্ড ভুল।' };
    const session = {
      merchantId: merchant.id,
      email: merchant.email,
      name: merchant.name,
      business: merchant.business,
      plan: merchant.plan,
      apiKey: merchant.apiKey,
      loginAt: new Date().toISOString(),
    };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return { ok: true, merchant: session };
  },

  register({ name, business, email, password, plan = 'starter' }) {
    const accounts = this.getAccounts();
    if (accounts.find(a => a.email === email.trim().toLowerCase())) {
      return { ok: false, error: 'এই ইমেইলে আগে থেকেই অ্যাকাউন্ট আছে।' };
    }
    if (!name || !business || !email || !password) {
      return { ok: false, error: 'সব তথ্য পূরণ করুন।' };
    }
    if (password.length < 6) {
      return { ok: false, error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' };
    }
    const id = 'm_' + Math.random().toString(36).slice(2, 9);
    const apiKey = 'live_sk_' + Math.random().toString(36).slice(2, 18);
    const newMerchant = {
      id, name, business,
      email: email.trim().toLowerCase(),
      password, plan,
      joinedAt: new Date().toISOString().slice(0, 10),
      apiKey,
    };
    const custom = JSON.parse(localStorage.getItem(this.ACCOUNTS_KEY) || '[]');
    custom.push(newMerchant);
    localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(custom));
    const session = { merchantId: id, email: newMerchant.email, name, business, plan, apiKey, loginAt: new Date().toISOString() };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return { ok: true, merchant: session };
  },

  getSession() {
    try { return JSON.parse(localStorage.getItem(this.SESSION_KEY)); } catch { return null; }
  },

  isLoggedIn() { return !!this.getSession(); },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    window.location.href = '/';
  },

  getPlan(planKey) { return PLANS[planKey] || PLANS.starter; },

  canAccess(feature, planKey) {
    // Use blacklist approach: blocked only if explicitly in 'locked' list
    // home, settings, and any other view are always accessible
    return !this.getPlan(planKey).locked.includes(feature);
  },

  upgradePlan(newPlan) {
    const session = this.getSession();
    if (!session) return;
    session.plan = newPlan;
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    const custom = JSON.parse(localStorage.getItem(this.ACCOUNTS_KEY) || '[]');
    const idx = custom.findIndex(a => a.email === session.email);
    if (idx !== -1) { custom[idx].plan = newPlan; localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(custom)); }
  },

  updateProfile({ name, business, email, phone, website }) {
    const session = this.getSession();
    if (!session) return { ok: false, error: 'No session' };
    if (name) session.name = name;
    if (business) session.business = business;
    if (email) session.email = email;
    if (phone) session.phone = phone;
    if (website) session.website = website;
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));

    const custom = JSON.parse(localStorage.getItem(this.ACCOUNTS_KEY) || '[]');
    const idx = custom.findIndex(a => a.id === session.merchantId || a.email === session.email);
    if (idx !== -1) {
      Object.assign(custom[idx], { name, business, email, phone, website });
      localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(custom));
    }
    return { ok: true, merchant: session };
  },

  getAllPlans() { return PLANS; },
};
