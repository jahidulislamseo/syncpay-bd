import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/localization/app_localizations.dart';
import '../../dashboard/providers/agent_provider.dart';
import '../../logs/presentation/activity_logs_screen.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agentState = ref.watch(agentProvider);
    final loc = AppLocalizations(agentState.language);

    return Scaffold(
      appBar: AppBar(
        title: Text(loc.tr('nav_settings')),
        centerTitle: false,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [
          // Section: Language
          _SectionHeader(title: loc.tr('language')),
          Card(
            child: Padding(
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
                    onChanged: (val) {
                      if (val != null) {
                        ref.read(agentProvider.notifier).setLanguage(val);
                      }
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Section: Theme
          _SectionHeader(title: loc.tr('theme')),
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    agentState.themeMode == 'dark'
                        ? loc.tr('theme_dark')
                        : agentState.themeMode == 'light'
                            ? loc.tr('theme_light')
                            : loc.tr('theme_system'),
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  DropdownButton<String>(
                    value: agentState.themeMode,
                    underline: const SizedBox(),
                    items: [
                      DropdownMenuItem(value: 'dark', child: Text(loc.tr('theme_dark'))),
                      DropdownMenuItem(value: 'light', child: Text(loc.tr('theme_light'))),
                      DropdownMenuItem(value: 'system', child: Text(loc.tr('theme_system'))),
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        ref.read(agentProvider.notifier).setThemeMode(val);
                      }
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Section: MFS Providers
          _SectionHeader(title: loc.tr('mfs_providers')),
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  title: const Text('bKash', style: TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: const Text('16247, Merchant Payment & Cash In'),
                  value: agentState.bkashActive,
                  activeThumbColor: const Color(0xFFE2136E),
                  onChanged: (val) => ref.read(agentProvider.notifier).toggleProvider('bkash', val),
                ),
                const Divider(height: 1),
                SwitchListTile(
                  title: const Text('Nagad', style: TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: const Text('16167, Payment & Money Received'),
                  value: agentState.nagadActive,
                  activeThumbColor: const Color(0xFFF7941D),
                  onChanged: (val) => ref.read(agentProvider.notifier).toggleProvider('nagad', val),
                ),
                const Divider(height: 1),
                SwitchListTile(
                  title: const Text('Rocket', style: TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: const Text('16216, DBBL Inbound Transfers'),
                  value: agentState.rocketActive,
                  activeThumbColor: const Color(0xFF8C3494),
                  onChanged: (val) => ref.read(agentProvider.notifier).toggleProvider('rocket', val),
                ),
                const Divider(height: 1),
                SwitchListTile(
                  title: const Text('Upay', style: TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: const Text('16268, UCB Payment & Cash In'),
                  value: agentState.upayActive,
                  activeThumbColor: const Color(0xFF00A3E0),
                  onChanged: (val) => ref.read(agentProvider.notifier).toggleProvider('upay', val),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Section: Background Service & Battery
          _SectionHeader(title: loc.tr('background_service')),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(loc.tr('background_service'), style: const TextStyle(fontWeight: FontWeight.bold)),
                      Text(
                        agentState.isServiceRunning ? loc.tr('service_running') : loc.tr('service_stopped'),
                        style: TextStyle(
                          color: agentState.isServiceRunning ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    loc.tr('battery_guidance'),
                    style: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFF6366F1)),
                    ),
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Opening Android Battery Optimization Settings...')),
                      );
                    },
                    icon: const Icon(Icons.battery_charging_full),
                    label: Text(loc.tr('battery_settings_btn')),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Section: Logs
          _SectionHeader(title: loc.tr('activity_logs')),
          Card(
            child: ListTile(
              leading: const Icon(Icons.receipt_long, color: Color(0xFF6366F1)),
              title: Text(loc.tr('activity_logs'), style: const TextStyle(fontWeight: FontWeight.w600)),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const ActivityLogsScreen()),
                );
              },
            ),
          ),
          const SizedBox(height: 16),

          // Section: About
          _SectionHeader(title: loc.tr('about')),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('ZiniPay Android Forwarder', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  const SizedBox(height: 4),
                  const Text('Version 1.0.0 (Production Agent)', style: TextStyle(color: Colors.grey, fontSize: 13)),
                  const SizedBox(height: 8),
                  Text(
                    'Dedicated hardware-level telephony agent ensuring zero dropped payment notifications.',
                    style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.1,
          color: Color(0xFF6366F1),
        ),
      ),
    );
  }
}
