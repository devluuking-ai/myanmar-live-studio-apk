package com.devluuking.livestudio

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Switch
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class SettingsActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val p = Prefs.prefs(this)
        val dests = Prefs.destinations(this)

        bindDest(dests[0], R.id.ytSwitch, R.id.ytServer, R.id.ytKey)
        bindDest(dests[1], R.id.fbSwitch, R.id.fbServer, R.id.fbKey)
        bindDest(dests[2], R.id.ttSwitch, R.id.ttServer, R.id.ttKey)

        val username = findViewById<EditText>(R.id.ttUsername)
        username.setText(Prefs.tiktokUsername(this))
        val bitrate = findViewById<EditText>(R.id.bitrate)
        bitrate.setText(Prefs.bitrateKbps(this).toString())

        findViewById<Button>(R.id.saveButton).setOnClickListener {
            val e = p.edit()
            saveDest(e, "youtube", R.id.ytSwitch, R.id.ytServer, R.id.ytKey)
            saveDest(e, "facebook", R.id.fbSwitch, R.id.fbServer, R.id.fbKey)
            saveDest(e, "tiktok", R.id.ttSwitch, R.id.ttServer, R.id.ttKey)
            e.putString("tiktok_username", username.text.toString().trim().removePrefix("@"))
            e.putInt("bitrate_kbps", bitrate.text.toString().toIntOrNull()?.coerceIn(600, 6000) ?: 1800)
            e.apply()
            Toast.makeText(this, "သိမ်းပြီးပါပြီ", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    private fun bindDest(d: Destination, switchId: Int, serverId: Int, keyId: Int) {
        findViewById<Switch>(switchId).isChecked = d.enabled
        findViewById<EditText>(serverId).setText(d.server)
        findViewById<EditText>(keyId).setText(d.key)
    }

    private fun saveDest(e: android.content.SharedPreferences.Editor, prefix: String, switchId: Int, serverId: Int, keyId: Int) {
        e.putBoolean("${prefix}_on", findViewById<Switch>(switchId).isChecked)
        e.putString("${prefix}_server", findViewById<EditText>(serverId).text.toString().trim())
        e.putString("${prefix}_key", findViewById<EditText>(keyId).text.toString().trim())
    }
}
