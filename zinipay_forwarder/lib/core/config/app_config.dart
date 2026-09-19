class AppConfig {
  static const String appName = 'SyncPay Agent';
  static const String appTagline = 'Secure Payment Forwarder';
  static const String appVersion = '1.0.0';

  // Default server URLs
  static const String defaultEmulatorBackendUrl = 'http://10.0.2.2:4000';
  static const String defaultLocalhostBackendUrl = 'http://localhost:4000';
  static const String defaultProductionBackendUrl = 'https://syncpaybd.xyz';

  // Backend Endpoints
  static const String ingestEndpoint = '/api/v1/device/sms/ingest';
  static const String heartbeatEndpoint = '/api/v1/device/heartbeat';
  static const String legacySyncEndpoint = '/api/v1/device/sync';

  // Retry Schedule (seconds)
  static const List<int> retryIntervalsSeconds = [5, 15, 30, 60, 120];
  static const int maxRetryAttempts = 5;

  // Telephony Method & Event Channels
  static const String methodChannelName = 'com.zinipay.forwarder/telephony';
  static const String smsEventChannelName = 'com.zinipay.forwarder/sms_stream';
}
