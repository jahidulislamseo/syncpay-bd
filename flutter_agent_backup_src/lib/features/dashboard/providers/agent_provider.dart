import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/local_vault.dart';
import '../../../services/offline_queue_service.dart';
import '../../sms/models/sms_transaction.dart';
import '../../sms/services/mfs_sms_parser.dart';

class AgentState {
  final bool isOnline;
  final bool isServiceRunning;
  final int? latencyMs;
  final DateTime lastSyncedAt;
  final String backendUrl;
  final String deviceId;
  final String deviceToken;
  final String merchantId;
  final String merchantName;
  final String language;
  final String themeMode;
  final bool bkashActive;
  final bool nagadActive;
  final bool rocketActive;
  final bool upayActive;
  final List<SmsTransaction> offlineQueue;
  final List<SmsTransaction> transactionHistory;
  final int rejectedCount;
  final bool isSyncing;

  const AgentState({
    required this.isOnline,
    required this.isServiceRunning,
    this.latencyMs,
    required this.lastSyncedAt,
    required this.backendUrl,
    required this.deviceId,
    required this.deviceToken,
    required this.merchantId,
    required this.merchantName,
    required this.language,
    required this.themeMode,
    required this.bkashActive,
    required this.nagadActive,
    required this.rocketActive,
    required this.upayActive,
    required this.offlineQueue,
    required this.transactionHistory,
    required this.rejectedCount,
    required this.isSyncing,
  });

  int get totalReceived => transactionHistory.length + offlineQueue.length + rejectedCount;
  int get totalProcessed => transactionHistory.where((t) => t.status == SmsStatus.processed || t.status == SmsStatus.matched).length;
  int get totalMatched => transactionHistory.where((t) => t.status == SmsStatus.matched).length;

  double get todayVolume {
    final now = DateTime.now();
    return transactionHistory
        .where((t) =>
            (t.status == SmsStatus.processed || t.status == SmsStatus.matched) &&
            t.receivedAt.year == now.year &&
            t.receivedAt.month == now.month &&
            t.receivedAt.day == now.day)
        .fold(0.0, (sum, t) => sum + t.amount);
  }

  AgentState copyWith({
    bool? isOnline,
    bool? isServiceRunning,
    int? latencyMs,
    DateTime? lastSyncedAt,
    String? backendUrl,
    String? deviceId,
    String? deviceToken,
    String? merchantId,
    String? merchantName,
    String? language,
    String? themeMode,
    bool? bkashActive,
    bool? nagadActive,
    bool? rocketActive,
    bool? upayActive,
    List<SmsTransaction>? offlineQueue,
    List<SmsTransaction>? transactionHistory,
    int? rejectedCount,
    bool? isSyncing,
  }) {
    return AgentState(
      isOnline: isOnline ?? this.isOnline,
      isServiceRunning: isServiceRunning ?? this.isServiceRunning,
      latencyMs: latencyMs ?? this.latencyMs,
      lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
      backendUrl: backendUrl ?? this.backendUrl,
      deviceId: deviceId ?? this.deviceId,
      deviceToken: deviceToken ?? this.deviceToken,
      merchantId: merchantId ?? this.merchantId,
      merchantName: merchantName ?? this.merchantName,
      language: language ?? this.language,
      themeMode: themeMode ?? this.themeMode,
      bkashActive: bkashActive ?? this.bkashActive,
      nagadActive: nagadActive ?? this.nagadActive,
      rocketActive: rocketActive ?? this.rocketActive,
      upayActive: upayActive ?? this.upayActive,
      offlineQueue: offlineQueue ?? this.offlineQueue,
      transactionHistory: transactionHistory ?? this.transactionHistory,
      rejectedCount: rejectedCount ?? this.rejectedCount,
      isSyncing: isSyncing ?? this.isSyncing,
    );
  }
}

final localVaultProvider = Provider<LocalVault>((ref) {
  throw UnimplementedError('localVaultProvider must be overridden with initialized LocalVault');
});

final agentProvider = StateNotifierProvider<AgentNotifier, AgentState>((ref) {
  final vault = ref.watch(localVaultProvider);
  return AgentNotifier(vault);
});

class AgentNotifier extends StateNotifier<AgentState> {
  final LocalVault _vault;
  final ApiClient _apiClient;
  late final OfflineQueueService _queueService;
  Timer? _heartbeatTimer;

  AgentNotifier(this._vault, {ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient(),
        super(AgentState(
          isOnline: true,
          isServiceRunning: true,
          latencyMs: 115,
          lastSyncedAt: DateTime.now(),
          backendUrl: _vault.backendUrl,
          deviceId: _vault.deviceId,
          deviceToken: _vault.deviceToken,
          merchantId: _vault.merchantId,
          merchantName: _vault.merchantName,
          language: _vault.language,
          themeMode: _vault.themeMode,
          bkashActive: _vault.bkashEnabled,
          nagadActive: _vault.nagadEnabled,
          rocketActive: _vault.rocketEnabled,
          upayActive: _vault.upayEnabled,
          offlineQueue: [],
          transactionHistory: [],
          rejectedCount: 0,
          isSyncing: false,
        )) {
    _queueService = OfflineQueueService(vault: _vault, apiClient: _apiClient);
    _queueService.onStateChanged = (queue, history) {
      state = state.copyWith(
        offlineQueue: queue,
        transactionHistory: history,
        lastSyncedAt: DateTime.now(),
        isSyncing: _queueService.isSyncing,
      );
    };

    // Load persisted state
    state = state.copyWith(
      offlineQueue: _queueService.getQueue(),
      transactionHistory: _queueService.getHistory(),
    );

    // Initial ping
    pingBackend();

    // Start periodic heartbeat (every 60s)
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      pingBackend();
    });
  }

  /// Pings backend to check online status and latency
  Future<void> pingBackend() async {
    final latency = await _apiClient.measureLatency(
      backendUrl: state.backendUrl,
      deviceToken: state.deviceToken,
    );

    final online = latency != null;
    state = state.copyWith(
      isOnline: online,
      latencyMs: latency,
      lastSyncedAt: online ? DateTime.now() : state.lastSyncedAt,
    );
  }

  /// Main handler for incoming SMS intercepted by telephony broadcast receiver or simulator
  Future<bool> handleIncomingRawSms(String sender, String body) async {
    await _vault.addLog('Incoming SMS Received', 'From: $sender');

    // Parse SMS
    final parsed = MfsSmsParser.parse(sender, body);

    if (!parsed.success || parsed.amount == null || parsed.trxId == null) {
      state = state.copyWith(rejectedCount: state.rejectedCount + 1);
      await _vault.addLog(
        'SMS Rejected',
        'Non-financial or unrecognized format: ${parsed.error ?? "Failed regex"}',
      );
      return false;
    }

    // Check if provider is enabled
    if (parsed.provider == 'bKash' && !state.bkashActive) return false;
    if (parsed.provider == 'Nagad' && !state.nagadActive) return false;
    if (parsed.provider == 'Rocket' && !state.rocketActive) return false;
    if (parsed.provider == 'Upay' && !state.upayActive) return false;

    await _vault.addLog(
      'Parser Detected ${parsed.provider}',
      'Extracted TrxID: ${parsed.trxId}, Amount: ৳${parsed.amount}',
    );

    final transaction = parsed.toTransaction();
    return _queueService.enqueue(transaction);
  }

  /// Triggers manual sync of offline queue
  Future<void> syncNow() async {
    state = state.copyWith(isSyncing: true);
    await pingBackend();
    await _queueService.processQueue();
    state = state.copyWith(isSyncing: false, lastSyncedAt: DateTime.now());
  }

  /// Language Switcher (Bengali / English) - zero app restart required
  Future<void> setLanguage(String code) async {
    await _vault.setLanguage(code);
    state = state.copyWith(language: code);
  }

  /// Theme Switcher (Dark / Light / System)
  Future<void> setThemeMode(String mode) async {
    await _vault.setThemeMode(mode);
    state = state.copyWith(themeMode: mode);
  }

  /// Toggle MFS Provider
  Future<void> toggleProvider(String provider, bool active) async {
    switch (provider.toLowerCase()) {
      case 'bkash':
        await _vault.setBkashEnabled(active);
        state = state.copyWith(bkashActive: active);
        break;
      case 'nagad':
        await _vault.setNagadEnabled(active);
        state = state.copyWith(nagadActive: active);
        break;
      case 'rocket':
        await _vault.setRocketEnabled(active);
        state = state.copyWith(rocketActive: active);
        break;
      case 'upay':
        await _vault.setUpayEnabled(active);
        state = state.copyWith(upayActive: active);
        break;
    }
  }

  /// Update Device Pairing / Setup credentials
  Future<void> updatePairingConfig({
    required String backendUrl,
    required String deviceToken,
    required String merchantId,
    required String merchantName,
  }) async {
    await _vault.setBackendUrl(backendUrl);
    await _vault.setDeviceToken(deviceToken);
    await _vault.setMerchantId(merchantId);
    await _vault.setMerchantName(merchantName);

    state = state.copyWith(
      backendUrl: backendUrl,
      deviceToken: deviceToken,
      merchantId: merchantId,
      merchantName: merchantName,
    );

    await pingBackend();
    await _vault.addLog('Pairing Config Updated', 'Connected to $merchantName ($merchantId)');
  }

  /// Start / Stop Background Service state
  void setBackgroundServiceRunning(bool running) {
    state = state.copyWith(isServiceRunning: running);
    _vault.addLog('Background Service', running ? 'Service Started' : 'Service Stopped');
  }

  /// Disconnect Device
  Future<void> disconnectDevice() async {
    await _vault.disconnectDevice();
    state = state.copyWith(
      offlineQueue: [],
      transactionHistory: [],
      isOnline: false,
    );
  }

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    _queueService.dispose();
    super.dispose();
  }
}
