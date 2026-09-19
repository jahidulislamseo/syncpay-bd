package com.zinipay.payflow_agent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

class SmsListenerReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "ZiniPaySmsReceiver"
        var smsListenerCallback: ((sender: String, body: String) -> Unit)? = null
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            for (sms in messages) {
                val sender = sms.displayOriginatingAddress ?: ""
                val body = sms.displayMessageBody ?: ""

                Log.d(TAG, "Incoming SMS from $sender: $body")

                val senderUpper = sender.uppercase()
                val bodyUpper = body.uppercase()

                // Filter for MFS Send Money / Cash In SMS (bKash, Nagad, Rocket, Upay)
                val isMfs = senderUpper.contains("BKASH") || senderUpper.contains("16247") ||
                            senderUpper.contains("NAGAD") || senderUpper.contains("16167") ||
                            senderUpper.contains("ROCKET") || senderUpper.contains("16216") || senderUpper.contains("DBBL") ||
                            senderUpper.contains("UPAY") || senderUpper.contains("16268") ||
                            bodyUpper.contains("TRXID") || bodyUpper.contains("TXNID")

                if (isMfs) {
                    // 1. Notify active Flutter UI if attached
                    val callback = smsListenerCallback
                    if (callback != null) {
                        callback(sender, body)
                    } else {
                        // 2. Standalone Background Forwarding Fallback
                        forwardToZiniPay(context, sender, body)
                    }
                }
            }
        }
    }

    private fun forwardToZiniPay(context: Context, sender: String, body: String) {
        val prefs = context.getSharedPreferences("FlutterSharedPreferences", Context.MODE_PRIVATE)
        val token = prefs.getString("flutter.zp_device_token", "token_phone_primary") ?: "token_phone_primary"
        val deviceId = prefs.getString("flutter.zp_device_id", "ZP-AND-PRIMARY") ?: "ZP-AND-PRIMARY"
        val baseUrl = prefs.getString("flutter.zp_backend_url", "http://10.0.2.2:4000") ?: "http://10.0.2.2:4000"

        val endpoint = baseUrl.trimEnd('/') + "/api/v1/device/sms/ingest"

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL(endpoint)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; utf-8")
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.connectTimeout = 12000
                conn.readTimeout = 12000
                conn.doOutput = true

                val payload = JSONObject().apply {
                    put("device_id", token)
                    put("sms", body)
                    put("sender", sender)
                    put("received_at", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date()))
                }

                conn.outputStream.use { os ->
                    val input = payload.toString().toByteArray(Charsets.UTF_8)
                    os.write(input, 0, input.size)
                }

                val responseCode = conn.responseCode
                Log.i(TAG, "Ingested to ZiniPay /api/v1/device/sms/ingest. Response: $responseCode")
                conn.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "Offline/Error during background SMS ingest: ${e.localizedMessage}")
            }
        }
    }
}
