import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/localization/app_localizations.dart';
import '../providers/agent_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agentState = ref.watch(agentProvider);
    final notifier = ref.read(agentProvider.notifier);
    final loc = AppLocalizations(agentState.language);
    final currencyFormat = NumberFormat('#,##0.00');

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.send_to_mobile, color: Color(0xFF6366F1)),
            const SizedBox(width: 8),
            Text(loc.tr('app_name')),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: agentState.isOnline
                    ? const Color(0xFF10B981).withValues(alpha: 0.15)
                    : const Color(0xFFEF4444).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: agentState.isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                  width: 1,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.circle,
                    size: 8,
                    color: agentState.isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    agentState.isOnline ? loc.tr('status_connected') : loc.tr('status_disconnected'),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: agentState.isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => notifier.syncNow(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Main Device Status Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Device Status'.toUpperCase(),
                            style: const TextStyle(
                              color: Colors.grey,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.1,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            agentState.isOnline ? loc.tr('status_online') : loc.tr('status_offline'),
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: agentState.isOnline
                                  ? const Color(0xFF10B981)
                                  : const Color(0xFFEF4444),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${loc.tr('last_synced')}: ${loc.tr('just_now')}',
                            style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            loc.tr('backend'),
                            style: const TextStyle(color: Colors.grey, fontSize: 11),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Icon(
                                Icons.cloud_done,
                                size: 16,
                                color: agentState.isOnline
                                    ? const Color(0xFF10B981)
                                    : const Color(0xFFEF4444),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                agentState.isOnline ? loc.tr('status_connected') : loc.tr('status_offline'),
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                            ],
                          ),
                          if (agentState.latencyMs != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              '${agentState.latencyMs}ms',
                              style: const TextStyle(
                                color: Color(0xFF38BDF8),
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Today's Payment Volume Banner
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF6366F1), Color(0xFF4F46E5)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF6366F1).withValues(alpha: 0.3),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      loc.tr('today_payment_volume'),
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '৳ ${currencyFormat.format(agentState.todayVolume)}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 32,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // 4 KPI Cards
              Row(
                children: [
                  Expanded(
                    child: _MetricCard(
                      title: loc.tr('sms_received'),
                      value: '${agentState.totalReceived}',
                      icon: Icons.sms,
                      color: const Color(0xFF38BDF8),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _MetricCard(
                      title: loc.tr('processed'),
                      value: '${agentState.totalProcessed}',
                      icon: Icons.done_all,
                      color: const Color(0xFF10B981),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _MetricCard(
                      title: loc.tr('matched_payments'),
                      value: '${agentState.totalMatched}',
                      icon: Icons.verified,
                      color: const Color(0xFF818CF8),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _MetricCard(
                      title: loc.tr('rejected'),
                      value: '${agentState.rejectedCount}',
                      icon: Icons.block,
                      color: const Color(0xFFEF4444),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Offline Queue Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            loc.tr('pending_uploads'),
                            style: const TextStyle(fontSize: 13, color: Colors.grey),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${agentState.offlineQueue.length} ${loc.tr('waiting_to_sync')}',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: agentState.offlineQueue.isNotEmpty
                                  ? const Color(0xFFF59E0B)
                                  : const Color(0xFF10B981),
                            ),
                          ),
                        ],
                      ),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF6366F1),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: agentState.isSyncing ? null : () => notifier.syncNow(),
                        icon: agentState.isSyncing
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.sync, size: 16),
                        label: Text(loc.tr('sync_now')),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Background Service Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            loc.tr('background_service'),
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            agentState.isServiceRunning
                                ? '● ${loc.tr('service_running')}'
                                : '○ ${loc.tr('service_stopped')}',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: agentState.isServiceRunning
                                  ? const Color(0xFF10B981)
                                  : const Color(0xFFEF4444),
                            ),
                          ),
                        ],
                      ),
                      OutlinedButton(
                        onPressed: () {
                          notifier.setBackgroundServiceRunning(!agentState.isServiceRunning);
                        },
                        child: Text(
                          agentState.isServiceRunning
                              ? loc.tr('stop_service')
                              : loc.tr('start_service'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // In-App SMS Simulator Card (For Hardware / Testbench Testing)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.science, size: 20, color: Color(0xFF6366F1)),
                          const SizedBox(width: 8),
                          Text(
                            loc.tr('simulate_sms'),
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        loc.tr('simulate_desc'),
                        style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFE2136E),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            ),
                            onPressed: () {
                              final id = DateTime.now().millisecondsSinceEpoch.toString().substring(6);
                              notifier.handleIncomingRawSms(
                                'bKash',
                                'You have received Tk 1,500.00 from 01712345678. Fee Tk 0.00. Balance Tk 8,500.00. TrxID BK$id at 19/09/2026 10:41',
                              );
                            },
                            child: const Text('+ bKash ৳1,500', style: TextStyle(fontSize: 12)),
                          ),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFF7941D),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            ),
                            onPressed: () {
                              final id = DateTime.now().millisecondsSinceEpoch.toString().substring(6);
                              notifier.handleIncomingRawSms(
                                'Nagad',
                                'Received Amount: Tk 500.00 from 01812345678. TxnID: NG$id. Balance: Tk 12,450.00',
                              );
                            },
                            child: const Text('+ Nagad ৳500', style: TextStyle(fontSize: 12)),
                          ),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF8C3494),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            ),
                            onPressed: () {
                              final id = DateTime.now().millisecondsSinceEpoch.toString().substring(6);
                              notifier.handleIncomingRawSms(
                                '16216',
                                'Tk 1,200.00 received from 019123456789. TxnId: RK$id. Balance: Tk 3,400.00',
                              );
                            },
                            child: const Text('+ Rocket ৳1,200', style: TextStyle(fontSize: 12)),
                          ),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF00A3E0),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            ),
                            onPressed: () {
                              final id = DateTime.now().millisecondsSinceEpoch.toString().substring(6);
                              notifier.handleIncomingRawSms(
                                'UPAY',
                                'You have received Tk 750.00 from 01612345678. Fee Tk 0.00. Balance Tk 2,100.00. TrxID UP$id at 19/09/2026',
                              );
                            },
                            child: const Text('+ Upay ৳750', style: TextStyle(fontSize: 12)),
                          ),
                          OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFFEF4444),
                              side: const BorderSide(color: Color(0xFFEF4444)),
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            ),
                            onPressed: () {
                              notifier.handleIncomingRawSms(
                                '121',
                                'Your weekly internet pack of 1GB was renewed successfully.',
                              );
                            },
                            child: const Text('Simulate Spam (Reject)', style: TextStyle(fontSize: 12)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _MetricCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.w600),
              ),
              Icon(icon, size: 18, color: color),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}
