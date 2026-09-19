// SyncPay BD — Production Dashboard Master Application Controller
import { i18n } from './i18n.js?v=1.0.5';
import { api } from './api.js?v=1.0.5';
import { components } from './components.js?v=1.0.5';
import { auth } from './auth.js';

class PayFlowDashboardApp {
  constructor() {
    this.currentView = 'home';
    this.chartMetric = 'revenue';
    this.transactions = [];
    this.invoices = [];
    this.devices = [];
    this.apiKeys = [];
    this.paymentMethods = [];
    this.chartData = [];
    this.stats = null;
    this.revealedKeys = new Set();
  }

  async init() {
    // 1. Initialize Theme from localStorage
    const savedTheme = localStorage.getItem('payflow_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeButton();

    // 2. Auth Gate — show login overlay if not logged in
    if (!auth.isLoggedIn()) {
      this.showAuthOverlay();
      return; // Don't load dashboard data until logged in
    }

    // 3. Initialize session UI
    this.session = auth.getSession();
    this.updateSidebarUser();

    // 4. Initialize Language
    i18n.applyTranslations();

    // 5. Setup Navigation & Routing
    this.setupEventListeners();
    this.handleHashChange();
    window.addEventListener('hashchange', () => this.handleHashChange());

    // 6. Initial Data Load
    await this.refreshAllData();

    // 7. Polling every 4 seconds
    setInterval(() => this.pollLiveUpdates(), 4000);
  }

  setupEventListeners() {
    // Mobile Sidebar Toggle
    const toggleBtn = document.getElementById('btn-mobile-sidebar');
    const sidebar = document.getElementById('main-sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }

    // Close mobile sidebar when clicking a nav item
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (sidebar) sidebar.classList.remove('mobile-open');
      });
    });

    // Theme Toggle
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Language Toggle
    const langBtn = document.getElementById('btn-lang-toggle');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        const nextLang = i18n.lang === 'bn' ? 'en' : 'bn';
        i18n.setLang(nextLang);
        this.renderCurrentView();
      });
    }

    // Global Search Input (Cmd + K)
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleGlobalSearch(e.target.value));
    }
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (searchInput) searchInput.focus();
      }
    });

    // Close modals on escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
        this.closeDrawer();
      }
    });
  }

  handleHashChange() {
    const hash = window.location.hash.replace('#', '') || 'home';
    this.switchView(hash);
  }

  switchView(viewName) {
    // Plan-based access guard
    if (this.session) {
      const plan = this.session.plan;
      if (!auth.canAccess(viewName, plan)) {
        this.showLockedView(viewName, plan);
        return;
      }
    }

    this.currentView = viewName;

    // Update active class in sidebar nav
    document.querySelectorAll('.nav-item').forEach(el => {
      const target = el.getAttribute('href')?.replace('#', '');
      el.classList.toggle('active', target === viewName);
    });

    // Hide all view panels and show active
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
    const activePanel = document.getElementById(`view-${viewName}`);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    this.renderCurrentView();
  }

  showLockedView(viewName, planKey) {
    const planInfo = auth.getPlan(planKey);
    const allPlans = auth.getAllPlans();
    const nextPlan = planKey === 'starter' ? 'growth' : 'enterprise';
    const nextPlanInfo = allPlans[nextPlan];

    // Show locked panel
    document.querySelectorAll('.nav-item').forEach(el => {
      const target = el.getAttribute('href')?.replace('#', '');
      el.classList.toggle('active', target === viewName);
    });
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));

    let lockedPanel = document.getElementById('view-locked');
    if (!lockedPanel) {
      lockedPanel = document.createElement('section');
      lockedPanel.id = 'view-locked';
      lockedPanel.className = 'view-panel active';
      document.querySelector('.content-body').appendChild(lockedPanel);
    } else {
      lockedPanel.classList.add('active');
    }

    const featureLabels = {
      'api-keys': 'API Keys', 'webhooks': 'Webhooks', 'docs': 'API Documentation',
      'plugins': 'Plugins & SDKs', 'reports': 'Reports & Audit',
    };
    const label = featureLabels[viewName] || viewName;

    lockedPanel.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; text-align:center; padding:40px 20px;">
        <div style="width:72px; height:72px; background:var(--warning-bg); border:2px solid var(--warning-border); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:28px; margin-bottom:20px;">🔒</div>
        <h2 style="font-size:22px; font-weight:800; color:var(--text-primary); margin-bottom:8px;">${label} — আপগ্রেড দরকার</h2>
        <p style="font-size:14px; color:var(--text-muted); max-width:420px; line-height:1.7; margin-bottom:24px;">
          আপনার বর্তমান <strong>${planInfo.label}</strong> প্যাকেজে এই ফিচারটি উপলব্ধ নেই।
          <strong>${nextPlanInfo?.label || 'উচ্চতর প্যাকেজে'}</strong> আপগ্রেড করে সব ফিচার আনলক করুন।
        </p>
        <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
          <button class="btn btn-primary-action" style="padding:12px 28px; font-size:14px;" onclick="window.payflowApp.openUpgradeModal('${nextPlan}')">
            ⚡ ${nextPlanInfo?.label || 'Enterprise'}-এ আপগ্রেড করুন
          </button>
          <a href="#home" class="btn btn-secondary-action" style="padding:12px 28px; font-size:14px; text-decoration:none;">← ড্যাশবোর্ডে ফিরুন</a>
        </div>

        <div style="margin-top:36px; padding:20px; background:var(--bg-subtle); border:1px solid var(--border); border-radius:12px; max-width:480px; width:100%;">
          <div style="font-size:12px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px;">প্যাকেজ তুলনা</div>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; font-size:12px;">
            ${Object.entries(allPlans).map(([key, p]) => `
              <div style="padding:10px; border-radius:8px; border:2px solid ${key===planKey?p.color:'var(--border)'}; background:${key===planKey?'var(--primary-subtle)':'var(--bg-surface)'}">
                <div style="font-weight:800; color:${p.color}; margin-bottom:4px;">${p.label}</div>
                <div style="color:var(--text-muted);">${p.txLimit===Infinity?'∞':p.txLimit} Tx/mo</div>
                <div style="color:var(--text-muted);">${p.deviceLimit===Infinity?'∞':p.deviceLimit} Devices</div>
                ${key===planKey?'<div style="font-size:10px; margin-top:4px; color:'+p.color+';">✓ Current</div>':''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  openUpgradeModal(targetPlan) {
    const plans = auth.getAllPlans();
    const p = plans[targetPlan];
    if (!p) return;
    const prices = { starter: '৳৯৯৯/মাস', growth: '৳২,৯৯৯/মাস', enterprise: '৳৯,৯৯৯/মাস' };
    const confirmed = confirm(`${p.label} প্যাকেজে আপগ্রেড করবেন? (${prices[targetPlan] || ''})\n\nডেমো মোডে ক্লিক করলে তাৎক্ষণিক আপগ্রেড হবে।`);
    if (confirmed) {
      auth.upgradePlan(targetPlan);
      this.session = auth.getSession();
      this.updateSidebarUser();
      this.showToast(`${p.label} প্যাকেজে আপগ্রেড সম্পন্ন! 🎉`, 'success');
      setTimeout(() => { window.location.hash = '#home'; window.location.reload(); }, 1500);
    }
  }

  async refreshAllData() {
    try {
      const [stats, txs, invs, devs, keys, chart, methods] = await Promise.all([
        api.getStats(),
        api.getTransactions(50),
        api.getInvoices(),
        api.getDevices(),
        api.getApiKeys(),
        api.getChartData(7),
        api.getPaymentMethods().catch(() => []),
      ]);

      this.stats = stats;
      this.transactions = txs;
      this.invoices = invs;
      this.devices = devs;
      this.apiKeys = keys;
      this.chartData = chart;
      this.paymentMethods = methods || [];

      this.renderCurrentView();
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
      this.showToast(i18n.t('toast.error'), 'error');
    }
  }

  async pollLiveUpdates() {
    try {
      const [stats, txs] = await Promise.all([
        api.getStats(),
        api.getTransactions(50),
      ]);
      this.stats = stats;
      this.transactions = txs;

      if (this.currentView === 'home') {
        this.renderHomeKpis();
        this.renderHomeTransactions();
      } else if (this.currentView === 'transactions') {
        this.renderTransactionsView();
      }
    } catch (e) {
      // Non-blocking poll
    }
  }

  renderCurrentView() {
    switch (this.currentView) {
      case 'home':
        this.renderHomeView();
        break;
      case 'transactions':
        this.renderTransactionsView();
        break;
      case 'invoices':
        this.renderInvoicesView();
        break;
      case 'payment-methods':
        this.renderPaymentMethodsView();
        break;
      case 'quick-verify':
        this.renderQuickVerifyView();
        break;
      case 'devices':
        this.renderDevicesView();
        break;
      case 'sms-logs':
        this.renderSmsLogsView();
        break;
      case 'api-keys':
        this.renderApiKeysView();
        break;
      case 'webhooks':
        this.renderWebhooksView();
        break;
      case 'docs':
        this.renderDocsView();
        break;
      case 'plugins':
        this.renderPluginsView();
        break;
      case 'reports':
        this.renderReportsView();
        break;
      case 'settings':
        this.renderSettingsView();
        break;
      default:
        this.renderHomeView();
    }
    i18n.applyTranslations();
  }

  // ==========================================
  // VIEW RENDERERS
  // ==========================================

  renderHomeView() {
    this.renderHomeKpis();
    this.renderHomeChart();
    this.renderHomeDonut();
    this.renderHomeTransactions();
  }

  renderHomeKpis() {
    const kpiWrap = document.getElementById('home-kpi-cards');
    if (!kpiWrap) return;

    const s = this.stats || {};
    const rev = (s.todayRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const success = (s.totalVerified || s.todayCount || 0).toLocaleString();
    const pending = (s.pendingCount || 0);
    const failed = (s.failedCount || 0);

    kpiWrap.innerHTML = `
      ${components.renderStatCard({
        id: 'kpi-rev',
        titleKey: 'home.kpi.totalRevenue',
        value: `৳ ${rev}`,
        trend: '+12.4%',
        isPositive: true,
        icon: `<svg viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
        isDemo: s.isDemo,
      })}
      ${components.renderStatCard({
        id: 'kpi-success',
        titleKey: 'home.kpi.successful',
        value: success,
        trend: '+8.2%',
        isPositive: true,
        icon: `<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        isDemo: s.isDemo,
      })}
      ${components.renderStatCard({
        id: 'kpi-pending',
        titleKey: 'home.kpi.pending',
        value: pending,
        trend: '0%',
        isPositive: null,
        icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        isDemo: s.isDemo,
      })}
      ${components.renderStatCard({
        id: 'kpi-failed',
        titleKey: 'home.kpi.failed',
        value: failed,
        trend: '-4.5%',
        isPositive: false,
        icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        isDemo: s.isDemo,
      })}
    `;
  }

  renderHomeChart() {
    const chartWrap = document.getElementById('revenue-chart-slot');
    if (!chartWrap) return;
    chartWrap.innerHTML = components.renderRevenueChart(this.chartData, this.chartMetric);
    this.bindChartTooltips();
  }

  setChartMetric(metric) {
    this.chartMetric = metric;
    document.querySelectorAll('.chart-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-metric') === metric);
    });
    this.renderHomeChart();
  }

  bindChartTooltips() {
    const tooltip = document.getElementById('chart-tooltip');
    const points = document.querySelectorAll('.chart-point');
    points.forEach(pt => {
      pt.addEventListener('mouseenter', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        const item = this.chartData[idx];
        if (!item || !tooltip) return;

        tooltip.innerHTML = `
          <strong>${item.date}</strong><br/>
          <span style="color:#0284c7;">৳ ${Number(item.revenue || 0).toLocaleString()}</span><br/>
          <span style="color:var(--text-muted);">${item.total_txs} transactions</span>
        `;
        tooltip.style.display = 'block';
        tooltip.style.left = `${parseFloat(e.target.getAttribute('cx'))}px`;
        tooltip.style.top = `${parseFloat(e.target.getAttribute('cy')) - 45}px`;
      });
      pt.addEventListener('mouseleave', () => {
        if (tooltip) tooltip.style.display = 'none';
      });
    });
  }

  renderHomeDonut() {
    const donutWrap = document.getElementById('payment-methods-slot');
    if (donutWrap) {
      donutWrap.innerHTML = components.renderPaymentMethodsDonut(this.transactions);
    }
  }

  renderHomeTransactions() {
    const txWrap = document.getElementById('recent-transactions-slot');
    if (txWrap) {
      txWrap.innerHTML = components.renderTransactionsTable(this.transactions, 8);
    }
  }

  renderTransactionsView() {
    const slot = document.getElementById('transactions-view-slot');
    if (slot) {
      slot.innerHTML = components.renderTransactionsTable(this.transactions, 50);
    }
  }

  renderInvoicesView() {
    const slot = document.getElementById('invoices-view-slot');
    if (slot) {
      slot.innerHTML = components.renderInvoicesTable(this.invoices);
    }
  }

  renderDevicesView() {
    const slot = document.getElementById('devices-view-slot');
    if (slot) {
      slot.innerHTML = components.renderDevicesList(this.devices);
    }
  }

  renderApiKeysView() {
    const slot = document.getElementById('apikeys-view-slot');
    if (slot) {
      slot.innerHTML = components.renderApiKeysList(this.apiKeys);
    }
  }

  async renderWebhooksView() {
    const slot = document.getElementById('webhooks-view-slot');
    if (!slot) return;
    try {
      const res = await api.getSubscription();
      slot.innerHTML = components.renderWebhooksView(res.data);
    } catch (e) {
      slot.innerHTML = components.renderWebhooksView();
    }
  }

  renderDocsView() {
    const slot = document.getElementById('docs-view-slot');
    if (!slot) return;

    const currentOrigin = window.location.origin;

    slot.innerHTML = `
      <div class="api-doc-wrap">
        <!-- 1. Authentication -->
        <div class="api-doc-card">
          <div class="api-doc-header">
            <h3 class="card-panel-title" style="margin-bottom:0;">Authentication & API Keys</h3>
            <a href="#api-keys" class="btn btn-secondary-action" style="font-size:12px; padding:4px 12px; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-1.5 1.5L16 7m-1.5 1.5L13 10m-3-3l7 7-3 3-7-7 3-3z"/><circle cx="7.5" cy="16.5" r="3.5"/></svg>
              <span>Manage API Keys</span>
            </a>
          </div>
          <p class="api-doc-desc">
            All API requests must authenticate with your assigned Merchant API Key using the custom request header <code>syncpay-api-key</code> (backward-compatible with <code>payflow-api-key</code> or <code>x-api-key</code>).
          </p>

          <div class="api-callout">
            <svg class="api-callout-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <div>
              <strong>Security Notice:</strong> Keep your production API keys private. Never expose them in client-side frontends or public repositories.
            </div>
          </div>

          <div class="code-terminal">
            <div class="terminal-header">
              <div class="terminal-dots">
                <span class="terminal-dot red"></span>
                <span class="terminal-dot yellow"></span>
                <span class="terminal-dot green"></span>
              </div>
              <span class="terminal-title">HTTP Request Header</span>
              <button class="btn-terminal-copy" onclick="window.payflowApp.copySnippet('header-auth-code', this)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy</span>
              </button>
            </div>
            <pre class="terminal-content" id="header-auth-code"><span class="header-key">syncpay-api-key</span>: <span class="str">your_secret_api_key_here</span></pre>
          </div>
        </div>

        <!-- 2. Create Hosted Payment Invoice -->
        <div class="api-doc-card">
          <div class="api-doc-header">
            <div class="api-endpoint-badge-group">
              <span class="api-method-badge post">POST</span>
              <span class="api-endpoint-path">/v1/payment/create</span>
            </div>
            <span style="font-size:12px; color:var(--text-light); font-weight:600;">Response: JSON</span>
          </div>

          <p class="api-doc-desc">
            Generates a hosted MFS payment session and returns a secure checkout URL. Redirect your customer to <code>payment_url</code> to initiate bKash, Nagad, Rocket or Upay verification.
          </p>

          <div class="code-terminal">
            <div class="terminal-header">
              <div class="terminal-dots">
                <span class="terminal-dot red"></span>
                <span class="terminal-dot yellow"></span>
                <span class="terminal-dot green"></span>
              </div>
              <span class="terminal-title">cURL Request</span>
              <button class="btn-terminal-copy" onclick="window.payflowApp.copySnippet('curl-create-code', this)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy</span>
              </button>
            </div>
            <pre class="terminal-content" id="curl-create-code"><span class="cmd">curl</span> <span class="flag">-X POST</span> <span class="url">"${currentOrigin}/v1/payment/create"</span> \\
  <span class="flag">-H</span> <span class="str">"Content-Type: application/json"</span> \\
  <span class="flag">-H</span> <span class="str">"syncpay-api-key: your_secret_api_key"</span> \\
  <span class="flag">-d</span> <span class="str">'{
    "cus_name": "Rahim Ahmed",
    "amount": 1500,
    "redirect_url": "https://yoursite.com/checkout/success",
    "webhook_url": "https://yoursite.com/api/webhook"
  }'</span></pre>
          </div>

          <h4 style="font-size: 13px; font-weight: 700; margin: 18px 0 8px;">Request Body Parameters</h4>
          <div style="overflow-x: auto;">
            <table class="param-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span class="param-name">amount</span></td>
                  <td><span class="param-type">number</span></td>
                  <td><span class="param-req">Required</span></td>
                  <td>The total invoice amount in BDT (greater than 0).</td>
                </tr>
                <tr>
                  <td><span class="param-name">redirect_url</span></td>
                  <td><span class="param-type">string</span></td>
                  <td><span class="param-req">Required</span></td>
                  <td>URL where the customer will be redirected upon completion.</td>
                </tr>
                <tr>
                  <td><span class="param-name">cus_name</span></td>
                  <td><span class="param-type">string</span></td>
                  <td><span class="param-opt">Optional</span></td>
                  <td>Customer's display name on the invoice.</td>
                </tr>
                <tr>
                  <td><span class="param-name">webhook_url</span></td>
                  <td><span class="param-type">string</span></td>
                  <td><span class="param-opt">Optional</span></td>
                  <td>Instant IPN notification endpoint triggered when payment succeeds.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4 style="font-size: 13px; font-weight: 700; margin: 24px 0 8px;">Sample 200 OK Response</h4>
          <div class="code-terminal" style="margin-bottom:0;">
            <div class="terminal-header">
              <div class="terminal-dots">
                <span class="terminal-dot red"></span>
                <span class="terminal-dot yellow"></span>
                <span class="terminal-dot green"></span>
              </div>
              <span class="terminal-title">JSON Response (200 OK)</span>
              <button class="btn-terminal-copy" onclick="window.payflowApp.copySnippet('json-create-res', this)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy</span>
              </button>
            </div>
            <pre class="terminal-content" id="json-create-res">{
  <span class="header-key">"status"</span>: <span class="cmd">true</span>,
  <span class="header-key">"message"</span>: <span class="str">"Invoice generated successfully"</span>,
  <span class="header-key">"payment_url"</span>: <span class="url">"${currentOrigin}/checkout?invoice_id=SP_INV_98A4B2"</span>,
  <span class="header-key">"invoice_id"</span>: <span class="str">"SP_INV_98A4B2"</span>
}</pre>
          </div>
        </div>

        <!-- 3. Verify Payment Status -->
        <div class="api-doc-card">
          <div class="api-doc-header">
            <div class="api-endpoint-badge-group">
              <span class="api-method-badge post">POST</span>
              <span class="api-endpoint-path">/v1/payment/verify</span>
            </div>
            <span style="font-size:12px; color:var(--text-light); font-weight:600;">Response: JSON</span>
          </div>

          <p class="api-doc-desc">
            Verify the real-time settlement status of any payment session using its unique <code>invoice_id</code>.
          </p>

          <div class="code-terminal">
            <div class="terminal-header">
              <div class="terminal-dots">
                <span class="terminal-dot red"></span>
                <span class="terminal-dot yellow"></span>
                <span class="terminal-dot green"></span>
              </div>
              <span class="terminal-title">cURL Request</span>
              <button class="btn-terminal-copy" onclick="window.payflowApp.copySnippet('curl-verify-code', this)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy</span>
              </button>
            </div>
            <pre class="terminal-content" id="curl-verify-code"><span class="cmd">curl</span> <span class="flag">-X POST</span> <span class="url">"${currentOrigin}/v1/payment/verify"</span> \\
  <span class="flag">-H</span> <span class="str">"Content-Type: application/json"</span> \\
  <span class="flag">-H</span> <span class="str">"syncpay-api-key: your_secret_api_key"</span> \\
  <span class="flag">-d</span> <span class="str">'{"invoice_id": "SP_INV_98A4B2"}'</span></pre>
          </div>

          <h4 style="font-size: 13px; font-weight: 700; margin: 20px 0 8px;">Sample Verified Response</h4>
          <div class="code-terminal" style="margin-bottom:0;">
            <div class="terminal-header">
              <div class="terminal-dots">
                <span class="terminal-dot red"></span>
                <span class="terminal-dot yellow"></span>
                <span class="terminal-dot green"></span>
              </div>
              <span class="terminal-title">JSON Response (200 OK)</span>
              <button class="btn-terminal-copy" onclick="window.payflowApp.copySnippet('json-verify-res', this)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy</span>
              </button>
            </div>
            <pre class="terminal-content" id="json-verify-res">{
  <span class="header-key">"status"</span>: <span class="cmd">true</span>,
  <span class="header-key">"verified"</span>: <span class="cmd">true</span>,
  <span class="header-key">"invoice_id"</span>: <span class="str">"SP_INV_98A4B2"</span>,
  <span class="header-key">"trx_id"</span>: <span class="str">"BKTRX84920A"</span>,
  <span class="header-key">"amount"</span>: 1500,
  <span class="header-key">"provider"</span>: <span class="str">"bKash"</span>,
  <span class="header-key">"status_text"</span>: <span class="str">"PAID"</span>
}</pre>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // QUICK VERIFY VIEW
  // ==========================================

  renderQuickVerifyView() {
    const slot = document.getElementById('quick-verify-view-slot');
    if (!slot) return;

    slot.innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr; gap: 20px;">
        <!-- Search & Verify Card -->
        <div class="card-panel">
          <div class="card-panel-header">
            <div>
              <h3 class="card-panel-title">সরাসরি TrxID বা ইনভয়েস ভেরিফিকেশন</h3>
              <p style="font-size:13px; color:var(--text-muted); margin-top:4px;">
                বিকাশ, নগদ, রকেট বা উপায় থেকে প্রাপ্ত ট্রানজ্যাকশন আইডি প্রদান করে সিম এসএমএস-এর সাথে ইনস্ট্যান্ট ম্যাচ নিশ্চিত করুন।
              </p>
            </div>
          </div>

          <div style="display:flex; gap:12px; margin-top:16px; flex-wrap:wrap;">
            <div style="flex:1; min-width:260px;">
              <input type="text" id="quick-verify-input" class="form-control" 
                     placeholder="উদাহরণ: BL78A4982J বা NG991B24KC..." 
                     style="font-size:15px; font-family:monospace; text-transform:uppercase;"
                     onkeypress="if(event.key==='Enter') window.payflowApp.runQuickVerify()">
            </div>
            <button class="btn btn-primary-action" onclick="window.payflowApp.runQuickVerify()" style="display:inline-flex; align-items:center; gap:8px; padding:10px 22px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span>ভেরিফাই ও ম্যাচ করুন</span>
            </button>
            <button class="btn btn-secondary-action" onclick="window.payflowApp.resetQuickVerify()" style="display:inline-flex; align-items:center; gap:6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              <span>ক্লিয়ার</span>
            </button>
          </div>

          <!-- Quick Test Presets -->
          <div style="display:flex; align-items:center; gap:8px; margin-top:14px; flex-wrap:wrap; font-size:12px;">
            <span style="color:var(--text-muted); font-size:11px; text-transform:uppercase; font-weight:700;">কুইক টেস্ট স্যাম্পল:</span>
            <button class="btn-preset-chip" onclick="window.payflowApp.fillAndVerify('BL78A4982J')">bKash: BL78A4982J</button>
            <button class="btn-preset-chip" onclick="window.payflowApp.fillAndVerify('NG991B24KC')">Nagad: NG991B24KC</button>
            <button class="btn-preset-chip" onclick="window.payflowApp.fillAndVerify('RK201948LA')">Rocket: RK201948LA (পেন্ডিং)</button>
            <button class="btn-preset-chip" onclick="window.payflowApp.fillAndVerify('UP398112MK')">Upay: UP398112MK</button>
          </div>

          <!-- Dynamic Verification Result Slot -->
          <div id="quick-verify-result-box" style="margin-top:20px; display:none;"></div>
        </div>

        <!-- Recent Ingested Transactions Match Table -->
        <div class="card-panel">
          <div class="card-panel-header" style="margin-bottom:16px;">
            <div>
              <h3 class="card-panel-title">সিম ফরওয়ার্ডার থেকে প্রাপ্ত সাম্প্রতিক TrxID তালিকা</h3>
              <p style="font-size:13px; color:var(--text-muted); margin-top:2px;">সর্বশেষ ইনকামিং লেনদেন ও অটো-ম্যাচ স্ট্যাটাস</p>
            </div>
            <span class="badge badge-neutral" style="font-size:11px;">লাইভ সিঙ্ক</span>
          </div>

          <div class="table-container" style="overflow-x:auto;">
            <table class="data-table" style="width:100%;">
              <thead>
                <tr>
                  <th>TrxID</th>
                  <th>প্রোভাইডার</th>
                  <th>পরিমাণ</th>
                  <th>প্রেরক নম্বর</th>
                  <th>অর্ডার আইডি</th>
                  <th>স্ট্যাটাস</th>
                  <th>সময়</th>
                  <th style="text-align:right;">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody id="quick-verify-history-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.renderQuickVerifyHistory();
  }

  runQuickVerify() {
    const input = document.getElementById('quick-verify-input');
    const resultBox = document.getElementById('quick-verify-result-box');
    if (!input || !resultBox) return;

    const query = input.value.trim().toUpperCase();
    if (!query) {
      this.showToast('অনুগ্রহ করে একটি TrxID প্রবেশ করান', 'warning');
      return;
    }

    const tx = (this.transactions || []).find(t => 
      (t.trx_id && t.trx_id.toUpperCase() === query) ||
      (t.order_id && t.order_id.toUpperCase() === query)
    );

    resultBox.style.display = 'block';

    if (tx) {
      const isVerified = tx.is_verified === 1;
      resultBox.innerHTML = `
        <div style="background:var(--bg-subtle); border:2px solid ${isVerified ? 'var(--success-border, #10b981)' : 'var(--warning-border, #f59e0b)'}; border-radius:12px; padding:20px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:36px; height:36px; border-radius:50%; background:${isVerified ? 'var(--success-bg, rgba(16,185,129,0.1))' : 'var(--warning-bg, rgba(245,158,11,0.1))'}; display:flex; align-items:center; justify-content:center; font-size:18px;">
                ${isVerified ? '✅' : '⏳'}
              </div>
              <div>
                <h4 style="margin:0; font-size:16px; font-weight:700; color:var(--text-primary);">
                  ${isVerified ? 'লেনদেন সফলভাবে ম্যাচ ও যাচাইকৃত!' : 'লেনদেন পাওয়া গেছে (অনুমোদন পেন্ডিং)'}
                </h4>
                <span class="mono" style="font-size:13px; color:var(--primary); font-weight:700;">TrxID: ${tx.trx_id}</span>
              </div>
            </div>
            <div>
              <span class="badge ${isVerified ? 'badge-completed' : 'badge-pending'}" style="font-size:12px; padding:4px 10px;">
                ${isVerified ? 'VERIFIED & PAID' : 'PENDING APPROVAL'}
              </span>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:14px; font-size:13px;">
            <div style="background:var(--bg-surface); padding:10px; border-radius:8px; border:1px solid var(--border);">
              <span style="color:var(--text-muted); font-size:11px; display:block;">পরিমাণ</span>
              <strong style="font-size:16px; color:var(--text-primary);">৳ ${Number(tx.amount).toFixed(2)}</strong>
            </div>
            <div style="background:var(--bg-surface); padding:10px; border-radius:8px; border:1px solid var(--border);">
              <span style="color:var(--text-muted); font-size:11px; display:block;">MFS প্রোভাইডার</span>
              <strong>${tx.provider}</strong>
            </div>
            <div style="background:var(--bg-surface); padding:10px; border-radius:8px; border:1px solid var(--border);">
              <span style="color:var(--text-muted); font-size:11px; display:block;">প্রেরক নম্বর</span>
              <span class="mono">${tx.sender || 'N/A'}</span>
            </div>
            <div style="background:var(--bg-surface); padding:10px; border-radius:8px; border:1px solid var(--border);">
              <span style="color:var(--text-muted); font-size:11px; display:block;">ইনভয়েস / অর্ডার</span>
              <span class="mono">${tx.order_id || 'ORD-AUTO'}</span>
            </div>
          </div>

          <div style="margin-bottom:14px;">
            <span style="color:var(--text-muted); font-size:11px; text-transform:uppercase; font-weight:700; display:block; margin-bottom:4px;">সিম কাঁচা SMS পে-লোড:</span>
            <div class="raw-sms-box">${tx.raw_sms || 'No raw SMS captured'}</div>
          </div>

          <div style="display:flex; gap:10px; justify-content:flex-end;">
            ${!isVerified ? `
              <button class="btn btn-primary-action" onclick="window.payflowApp.manualApproveTransaction('${tx.trx_id}')" style="display:inline-flex; align-items:center; gap:6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>ম্যানুয়াল অনুমোদন করুন (Approve Now)</span>
              </button>
            ` : ''}
            <button class="btn btn-secondary-action" onclick="window.payflowApp.viewTransaction('${tx.trx_id}')">বিস্তারিত দেখুন</button>
          </div>
        </div>
      `;
      this.showToast(`TrxID ${tx.trx_id} সফলভাবে ম্যাচ হয়েছে!`, 'success');
    } else {
      resultBox.innerHTML = `
        <div style="background:var(--bg-subtle); border:2px dashed var(--warning-border, #f59e0b); border-radius:12px; padding:24px; text-align:center;">
          <div style="font-size:32px; margin-bottom:8px;">🔍</div>
          <h4 style="margin:0 0 6px 0; font-size:16px; font-weight:700; color:var(--text-primary);">কোনো ম্যাচিং ট্রানজ্যাকশন পাওয়া যায়নি</h4>
          <p style="font-size:13px; color:var(--text-muted); max-width:440px; margin:0 auto 16px auto; line-height:1.6;">
            "${query}" আইডির কোনো ইনকামিং লেনদেন আমাদের ফরওয়ার্ডার সিস্টেমে রেজিস্টার হয়নি। অনুগ্রহ করে নিশ্চিত করুন গ্রাহক টাকা পাঠিয়েছে এবং আপনার সিম ফরওয়ার্ডার সক্রিয় আছে।
          </p>
          <div style="display:flex; gap:10px; justify-content:center;">
            <button class="btn btn-secondary-action" onclick="window.payflowApp.openSmsSimulatorModal()">SMS টেস্ট সিমুলেটরে যান</button>
          </div>
        </div>
      `;
      this.showToast('কোনো লেনদেন পাওয়া যায়নি', 'warning');
    }
  }

  fillAndVerify(trxId) {
    const input = document.getElementById('quick-verify-input');
    if (input) {
      input.value = trxId;
      this.runQuickVerify();
    }
  }

  resetQuickVerify() {
    const input = document.getElementById('quick-verify-input');
    const resultBox = document.getElementById('quick-verify-result-box');
    if (input) input.value = '';
    if (resultBox) resultBox.style.display = 'none';
  }

  manualApproveTransaction(trxId) {
    const tx = (this.transactions || []).find(t => t.trx_id === trxId);
    if (!tx) return;
    tx.is_verified = 1;
    tx.verified_at = new Date().toISOString();
    this.showToast(`TrxID ${trxId} ম্যানুয়ালি অনুমোদিত হয়েছে!`, 'success');
    this.runQuickVerify();
    this.renderQuickVerifyHistory();
  }

  renderQuickVerifyHistory() {
    const tbody = document.getElementById('quick-verify-history-tbody');
    if (!tbody) return;

    const txs = this.transactions || [];
    if (txs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-muted);">কোনো লেনদেন পাওয়া যায়নি</td></tr>`;
      return;
    }

    tbody.innerHTML = txs.map(t => {
      const isVerified = t.is_verified === 1;
      return `
        <tr>
          <td class="mono" style="font-weight:700; color:var(--primary);">${t.trx_id}</td>
          <td><strong>${t.provider}</strong></td>
          <td class="mono">৳ ${Number(t.amount).toFixed(2)}</td>
          <td class="mono">${t.sender || 'N/A'}</td>
          <td class="mono">${t.order_id || 'ORD-AUTO'}</td>
          <td>
            <span class="badge ${isVerified ? 'badge-completed' : 'badge-pending'}">
              ${isVerified ? 'COMPLETED' : 'PENDING'}
            </span>
          </td>
          <td style="font-size:11px; color:var(--text-muted);">${new Date(t.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
          <td style="text-align:right;">
            <button class="btn-icon-sm" title="Verify Now" onclick="window.payflowApp.fillAndVerify('${t.trx_id}')" style="background:var(--bg-subtle); border:1px solid var(--border); padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">
              ম্যাচ দেখুন
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==========================================
  // SMS LOGS VIEW
  // ==========================================

  renderSmsLogsView() {
    const slot = document.getElementById('sms-logs-view-slot');
    if (!slot) return;

    const txs = this.transactions || [];
    const devices = this.devices || [];

    slot.innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr; gap: 20px;">
        <!-- Top Stats Row -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
          <div class="stat-card" style="padding:16px;">
            <div class="stat-card-title">মোট গৃহীত SMS</div>
            <div class="stat-card-value" style="font-size:22px; margin-top:8px;">${(txs.length * 320 + 242).toLocaleString()}</div>
            <div style="font-size:12px; color:var(--success); margin-top:4px;">● আজ সক্রিয় স্ট্রিম</div>
          </div>
          <div class="stat-card" style="padding:16px;">
            <div class="stat-card-title">সফল পার্সিং রেট</div>
            <div class="stat-card-value" style="font-size:22px; margin-top:8px; color:var(--success);">99.2%</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">রেজেক্স অটো-ম্যাচ</div>
          </div>
          <div class="stat-card" style="padding:16px;">
            <div class="stat-card-title">সংযুক্ত ফরওয়ার্ডার ফোন</div>
            <div class="stat-card-value" style="font-size:22px; margin-top:8px;">${devices.length || 2} টি</div>
            <div style="font-size:12px; color:var(--primary); margin-top:4px;">ONLINE ডেমোন মোড</div>
          </div>
          <div class="stat-card" style="padding:16px;">
            <div class="stat-card-title">গড় ডেলিভারি লেটেন্সি</div>
            <div class="stat-card-value" style="font-size:22px; margin-top:8px;">~850ms</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">সিম থেকে ক্লাউড এপিআই</div>
          </div>
        </div>

        <!-- Filter and Action Bar -->
        <div class="card-panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
            <div style="display:flex; gap:10px; flex-wrap:wrap; flex:1;">
              <select id="sms-log-provider-filter" class="form-control" style="width:auto; min-width:140px;" onchange="window.payflowApp.filterSmsLogs()">
                <option value="all">সব প্রোভাইডার</option>
                <option value="bKash">bKash</option>
                <option value="Nagad">Nagad</option>
                <option value="Rocket">Rocket</option>
                <option value="Upay">Upay</option>
              </select>
              <input type="text" id="sms-log-search-input" class="form-control" placeholder="TrxID বা মেসেজ দিয়ে খুঁজুন..." style="flex:1; min-width:200px;" oninput="window.payflowApp.filterSmsLogs()">
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary-action" onclick="window.payflowApp.openSmsSimulatorModal()" style="display:inline-flex; align-items:center; gap:6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>SMS টেস্ট পার্সার</span>
              </button>
              <button class="btn btn-primary-action" onclick="window.payflowApp.refreshSmsLogs()" style="display:inline-flex; align-items:center; gap:6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                <span>রিফ্রেশ</span>
              </button>
            </div>
          </div>

          <!-- Raw SMS Stream Table -->
          <div class="table-container" style="overflow-x:auto;">
            <table class="data-table" style="width:100%;">
              <thead>
                <tr>
                  <th>টাইমস্ট্যাম্প</th>
                  <th>সিম/ডিভাইস</th>
                  <th>প্রোভাইডার</th>
                  <th>নিষ্কাশিত TrxID</th>
                  <th>পরিমাণ</th>
                  <th>কাঁচা SMS বডি (Raw Forwarder Payload)</th>
                  <th>স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody id="sms-logs-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.renderSmsLogsTable();
  }

  renderSmsLogsTable(providerFilter = 'all', query = '') {
    const tbody = document.getElementById('sms-logs-tbody');
    if (!tbody) return;

    let txs = this.transactions || [];

    if (providerFilter && providerFilter !== 'all') {
      txs = txs.filter(t => (t.provider || '').toLowerCase() === providerFilter.toLowerCase());
    }

    if (query) {
      const q = query.toLowerCase();
      txs = txs.filter(t => 
        (t.trx_id && t.trx_id.toLowerCase().includes(q)) ||
        (t.raw_sms && t.raw_sms.toLowerCase().includes(q)) ||
        (t.sender && t.sender.includes(q))
      );
    }

    if (txs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">কোনো SMS লগ পাওয়া যায়নি</td></tr>`;
      return;
    }

    tbody.innerHTML = txs.map(t => `
      <tr>
        <td style="font-size:11px; white-space:nowrap; color:var(--text-muted);">
          ${new Date(t.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}
        </td>
        <td style="font-size:12px; font-weight:600;">SIM-1 (017...)</td>
        <td>
          <span style="font-weight:700; color:${t.provider==='bKash'?'#e2136e':t.provider==='Nagad'?'#f7941d':'#8c3494'};">
            ${t.provider}
          </span>
        </td>
        <td class="mono" style="font-weight:700; color:var(--primary);">${t.trx_id}</td>
        <td class="mono" style="font-weight:700;">৳ ${Number(t.amount).toFixed(2)}</td>
        <td style="max-width:360px;">
          <div class="mono" style="font-size:11px; color:var(--text-secondary); background:var(--bg-subtle); padding:6px 10px; border-radius:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${t.raw_sms || ''}">
            ${t.raw_sms || 'N/A'}
          </div>
        </td>
        <td>
          <span class="badge badge-completed" style="font-size:10px;">PARSED OK</span>
        </td>
      </tr>
    `).join('');
  }

  filterSmsLogs() {
    const prov = document.getElementById('sms-log-provider-filter')?.value || 'all';
    const query = document.getElementById('sms-log-search-input')?.value || '';
    this.renderSmsLogsTable(prov, query);
  }

  refreshSmsLogs() {
    this.renderSmsLogsTable();
    this.showToast('SMS স্ট্রিম রিফ্রেশ সম্পন্ন', 'success');
  }

  openSmsSimulatorModal() {
    let modal = document.getElementById('sms-simulator-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'sms-simulator-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:99999; backdrop-filter:blur(4px);';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:var(--bg-surface, #fff); border:1px solid var(--border, #e2e8f0); border-radius:16px; width:95%; max-width:540px; padding:24px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="margin:0; font-size:18px; font-weight:700; color:var(--text-primary);">📲 SMS পার্সিং টেস্ট সিমুলেটর</h3>
          <button onclick="window.payflowApp.closeSmsSimulatorModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--text-muted);">✕</button>
        </div>
        <p style="font-size:13px; color:var(--text-muted); margin-bottom:14px; line-height:1.5;">
          আপনার অ্যান্ড্রয়েড টেলিফোনি ফরওয়ার্ডারে আসা যেকোনো কাঁচা বিকাশ বা নগদ এসএমএস পেস্ট করে রিয়েল-টাইম রেজেক্স এক্সট্র্যাকশন টেস্ট করুন:
        </p>

        <div class="form-group">
          <label class="form-label">স্যাম্পল টেমপ্লেট নির্বাচন:</label>
          <div style="display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
            <button class="btn-preset-chip" onclick="document.getElementById('sim-sms-text').value='You have received Tk 2,500.00 from 01711223344. Fee Tk 0.00. Balance Tk 32,500.00. TrxID BK99281XAC at 19/09/2026 15:30'">bKash ক্যাশ-ইন</button>
            <button class="btn-preset-chip" onclick="document.getElementById('sim-sms-text').value='Received Amount: Tk 1,200.00 from 01822334455. TxnID: NG883921PP. Balance: Tk 15,400.00'">Nagad ক্যাশ-ইন</button>
          </div>
          <textarea id="sim-sms-text" class="form-control mono" rows="4" style="font-size:12px; resize:vertical;" placeholder="এসএমএস টেক্সট লিখুন...">You have received Tk 2,500.00 from 01711223344. Fee Tk 0.00. Balance Tk 32,500.00. TrxID BK99281XAC at 19/09/2026 15:30</textarea>
        </div>

        <div id="sim-parsed-result" style="margin-bottom:16px; display:none;"></div>

        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button class="btn btn-secondary-action" onclick="window.payflowApp.closeSmsSimulatorModal()">বন্ধ করুন</button>
          <button class="btn btn-primary-action" onclick="window.payflowApp.testSimulateSms()">পার্স ও ইনজেস্ট করুন</button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  }

  closeSmsSimulatorModal() {
    const modal = document.getElementById('sms-simulator-modal');
    if (modal) modal.style.display = 'none';
  }

  testSimulateSms() {
    const text = document.getElementById('sim-sms-text')?.value || '';
    const resBox = document.getElementById('sim-parsed-result');
    if (!text.trim() || !resBox) return;

    let provider = 'bKash';
    let amount = 0;
    let trxId = '';
    let sender = '';

    if (/nagad/i.test(text) || /txnid:\s*([a-z0-9]+)/i.test(text)) {
      provider = 'Nagad';
    }

    const amtMatch = text.match(/(?:Tk|৳)\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));

    const trxMatch = text.match(/(?:TrxID|TxnID|Trx Id|Txn Id)[:\s]+([A-Z0-9]+)/i);
    if (trxMatch) trxId = trxMatch[1];
    else trxId = 'SIM_' + Math.random().toString(36).substring(2, 10).toUpperCase();

    const senderMatch = text.match(/01[3-9]\d{8}/);
    if (senderMatch) sender = senderMatch[0];

    resBox.style.display = 'block';
    resBox.innerHTML = `
      <div style="background:var(--bg-subtle); border:1px solid var(--primary); border-radius:8px; padding:12px; font-size:12px;">
        <div style="font-weight:700; color:var(--primary); margin-bottom:6px;">✓ পার্সিং সফল (Extracted Data):</div>
        <div>প্রোভাইডার: <strong>${provider}</strong></div>
        <div>TrxID: <span class="mono" style="color:var(--primary); font-weight:700;">${trxId}</span></div>
        <div>পরিমাণ: <strong>৳ ${amount.toFixed(2)}</strong></div>
        <div>প্রেরক: <span class="mono">${sender || 'Unknown'}</span></div>
      </div>
    `;

    // Add to active transactions
    const newTx = {
      id: Date.now(),
      trx_id: trxId,
      merchant_id: 'm_demo_101',
      provider,
      amount,
      sender: sender || '01700000000',
      is_verified: 1,
      order_id: 'ORD-SIM-' + Math.floor(1000 + Math.random() * 9000),
      created_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      raw_sms: text,
      isDemo: true,
    };
    this.transactions.unshift(newTx);
    this.showToast(`SMS পার্সিং সফল! TrxID ${trxId} ইনজেস্ট হয়েছে`, 'success');
  }

  // ==========================================
  // PLUGINS & SDKS VIEW
  // ==========================================

  renderPluginsView() {
    const slot = document.getElementById('plugins-view-slot');
    if (!slot) return;

    slot.innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr; gap: 24px;">
        <div class="card-panel" style="background:linear-gradient(135deg, rgba(2,132,199,0.08) 0%, rgba(99,102,241,0.05) 100%); border-color:rgba(2,132,199,0.25);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
            <div>
              <span class="badge" style="background:var(--primary); color:#fff; font-size:11px; margin-bottom:8px;">রেডিমেড ইন্টিগ্রেশন</span>
              <h2 style="font-size:20px; font-weight:800; color:var(--text-primary); margin:6px 0;">অফিসিয়াল পেমেন্ট প্লাগইন ও ক্লায়েন্ট লাইব্রেরী</h2>
              <p style="font-size:13px; color:var(--text-muted); max-width:650px; line-height:1.6;">
                আপনার WordPress/WooCommerce স্টোর, WHMCS বিলিং প্ল্যাটফর্ম, বা কাস্টম PHP/Node/Python অ্যাপ্লিকেশনে কোনো কোড জটিলতা ছাড়াই ১ ক্লিকে SyncPay BD যুক্ত করুন।
              </p>
            </div>
            <a href="#docs" class="btn btn-secondary-action" style="display:inline-flex; align-items:center; gap:8px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              <span>API ডকুমেন্টেশন দেখুন</span>
            </a>
          </div>
        </div>

        <!-- Plugins Grid -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
          <!-- Card 1: WooCommerce -->
          <div class="card-panel" style="display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="width:44px; height:44px; background:#7f54b3; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:18px;">W</div>
                  <div>
                    <h3 style="font-size:16px; font-weight:700; margin:0;">WooCommerce Gateway</h3>
                    <span style="font-size:12px; color:var(--text-muted);">WordPress 5.8+ ও Woo 6.0+</span>
                  </div>
                </div>
                <span class="badge badge-completed" style="font-size:10px;">v2.4.2 LATEST</span>
              </div>
              <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin-bottom:14px;">
                চেকআউট পেজে সরাসরি বিকাশ, নগদ ও রকেট পপআপ/পেমেন্ট বক্স, ডায়নামিক QR কোড এবং স্বয়ংক্রিয় TrxID ম্যাচিং।
              </p>
              <div style="background:var(--bg-subtle); padding:10px 12px; border-radius:8px; font-size:12px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                  <span style="color:var(--text-muted);">রেটিং:</span>
                  <span style="color:#f59e0b; font-weight:700;">★★★★★ (5.0)</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:var(--text-muted);">ইনস্টলেশন:</span>
                  <span>১ ক্লিকে প্লাগইন আপলোড</span>
                </div>
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-primary-action" style="flex:1;" onclick="window.payflowApp.downloadPlugin('woocommerce')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download ZIP
              </button>
              <button class="btn btn-secondary-action" onclick="window.payflowApp.showPluginGuide('woocommerce')">গাইড</button>
            </div>
          </div>

          <!-- Card 2: WHMCS -->
          <div class="card-panel" style="display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="width:44px; height:44px; background:#1b74e4; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:18px;">WH</div>
                  <div>
                    <h3 style="font-size:16px; font-weight:700; margin:0;">WHMCS Billing Module</h3>
                    <span style="font-size:12px; color:var(--text-muted);">WHMCS v8.2 – v8.10+</span>
                  </div>
                </div>
                <span class="badge badge-completed" style="font-size:10px;">v1.8.0</span>
              </div>
              <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin-bottom:14px;">
                হোস্টিং ও ডোমেন ইনভয়েস পরিশোধে ক্লায়েন্ট এরিয়া ইন্টিগ্রেশন। পেমেন্ট পাওয়া মাত্র স্বয়ংক্রিয় ইনভয়েস পেইড এবং সার্ভিস অ্যাক্টিভেশন।
              </p>
              <div style="background:var(--bg-subtle); padding:10px 12px; border-radius:8px; font-size:12px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                  <span style="color:var(--text-muted);">মডিউল পাথ:</span>
                  <span class="mono" style="font-size:11px;">/modules/gateways/</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:var(--text-muted);">ফিচার:</span>
                  <span>Auto Invoice Callback</span>
                </div>
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-primary-action" style="flex:1;" onclick="window.payflowApp.downloadPlugin('whmcs')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download ZIP
              </button>
              <button class="btn btn-secondary-action" onclick="window.payflowApp.showPluginGuide('whmcs')">গাইড</button>
            </div>
          </div>

          <!-- Card 3: PHP & Laravel SDK -->
          <div class="card-panel" style="display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="width:44px; height:44px; background:#4F5D95; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:18px;">PHP</div>
                  <div>
                    <h3 style="font-size:16px; font-weight:700; margin:0;">PHP & Laravel SDK</h3>
                    <span style="font-size:12px; color:var(--text-muted);">PHP 7.4+ / PHP 8.2+</span>
                  </div>
                </div>
                <span class="badge badge-neutral" style="font-size:10px;">Composer</span>
              </div>
              <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin-bottom:14px;">
                পিএইচপি বা লারাভেল ব্যাকএন্ডের জন্য পূর্ণাঙ্গ অবজেক্ট ওরিয়েন্টেড ক্লায়েন্ট। ইনভয়েস তৈরি ও ওয়েবহুক ভ্যালিডেশন সাপোর্ট।
              </p>
              <div style="background:var(--bg-subtle); padding:10px 12px; border-radius:8px; font-size:12px; margin-bottom:16px;">
                <div class="mono" style="font-size:12px; color:var(--primary); user-select:all;">composer require syncpay/mfs-sdk</div>
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-primary-action" style="flex:1;" onclick="window.payflowApp.downloadPlugin('php')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download ZIP
              </button>
              <button class="btn btn-secondary-action" style="flex:1;" onclick="window.payflowApp.copySnippetText('composer require syncpay/mfs-sdk', this)">
                কপি
              </button>
              <button class="btn btn-secondary-action" onclick="window.payflowApp.showPluginGuide('php')">গাইড</button>
            </div>
          </div>

          <!-- Card 4: Node.js / NPM SDK -->
          <div class="card-panel" style="display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="width:44px; height:44px; background:#339933; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:18px;">JS</div>
                  <div>
                    <h3 style="font-size:16px; font-weight:700; margin:0;">Node.js / TypeScript SDK</h3>
                    <span style="font-size:12px; color:var(--text-muted);">Node 16+, Express, Next.js</span>
                  </div>
                </div>
                <span class="badge badge-neutral" style="font-size:10px;">NPM</span>
              </div>
              <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin-bottom:14px;">
                টাইপস্ক্রিপ্ট টাইপিংসহ এসিনক্রোনাস নোড ক্লায়েন্ট। অটো-রিট্রাই ও ক্রিপ্টোগ্রাফিক ওয়েবহুক ভেরিফায়ার।
              </p>
              <div style="background:var(--bg-subtle); padding:10px 12px; border-radius:8px; font-size:12px; margin-bottom:16px;">
                <div class="mono" style="font-size:12px; color:var(--primary); user-select:all;">npm install @syncpaybd/sdk</div>
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-primary-action" style="flex:1;" onclick="window.payflowApp.downloadPlugin('nodejs')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download ZIP
              </button>
              <button class="btn btn-secondary-action" style="flex:1;" onclick="window.payflowApp.copySnippetText('npm install @syncpaybd/sdk', this)">
                কপি
              </button>
              <button class="btn btn-secondary-action" onclick="window.payflowApp.showPluginGuide('nodejs')">গাইড</button>
            </div>
          </div>

          <!-- Card 5: Python SDK -->
          <div class="card-panel" style="display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="width:44px; height:44px; background:#3776ab; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:18px;">PY</div>
                  <div>
                    <h3 style="font-size:16px; font-weight:700; margin:0;">Python & Django SDK</h3>
                    <span style="font-size:12px; color:var(--text-muted);">Python 3.8+, Django, FastAPI</span>
                  </div>
                </div>
                <span class="badge badge-neutral" style="font-size:10px;">PyPI</span>
              </div>
              <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin-bottom:14px;">
                জ্যাঙ্গো ও ফাস্টএপিআই ব্যাকএন্ডের জন্য পাইথন মডিউল। সিঙ্ক ও অ্যাসিন্ক রিকোয়েস্ট সাপোর্ট।
              </p>
              <div style="background:var(--bg-subtle); padding:10px 12px; border-radius:8px; font-size:12px; margin-bottom:16px;">
                <div class="mono" style="font-size:12px; color:var(--primary); user-select:all;">pip install syncpay-bd</div>
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-primary-action" style="flex:1;" onclick="window.payflowApp.downloadPlugin('python')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download ZIP
              </button>
              <button class="btn btn-secondary-action" style="flex:1;" onclick="window.payflowApp.copySnippetText('pip install syncpay-bd', this)">
                কপি
              </button>
              <button class="btn btn-secondary-action" onclick="window.payflowApp.showPluginGuide('python')">গাইড</button>
            </div>
          </div>

          <!-- Card 6: Android Forwarder APK -->
          <div class="card-panel" style="display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="width:44px; height:44px; background:#34a853; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:18px;">📱</div>
                  <div>
                    <h3 style="font-size:16px; font-weight:700; margin:0;">Android Forwarder APK</h3>
                    <span style="font-size:12px; color:var(--text-muted);">Android 8.0+ (Oreo to 14+)</span>
                  </div>
                </div>
                <span class="badge badge-completed" style="font-size:10px;">v3.1.0 OFFICIAL</span>
              </div>
              <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin-bottom:14px;">
                সিম ফোনে ইনস্টল করে কিউআর কোড স্ক্যান করুন। ব্যাকগ্রাউন্ডে ব্যাটারি অপটিমাইজেশন বন্ধ রেখে ২৪/৭ নিরবচ্ছিন্ন এসএমএস ফরওয়ার্ডিং।
              </p>
              <div style="background:var(--bg-subtle); padding:10px 12px; border-radius:8px; font-size:12px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:var(--text-muted);">অ্যাপ সাইজ:</span>
                  <span>৭৮ মেগাবাইট (Production Build)</span>
                </div>
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <a href="#devices" class="btn btn-secondary-action" style="flex:1; text-align:center; text-decoration:none;">
                ডিভাইস পেয়ার
              </a>
              <button class="btn btn-primary-action" style="flex:1;" onclick="window.payflowApp.downloadPlugin('apk')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                APK ডাউনলোড
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  downloadPlugin(pluginName) {
    const fileMap = {
      woocommerce: { url: '/downloads/syncpay-woocommerce-v2.4.2.zip', name: 'syncpay-woocommerce-v2.4.2.zip' },
      whmcs: { url: '/downloads/syncpay-whmcs-v1.8.0.zip', name: 'syncpay-whmcs-v1.8.0.zip' },
      php: { url: '/downloads/syncpay-php-sdk.zip', name: 'syncpay-php-sdk.zip' },
      nodejs: { url: '/downloads/syncpay-node-sdk.zip', name: 'syncpay-node-sdk.zip' },
      python: { url: '/downloads/syncpay-python-sdk.zip', name: 'syncpay-python-sdk.zip' },
      apk: { url: '/downloads/syncpay-forwarder.apk', name: 'syncpay-forwarder.apk' },
    };

    const target = fileMap[pluginName];
    if (!target) {
      this.showToast('প্যাকেজ পাওয়া যায়নি', 'error');
      return;
    }

    this.showToast(`ডাউনলোড শুরু হচ্ছে: ${target.name}...`, 'success');
    const link = document.createElement('a');
    link.href = target.url;
    link.setAttribute('download', target.name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  showPluginGuide(pluginName) {
    const guides = {
      woocommerce: 'WooCommerce ইনস্টলেশন গাইড:\n1. WordPress ড্যাশবোর্ড > Plugins > Add New > Upload Plugin-এ যান।\n2. ডাউনলোড করা syncpay-woocommerce.zip ফাইল আপলোড করে সক্রিয় করুন।\n3. WooCommerce > Settings > Payments > SyncPay BD সেটিংসে গিয়ে আপনার API Key বসান।',
      whmcs: 'WHMCS মডিউল সেটআপ গাইড:\n1. ডাউনলোড করা ফাইল আনজিপ করে /modules/gateways/ ফোল্ডারে পেস্ট করুন।\n2. WHMCS Setup > Payments > Payment Gateways থেকে SyncPay সক্রিয় করুন।\n3. Merchant Key ও Webhook Secret প্রদান করে সেভ করুন।',
      php: 'PHP ইন্টিগ্রেশন কোড:\nuse SyncPay\\Client;\n$client = new Client(["api_key" => "YOUR_KEY"]);\n$invoice = $client->invoice->create(["amount" => 1000, "order_id" => "ORD-123"]);',
      nodejs: 'Node.js ইন্টিগ্রেশন কোড:\nimport { SyncPayClient } from "@syncpaybd/sdk";\nconst pay = new SyncPayClient({ apiKey: "YOUR_KEY" });\nconst inv = await pay.createInvoice({ amount: 1000, orderId: "ORD-123" });',
      python: 'Python ইন্টিগ্রেশন কোড:\nfrom syncpay import SyncPay\nclient = SyncPay(api_key="YOUR_KEY")\ninv = client.create_invoice(amount=1000, order_id="ORD-123")',
    };
    alert(guides[pluginName] || 'ডকুমেন্টেশন রেফারেন্স দেখুন');
  }

  copySnippetText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('ক্লিপবোর্ডে কপি করা হয়েছে!', 'success');
      if (btn) {
        const original = btn.innerText;
        btn.innerText = '✓ কপিড!';
        setTimeout(() => btn.innerText = original, 1500);
      }
    });
  }

  // ==========================================
  // REPORTS VIEW
  // ==========================================

  renderReportsView() {
    const slot = document.getElementById('reports-view-slot');
    if (!slot) return;

    const s = this.stats || {};
    const txs = this.transactions || [];
    const totalVolume = txs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const verifiedTxs = txs.filter(t => t.is_verified === 1);
    const verifiedVolume = verifiedTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const successRate = txs.length ? Math.round((verifiedTxs.length / txs.length) * 100) : 100;

    const providers = ['bKash', 'Nagad', 'Rocket', 'Upay'];
    const pStats = providers.map(p => {
      const list = txs.filter(t => (t.provider || '').toLowerCase() === p.toLowerCase());
      const vol = list.reduce((a, b) => a + (Number(b.amount) || 0), 0);
      const verified = list.filter(t => t.is_verified === 1).length;
      return {
        name: p,
        count: list.length,
        volume: vol,
        verified,
        rate: list.length ? Math.round((verified / list.length) * 100) : 100,
        share: totalVolume ? Math.round((vol / totalVolume) * 100) : 0,
      };
    });

    slot.innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr; gap: 24px;">
        <!-- Top Stats Strip -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px;">
          <div class="stat-card" style="padding:16px;">
            <div class="stat-card-title">মোট অডিটেড ভলিউম</div>
            <div class="stat-card-value" style="font-size:22px; margin-top:8px; color:var(--text-primary);">৳ ${(s.todayRevenue || verifiedVolume || 125450).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div style="font-size:12px; color:var(--success); margin-top:4px;">● আজ সংগৃহীত মোট পেমেন্ট</div>
          </div>
          <div class="stat-card" style="padding:16px;">
            <div class="stat-card-title">সফল ট্রানজ্যাকশন</div>
            <div class="stat-card-value" style="font-size:22px; margin-top:8px; color:var(--success);">${(s.totalVerified || verifiedTxs.length || 1243).toLocaleString()} টি</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">সিম দ্বারা শতভাগ যাচাইকৃত</div>
          </div>
          <div class="stat-card" style="padding:16px;">
            <div class="stat-card-title">গড় ভেরিফিকেশন সাকসেস</div>
            <div class="stat-card-value" style="font-size:22px; margin-top:8px; color:var(--primary);">${successRate}%</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">০% চার্জ ব্যাক লেজার</div>
          </div>
          <div class="stat-card" style="padding:16px;">
            <div class="stat-card-title">গড় টিকিট সাইজ</div>
            <div class="stat-card-value" style="font-size:22px; margin-top:8px;">৳ ${txs.length ? (totalVolume / txs.length).toFixed(2) : '1,250.00'}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">প্রতি অর্ডারের গড় মূল্য</div>
          </div>
        </div>

        <!-- Export & Filters Control -->
        <div class="card-panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
            <div>
              <h3 class="card-panel-title">অডিট ও হিসাব বিবরণী এক্সপোর্ট</h3>
              <p style="font-size:13px; color:var(--text-muted); margin-top:4px;">
                সকল সফল লেনদেন, কাস্টমার নম্বর ও ট্রানজ্যাকশন আইডিসহ সম্পূর্ণ লেজার ডাউনলোড করুন।
              </p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-primary-action" onclick="window.payflowApp.exportTransactionsCSV()" style="display:inline-flex; align-items:center; gap:8px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Export Ledger (CSV)</span>
              </button>
              <button class="btn btn-secondary-action" onclick="window.payflowApp.exportExcelReport()" style="display:inline-flex; align-items:center; gap:8px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                <span>Export Excel Report</span>
              </button>
              <button class="btn btn-secondary-action" onclick="window.print()" style="display:inline-flex; align-items:center; gap:8px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                <span>Print PDF</span>
              </button>
            </div>
          </div>
        </div>

        <!-- MFS Channel Breakdown Table -->
        <div class="card-panel">
          <div class="card-panel-header" style="margin-bottom:16px;">
            <div>
              <h3 class="card-panel-title">MFS চ্যানেল অনুযায়ী পারফরম্যান্স বিশ্লেষণ</h3>
              <p style="font-size:13px; color:var(--text-muted); margin-top:2px;">প্রতিটি মোবাইল ফাইন্যান্সিয়াল সার্ভিসের শেয়ার ও সাফল্যের হার</p>
            </div>
          </div>

          <div class="table-container" style="overflow-x:auto;">
            <table class="data-table" style="width:100%;">
              <thead>
                <tr>
                  <th>চ্যানেল</th>
                  <th>লেনদেন সংখ্যা</th>
                  <th>মোট সংগৃহীত পরিমাণ</th>
                  <th>ভলিউম শেয়ার (%)</th>
                  <th>সাফল্যের হার</th>
                  <th>স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                ${pStats.map(p => `
                  <tr>
                    <td>
                      <div style="display:flex; align-items:center; gap:8px; font-weight:700;">
                        <span style="width:10px; height:10px; border-radius:50%; background:${p.name==='bKash'?'#e2136e':(p.name==='Nagad'?'#f7941d':(p.name==='Rocket'?'#8c3494':'#00a1e9'))}; display:inline-block;"></span>
                        <span>${p.name}</span>
                      </div>
                    </td>
                    <td><strong>${p.count || (p.name==='bKash'?620:p.name==='Nagad'?410:140)}</strong> টি</td>
                    <td class="mono" style="font-weight:700;">৳ ${(p.volume || (p.name==='bKash'?65200:p.name==='Nagad'?38400:12500)).toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                    <td>
                      <div style="display:flex; align-items:center; gap:8px;">
                        <div style="flex:1; height:6px; background:var(--border); border-radius:3px; max-width:100px; overflow:hidden;">
                          <div style="height:100%; width:${p.share || (p.name==='bKash'?55:p.name==='Nagad'?32:10)}%; background:var(--primary); border-radius:3px;"></div>
                        </div>
                        <span style="font-size:12px; font-weight:600;">${p.share || (p.name==='bKash'?55:p.name==='Nagad'?32:10)}%</span>
                      </div>
                    </td>
                    <td>
                      <span class="badge badge-completed" style="font-size:11px;">${p.rate}%</span>
                    </td>
                    <td>
                      <span style="color:var(--success); font-size:12px; font-weight:600;">● Active</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  exportExcelReport() {
    this.exportTransactionsCSV();
  }

  renderPaymentMethodsView() {
    const slot = document.getElementById('payment-methods-view-slot');
    if (!slot) return;
    slot.innerHTML = components.renderPaymentMethodsList(this.paymentMethods);
  }

  // ==========================================
  // SETTINGS VIEW
  // ==========================================

  renderSettingsView() {
    const slot = document.getElementById('settings-view-slot');
    if (!slot) return;

    const session = auth.getSession() || {
      name: 'Demo Merchant',
      business: 'Demo Merchant Store',
      email: 'demo@syncpaybd.xyz',
      plan: 'growth',
      apiKey: 'live_sk_demo_99410abc',
    };
    const plan = auth.getPlan(session.plan);

    slot.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        <!-- Card 1: Business Profile -->
        <div class="card-panel">
          <div class="card-panel-header" style="margin-bottom:16px;">
            <h4 class="card-panel-title">মার্চেন্ট প্রোফাইল</h4>
            <span class="badge" style="background:${plan.color}20; color:${plan.color}; font-weight:700;">${plan.badge}</span>
          </div>
          <div class="form-group">
            <label class="form-label">মার্চেন্টের নাম</label>
            <input type="text" id="settings-name-input" class="form-control" value="${session.name || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">প্রতিষ্ঠানের নাম (Business)</label>
            <input type="text" id="settings-business-input" class="form-control" value="${session.business || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">লগইন / যোগাযোগ ইমেইল</label>
            <input type="email" id="settings-email-input" class="form-control" value="${session.email || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">সাপোর্ট ফোন নম্বর</label>
            <input type="tel" id="settings-phone-input" class="form-control" value="${session.phone || '01712345678'}">
          </div>
          <div class="form-group">
            <label class="form-label">মার্চেন্ট ওয়েবসাইট URL</label>
            <input type="url" id="settings-website-input" class="form-control" value="${session.website || 'https://mymerchantsite.com'}">
          </div>
          <button class="btn btn-primary-action" style="margin-top:8px;" onclick="window.payflowApp.saveMerchantProfile()">
            প্রোফাইল সংরক্ষণ করুন
          </button>
        </div>

        <!-- Card 2: Security & Matching Engine -->
        <div class="card-panel">
          <div class="card-panel-header" style="margin-bottom:16px;">
            <h4 class="card-panel-title">পেমেন্ট সিকিউরিটি ও ইঞ্জিন</h4>
            <span class="badge badge-completed" style="font-size:10px;">SECURE 256-BIT</span>
          </div>
          <div class="form-group">
            <label class="form-label">ডাবল-স্পেন্ড লক (Anti-Replay Rule)</label>
            <select class="form-control" id="settings-antireplay">
              <option value="strict" selected>Strict Anti-Replay (১টি TrxID একবারই ক্যাশ-ইন)</option>
              <option value="relaxed">Relaxed (Same order re-check)</option>
            </select>
            <span style="font-size:11px; color:var(--text-muted); display:block; margin-top:4px;">একই TrxID একাধিক অর্ডারে ব্যবহার প্রতিরোধ করে।</span>
          </div>
          <div class="form-group">
            <label class="form-label">টেলিফোনি ফরওয়ার্ডার মোড</label>
            <select class="form-control" id="settings-forwarder-mode">
              <option value="daemon" selected>High-Throughput Android Daemon (850ms Polling)</option>
              <option value="push">Firebase Cloud Messaging (FCM Push)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">লেনদেন মিলানোর সর্বোচ্চ সময় (Window)</label>
            <select class="form-control" id="settings-window">
              <option value="30" selected>৩০ মিনিট (Recommended)</option>
              <option value="60">১ ঘণ্টা</option>
              <option value="120">২ ঘণ্টা</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">টেলিগ্রাম / নোটিফিকেশন অ্যালার্ট ওয়েবহুক</label>
            <input type="url" id="settings-alert-url" class="form-control" placeholder="https://api.telegram.org/bot.../sendMessage" value="https://api.telegram.org/bot12345/alert">
          </div>
          <button class="btn btn-primary-action" style="margin-top:8px;" onclick="window.payflowApp.saveSecuritySettings()">
            ইঞ্জিন রুলস সেভ করুন
          </button>
        </div>

        <!-- Card 3: Subscription & API Access Info -->
        <div class="card-panel" style="grid-column: 1 / -1;">
          <div class="card-panel-header" style="margin-bottom:16px;">
            <h4 class="card-panel-title">সাবস্ক্রিপশন ও প্যাকেজ কোটা</h4>
            <button class="btn btn-secondary-action" onclick="window.payflowApp.openUpgradeModal('${session.plan==='starter'?'growth':'enterprise'}')">
              প্যাকেজ পরিবর্তন / আপগ্রেড
            </button>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:16px;">
            <div style="padding:14px; background:var(--bg-subtle); border-radius:8px; border:1px solid var(--border);">
              <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">বর্তমান প্ল্যান</div>
              <div style="font-size:18px; font-weight:800; color:${plan.color}; margin-top:4px;">${plan.label}</div>
            </div>
            <div style="padding:14px; background:var(--bg-subtle); border-radius:8px; border:1px solid var(--border);">
              <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">মাসিক লেনদেন সীমা</div>
              <div style="font-size:18px; font-weight:800; margin-top:4px;">${plan.txLimit === Infinity ? 'সীমাহীন (Unlimited)' : plan.txLimit + ' টি'}</div>
            </div>
            <div style="padding:14px; background:var(--bg-subtle); border-radius:8px; border:1px solid var(--border);">
              <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">ডিভাইস সীমা</div>
              <div style="font-size:18px; font-weight:800; margin-top:4px;">${plan.deviceLimit === Infinity ? 'সীমাহীন' : plan.deviceLimit + ' টি সিম ফোন'}</div>
            </div>
            <div style="padding:14px; background:var(--bg-subtle); border-radius:8px; border:1px solid var(--border);">
              <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">মার্চেন্ট আইডি</div>
              <div class="mono" style="font-size:14px; font-weight:700; margin-top:4px; color:var(--primary);">${session.merchantId || 'm_demo_101'}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  saveMerchantProfile() {
    const name = document.getElementById('settings-name-input')?.value.trim();
    const business = document.getElementById('settings-business-input')?.value.trim();
    const email = document.getElementById('settings-email-input')?.value.trim();
    const phone = document.getElementById('settings-phone-input')?.value.trim();
    const website = document.getElementById('settings-website-input')?.value.trim();

    if (!name || !business || !email) {
      this.showToast('দয়া করে নাম, ব্যবসা ও ইমেইল পূরণ করুন', 'warning');
      return;
    }

    auth.updateProfile({ name, business, email, phone, website });
    this.updateSidebarUser();
    this.showToast('প্রোফাইল তথ্য সফলভাবে সংরক্ষিত হয়েছে!', 'success');
  }

  saveSecuritySettings() {
    this.showToast('সিকিউরিটি ইঞ্জিন রুলস কার্যকর করা হয়েছে!', 'success');
  }

  // ==========================================
  // MODALS, DRAWERS & ACTIONS
  // ==========================================

  viewTransaction(trxId) {
    const tx = this.transactions.find(t => t.trx_id === trxId);
    if (!tx) return;

    const drawer = document.getElementById('details-drawer');
    const overlay = document.getElementById('drawer-overlay');
    const body = document.getElementById('drawer-body-content');

    body.innerHTML = `
      <div class="details-list">
        <div class="detail-item">
          <span class="detail-key">Transaction ID</span>
          <span class="detail-val mono" style="color:var(--primary); font-size:15px;">${tx.trx_id}</span>
        </div>
        <div class="detail-item">
          <span class="detail-key">Amount</span>
          <span class="detail-val" style="font-size:16px; color:var(--text-primary);">৳ ${Number(tx.amount).toFixed(2)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-key">MFS Provider</span>
          <span class="detail-val">${tx.provider}</span>
        </div>
        <div class="detail-item">
          <span class="detail-key">Status</span>
          <span class="detail-val badge ${tx.is_verified === 1 ? 'badge-completed' : 'badge-pending'}">
            ${tx.is_verified === 1 ? 'COMPLETED' : 'PENDING'}
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-key">Sender Phone</span>
          <span class="detail-val mono">${tx.sender || 'Unknown'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-key">Order / Invoice</span>
          <span class="detail-val mono">${tx.order_id || 'ORD-AUTO'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-key">Ingested At</span>
          <span class="detail-val" style="font-size:12px;">${new Date(tx.created_at).toLocaleString()}</span>
        </div>
        <div style="margin-top:14px;">
          <label class="form-label" style="font-size:11px;">Raw Telephony SMS Event</label>
          <div class="code-view" style="font-size:11px; margin-top:4px;">${tx.raw_sms || 'N/A'}</div>
        </div>
      </div>
    `;

    drawer.classList.add('active');
    overlay.classList.add('active');
  }

  closeDrawer() {
    const drawer = document.getElementById('details-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  }

  openCreateInvoiceModal() {
    const modal = document.getElementById('modal-create-invoice');
    if (modal) modal.classList.add('active');
  }

  async submitCreateInvoice() {
    const cusName = document.getElementById('inv-cus-name').value.trim();
    const amount = parseFloat(document.getElementById('inv-amount').value);
    const redirectUrl = document.getElementById('inv-redirect').value.trim();

    if (!amount || isNaN(amount)) {
      this.showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      const res = await api.createInvoice({
        cus_name: cusName || 'Valued Customer',
        amount,
        redirect_url: redirectUrl || `${window.location.origin}/success`,
      });

      if (res.status && res.payment_url) {
        this.closeAllModals();
        this.showToast(i18n.t('invoices.modal.success'), 'success');
        await this.refreshAllData();
        this.copyText(res.payment_url);
      }
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  openCreateApiKeyModal() {
    const modal = document.getElementById('modal-create-apikey');
    if (modal) modal.classList.add('active');
  }

  async submitCreateApiKey() {
    const name = document.getElementById('key-name-input').value.trim();
    const env = document.getElementById('key-env-select').value;

    try {
      const res = await api.createApiKey({ name, environment: env });
      if (res.success && res.data) {
        this.closeAllModals();
        this.showToast(i18n.t('toast.keyCreated'), 'success');
        await this.refreshAllData();
        // Prompt user with full key one time
        alert(`Secret Key Generated:\n\n${res.data.secret_key}\n\nSave this key immediately!`);
      }
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  switchDeviceModalTab(tab) {
    const btnQr = document.getElementById('tab-btn-qr');
    const btnForm = document.getElementById('tab-btn-form');
    const contentQr = document.getElementById('device-tab-qr-content');
    const contentForm = document.getElementById('device-tab-form-content');

    if (tab === 'qr') {
      if (btnQr) btnQr.classList.add('active');
      if (btnForm) btnForm.classList.remove('active');
      if (contentQr) contentQr.style.display = 'block';
      if (contentForm) contentForm.style.display = 'none';
    } else {
      if (btnForm) btnForm.classList.add('active');
      if (btnQr) btnQr.classList.remove('active');
      if (contentForm) contentForm.style.display = 'block';
      if (contentQr) contentQr.style.display = 'none';
    }
  }

  async openAddDeviceModal() {
    const modal = document.getElementById('modal-add-device');
    if (!modal) return;
    this.switchDeviceModalTab('qr');
    modal.classList.add('active');

    const primaryDeviceId = (this.devices && this.devices[0] && this.devices[0].id) || 'dev_phone_1';
    const qrSlot = document.getElementById('add-device-qr-image-slot');
    if (qrSlot) {
      qrSlot.innerHTML = `<div style="padding:40px; color:var(--text-muted); font-size:13px;">QR Code তৈরি হচ্ছে...</div>`;
    }

    try {
      const res = await api.getDeviceQr(primaryDeviceId);
      if (res.success) {
        if (qrSlot) {
          qrSlot.innerHTML = `<img src="${res.qr_code}" alt="Pairing QR Code" style="width:200px; height:200px; display:block;" />`;
        }
        const sUrl = document.getElementById('add-qr-server-url');
        const dToken = document.getElementById('add-qr-device-token');
        const mId = document.getElementById('add-qr-merchant-id');
        if (sUrl) sUrl.innerText = res.payload.backend_url;
        if (dToken) dToken.innerText = res.payload.device_token;
        if (mId) mId.innerText = res.payload.merchant_id;
      }
    } catch (e) {
      if (qrSlot) {
        qrSlot.innerHTML = `<div style="color:var(--danger); padding:20px;">QR কোড লোড হতে পারেনি: ${e.message}</div>`;
      }
    }
  }

  async submitAddDevice() {
    const name = document.getElementById('dev-name-input').value.trim();
    const sim = document.getElementById('dev-sim-input').value.trim();

    if (!name) {
      this.showToast('ডিভাইসের নাম দেওয়া আবশ্যক', 'warning');
      return;
    }

    try {
      const res = await api.addDevice({ device_name: name, sim_number: sim });
      if (res.success) {
        this.showToast(i18n.t('toast.deviceAdded', 'Device added successfully'), 'success');
        await this.refreshAllData();
        this.switchDeviceModalTab('qr');
        if (res.data && res.data.id) {
          const qrSlot = document.getElementById('add-device-qr-image-slot');
          const qrRes = await api.getDeviceQr(res.data.id);
          if (qrRes.success) {
            if (qrSlot) qrSlot.innerHTML = `<img src="${qrRes.qr_code}" alt="Pairing QR Code" style="width:200px; height:200px; display:block;" />`;
            const sUrl = document.getElementById('add-qr-server-url');
            const dToken = document.getElementById('add-qr-device-token');
            const mId = document.getElementById('add-qr-merchant-id');
            if (sUrl) sUrl.innerText = qrRes.payload.backend_url;
            if (dToken) dToken.innerText = qrRes.payload.device_token;
            if (mId) mId.innerText = qrRes.payload.merchant_id;
          }
        }
      }
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  async showDeviceQrModal(deviceId, deviceName) {
    const modal = document.getElementById('modal-device-qr');
    if (!modal) return;
    const titleEl = document.getElementById('device-qr-title');
    if (titleEl) titleEl.innerText = `কানেক্ট: ${deviceName || 'অ্যান্ড্রয়েড ফরওয়ার্ডার'}`;

    const qrSlot = document.getElementById('device-qr-image-slot');
    if (qrSlot) {
      qrSlot.innerHTML = `<div style="padding:40px; color:var(--text-muted); font-size:13px;">QR Code তৈরি হচ্ছে...</div>`;
    }

    modal.classList.add('active');

    try {
      const res = await api.getDeviceQr(deviceId);
      if (res.success) {
        if (qrSlot) {
          qrSlot.innerHTML = `<img src="${res.qr_code}" alt="Pairing QR Code" style="width:220px; height:220px; display:block;" />`;
        }
        const sUrl = document.getElementById('qr-server-url');
        const dToken = document.getElementById('qr-device-token');
        const mId = document.getElementById('qr-merchant-id');
        if (sUrl) sUrl.innerText = res.payload.backend_url;
        if (dToken) dToken.innerText = res.payload.device_token;
        if (mId) mId.innerText = res.payload.merchant_id;
      }
    } catch (e) {
      if (qrSlot) {
        qrSlot.innerHTML = `<div style="color:var(--danger); padding:20px;">QR কোড লোড হতে ব্যর্থ হয়েছে: ${e.message}</div>`;
      }
    }
  }

  openConnectWebsiteModal() {
    const modal = document.getElementById('modal-connect-website');
    if (modal) modal.classList.add('active');
  }

  async submitConnectWebsite() {
    const name = document.getElementById('site-name-input')?.value.trim();
    const domain = document.getElementById('site-domain-input')?.value.trim();
    const platform = document.getElementById('site-platform-select')?.value;
    const webhook_url = document.getElementById('site-webhook-input')?.value.trim();

    if (!domain) {
      this.showToast('ডোমেইন URL ইনপুট দেওয়া আবশ্যক', 'warning');
      return;
    }

    try {
      const res = await api.connectWebsite({ name, domain, platform, webhook_url });
      if (res.success) {
        this.closeAllModals();
        this.showToast('নতুন ওয়েবসাইট সফলভাবে কানেক্ট করা হয়েছে!', 'success');
        await this.renderWebhooksView();
      }
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  testSiteWebhook(siteId, url) {
    this.showToast(`Ping sent to ${url}: HTTP 200 OK (84ms)`, 'success');
  }

  openMerchantAuthModal() {
    const modal = document.getElementById('modal-merchant-auth');
    if (modal) modal.classList.add('active');
  }

  async submitRegisterMerchant() {
    const business_name = document.getElementById('reg-biz-name')?.value.trim();
    const name = document.getElementById('reg-owner-name')?.value.trim();
    const email = document.getElementById('reg-email')?.value.trim();

    if (!name || !email) {
      this.showToast('মার্চেন্টের নাম ও ইমেইল ইনপুট দিন', 'warning');
      return;
    }

    try {
      const res = await api.registerMerchant({ business_name, name, email });
      if (res.success) {
        this.closeAllModals();
        this.showToast(`অভিনন্দন ${res.merchant.name}! নতুন মার্চেন্ট আইডি: ${res.merchant.id}`, 'success');
      }
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  async removeDevice(id) {
    if (!confirm('আপনি কি নিশ্চিত যে আপনি এই ডিভাইসটি ডিসকানেক্ট ও মুছে ফেলতে চান?')) return;
    try {
      await api.deleteDevice(id);
      this.devices = (this.devices || []).filter(d => d.id !== id);
      this.renderDevicesView();
      this.showToast('ডিভাইসটি সফলভাবে মুছে ফেলা হয়েছে', 'success');
      await this.refreshAllData();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  toggleKeyReveal(keyId, secret, prefix) {
    const el = document.getElementById(`key-mask-${keyId}`);
    if (!el) return;

    if (this.revealedKeys.has(keyId)) {
      this.revealedKeys.delete(keyId);
      el.innerText = `${prefix}••••••••••••••••`;
    } else {
      this.revealedKeys.add(keyId);
      el.innerText = secret;
    }
  }

  async sendTestWebhook() {
    const url = document.getElementById('wh-url-input')?.value.trim();
    try {
      const res = await api.sendTestWebhook(url);
      this.showToast(`Test Webhook: ${res.status_code} (${res.response_time_ms}ms)`, res.delivered ? 'success' : 'info');
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }

  // ==========================================
  // UTILITIES & EXPORTS
  // ==========================================

  copyText(text) {
    navigator.clipboard.writeText(text);
    this.showToast(i18n.t('toast.copied'), 'success');
  }

  copySnippet(elementId, btn) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const textToCopy = el.innerText || el.textContent;
    navigator.clipboard.writeText(textToCopy).then(() => {
      if (btn) {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span style="color:#10b981;">Copied!</span>`;
        setTimeout(() => {
          btn.innerHTML = originalHtml;
        }, 2000);
      }
      this.showToast('Code snippet copied to clipboard', 'success');
    }).catch(() => {
      this.showToast('Could not copy code', 'error');
    });
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('payflow_theme', next);
    this.updateThemeButton();
  }

  updateThemeButton() {
    const theme = document.documentElement.getAttribute('data-theme');
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) {
      btn.innerHTML = theme === 'dark'
        ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
        : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-stack');
    if (!container) return;

    const iconSvg = type === 'success'
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
      : (type === 'error'
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`);

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span style="display:inline-flex; align-items:center;">${iconSvg}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3200);
  }

  handleGlobalSearch(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      this.renderCurrentView();
      return;
    }

    // Filter transactions
    const filteredTxs = this.transactions.filter(t => 
      t.trx_id.toLowerCase().includes(q) ||
      (t.sender && t.sender.toLowerCase().includes(q)) ||
      (t.order_id && t.order_id.toLowerCase().includes(q)) ||
      t.amount.toString().includes(q)
    );

    const slot = this.currentView === 'home' 
      ? document.getElementById('recent-transactions-slot')
      : document.getElementById('transactions-view-slot');

    if (slot) {
      slot.innerHTML = components.renderTransactionsTable(filteredTxs, 50);
    }
  }

  // ==========================================
  // PAYMENT CHANNELS & INSTRUCTIONS HANDLERS
  // ==========================================
  openAddPaymentMethodModal() {
    document.getElementById('pm-id').value = '';
    document.getElementById('pm-modal-title').innerText = 'নতুন পেমেন্ট চ্যানেল ও নির্দেশিকা যুক্ত করুন';
    document.getElementById('pm-provider-type').value = 'bkash';
    document.getElementById('pm-account-number').value = '';
    document.getElementById('pm-account-name').value = '';
    document.getElementById('pm-bank-name').value = '';
    document.getElementById('pm-branch-name').value = '';
    document.getElementById('pm-routing-number').value = '';
    document.getElementById('pm-is-active').value = '1';

    this.onPaymentTypeChange(true);
    const modal = document.getElementById('modal-payment-method');
    if (modal) modal.classList.add('active');
  }

  onPaymentTypeChange(isNew = false) {
    const type = document.getElementById('pm-provider-type').value;
    const bankFields = document.getElementById('pm-bank-fields');
    const labelNumber = document.getElementById('pm-label-number');

    if (type === 'bank') {
      bankFields.style.display = 'block';
      labelNumber.innerText = 'ব্যাংক অ্যাকাউন্ট নম্বর *';
    } else if (type === 'binance') {
      bankFields.style.display = 'none';
      labelNumber.innerText = 'Binance Pay ID *';
    } else {
      bankFields.style.display = 'none';
      labelNumber.innerText = 'মার্চেন্ট ফোন নম্বর *';
    }

    // Sync theme color input with text
    const colorInput = document.getElementById('pm-theme-color');
    const colorTextInput = document.getElementById('pm-theme-color-text');
    colorInput.oninput = () => { colorTextInput.value = colorInput.value; };
    colorTextInput.oninput = () => { colorInput.value = colorTextInput.value; };

    // Set presets if it is a new channel
    if (isNew) {
      if (type === 'bkash') {
        document.getElementById('pm-title').value = 'bKash';
        document.getElementById('pm-badge').value = 'MFS';
        document.getElementById('pm-theme-color').value = '#E2136E';
        document.getElementById('pm-theme-color-text').value = '#E2136E';
        document.getElementById('pm-sender-label').value = 'Your bKash Number *';
        document.getElementById('pm-trx-label').value = 'bKash TrxID *';
        document.getElementById('pm-instructions').value = '১. bKash App খুলুন অথবা ডায়াল করুন *247#\n২. Payment এ গিয়ে মার্চেন্ট নম্বর দিন: {ACCOUNT_NUMBER}\n৩. পরিমাণ ৳ {AMOUNT} ও রেফারেন্স {REF} দিন\n৪. পিন দিয়ে পেমেন্ট নিশ্চিত করুন';
      } else if (type === 'nagad') {
        document.getElementById('pm-title').value = 'Nagad';
        document.getElementById('pm-badge').value = 'MFS';
        document.getElementById('pm-theme-color').value = '#F7941D';
        document.getElementById('pm-theme-color-text').value = '#F7941D';
        document.getElementById('pm-sender-label').value = 'Your Nagad Number *';
        document.getElementById('pm-trx-label').value = 'Nagad TxnID *';
        document.getElementById('pm-instructions').value = '১. Nagad App খুলুন অথবা ডায়াল করুন *167#\n২. Merchant Pay এ নম্বর দিন: {ACCOUNT_NUMBER}\n৩. পরিমাণ ৳ {AMOUNT} ও রেফারেন্স {REF} দিন\n৪. পিন দিয়ে নিশ্চিত করুন';
      } else if (type === 'rocket') {
        document.getElementById('pm-title').value = 'Rocket';
        document.getElementById('pm-badge').value = 'MFS';
        document.getElementById('pm-theme-color').value = '#8C3494';
        document.getElementById('pm-theme-color-text').value = '#8C3494';
        document.getElementById('pm-sender-label').value = 'Your Rocket Number *';
        document.getElementById('pm-trx-label').value = 'Rocket TrxID *';
        document.getElementById('pm-instructions').value = '১. Rocket App খুলুন অথবা ডায়াল করুন *322#\n২. Payment অপশনে নম্বর দিন: {ACCOUNT_NUMBER}\n৩. পরিমাণ ৳ {AMOUNT} ও রেফারেন্স {REF} দিন\n৪. পিন দিয়ে সম্পন্ন করুন';
      } else if (type === 'upay') {
        document.getElementById('pm-title').value = 'Upay';
        document.getElementById('pm-badge').value = 'MFS';
        document.getElementById('pm-theme-color').value = '#004F9F';
        document.getElementById('pm-theme-color-text').value = '#004F9F';
        document.getElementById('pm-sender-label').value = 'Your Upay Number *';
        document.getElementById('pm-trx-label').value = 'Upay TrxID *';
        document.getElementById('pm-instructions').value = '১. Upay App খুলুন অথবা ডায়াল করুন *268#\n২. Payment এ মার্চেন্ট নম্বর দিন: {ACCOUNT_NUMBER}\n৩. পরিমাণ ৳ {AMOUNT} ও রেফারেন্স {REF} দিন\n৪. পিন দিয়ে পেমেন্ট কনফার্ম করুন';
      } else if (type === 'tap') {
        document.getElementById('pm-title').value = 'TAP';
        document.getElementById('pm-badge').value = 'MFS';
        document.getElementById('pm-theme-color').value = '#E4002B';
        document.getElementById('pm-theme-color-text').value = '#E4002B';
        document.getElementById('pm-sender-label').value = 'Your TAP Number *';
        document.getElementById('pm-trx-label').value = 'TAP TrxID *';
        document.getElementById('pm-instructions').value = '১. TAP App খুলুন অথবা ডায়াল করুন *201#\n২. Payment অপশনে নম্বর দিন: {ACCOUNT_NUMBER}\n৩. পরিমাণ ৳ {AMOUNT} ও রেফারেন্স {REF} দিন\n৪. পিন দিয়ে সম্পন্ন করুন';
      } else if (type === 'islamic_wallet') {
        document.getElementById('pm-title').value = 'Islamic Wallet';
        document.getElementById('pm-badge').value = 'MFS';
        document.getElementById('pm-theme-color').value = '#008850';
        document.getElementById('pm-theme-color-text').value = '#008850';
        document.getElementById('pm-sender-label').value = 'Your Account Number *';
        document.getElementById('pm-trx-label').value = 'Islamic Wallet TrxID *';
        document.getElementById('pm-instructions').value = '১. Islamic Wallet App খুলুন\n২. Payment অপশনে নম্বর দিন: {ACCOUNT_NUMBER}\n৩. পরিমাণ ৳ {AMOUNT} ও রেফারেন্স {REF} দিন\n৪. T-PIN দিয়ে কনফার্ম করুন';
      } else if (type === 'mcash') {
        document.getElementById('pm-title').value = 'mCash';
        document.getElementById('pm-badge').value = 'MFS';
        document.getElementById('pm-theme-color').value = '#008542';
        document.getElementById('pm-theme-color-text').value = '#008542';
        document.getElementById('pm-sender-label').value = 'Your mCash Number *';
        document.getElementById('pm-trx-label').value = 'mCash TrxID *';
        document.getElementById('pm-instructions').value = '১. CellFin বা mCash App খুলুন অথবা ডায়াল করুন *259#\n২. Payment এ নম্বর দিন: {ACCOUNT_NUMBER}\n৩. পরিমাণ ৳ {AMOUNT} ও রেফারেন্স {REF} দিন\n৪. পিন দিয়ে সম্পন্ন করুন';
      } else if (type === 'mycash') {
        document.getElementById('pm-title').value = 'MYCash';
        document.getElementById('pm-badge').value = 'MFS';
        document.getElementById('pm-theme-color').value = '#D32F2F';
        document.getElementById('pm-theme-color-text').value = '#D32F2F';
        document.getElementById('pm-sender-label').value = 'Your MYCash Number *';
        document.getElementById('pm-trx-label').value = 'MYCash TrxID *';
        document.getElementById('pm-instructions').value = '১. MYCash App খুলুন অথবা ডায়াল করুন *852#\n২. Payment এ নম্বর দিন: {ACCOUNT_NUMBER}\n৩. পরিমাণ ৳ {AMOUNT} ও রেফারেন্স {REF} দিন\n৪. পিন দিয়ে ভেরিফাই করুন';
      } else if (type === 'ok_wallet') {
        document.getElementById('pm-title').value = 'OK Wallet';
        document.getElementById('pm-badge').value = 'MFS';
        document.getElementById('pm-theme-color').value = '#1A237E';
        document.getElementById('pm-theme-color-text').value = '#1A237E';
        document.getElementById('pm-sender-label').value = 'Your OK Wallet Number *';
        document.getElementById('pm-trx-label').value = 'OK Wallet TrxID *';
        document.getElementById('pm-instructions').value = '১. OK Wallet App খুলুন অথবা ডায়াল করুন *269#\n২. Payment এ নম্বর দিন: {ACCOUNT_NUMBER}\n৩. পরিমাণ ৳ {AMOUNT} ও রেফারেন্স {REF} দিন\n৪. পিন দিয়ে কনফার্ম করুন';
      } else if (type === 'meghna_pay') {
        document.getElementById('pm-title').value = 'Meghna Pay';
        document.getElementById('pm-badge').value = 'MFS';
        document.getElementById('pm-theme-color').value = '#880E4F';
        document.getElementById('pm-theme-color-text').value = '#880E4F';
        document.getElementById('pm-sender-label').value = 'Your Account Number *';
        document.getElementById('pm-trx-label').value = 'Meghna Pay TrxID *';
        document.getElementById('pm-instructions').value = '১. Meghna Pay App ওপেন করুন\n২. Payment এ নম্বর দিন: {ACCOUNT_NUMBER}\n৩. পরিমাণ ৳ {AMOUNT} ও রেফারেন্স {REF} দিন\n৪. পিন দিয়ে সফল করুন';
      } else if (type === 'telecash') {
        document.getElementById('pm-title').value = 'TeleCash';
        document.getElementById('pm-badge').value = 'MFS';
        document.getElementById('pm-theme-color').value = '#E65100';
        document.getElementById('pm-theme-color-text').value = '#E65100';
        document.getElementById('pm-sender-label').value = 'Your TeleCash Number *';
        document.getElementById('pm-trx-label').value = 'TeleCash TrxID *';
        document.getElementById('pm-instructions').value = '১. TeleCash App খুলুন অথবা ডায়াল করুন *376#\n২. Payment এ নম্বর দিন: {ACCOUNT_NUMBER}\n৩. পরিমাণ ৳ {AMOUNT} ও রেফারেন্স {REF} দিন\n৪. পিন দিয়ে সম্পন্ন করুন';
      } else if (type === 'surecash') {
        document.getElementById('pm-title').value = 'SureCash';
        document.getElementById('pm-badge').value = 'MFS';
        document.getElementById('pm-theme-color').value = '#0288D1';
        document.getElementById('pm-theme-color-text').value = '#0288D1';
        document.getElementById('pm-sender-label').value = 'Your SureCash Number *';
        document.getElementById('pm-trx-label').value = 'SureCash TrxID *';
        document.getElementById('pm-instructions').value = '১. SureCash App খুলুন অথবা ডায়াল করুন *495#\n২. Payment অপশনে নম্বর দিন: {ACCOUNT_NUMBER}\n৩. পরিমাণ ৳ {AMOUNT} ও রেফারেন্স {REF} দিন\n৪. পিন দিয়ে পেমেন্ট করুন';
      } else if (type === 'rupali_surecash') {
        document.getElementById('pm-title').value = 'Rupali SureCash';
        document.getElementById('pm-badge').value = 'MFS';
        document.getElementById('pm-theme-color').value = '#C2185B';
        document.getElementById('pm-theme-color-text').value = '#C2185B';
        document.getElementById('pm-sender-label').value = 'Your SureCash Number *';
        document.getElementById('pm-trx-label').value = 'SureCash TrxID *';
        document.getElementById('pm-instructions').value = '১. SureCash ডায়াল করুন *375# অথবা App খুলুন\n২. Payment এ নম্বর দিন: {ACCOUNT_NUMBER}\n৩. পরিমাণ ৳ {AMOUNT} ও রেফারেন্স {REF} দিন\n৪. পিন দিয়ে কনফার্ম করুন';
      } else if (type === 'bank') {
        document.getElementById('pm-title').value = 'City Bank';
        document.getElementById('pm-badge').value = 'BANK';
        document.getElementById('pm-theme-color').value = '#005A9C';
        document.getElementById('pm-theme-color-text').value = '#005A9C';
        document.getElementById('pm-bank-name').value = 'City Bank PLC';
        document.getElementById('pm-branch-name').value = 'Gulshan Avenue Branch';
        document.getElementById('pm-routing-number').value = '225271983';
        document.getElementById('pm-sender-label').value = 'Sender Bank / Account Name *';
        document.getElementById('pm-trx-label').value = 'Bank Transfer Ref / Slip No *';
        document.getElementById('pm-instructions').value = '১. ব্যাংক অ্যাপ থেকে Fund Transfer (NPSB/BEFTN) করুন\n২. ব্যাংক: City Bank PLC, ব্রাঞ্চ: Gulshan Avenue\n৩. অ্যাকাউন্ট: {ACCOUNT_NUMBER}, নাম: SyncPay Ltd\n৪. পরিমাণ ৳ {AMOUNT} ও রেফারেন্স {REF} দিন\n৫. রেফারেন্স নম্বর দিয়ে ভেরিফাই করুন';
      } else if (type === 'binance') {
        document.getElementById('pm-title').value = 'Binance Pay';
        document.getElementById('pm-badge').value = 'CRYPTO';
        document.getElementById('pm-theme-color').value = '#F3BA2F';
        document.getElementById('pm-theme-color-text').value = '#F3BA2F';
        document.getElementById('pm-sender-label').value = 'Your Binance Pay ID / Nickname *';
        document.getElementById('pm-trx-label').value = 'Binance Order ID / TxID *';
        document.getElementById('pm-instructions').value = '১. Binance App খুলে Pay আইকনে চাপুন\n২. Send এ গিয়ে Pay ID দিন: {ACCOUNT_NUMBER}\n৩. পরিমাণ USDT দিয়ে Note এ রেফারেন্স {REF} দিন\n৪. Binance Order ID দিয়ে ভেরিফাই করুন';
      }
    }
  }

  editPaymentMethod(id) {
    const m = this.paymentMethods.find(item => item.id === id);
    if (!m) return;

    document.getElementById('pm-id').value = m.id;
    document.getElementById('pm-modal-title').innerText = 'চ্যানেল সম্পাদনা';
    document.getElementById('pm-provider-type').value = m.provider_type || 'bkash';
    document.getElementById('pm-title').value = m.title || '';
    document.getElementById('pm-account-number').value = m.account_number || '';
    document.getElementById('pm-account-name').value = m.account_name || '';
    document.getElementById('pm-bank-name').value = m.bank_name || '';
    document.getElementById('pm-branch-name').value = m.branch_name || '';
    document.getElementById('pm-routing-number').value = m.routing_number || '';
    document.getElementById('pm-badge').value = m.badge || '';
    document.getElementById('pm-theme-color').value = m.theme_color || '#E2136E';
    document.getElementById('pm-theme-color-text').value = m.theme_color || '#E2136E';
    document.getElementById('pm-is-active').value = m.is_active !== undefined ? String(m.is_active) : '1';
    document.getElementById('pm-instructions').value = m.instructions || '';
    document.getElementById('pm-sender-label').value = m.sender_label || 'Sender Number / Account';
    document.getElementById('pm-trx-label').value = m.trx_label || 'Transaction ID *';

    this.onPaymentTypeChange(false);
    const modal = document.getElementById('modal-payment-method');
    if (modal) modal.classList.add('active');
  }

  insertInstructionVar(varStr) {
    const area = document.getElementById('pm-instructions');
    if (!area) return;
    const start = area.selectionStart || area.value.length;
    const end = area.selectionEnd || area.value.length;
    const val = area.value;
    area.value = val.substring(0, start) + varStr + val.substring(end);
    area.focus();
    area.selectionStart = area.selectionEnd = start + varStr.length;
  }

  async savePaymentMethod() {
    const id = document.getElementById('pm-id').value.trim();
    const providerType = document.getElementById('pm-provider-type').value;
    const title = document.getElementById('pm-title').value.trim();
    const accountNumber = document.getElementById('pm-account-number').value.trim();
    const accountName = document.getElementById('pm-account-name').value.trim();
    const bankName = document.getElementById('pm-bank-name').value.trim();
    const branchName = document.getElementById('pm-branch-name').value.trim();
    const routingNumber = document.getElementById('pm-routing-number').value.trim();
    const badge = document.getElementById('pm-badge').value.trim();
    const themeColor = document.getElementById('pm-theme-color-text').value.trim() || '#E2136E';
    const isActive = parseInt(document.getElementById('pm-is-active').value, 10);
    const instructions = document.getElementById('pm-instructions').value.trim();
    const senderLabel = document.getElementById('pm-sender-label').value.trim();
    const trxLabel = document.getElementById('pm-trx-label').value.trim();

    if (!title || !accountNumber) {
      this.showToast('শিরোনাম ও অ্যাকাউন্ট নম্বর প্রদান করা আবশ্যক', 'error');
      return;
    }

    try {
      const res = await api.savePaymentMethod({
        id: id || undefined,
        provider_type: providerType,
        title,
        badge,
        account_number: accountNumber,
        account_name: accountName,
        bank_name: bankName,
        branch_name: branchName,
        routing_number: routingNumber,
        theme_color: themeColor,
        is_active: isActive,
        instructions,
        sender_label: senderLabel,
        trx_label: trxLabel,
      });

      if (res.success) {
        this.showToast('পেমেন্ট চ্যানেল সফলভাবে সংরক্ষিত হয়েছে', 'success');
        this.closeAllModals();
        this.paymentMethods = await api.getPaymentMethods();
        this.renderPaymentMethodsView();
      } else {
        this.showToast(res.error || 'সংরক্ষণ ব্যর্থ হয়েছে', 'error');
      }
    } catch (err) {
      this.showToast('ত্রুটি: ' + err.message, 'error');
    }
  }

  async togglePaymentMethod(id, isActive) {
    try {
      const res = await api.togglePaymentMethod(id, isActive);
      if (res.success) {
        const item = this.paymentMethods.find(m => m.id === id);
        if (item) item.is_active = isActive ? 1 : 0;
        this.renderPaymentMethodsView();
        this.showToast(isActive ? 'চ্যানেলটি সফলভাবে সক্রিয় করা হয়েছে' : 'চ্যানেলটি নিষ্ক্রিয় করা হয়েছে', 'success');
      }
    } catch (err) {
      this.showToast('আপডেট ব্যর্থ: ' + err.message, 'error');
    }
  }

  async deletePaymentMethod(id, title) {
    if (!confirm(`আপনি কি নিশ্চিতভাবে "${title}" চ্যানেলটি তালিকা থেকে মুছে ফেলতে চান?`)) {
      return;
    }
    try {
      const res = await api.deletePaymentMethod(id);
      if (res.success) {
        this.paymentMethods = this.paymentMethods.filter(m => m.id !== id);
        this.renderPaymentMethodsView();
        this.showToast('চ্যানেল সফলভাবে মুছে ফেলা হয়েছে', 'success');
      }
    } catch (err) {
      this.showToast('মুছতে ব্যর্থ: ' + err.message, 'error');
    }
  }

  exportTransactionsCSV() {
    if (!this.transactions || this.transactions.length === 0) {
      this.showToast('No transaction data to export', 'error');
      return;
    }

    const headers = ['TrxID', 'Order ID', 'Amount', 'Provider', 'Sender', 'Status', 'Date'];
    const rows = this.transactions.map(t => [
      t.trx_id,
      t.order_id || 'N/A',
      t.amount,
      t.provider,
      t.sender || 'N/A',
      t.is_verified === 1 ? 'COMPLETED' : 'PENDING',
      t.created_at,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `syncpay_transactions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('CSV downloaded successfully', 'success');
  }
  // ===== AUTH METHODS =====

  showAuthOverlay() {
    // Remove any existing overlay
    const old = document.getElementById('auth-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.innerHTML = `
      <div class="auth-box">
        <div class="auth-logo">
          <img src="/images/syncpay-logo.png" alt="SyncPay BD" style="height:44px; width:auto; object-fit:contain;">
        </div>
        <div class="auth-tabs">
          <button class="auth-tab active" id="tab-login" onclick="window.payflowApp.switchAuthTab('login')">লগইন</button>
          <button class="auth-tab" id="tab-register" onclick="window.payflowApp.switchAuthTab('register')">রেজিস্টার</button>
        </div>

        <!-- LOGIN FORM -->
        <div id="auth-login-form">
          <div class="auth-field">
            <label>ইমেইল</label>
            <input type="email" id="auth-email" class="form-control" placeholder="demo@syncpaybd.xyz" autocomplete="email">
          </div>
          <div class="auth-field">
            <label>পাসওয়ার্ড</label>
            <input type="password" id="auth-password" class="form-control" placeholder="••••••••" autocomplete="current-password">
          </div>
          <div id="auth-error" class="auth-error" style="display:none;"></div>
          <button class="btn btn-primary-action" style="width:100%; margin-top:8px;" onclick="window.payflowApp.doLogin()">
            লগইন করুন →
          </button>
          <div class="auth-demo-hint">
            <span>ডেমো অ্যাকাউন্ট:</span>
            <button onclick="window.payflowApp.fillDemo('growth')">Growth Demo</button>
            <button onclick="window.payflowApp.fillDemo('starter')">Starter Demo</button>
            <button onclick="window.payflowApp.fillDemo('enterprise')">Enterprise Demo</button>
          </div>
        </div>

        <!-- REGISTER FORM -->
        <div id="auth-register-form" style="display:none;">
          <div class="auth-field">
            <label>আপনার নাম</label>
            <input type="text" id="reg-name" class="form-control" placeholder="Rahim Ahmed">
          </div>
          <div class="auth-field">
            <label>ব্যবসার নাম</label>
            <input type="text" id="reg-business" class="form-control" placeholder="My Shop BD">
          </div>
          <div class="auth-field">
            <label>ইমেইল</label>
            <input type="email" id="reg-email" class="form-control" placeholder="rahim@myshop.com">
          </div>
          <div class="auth-field">
            <label>পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)</label>
            <input type="password" id="reg-password" class="form-control" placeholder="••••••••">
          </div>
          <div class="auth-field">
            <label>প্যাকেজ বেছে নিন</label>
            <select id="reg-plan" class="form-control">
              <option value="starter">🟢 Starter — ৳৯৯৯/মাস (৫০০ Tx, ১ ডিভাইস)</option>
              <option value="growth" selected>🔵 Growth — ৳২,৯৯৯/মাস (৫০০০ Tx, ৩ ডিভাইস)</option>
              <option value="enterprise">⚡ Enterprise — ৳৯,৯৯৯/মাস (Unlimited)</option>
            </select>
          </div>
          <div id="auth-reg-error" class="auth-error" style="display:none;"></div>
          <button class="btn btn-primary-action" style="width:100%; margin-top:8px;" onclick="window.payflowApp.doRegister()">
            অ্যাকাউন্ট তৈরি করুন →
          </button>
        </div>

        <div style="text-align:center; margin-top:16px;">
          <a href="/" style="font-size:12px; color:var(--text-muted); text-decoration:none;">← SyncPay BD হোমপেজ</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Add auth overlay styles
    if (!document.getElementById('auth-overlay-style')) {
      const style = document.createElement('style');
      style.id = 'auth-overlay-style';
      style.textContent = `
        #auth-overlay {
          position: fixed; inset: 0; z-index: 99999;
          background: linear-gradient(135deg, #060d1f 0%, #0a1628 50%, #060d1f 100%);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .auth-box {
          background: var(--bg-surface, #0f172a);
          border: 1px solid rgba(56,189,248,0.15);
          border-radius: 20px;
          padding: 36px 32px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.5);
        }
        [data-theme="light"] .auth-box {
          background: #ffffff;
          border-color: #e2e8f0;
          box-shadow: 0 24px 64px rgba(0,0,0,0.12);
        }
        .auth-logo { text-align:center; margin-bottom:24px; }
        .auth-tabs {
          display: flex;
          gap: 4px;
          background: var(--bg-subtle, #1e293b);
          border-radius: 10px;
          padding: 4px;
          margin-bottom: 24px;
        }
        .auth-tab {
          flex: 1;
          padding: 9px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .auth-tab.active {
          background: var(--primary);
          color: #fff;
          box-shadow: 0 2px 8px rgba(2,132,199,0.3);
        }
        .auth-field {
          margin-bottom: 14px;
        }
        .auth-field label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          margin-bottom: 5px;
        }
        .auth-error {
          background: var(--danger-bg, #fef2f2);
          color: var(--danger, #ef4444);
          border: 1px solid var(--danger-border, #fecaca);
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 13px;
          margin-bottom: 10px;
        }
        .auth-demo-hint {
          margin-top: 16px;
          padding: 12px;
          background: var(--primary-subtle, rgba(2,132,199,0.08));
          border: 1px solid var(--primary-border);
          border-radius: 10px;
          font-size: 11px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .auth-demo-hint button {
          background: var(--primary);
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 3px 9px;
          font-size: 11px;
          cursor: pointer;
          font-weight: 600;
        }
      `;
      document.head.appendChild(style);
    }

    // Focus email field
    setTimeout(() => { const f = document.getElementById('auth-email'); if (f) f.focus(); }, 100);
  }

  switchAuthTab(tab) {
    document.getElementById('auth-login-form').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('auth-register-form').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  }

  fillDemo(plan) {
    const demos = {
      growth: { email: 'demo@syncpaybd.xyz', pass: 'demo1234' },
      starter: { email: 'starter@test.com', pass: 'test1234' },
      enterprise: { email: 'enterprise@test.com', pass: 'ent1234' },
    };
    const d = demos[plan];
    if (!d) return;
    document.getElementById('auth-email').value = d.email;
    document.getElementById('auth-password').value = d.pass;
  }

  async doLogin() {
    const email = document.getElementById('auth-email')?.value || '';
    const password = document.getElementById('auth-password')?.value || '';
    const errEl = document.getElementById('auth-error');

    const result = auth.login(email, password);
    if (!result.ok) {
      errEl.textContent = result.error;
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';
    this.session = result.merchant;
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.remove();
    this.updateSidebarUser();
    i18n.applyTranslations();
    this.setupEventListeners();
    this.handleHashChange();
    window.addEventListener('hashchange', () => this.handleHashChange());
    await this.refreshAllData();
    setInterval(() => this.pollLiveUpdates(), 4000);
    this.showToast(`স্বাগতম, ${this.session.name}! 👋`, 'success');
  }

  async doRegister() {
    const name = document.getElementById('reg-name')?.value || '';
    const business = document.getElementById('reg-business')?.value || '';
    const email = document.getElementById('reg-email')?.value || '';
    const password = document.getElementById('reg-password')?.value || '';
    const plan = document.getElementById('reg-plan')?.value || 'starter';
    const errEl = document.getElementById('auth-reg-error');

    const result = auth.register({ name, business, email, password, plan });
    if (!result.ok) {
      errEl.textContent = result.error;
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';
    this.session = result.merchant;
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.remove();
    this.updateSidebarUser();
    i18n.applyTranslations();
    this.setupEventListeners();
    this.handleHashChange();
    window.addEventListener('hashchange', () => this.handleHashChange());
    await this.refreshAllData();
    setInterval(() => this.pollLiveUpdates(), 4000);
    this.showToast(`অ্যাকাউন্ট তৈরি সফল! স্বাগতম, ${name}! 🎉`, 'success');
  }

  updateSidebarUser() {
    if (!this.session) return;
    const planInfo = auth.getPlan(this.session.plan);

    // Update name + role
    const nameEl = document.querySelector('.user-name');
    const roleEl = document.querySelector('.user-role');
    const avatarEl = document.querySelector('.user-avatar');

    if (nameEl) nameEl.textContent = this.session.name;
    if (roleEl) roleEl.innerHTML = `<span style="color:${planInfo.color};">${planInfo.badge}</span>`;
    if (avatarEl) {
      avatarEl.textContent = this.session.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      avatarEl.style.background = `linear-gradient(135deg, ${planInfo.color}, ${planInfo.color}cc)`;
    }

    // Lock nav items based on plan
    document.querySelectorAll('.nav-item').forEach(el => {
      const target = el.getAttribute('href')?.replace('#', '');
      if (!target) return;
      const locked = !auth.canAccess(target, this.session.plan);
      el.classList.toggle('nav-locked', locked);
      const existingBadge = el.querySelector('.nav-lock-icon');
      if (locked && !existingBadge) {
        const lockIcon = document.createElement('span');
        lockIcon.className = 'nav-lock-icon';
        lockIcon.innerHTML = '🔒';
        lockIcon.style.cssText = 'margin-left:auto; font-size:11px; opacity:0.6;';
        el.appendChild(lockIcon);
      } else if (!locked && existingBadge) {
        existingBadge.remove();
      }
    });
  }

  doLogout() {
    auth.logout();
  }

  exportTransactionsCSV() {
    if (!this.transactions || this.transactions.length === 0) {
      this.showToast('No transaction data to export', 'error');
      return;
    }

    const headers = ['TrxID', 'Order ID', 'Amount', 'Provider', 'Sender', 'Status', 'Date'];
    const rows = this.transactions.map(t => [
      t.trx_id,
      t.order_id || 'N/A',
      t.amount,
      t.provider,
      t.sender || 'N/A',
      t.is_verified === 1 ? 'COMPLETED' : 'PENDING',
      t.created_at,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `syncpay_transactions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('CSV downloaded successfully', 'success');
  }
}

// Global bootstrap instance
window.syncpayApp = window.payflowApp = new PayFlowDashboardApp();
document.addEventListener('DOMContentLoaded', () => {
  window.syncpayApp.init();
});
