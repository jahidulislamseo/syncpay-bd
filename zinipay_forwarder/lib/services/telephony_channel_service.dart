import 'dart:async';
import 'package:flutter/services.dart';
import '../core/config/app_config.dart';

typedef SmsStreamHandler = void Function(String sender, String body);

class TelephonyChannelService {
  static const MethodChannel _methodChannel = MethodChannel(AppConfig.methodChannelName);
  static const EventChannel _eventChannel = EventChannel(AppConfig.smsEventChannelName);

  StreamSubscription? _subscription;

  void startListening(SmsStreamHandler onSmsReceived) {
    try {
      _subscription = _eventChannel.receiveBroadcastStream().listen(
        (dynamic event) {
          if (event is Map) {
            final sender = event['sender']?.toString() ?? '';
            final body = event['body']?.toString() ?? '';
            if (body.isNotEmpty) {
              onSmsReceived(sender, body);
            }
          }
        },
        onError: (dynamic error) {
          // Channel error handler
        },
      );
    } catch (_) {
      // Platform channel not available on web/desktop tests
    }
  }

  Future<bool> startForegroundService() async {
    try {
      final res = await _methodChannel.invokeMethod<bool>('startForegroundService');
      return res ?? false;
    } catch (_) {
      return false;
    }
  }

  Future<bool> stopForegroundService() async {
    try {
      final res = await _methodChannel.invokeMethod<bool>('stopForegroundService');
      return res ?? false;
    } catch (_) {
      return false;
    }
  }

  Future<void> requestBatteryOptimization() async {
    try {
      await _methodChannel.invokeMethod('requestBatteryOptimization');
    } catch (_) {}
  }

  /// Launch Android Package Installer for downloaded APK
  Future<bool> installApk(String filePath) async {
    try {
      final res = await _methodChannel.invokeMethod<bool>('installApk', {'filePath': filePath});
      return res ?? false;
    } catch (e) {
      return false;
    }
  }

  void stopListening() {
    _subscription?.cancel();
    _subscription = null;
  }
}
