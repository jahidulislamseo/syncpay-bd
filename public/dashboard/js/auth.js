/**
 * SyncPay BD — Auth & Session Manager
 * Handles merchant login, registration, package-based access control
 */

const PLANS = {
  starter: {
    label: 'Starter 1',
    badge: '🟢 Starter 1',
    color: '#10b981',
    txLimit: 500,
    deviceLimit: 1,
    siteLimit: 1,
    features: ['transactions', 'invoices', 'devices', 'payment-methods', 'quick-verify', 'sms-logs'],
    locked: ['api-keys', 'webhooks', 'docs', 'plugins', 'reports'],
  },
  pro: {
    label: 'Pro 2',
    badge: '🔵 Pro 2',
    color: '#0284c7',
    txLimit: 2000,
    deviceLimit: 2,
    siteLimit: 2,
    features: ['transactions', 'invoices', 'devices', 'payment-methods', 'quick-verify', 'sms-logs', 'api-keys', 'webhooks', 'docs', 'plugins', 'reports'],
    locked: [],
  },
  business: {
    label: 'Business 3',
    badge: '⭐ Business 3',
    color: '#0284c7',
    txLimit: Infinity,
    deviceLimit: 3,
    siteLimit: 3,
    features: ['transactions', 'invoices', 'devices', 'payment-methods', 'quick-verify', 'sms-logs', 'api-keys', 'webhooks', 'docs', 'plugins', 'reports'],
    locked: [],
  },
  enterprise: {
    label: 'Enterprise 5',
    badge: '⚡ Enterprise 5',
    color: '#8b5cf6',
    txLimit: Infinity,
    deviceLimit: 5,
    siteLimit: 5,
    features: ['transactions', 'invoices', 'devices', 'payment-methods', 'quick-verify', 'sms-logs', 'api-keys', 'webhooks', 'docs', 'plugins', 'reports'],
    locked: [],
  },
  growth: {
    label: 'Growth 20',
    badge: '🔵 Growth 20',
    color: '#0284c7',
    txLimit: Infinity,
    deviceLimit: 20,
    siteLimit: 20,
    features: ['transactions', 'invoices', 'devices', 'payment-methods', 'quick-verify', 'sms-logs', 'api-keys', 'webhooks', 'docs', 'plugins', 'reports'],
    locked: [],
  },
  agency: {
    label: 'Agency 4',
    badge: '🟣 Agency 4',
    color: '#a855f7',
    txLimit: Infinity,
    deviceLimit: 4,
    siteLimit: 4,
    features: ['transactions', 'invoices', 'devices', 'payment-methods', 'quick-verify', 'sms-logs', 'api-keys', 'webhooks', 'docs', 'plugins', 'reports'],
    locked: [],
  },
  elite: {
    label: 'Elite 10',
    badge: '👑 Elite 10',
    color: '#f59e0b',
    txLimit: Infinity,
    deviceLimit: 10,
    siteLimit: 10,
    features: ['transactions', 'invoices', 'devices', 'payment-methods', 'quick-verify', 'sms-logs', 'api-keys', 'webhooks', 'docs', 'plugins', 'reports'],
    locked: [],
  },
  scale: {
    label: 'Scale 30',
    badge: '🚀 Scale 30',
    color: '#ec4899',
    txLimit: Infinity,
    deviceLimit: 30,
    siteLimit: 30,
    features: ['transactions', 'invoices', 'devices', 'payment-methods', 'quick-verify', 'sms-logs', 'api-keys', 'webhooks', 'docs', 'plugins', 'reports'],
    locked: [],
  },
  mega: {
    label: 'Mega 50',
    badge: '💎 Mega 50',
    color: '#6366f1',
    txLimit: Infinity,
    deviceLimit: 50,
    siteLimit: 50,
    features: ['transactions', 'invoices', 'devices', 'payment-methods', 'quick-verify', 'sms-logs', 'api-keys', 'webhooks', 'docs', 'plugins', 'reports'],
    locked: [],
  },
};

const DEMO_ACCOUNTS = [
  {
    id: 'm_demo_101',
    email: 'demo@syncpaybd.site',
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
    if (!merchant) return { ok: false, error: 'Email address not found.' };
    if (merchant.password !== password) return { ok: false, error: 'Invalid password.' };
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
      return { ok: false, error: 'An account with this email already exists.' };
    }
    if (!name || !business || !email || !password) {
      return { ok: false, error: 'Please fill in all required fields.' };
    }
    if (password.length < 6) {
      return { ok: false, error: 'Password must be at least 6 characters.' };
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

  checkSubscription(session) {
    if (!session) return { status: 'EXPIRED', daysLeft: 0, isExpired: true, expiresAt: null };
    
    // If no expiration date exists yet, grant 30 days active trial
    if (!session.expiresAt) {
      session.expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
      session.planStatus = 'ACTIVE';
      session.billingCycle = session.billingCycle || 'monthly';
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    }

    const now = Date.now();
    const expTime = new Date(session.expiresAt).getTime();
    const diffDays = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      session.planStatus = 'EXPIRED';
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      return { status: 'EXPIRED', daysLeft: 0, isExpired: true, expiresAt: session.expiresAt };
    }

    session.planStatus = 'ACTIVE';
    return { status: 'ACTIVE', daysLeft: diffDays, isExpired: false, expiresAt: session.expiresAt };
  },

  activatePaidPlan(planId, billingCycle = 'monthly', trxId = '', amount = 0) {
    const session = this.getSession();
    if (!session) return { ok: false, error: 'No active session' };

    const durationDays = billingCycle === 'yearly' ? 365 : 30;
    const now = new Date();
    const expiresAt = new Date(Date.now() + durationDays * 86400000).toISOString();

    session.plan = planId;
    session.planStatus = 'ACTIVE';
    session.billingCycle = billingCycle;
    session.planActivatedAt = now.toISOString();
    session.expiresAt = expiresAt;
    session.lastPaidAmount = amount;
    session.lastPaidTrx = trxId;

    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));

    // Update in stored accounts list
    const custom = JSON.parse(localStorage.getItem(this.ACCOUNTS_KEY) || '[]');
    const idx = custom.findIndex(a => a.email === session.email);
    if (idx !== -1) {
      custom[idx].plan = planId;
      custom[idx].planStatus = 'ACTIVE';
      custom[idx].billingCycle = billingCycle;
      custom[idx].expiresAt = expiresAt;
      localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(custom));
    }

    return { ok: true, session, expiresAt, durationDays };
  },

  simulateExpiry(daysLeft = 0) {
    const session = this.getSession();
    if (!session) return;
    session.expiresAt = new Date(Date.now() + daysLeft * 86400000).toISOString();
    session.planStatus = daysLeft <= 0 ? 'EXPIRED' : 'ACTIVE';
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return this.checkSubscription(session);
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
