package com.asistenciaqr.app.config

import android.content.Context
import android.content.SharedPreferences

object Config {
    const val DEFAULT_BASE_URL = "https://qrasistencia.iaparamaestros.org/api"
    private const val PREFS_NAME = "asistencia_qr_config"
    private const val KEY_SERVER_URL = "custom_server_base_url"

    fun getApiBaseUrl(context: Context): String {
        val prefs = getPrefs(context)
        return prefs.getString(KEY_SERVER_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
    }

    fun setApiBaseUrl(context: Context, url: String) {
        val cleanUrl = if (url.endsWith("/")) url.dropLast(1) else url
        val finalUrl = if (!cleanUrl.endsWith("/api")) "$cleanUrl/api" else cleanUrl
        getPrefs(context).edit().putString(KEY_SERVER_URL, finalUrl).apply()
    }

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
}
