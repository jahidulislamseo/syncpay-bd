/**
 * PayFlow MFS Super Admin — Reusable UI Components
 */

import { i18n } from './i18n.js';

export const components = {
  // Format currency in BDT
  formatCurrency(amount) {
    return '৳ ' + Number(amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  },

  // Mask sensitive phone number e.g. 01712345678 -> 017****5678
  maskPhoneNumber(phone) {
    if (!phone || phone.length < 8) return phone || 'N/A';
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
  },

  // KPI Stat Cards (2 Rows)
  renderStatCards(stats) {
    const isDemo = stats.isDemo;
    const demoBadge = isDemo ? `<span class="demo-tag">${i18n.get('demoMode')}</span>` : '';

    return `
      <!-- Row 1: Global Financial Volume -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-title">${i18n.get('totalRevenue')}</span>
          <div class="kpi-icon-wrap"><svg viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        </div>
        <div class="kpi-value">${this.formatCurrency(stats.totalRevenue)}</div>
        <div class="kpi-subtext">
          <span class="trend-up">↑ +14.8%</span>
          <span style="color:var(--text-muted);">${i18n.get('vsPrevious')}</span>
          ${demoBadge}
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-title">${i18n.get('totalTransactions')}</span>
          <div class="kpi-icon-wrap"><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>
        </div>
        <div class="kpi-value">${Number(stats.totalTransactions).toLocaleString()}</div>
        <div class="kpi-subtext">
          <span class="trend-up">↑ +9.2%</span>
          <span style="color:var(--text-muted);">${i18n.get('vsPrevious')}</span>
          ${demoBadge}
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-title">${i18n.get('successfulPayments')}</span>
          <div class="kpi-icon-wrap"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
        </div>
        <div class="kpi-value" style="color:var(--success);">${Number(stats.successfulPayments).toLocaleString()}</div>
        <div class="kpi-subtext">
          <span class="trend-up">98.4% Success Rate</span>
          ${demoBadge}
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-title">${i18n.get('failedPaymentsCount')}</span>
          <div class="kpi-icon-wrap"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
        </div>
        <div class="kpi-value" style="color:var(--danger);">${Number(stats.failedPayments).toLocaleString()}</div>
        <div class="kpi-subtext">
          <span class="trend-down">↓ -2.1%</span>
          <span style="color:var(--text-muted);">${i18n.get('vsPrevious')}</span>
          ${demoBadge}
        </div>
      </div>

      <!-- Row 2: Operational Topology -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-title">${i18n.get('activeMerchants')}</span>
          <div class="kpi-icon-wrap"><svg viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></div>
        </div>
        <div class="kpi-value">${Number(stats.activeMerchants).toLocaleString()}</div>
        <div class="kpi-subtext">
          <span class="badge badge-active">Enterprise</span>
          <span style="color:var(--text-muted);">Verified Stores</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-title">${i18n.get('activeDevices')}</span>
          <div class="kpi-icon-wrap"><svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></div>
        </div>
        <div class="kpi-value" style="color:var(--info);">${stats.activeDevices} / ${stats.totalDevices}</div>
        <div class="kpi-subtext">
          <span class="status-pulse-dot" style="display:inline-block;"></span>
          <span style="color:var(--text-muted);">Android SMS Forwarders</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-title">${i18n.get('pendingInvoices')}</span>
          <div class="kpi-icon-wrap"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
        </div>
        <div class="kpi-value">${Number(stats.pendingInvoices).toLocaleString()}</div>
        <div class="kpi-subtext">
          <span class="badge badge-pending">Expiring in 30m</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-title">${i18n.get('webhookFailures')}</span>
          <div class="kpi-icon-wrap"><svg viewBox="0 0 24 24"><path d="M18 16.98h4v5h-4z"/><path d="M2 16.98h4v5H2z"/><path d="M10 2h4v5h-4z"/><path d="M12 7v5"/><path d="M5 12v5"/><path d="M19 12v5"/><path d="M5 12h14"/></svg></div>
        </div>
        <div class="kpi-value" style="color: ${stats.webhookFailures > 0 ? 'var(--danger)' : 'var(--success)'};">${stats.webhookFailures}</div>
        <div class="kpi-subtext">
          <span class="badge badge-retrying">Auto-Retrying</span>
        </div>
      </div>
    `;
  },

  // Interactive SVG Revenue Chart
  renderRevenueChart(data = [], metric = 'revenue') {
    if (!data.length) {
      return `<div style="padding:3rem;text-align:center;color:var(--text-muted);">No chart analytics available.</div>`;
    }

    const width = 800;
    const height = 240;
    const padding = { top: 20, right: 30, bottom: 30, left: 60 };

    const values = data.map((d) => d[metric] || 0);
    const maxVal = Math.max(...values, 100);
    const minVal = 0;

    const getX = (idx) => padding.left + (idx / (data.length - 1)) * (width - padding.left - padding.right);
    const getY = (val) => height - padding.bottom - ((val - minVal) / (maxVal - minVal)) * (height - padding.top - padding.bottom);

    // Build SVG Path
    let pathD = `M ${getX(0)} ${getY(values[0])}`;
    let areaD = `M ${getX(0)} ${height - padding.bottom} L ${getX(0)} ${getY(values[0])}`;

    for (let i = 1; i < data.length; i++) {
      const x0 = getX(i - 1);
      const y0 = getY(values[i - 1]);
      const x1 = getX(i);
      const y1 = getY(values[i]);
      const cx = (x0 + x1) / 2;
      pathD += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
      areaD += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }

    areaD += ` L ${getX(data.length - 1)} ${height - padding.bottom} Z`;

    const dots = data
      .map((d, i) => {
        const cx = getX(i);
        const cy = getY(d[metric] || 0);
        const label = metric === 'revenue' ? `৳ ${Number(d.revenue).toLocaleString()}` : d[metric];
        return `
        <circle cx="${cx}" cy="${cy}" r="5" class="chart-dot">
          <title>${d.date}: ${label}</title>
        </circle>
      `;
      })
      .join('');

    const xLabels = data
      .map((d, i) => {
        const x = getX(i);
        const dayLabel = d.date ? d.date.substring(5) : '';
        return `<text x="${x}" y="${height - 10}" text-anchor="middle" class="chart-axis-text">${dayLabel}</text>`;
      })
      .join('');

    return `
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg">
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="#4f46e5" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        
        <!-- Horizontal Gridlines -->
        <line x1="${padding.left}" y1="${getY(maxVal)}" x2="${width - padding.right}" y2="${getY(maxVal)}" class="chart-grid-line" />
        <line x1="${padding.left}" y1="${getY(maxVal / 2)}" x2="${width - padding.right}" y2="${getY(maxVal / 2)}" class="chart-grid-line" />
        <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" class="chart-grid-line" />

        <!-- Area & Path -->
        <path d="${areaD}" class="chart-area-revenue" />
        <path d="${pathD}" class="chart-path-revenue" />

        <!-- Data Dots -->
        ${dots}

        <!-- X Axis Labels -->
        ${xLabels}
      </svg>
    `;
  },

  // MFS Provider Analytics Cards
  renderMfsProviders(providers = []) {
    return providers
      .map((p) => {
        const brandClass = `provider-${p.provider.toLowerCase()}`;
        return `
        <div class="provider-card">
          <div class="provider-header">
            <div class="provider-badge-wrap">
              <span class="provider-logo-chip ${brandClass}">${p.provider.charAt(0)}</span>
              <span>${p.provider} MFS</span>
            </div>
            <span class="badge badge-operational">● ${p.status}</span>
          </div>
          
          <div class="provider-metrics-row">
            <div>
              <div style="color:var(--text-muted);font-size:0.7rem;">Transactions</div>
              <div class="provider-metric-val">${Number(p.transactions).toLocaleString()}</div>
            </div>
            <div>
              <div style="color:var(--text-muted);font-size:0.7rem;">Success Rate</div>
              <div class="provider-metric-val" style="color:var(--success);">${p.successRate}</div>
            </div>
            <div>
              <div style="color:var(--text-muted);font-size:0.7rem;">Total Volume</div>
              <div class="provider-metric-val">${this.formatCurrency(p.volume)}</div>
            </div>
          </div>
        </div>
      `;
      })
      .join('');
  },

  // Global Transactions Table
  renderTransactionsTable(txs = []) {
    if (!txs.length) {
      return `<tr><td colspan="9" style="text-align:center;padding:2.5rem;color:var(--text-muted);">No transactions recorded in gateway.</td></tr>`;
    }

    return txs
      .map((t) => {
        const statusBadge = t.is_verified
          ? `<span class="badge badge-completed">COMPLETED</span>`
          : `<span class="badge badge-pending">PENDING</span>`;

        return `
        <tr>
          <td><strong>${t.trx_id}</strong></td>
          <td>${t.merchant_name || t.merchant_id}</td>
          <td><span class="badge badge-neutral">${t.provider}</span></td>
          <td style="font-weight:700;color:var(--text-primary);">${this.formatCurrency(t.amount)}</td>
          <td><code>${this.maskPhoneNumber(t.sender)}</code></td>
          <td>${t.device_name || t.device_id || 'System'}</td>
          <td>${statusBadge}</td>
          <td>${new Date(t.created_at).toLocaleDateString()} ${new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td>
            <button class="btn-secondary btn-sm" onclick="window.inspectTransaction(${t.id})">
              View
            </button>
          </td>
        </tr>
      `;
      })
      .join('');
  },

  // Merchants Table
  renderMerchantsTable(merchants = []) {
    if (!merchants.length) {
      return `<tr><td colspan="8" style="text-align:center;padding:2.5rem;color:var(--text-muted);">No merchants registered yet.</td></tr>`;
    }

    return merchants
      .map((m) => {
        return `
        <tr>
          <td>
            <strong>${m.name}</strong>
            <div style="font-size:0.72rem;color:var(--text-muted);">${m.id}</div>
          </td>
          <td>${m.email}</td>
          <td><span class="badge badge-neutral">${m.device_count || 1} Devices</span></td>
          <td><strong>${Number(m.transaction_count || 0).toLocaleString()}</strong></td>
          <td style="color:var(--success);font-weight:700;">${this.formatCurrency(m.total_volume || 0)}</td>
          <td><span class="badge badge-active">ACTIVE</span></td>
          <td>${new Date(m.created_at).toLocaleDateString()}</td>
          <td>
            <button class="btn-secondary btn-sm" onclick="window.inspectMerchant('${m.id}')">Manage</button>
          </td>
        </tr>
      `;
      })
      .join('');
  },

  // Devices Table
  renderDevicesTable(devices = []) {
    if (!devices.length) {
      return `<tr><td colspan="7" style="text-align:center;padding:2.5rem;color:var(--text-muted);">No forwarder devices paired.</td></tr>`;
    }

    return devices
      .map((d) => {
        const isOnline = d.status === 'ONLINE';
        const statusBadge = isOnline
          ? `<span class="badge badge-online">● ONLINE</span>`
          : `<span class="badge badge-offline">● OFFLINE</span>`;

        return `
        <tr>
          <td>
            <strong>${d.device_name}</strong>
            <div style="font-size:0.72rem;color:var(--text-muted);">${d.id}</div>
          </td>
          <td>${d.merchant_name || d.merchant_id}</td>
          <td><code>${d.sim_number || 'N/A'}</code></td>
          <td>${statusBadge}</td>
          <td>${d.sms_processed || 0} SMS</td>
          <td>${new Date(d.last_seen).toLocaleTimeString()}</td>
          <td>
            <button class="btn-secondary btn-sm" onclick="window.toggleDeviceStatus('${d.id}', '${isOnline ? 'OFFLINE' : 'ONLINE'}')">
              ${isOnline ? 'Pause' : 'Activate'}
            </button>
          </td>
        </tr>
      `;
      })
      .join('');
  },

  // Invoices Table
  renderInvoicesTable(invoices = []) {
    if (!invoices.length) {
      return `<tr><td colspan="7" style="text-align:center;padding:2.5rem;color:var(--text-muted);">No invoices generated.</td></tr>`;
    }

    return invoices
      .map((inv) => {
        const badge = inv.status === 'PAID'
          ? `<span class="badge badge-completed">PAID</span>`
          : inv.status === 'EXPIRED'
          ? `<span class="badge badge-disabled">EXPIRED</span>`
          : `<span class="badge badge-pending">PENDING</span>`;

        return `
        <tr>
          <td><strong>${inv.id}</strong></td>
          <td>${inv.merchant_name || inv.merchant_id}</td>
          <td>${inv.customer_name}</td>
          <td style="font-weight:700;">${this.formatCurrency(inv.expected_amount)}</td>
          <td><span class="badge badge-neutral">${inv.provider}</span></td>
          <td>${badge}</td>
          <td>${new Date(inv.created_at).toLocaleDateString()}</td>
        </tr>
      `;
      })
      .join('');
  },

  // API Keys Table
  renderApiKeysTable(keys = []) {
    return keys
      .map((k) => {
        return `
        <tr>
          <td><code>${k.key_prefix}••••••••••••</code></td>
          <td>${k.merchant_name || k.merchant_id}</td>
          <td><span class="badge badge-neutral">${k.environment.toUpperCase()}</span></td>
          <td><span class="badge ${k.status === 'active' ? 'badge-active' : 'badge-disabled'}">${k.status.toUpperCase()}</span></td>
          <td>${new Date(k.created_at).toLocaleDateString()}</td>
          <td>
            ${k.status === 'active' ? `<button class="btn-secondary btn-sm" style="color:var(--danger);" onclick="window.revokeApiKey('${k.id}')">Revoke</button>` : 'Revoked'}
          </td>
        </tr>
      `;
      })
      .join('');
  },

  // Webhooks Table
  renderWebhooksTable(logs = []) {
    return logs
      .map((wh) => {
        const is200 = wh.http_status === 200;
        return `
        <tr>
          <td><strong>${wh.event}</strong></td>
          <td>${wh.merchant}</td>
          <td><code>${wh.invoice}</code></td>
          <td><span class="badge ${is200 ? 'badge-completed' : 'badge-failed'}">HTTP ${wh.http_status}</span></td>
          <td>${wh.response_time}</td>
          <td>Attempt #${wh.attempt}</td>
          <td>${new Date(wh.created_at).toLocaleTimeString()}</td>
          <td>
            ${!is200 ? `<button class="btn-secondary btn-sm" onclick="window.retryWebhook('${wh.id}')">Retry</button>` : 'Delivered'}
          </td>
        </tr>
      `;
      })
      .join('');
  },

  // Security Audit Logs
  renderAuditLogsTable(logs = []) {
    return logs
      .map((l) => {
        return `
        <tr>
          <td>${new Date(l.created_at).toLocaleTimeString()}</td>
          <td><strong>${l.admin_email}</strong></td>
          <td><span class="badge badge-neutral">${l.action}</span></td>
          <td>${l.resource} (${l.resource_id || 'System'})</td>
          <td><code>${l.ip}</code></td>
          <td><span class="badge badge-completed">${l.result}</span></td>
          <td style="color:var(--text-muted);font-size:0.75rem;">${l.details || ''}</td>
        </tr>
      `;
      })
      .join('');
  },

  // Suspicious Activity Table
  renderSuspiciousTable(items = []) {
    return items
      .map((s) => {
        return `
        <tr>
          <td>${new Date(s.created_at).toLocaleTimeString()}</td>
          <td><span class="badge badge-blocked">${s.event_type}</span></td>
          <td>${s.merchant_name || s.merchant_id || 'Global'}</td>
          <td><code>${s.ip || 'N/A'}</code></td>
          <td style="color:var(--danger);font-weight:600;">${s.risk_reason}</td>
          <td><span class="badge badge-blocked">${s.status}</span></td>
        </tr>
      `;
      })
      .join('');
  },

  // System Health Grid
  renderSystemHealth(health) {
    const services = (health.services || []).map((s) => {
      return `
        <div class="health-service-card">
          <div>
            <div class="health-name">${s.name}</div>
            <div class="health-uptime">Latency: ${s.latency} • Uptime: ${s.uptime}</div>
          </div>
          <span class="badge badge-operational">● ${s.status}</span>
        </div>
      `;
    }).join('');

    const m = health.metrics || {};
    return `
      <div class="health-services-grid">
        ${services}
      </div>

      <div class="dashboard-panel" style="margin-top:1.5rem;">
        <h3 class="panel-title" style="margin-bottom:1rem;">Host & Gateway Metrics</h3>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;">
          <div class="provider-card">
            <div style="color:var(--text-muted);font-size:0.75rem;">CPU Load (1m avg)</div>
            <div style="font-size:1.4rem;font-weight:800;margin-top:0.25rem;">${m.cpuLoad || '0.42'}</div>
          </div>
          <div class="provider-card">
            <div style="color:var(--text-muted);font-size:0.75rem;">Host Memory Usage</div>
            <div style="font-size:1.4rem;font-weight:800;margin-top:0.25rem;">${m.memoryUsage || '42%'}</div>
          </div>
          <div class="provider-card">
            <div style="color:var(--text-muted);font-size:0.75rem;">Database Engine</div>
            <div style="font-size:1.4rem;font-weight:800;margin-top:0.25rem;">SQLite WAL</div>
          </div>
          <div class="provider-card">
            <div style="color:var(--text-muted);font-size:0.75rem;">API Throughput</div>
            <div style="font-size:1.4rem;font-weight:800;margin-top:0.25rem;">${m.apiRequestsPerMin || 180} req/m</div>
          </div>
        </div>
      </div>
    `;
  },

  // Monospace Server Logs Terminal
  renderServerLogsTerminal(logs = []) {
    const lines = logs.map((l) => {
      return `
        <div class="log-line">
          <span class="log-time">${l.timestamp.substring(11, 19)}</span>
          <span class="log-level-${l.level}">[${l.level}]</span>
          <span class="log-service">${l.service}:</span>
          <span class="log-msg">${l.message}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="log-terminal">
        <div class="terminal-header">
          <div class="terminal-dots">
            <span class="terminal-dot terminal-dot-red"></span>
            <span class="terminal-dot terminal-dot-yellow"></span>
            <span class="terminal-dot terminal-dot-green"></span>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);">payflow-gateway.daemon.stdout</div>
          <div style="font-size:0.75rem;color:var(--success);">LIVE STREAM</div>
        </div>
        <div class="terminal-body" id="serverTerminalBody">
          ${lines}
        </div>
      </div>
    `;
  },

  // Admin Users Table
  renderAdminUsersTable(users = []) {
    return users.map((u) => {
      return `
        <tr>
          <td><strong>${u.name}</strong></td>
          <td>${u.email}</td>
          <td><span class="badge ${u.role === 'Super Admin' ? 'badge-completed' : 'badge-neutral'}">${u.role}</span></td>
          <td><span class="badge badge-active">${u.status}</span></td>
          <td>${new Date(u.last_login || u.created_at).toLocaleString()}</td>
        </tr>
      `;
    }).join('');
  },
};
