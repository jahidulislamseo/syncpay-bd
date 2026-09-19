import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../services/biometric_service.dart';
import '../../../services/csv_export_service.dart';
import '../../dashboard/providers/agent_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _biometricAvailable = false;
  bool _biometricEnabled   = false;

  @override
  void initState() {
    super.initState();
    _loadBiometric();
  }

  Future<void> _loadBiometric() async {
    final available = await BiometricService.isAvailable();
    final enabled   = await BiometricService.isEnabled();
    if (mounted) setState(() { _biometricAvailable = available; _biometricEnabled = enabled; });
  }

  Future<void> _toggleBiometric(bool val) async {
    if (val) {
      final ok = await BiometricService.authenticate(reason: 'Biometric lock চালু করতে প্রমাণ করুন');
      if (!ok) return;
    }
    await BiometricService.setEnabled(val);
    if (mounted) setState(() => _biometricEnabled = val);
  }

  @override
  Widget build(BuildContext context) {
    final agentState = ref.watch(agentProvider);
    final loc        = AppLocalizations(agentState.language);
    final allTrx     = [...agentState.transactionHistory, ...agentState.offlineQueue];

    return Scaffold(
      appBar: AppBar(title: Text(loc.tr('nav_settings'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [

          // ── Language ─────────────────────────────────────────────────────
          _SectionHeader(title: loc.tr('language')),
          Card(child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('বাংলা / English', style: TextStyle(fontWeight: FontWeight.w600)),
                DropdownButton<String>(
                  value: agentState.language,
                  underline: const SizedBox(),
                  items: const [
                    DropdownMenuItem(value: 'bn', child: Text('বাংলা (Bangla)')),
                    DropdownMenuItem(value: 'en', child: Text('English (EN)')),
                  ],
                  onChanged: (v) { if (v != null) ref.read(agentProvider.notifier).setLanguage(v); },
                ),
              ],
            ),
          )),
          const SizedBox(height: 16),

          // ── Theme ────────────────────────────────────────────────────────
          _SectionHeader(title: loc.tr('theme')),
          Card(child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('থিম', style: TextStyle(fontWeight: FontWeight.w600)),
                DropdownButton<String>(
                  value: agentState.themeMode,
                  underline: const SizedBox(),
                  items: [
                    DropdownMenuItem(value: 'light', child: Text(loc.tr('theme_light'))),
                    DropdownMenuItem(value: 'dark',  child: Text(loc.tr('theme_dark'))),
                    DropdownMenuItem(value: 'system',child: Text(loc.tr('theme_system'))),
                  ],
                  onChanged: (v) { if (v != null) ref.read(agentProvider.notifier).setThemeMode(v); },
                ),
              ],
            ),
          )),
          const SizedBox(height: 16),

          // ── Security: Biometric ──────────────────────────────────────────
          _SectionHeader(title: 'নিরাপত্তা'),
          Card(child: Column(children: [
            SwitchListTile(
              secondary: const Icon(Icons.fingerprint, color: Color(0xFF6366F1)),
              title: const Text('Biometric Lock', style: TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text(_biometricAvailable
                  ? 'App খুলতে Fingerprint / Face ID ব্যবহার'
                  : 'এই ডিভাইসে Biometric সমর্থিত নয়'),
              value: _biometricEnabled,
              activeColor: const Color(0xFF6366F1),
              onChanged: _biometricAvailable ? _toggleBiometric : null,
            ),
          ])),
          const SizedBox(height: 16),

          // ── MFS Providers ────────────────────────────────────────────────
          _SectionHeader(title: loc.tr('mfs_providers')),
          Card(child: Column(children: [
            _ProviderTile('bKash',  '16247 • Merchant Payment & Cash In', const Color(0xFFE2136E), agentState.bkashActive,  (v) => ref.read(agentProvider.notifier).toggleProvider('bkash',  v)),
            const Divider(height: 1),
            _ProviderTile('Nagad',  '16167 • Payment & Money Received',  const Color(0xFFF7941D), agentState.nagadActive,  (v) => ref.read(agentProvider.notifier).toggleProvider('nagad',  v)),
            const Divider(height: 1),
            _ProviderTile('Rocket', '16216 • DBBL Inbound Transfers',    const Color(0xFF8C3494), agentState.rocketActive, (v) => ref.read(agentProvider.notifier).toggleProvider('rocket', v)),
            const Divider(height: 1),
            _ProviderTile('Upay',   '16268 • UCB Payment & Cash In',     const Color(0xFF00A3E0), agentState.upayActive,   (v) => ref.read(agentProvider.notifier).toggleProvider('upay',   v)),
          ])),
          const SizedBox(height: 16),

          // ── Bank Providers ───────────────────────────────────────────────
          _SectionHeader(title: 'ব্যাংক প্রদানকারী'),
          Card(child: Column(children: [
            _ProviderTile('DBBL',       'Dutch-Bangla Bank Ltd.',       const Color(0xFF005BAC), agentState.dbblActive,       (v) => ref.read(agentProvider.notifier).toggleProvider('dbbl',       v)),
            const Divider(height: 1),
            _ProviderTile('BRAC Bank',  'BRAC Bank Ltd.',               const Color(0xFFE31837), agentState.bracActive,       (v) => ref.read(agentProvider.notifier).toggleProvider('brac',       v)),
            const Divider(height: 1),
            _ProviderTile('Islami Bank','Islami Bank Bangladesh Ltd.',   const Color(0xFF006400), agentState.islamiActive,     (v) => ref.read(agentProvider.notifier).toggleProvider('islami',     v)),
            const Divider(height: 1),
            _ProviderTile('City Bank',  'The City Bank Ltd.',           const Color(0xFF003087), agentState.cityBankActive,   (v) => ref.read(agentProvider.notifier).toggleProvider('citybank',   v)),
          ])),
          const SizedBox(height: 16),

          // ── Alerts ───────────────────────────────────────────────────────
          _SectionHeader(title: 'এলার্ট'),
          Card(child: Column(children: [
            SwitchListTile(
              secondary: const Icon(Icons.notifications_active, color: Color(0xFF10B981)),
              title: const Text('Payment Notification', style: TextStyle(fontWeight: FontWeight.bold)),
              subtitle: const Text('প্রতিটি forwarded SMS-এর জন্য notification'),
              value: agentState.notificationsEnabled,
              activeColor: const Color(0xFF10B981),
              onChanged: (v) => ref.read(agentProvider.notifier).setNotificationsEnabled(v),
            ),
            const Divider(height: 1),
            SwitchListTile(
              secondary: const Icon(Icons.campaign, color: Color(0xFFF59E0B)),
              title: const Text('বড় পেমেন্ট Alert', style: TextStyle(fontWeight: FontWeight.bold)),
              subtitle: const Text('৳৫,০০০ বা বেশি হলে বিশেষ alert'),
              value: agentState.bigPaymentAlertEnabled,
              activeColor: const Color(0xFFF59E0B),
              onChanged: (v) => ref.read(agentProvider.notifier).setBigPaymentAlertEnabled(v),
            ),
          ])),
          const SizedBox(height: 16),

          // ── Export ───────────────────────────────────────────────────────
          _SectionHeader(title: 'ডেটা'),
          Card(child: Column(children: [
            ListTile(
              leading: const Icon(Icons.download, color: Color(0xFF6366F1)),
              title: const Text('CSV Export', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text('${allTrx.length} টি লেনদেন export করুন'),
              trailing: const Icon(Icons.chevron_right),
              onTap: allTrx.isEmpty
                  ? null
                  : () => CsvExportService.exportAndShare(allTrx),
            ),
          ])),
          const SizedBox(height: 16),

          // ── Background Service ───────────────────────────────────────────
          _SectionHeader(title: loc.tr('background_service')),
          Card(child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text(loc.tr('background_service'), style: const TextStyle(fontWeight: FontWeight.bold)),
                Text(
                  agentState.isServiceRunning ? loc.tr('service_running') : loc.tr('service_stopped'),
                  style: TextStyle(color: agentState.isServiceRunning ? const Color(0xFF10B981) : const Color(0xFFEF4444), fontWeight: FontWeight.bold),
                ),
              ]),
              const SizedBox(height: 12),
              Text(loc.tr('battery_guidance'), style: TextStyle(color: Colors.grey.shade400, fontSize: 13)),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFF6366F1))),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Battery optimization settings...')),
                  );
                },
                icon: const Icon(Icons.battery_charging_full),
                label: Text(loc.tr('battery_settings_btn')),
              ),
            ]),
          )),
          const SizedBox(height: 16),

          // ── About ────────────────────────────────────────────────────────
          _SectionHeader(title: loc.tr('about')),
          Card(child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('SyncPay BD Android Forwarder', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              const SizedBox(height: 4),
              const Text('Version 1.1.0 • bKash, Nagad, Rocket, Upay + Banks', style: TextStyle(color: Colors.grey, fontSize: 13)),
              const SizedBox(height: 8),
              Text('Dedicated hardware-level telephony agent ensuring zero dropped payment notifications.',
                  style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
            ]),
          )),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

// ── Helper widgets ──────────────────────────────────────────────────────────

class _ProviderTile extends StatelessWidget {
  final String name, subtitle;
  final Color color;
  final bool value;
  final ValueChanged<bool> onChanged;
  const _ProviderTile(this.name, this.subtitle, this.color, this.value, this.onChanged);

  @override
  Widget build(BuildContext context) => SwitchListTile(
    secondary: Container(
      width: 32, height: 32,
      decoration: BoxDecoration(color: color.withValues(alpha: 0.15), shape: BoxShape.circle),
      child: Center(child: Text(name[0], style: TextStyle(color: color, fontWeight: FontWeight.bold))),
    ),
    title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
    subtitle: Text(subtitle, style: const TextStyle(fontSize: 12)),
    value: value,
    activeColor: color,
    onChanged: onChanged,
  );
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(left: 4, bottom: 8),
    child: Text(title.toUpperCase(),
      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.1, color: Color(0xFF6366F1))),
  );
}
