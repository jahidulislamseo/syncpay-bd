package com.zinipay.payflow_agent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.telephony.SubscriptionManager
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

class SmsListenerReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "SyncPaySmsReceiver"
        var smsListenerCallback: ((data: Map<String, Any?>) -> Unit)? = null
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)

            val simSlot = extractSimSlot(intent)
            val carrier = extractCarrier(context, simSlot)

            for (sms in messages) {
                val sender = sms.displayOriginatingAddress ?: ""
                val body = sms.displayMessageBody ?: ""

                Log.d(TAG, "Incoming SMS (Slot $simSlot, Carrier $carrier) from $sender: $body")

                val senderUpper = sender.uppercase()
                val bodyUpper = body.uppercase()

                // Filter for MFS Send Money / Cash In SMS (bKash, Nagad, Rocket, Upay)
                val isMfs = senderUpper.contains("BKASH") || senderUpper.contains("16247") ||
                            senderUpper.contains("NAGAD") || senderUpper.contains("16167") ||
                            senderUpper.contains("ROCKET") || senderUpper.contains("16216") || senderUpper.contains("DBBL") ||
                            senderUpper.contains("UPAY") || senderUpper.contains("16268") ||
                            bodyUpper.contains("TRXID") || bodyUpper.contains("TXNID")

                if (isMfs) {
                    val smsData = mapOf(
                        "sender" to sender,
                        "body" to body,
                        "sim_slot" to simSlot,
                        "carrier" to carrier,
                        "received_at" to System.currentTimeMillis()
                    )

                    val callback = smsListenerCallback
                    if (callback != null) {
                        callback(smsData)
                    } else {
                        forwardToSyncPay(context, sender, body, simSlot, carrier)
                    }
                }
            }
        }
    }

    private fun extractSimSlot(intent: Intent): Int {
        val slotKeys = arrayOf("simSlot", "slot", "phone", "subscription", "simId", "sim_slot", "com.android.phone.extra.slot")
        for (key in slotKeys) {
            if (intent.hasExtra(key)) {
                val value = intent.getIntExtra(key, -1)
                if (value in 0..1) return value
            }
        }
        return 0
    }

    private fun extractCarrier(context: Context, slot: Int): String {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                val subManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
                val activeList = subManager?.activeSubscriptionInfoList
                if (!activeList.isNullOrEmpty()) {
                    for (sub in activeList) {
                        if (sub.simSlotIndex == slot) {
                            return sub.displayName?.toString() ?: sub.carrierName?.toString() ?: "Unknown"
                        }
                    }
                    return activeList.firstOrNull()?.carrierName?.toString() ?: "Cellular"
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Carrier extraction: ${e.localizedMessage}")
        }
        return "Cellular"
    }

    private fun forwardToSyncPay(context: Context, sender: String, body: String, simSlot: Int, carrier: String) {
        val prefs = context.getSharedPreferences("FlutterSharedPreferences", Context.MODE_PRIVATE)
        val token = prefs.getString("flutter.zp_device_token", "token_phone_primary") ?: "token_phone_primary"
        val baseUrl = prefs.getString("flutter.zp_backend_url", "https://syncpaybd.site") ?: "https://syncpaybd.site"

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
                    put("sim_slot", simSlot)
                    put("carrier", carrier)
                    put("source", "SMS")
                    put("received_at", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date()))
                }

                conn.outputStream.use { os ->
                    val input = payload.toString().toByteArray(Charsets.UTF_8)
                    os.write(input, 0, input.size)
                }

                val responseCode = conn.responseCode
                Log.i(TAG, "Ingested to SyncPay /api/v1/device/sms/ingest. Response: $responseCode")
                conn.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "Offline/Error during background SMS ingest: ${e.localizedMessage}")
            }
        }
    }
}
