import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/storage/local_vault.dart';
import 'core/theme/app_theme.dart';
import 'features/dashboard/providers/agent_provider.dart';
import 'features/splash/splash_screen.dart';
import 'services/telephony_channel_service.dart';
import 'services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationService.init();
  final vault = await LocalVault.init();

  runApp(
    ProviderScope(
      overrides: [
        localVaultProvider.overrideWithValue(vault),
      ],
      child: const ZiniPayForwarderApp(),
    ),
  );
}

class ZiniPayForwarderApp extends ConsumerStatefulWidget {
  const ZiniPayForwarderApp({super.key});

  @override
  ConsumerState<ZiniPayForwarderApp> createState() => _ZiniPayForwarderAppState();
}

class _ZiniPayForwarderAppState extends ConsumerState<ZiniPayForwarderApp> {
  final TelephonyChannelService _telephonyChannel = TelephonyChannelService();

  @override
  void initState() {
    super.initState();
    // Listen for platform SMS events emitted by Android SmsListenerReceiver
    _telephonyChannel.startListening((sender, body) {
      ref.read(agentProvider.notifier).handleIncomingRawSms(sender, body);
    });
  }

  @override
  void dispose() {
    _telephonyChannel.stopListening();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final agentState = ref.watch(agentProvider);

    ThemeMode mode;
    switch (agentState.themeMode) {
      case 'dark':
        mode = ThemeMode.dark;
        break;
      case 'system':
        mode = ThemeMode.system;
        break;
      case 'light':
      default:
        mode = ThemeMode.light;
        break;
    }

    return MaterialApp(
      title: 'ZiniPay Payment Agent',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: mode,
      home: const SplashScreen(),
    );
  }
}
