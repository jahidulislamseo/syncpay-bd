import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/localization/app_localizations.dart';
import '../../connection/presentation/connection_screen.dart';
import '../../settings/presentation/settings_screen.dart';
import '../../sms/presentation/sms_activity_screen.dart';
import '../providers/agent_provider.dart';
import 'dashboard_screen.dart';

class AgentShell extends ConsumerStatefulWidget {
  const AgentShell({super.key});

  @override
  ConsumerState<AgentShell> createState() => _AgentShellState();
}

class _AgentShellState extends ConsumerState<AgentShell> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    DashboardScreen(),
    SmsActivityScreen(),
    ConnectionScreen(),
    SettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final agentState = ref.watch(agentProvider);
    final loc = AppLocalizations(agentState.language);

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: [
          BottomNavigationBarItem(
            icon: const Icon(Icons.dashboard_outlined),
            activeIcon: const Icon(Icons.dashboard),
            label: loc.tr('nav_home'),
          ),
          BottomNavigationBarItem(
            icon: Badge(
              isLabelVisible: agentState.offlineQueue.isNotEmpty,
              label: Text('${agentState.offlineQueue.length}'),
              child: const Icon(Icons.sms_outlined),
            ),
            activeIcon: Badge(
              isLabelVisible: agentState.offlineQueue.isNotEmpty,
              label: Text('${agentState.offlineQueue.length}'),
              child: const Icon(Icons.sms),
            ),
            label: loc.tr('nav_activity'),
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.devices_outlined),
            activeIcon: const Icon(Icons.devices),
            label: loc.tr('nav_connection'),
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.settings_outlined),
            activeIcon: const Icon(Icons.settings),
            label: loc.tr('nav_settings'),
          ),
        ],
      ),
    );
  }
}
