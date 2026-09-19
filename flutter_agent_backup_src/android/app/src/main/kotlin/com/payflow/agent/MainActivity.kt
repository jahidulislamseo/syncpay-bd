package com.payflow.agent

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val METHOD_CHANNEL = "com.zinipay.forwarder/telephony"
    private val EVENT_CHANNEL = "com.zinipay.forwarder/sms_stream"

    private var eventSink: EventChannel.EventSink? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // MethodChannel
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, METHOD_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "startForegroundService" -> {
                    val intent = Intent(this, ForegroundSyncService::class.java).apply {
                        action = ForegroundSyncService.ACTION_START
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(intent)
                    } else {
                        startService(intent)
                    }
                    result.success(true)
                }
                "stopForegroundService" -> {
                    val intent = Intent(this, ForegroundSyncService::class.java).apply {
                        action = ForegroundSyncService.ACTION_STOP
                    }
                    startService(intent)
                    result.success(true)
                }
                "requestBatteryOptimization" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        val pm = getSystemService(POWER_SERVICE) as PowerManager
                        if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                                data = Uri.parse("package:$packageName")
                            }
                            startActivity(intent)
                        }
                    }
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }

        // EventChannel for Real-time SMS Streaming to Flutter UI
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, EVENT_CHANNEL).setStreamHandler(
            object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    eventSink = events
                    SmsListenerReceiver.smsListenerCallback = { sender, body ->
                        runOnUiThread {
                            eventSink?.success(mapOf("sender" to sender, "body" to body))
                        }
                    }
                }

                override fun onCancel(arguments: Any?) {
                    eventSink = null
                    SmsListenerReceiver.smsListenerCallback = null
                }
            }
        )
    }
}
