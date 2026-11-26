package com.devluuking.livestudio

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var showView: WebView
    private lateinit var dashView: WebView
    private lateinit var statusText: TextView
    private lateinit var controlBar: View
    private lateinit var stopChip: Button
    private lateinit var liveButton: Button
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var showMode = false
    private var serverReady = false

    private val projectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK && result.data != null) {
            val svc = Intent(this, StreamService::class.java).apply {
                action = StreamService.ACTION_START
                putExtra(StreamService.EXTRA_RESULT_CODE, result.resultCode)
                putExtra(StreamService.EXTRA_DATA, result.data)
            }
            ContextCompat.startForegroundService(this, svc)
            setLiveUi(true)
        } else {
            toast("Screen capture ခွင့်ပြုချက် မရပါ")
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            launchProjection()
        } else {
            toast("Microphone ခွင့်ပြုချက် လိုအပ်ပါသည်")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_main)

        showView = findViewById(R.id.showView)
        dashView = findViewById(R.id.dashView)
        statusText = findViewById(R.id.statusText)
        controlBar = findViewById(R.id.controlBar)
        stopChip = findViewById(R.id.stopChip)
        liveButton = findViewById(R.id.liveButton)

        setupWebView(showView)
        setupWebView(dashView)
        setupTts()

        findViewById<Button>(R.id.dashButton).setOnClickListener { showDashboard(true) }
        findViewById<Button>(R.id.showButton).setOnClickListener { showDashboard(false) }
        findViewById<Button>(R.id.settingsButton).setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
        liveButton.setOnClickListener { onGoLive() }
        stopChip.setOnClickListener { stopLive() }
        findViewById<Button>(R.id.fullscreenButton).setOnClickListener { enterShowMode() }
        showView.setOnTouchListener { _, event ->
            if (event.action == android.view.MotionEvent.ACTION_DOWN) {
                when {
                    showMode -> { exitShowMode(); true }
                    StreamService.streaming -> {
                        stopChip.visibility =
                            if (stopChip.visibility == View.VISIBLE) View.GONE else View.VISIBLE
                        true
                    }
                    else -> false
                }
            } else false
        }

        StreamService.statusListener = { msg ->
            runOnUiThread {
                statusText.text = msg
                if (msg.startsWith("Live ရပ်")) {
                    setLiveUi(false)
                } else if (msg.startsWith("❌") || msg.contains("ပြတ်သွားသည်")) {
                    statusText.visibility = View.VISIBLE
                }
            }
        }
        setLiveUi(StreamService.streaming)

        statusText.text = "Server စတင်နေသည်…"
        NodeRuntime.start(this,
            onReady = {
                runOnUiThread {
                    serverReady = true
                    statusText.text = "အဆင်သင့် — Dashboard မှာ ဂိမ်းရွေး၊ TikTok LIVE စပြီး ချိတ်ပါ"
                    showView.loadUrl("http://127.0.0.1:3000/overlay")
                    dashView.loadUrl("http://127.0.0.1:3000/control")
                }
            },
            onError = { msg -> runOnUiThread { statusText.text = msg } }
        )
    }

    private fun showDashboard(dashboard: Boolean) {
        dashView.visibility = if (dashboard) View.VISIBLE else View.GONE
        showView.visibility = if (dashboard) View.GONE else View.VISIBLE
    }

    private fun setupWebView(webView: WebView) {
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        webView.webViewClient = WebViewClient()
        webView.addJavascriptInterface(Bridge(), "AndroidBridge")
    }

    private fun setupTts() {
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val result = tts?.setLanguage(Locale("my", "MM"))
                ttsReady = result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED
            }
        }
    }

    inner class Bridge {
        @JavascriptInterface
        fun speak(text: String) {
            if (!ttsReady) return
            tts?.speak(text, TextToSpeech.QUEUE_ADD, null, "livestudio")
        }
    }

    private fun onGoLive() {
        val dests = Prefs.destinations(this).filter { it.enabled && it.server.isNotBlank() && it.key.isNotBlank() }
        if (dests.isEmpty()) {
            toast("TikTok အတွက် Mobile gaming သုံးပါ။ YouTube/Facebook ဆိုရင် ⚙ Keys မှာ key ထည့်ပါ")
            startActivity(Intent(this, SettingsActivity::class.java))
            return
        }
        showDashboard(false)
        val perms = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= 33) perms.add(Manifest.permission.POST_NOTIFICATIONS)
        val missing = perms.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        } else {
            launchProjection()
        }
    }

    private fun launchProjection() {
        val mpm = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        projectionLauncher.launch(mpm.createScreenCaptureIntent())
    }

    private fun stopLive() {
        val svc = Intent(this, StreamService::class.java).apply { action = StreamService.ACTION_STOP }
        startService(svc)
        setLiveUi(false)
    }

    private fun setLiveUi(live: Boolean) {
        controlBar.visibility = if (live) View.GONE else View.VISIBLE
        stopChip.visibility = if (live) View.VISIBLE else View.GONE
        statusText.visibility = if (live) View.GONE else View.VISIBLE
        if (live) {
            showDashboard(false)
            applyImmersive(true)
        } else {
            showMode = false
            applyImmersive(false)
        }
    }

    // Fullscreen show mode for TikTok Mobile gaming screen-share.
    private fun enterShowMode() {
        showDashboard(false)
        showMode = true
        controlBar.visibility = View.GONE
        statusText.visibility = View.GONE
        stopChip.visibility = View.GONE
        applyImmersive(true)
    }

    private fun exitShowMode() {
        showMode = false
        controlBar.visibility = View.VISIBLE
        statusText.visibility = View.VISIBLE
        applyImmersive(false)
    }

    private fun applyImmersive(on: Boolean) {
        WindowCompat.setDecorFitsSystemWindows(window, !on)
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        if (on) {
            controller.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            controller.hide(WindowInsetsCompat.Type.systemBars())
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars())
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && (showMode || StreamService.streaming)) applyImmersive(true)
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    override fun onDestroy() {
        StreamService.statusListener = null
        tts?.shutdown()
        super.onDestroy()
    }
}
