package com.devluuking.livestudio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.sources.audio.MicrophoneSource
import com.pedro.encoder.input.sources.audio.MixAudioSource
import com.pedro.encoder.input.sources.video.NoVideoSource
import com.pedro.encoder.input.sources.video.ScreenSource
import com.pedro.library.generic.GenericStream

class StreamService : Service(), ConnectChecker {

    companion object {
        private const val TAG = "StreamService"
        private const val CHANNEL_ID = "livestudio_stream"
        private const val NOTIFY_ID = 4201
        const val ACTION_START = "com.devluuking.livestudio.START"
        const val ACTION_STOP = "com.devluuking.livestudio.STOP"
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_DATA = "data"

        @Volatile var statusListener: ((String) -> Unit)? = null
        @Volatile var streaming: Boolean = false
    }

    private val streams = mutableListOf<GenericStream>()
    private var mediaProjection: MediaProjection? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val connected = mutableSetOf<String>()
    private val destByStream = mutableMapOf<GenericStream, Destination>()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
                val data: Intent? = if (Build.VERSION.SDK_INT >= 33) {
                    intent.getParcelableExtra(EXTRA_DATA, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION") intent.getParcelableExtra(EXTRA_DATA)
                }
                if (data != null) startStreaming(resultCode, data)
                else report("Screen capture permission မရပါ")
            }
            ACTION_STOP -> stopStreaming()
        }
        return START_STICKY
    }

    private fun startStreaming(resultCode: Int, data: Intent) {
        if (streaming) return
        var dests = Prefs.destinations(this).filter { it.enabled && it.server.isNotBlank() && it.key.isNotBlank() }
        if (dests.isEmpty()) {
            report("Stream key ထည့်ထားတဲ့ platform မရှိပါ — ⚙ Keys မှာ အရင်ထည့်ပါ")
            stopSelf()
            return
        }
        // Android 14+: one MediaProjection allows only ONE createVirtualDisplay() call, so
        // per-destination ScreenSource instances cannot all capture from the same projection.
        // v1 guard: stream to the first enabled platform only and say so plainly.
        // TODO(v2): single capture feeding a fan-out to all destinations.
        if (Build.VERSION.SDK_INT >= 34 && dests.size > 1) {
            report("Android 14+ မှာ v1 က platform တစ်ခုပဲ လွှင့်နိုင်သေးသည် — ${dests.first().label} ကိုပဲ လွှင့်မည် (ကျန်တာတွေ v2 မှာ ရမည်)")
            dests = listOf(dests.first())
        }

        startForegroundWithNotification()
        acquireWakeLock()

        val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val projection = mpm.getMediaProjection(resultCode, data)
        if (projection == null) {
            report("MediaProjection မရပါ")
            stopSelf()
            return
        }
        mediaProjection = projection
        projection.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() {
                Log.i(TAG, "MediaProjection stopped")
            }
        }, null)

        val bitrate = Prefs.bitrateKbps(this) * 1000
        var started = 0
        for (dest in dests) {
            try {
                val stream = GenericStream(baseContext, this, NoVideoSource(), MicrophoneSource()).apply {
                    getGlInterface().setForceRender(true, 15)
                }
                val prepared = stream.prepareVideo(1280, 720, bitrate, rotation = 90) &&
                    stream.prepareAudio(44100, true, 128 * 1000, echoCanceler = true, noiseSuppressor = true)
                if (!prepared) {
                    report("${dest.label}: encoder prepare မအောင်မြင်ပါ")
                    stream.release()
                    continue
                }
                stream.changeVideoSource(ScreenSource(applicationContext, projection))
                stream.changeAudioSource(MixAudioSource(projection))
                destByStream[stream] = dest
                streams.add(stream)
                stream.startStream(dest.endpoint())
                started++
                report("${dest.label}: ချိတ်နေသည်…")
            } catch (e: Exception) {
                Log.e(TAG, "start failed for ${dest.label}", e)
                report("${dest.label}: စတင်မရပါ (${e.message})")
            }
        }
        streaming = started > 0
        if (!streaming) {
            stopStreaming()
        }
    }

    private fun stopStreaming() {
        for (s in streams) {
            try {
                if (s.isStreaming) s.stopStream()
            } catch (_: Exception) {}
            try { s.release() } catch (_: Exception) {}
        }
        streams.clear()
        destByStream.clear()
        connected.clear()
        streaming = false
        try { mediaProjection?.stop() } catch (_: Exception) {}
        mediaProjection = null
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        report("Live ရပ်လိုက်ပါပြီ")
        stopSelf()
    }

    override fun onDestroy() {
        if (streaming) stopStreaming()
        super.onDestroy()
    }

    private fun startForegroundWithNotification() {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Live Studio", NotificationManager.IMPORTANCE_LOW)
            nm.createNotificationChannel(channel)
        }
        val stopIntent = Intent(this, StreamService::class.java).setAction(ACTION_STOP)
        val stopPending = android.app.PendingIntent.getService(
            this, 1, stopIntent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Live Studio — Live လွှင့်နေသည်")
            .setContentText("TikTok / Facebook / YouTube")
            .setSmallIcon(android.R.drawable.presence_video_online)
            .setOngoing(true)
            .setSilent(true)
            .addAction(android.R.drawable.ic_media_pause, "ရပ်ရန်", stopPending)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(this, NOTIFY_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        } else {
            startForeground(NOTIFY_ID, notification)
        }
    }

    private fun acquireWakeLock() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "livestudio:stream").apply {
            setReferenceCounted(false)
            acquire(6 * 60 * 60 * 1000L)
        }
    }

    private fun report(msg: String) {
        Log.i(TAG, msg)
        statusListener?.invoke(msg)
    }

    // ConnectChecker — note: with several streams the callbacks do not say which stream fired,
    // so status lines stay generic per event.
    override fun onConnectionStarted(url: String) { report("ချိတ်ဆက်နေသည်…") }
    override fun onConnectionSuccess() { report("✅ Live ချိတ်ဆက်ပြီးပါပြီ") }
    override fun onConnectionFailed(reason: String) { report("❌ ချိတ်မရပါ: $reason") }
    override fun onNewBitrate(bitrate: Long) {}
    override fun onDisconnect() { report("ချိတ်ဆက်မှု ပြတ်သွားသည်") }
    override fun onAuthError() { report("❌ Stream key မှားနေပါသည်") }
    override fun onAuthSuccess() {}
}
