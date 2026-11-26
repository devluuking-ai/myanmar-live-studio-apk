package com.devluuking.livestudio

import android.content.Context
import android.content.SharedPreferences

data class Destination(
    val id: String,
    val label: String,
    val enabled: Boolean,
    val server: String,
    val key: String
) {
    fun endpoint(): String {
        val s = server.trim().trimEnd('/')
        val k = key.trim()
        return if (k.isEmpty() || s.endsWith(k)) s else "$s/$k"
    }
}

object Prefs {
    private const val NAME = "destinations"

    fun prefs(ctx: Context): SharedPreferences = ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    fun destinations(ctx: Context): List<Destination> {
        val p = prefs(ctx)
        return listOf(
            Destination(
                "youtube", "YouTube",
                p.getBoolean("youtube_on", false),
                p.getString("youtube_server", "rtmp://a.rtmp.youtube.com/live2") ?: "",
                p.getString("youtube_key", "") ?: ""
            ),
            Destination(
                "facebook", "Facebook",
                p.getBoolean("facebook_on", false),
                p.getString("facebook_server", "rtmps://live-api-s.facebook.com:443/rtmp") ?: "",
                p.getString("facebook_key", "") ?: ""
            ),
            Destination(
                "tiktok", "TikTok",
                p.getBoolean("tiktok_on", false),
                p.getString("tiktok_server", "") ?: "",
                p.getString("tiktok_key", "") ?: ""
            )
        )
    }

    fun bitrateKbps(ctx: Context): Int =
        prefs(ctx).getInt("bitrate_kbps", 1800).coerceIn(600, 6000)

    fun tiktokUsername(ctx: Context): String =
        prefs(ctx).getString("tiktok_username", "aicreater999") ?: "aicreater999"
}
