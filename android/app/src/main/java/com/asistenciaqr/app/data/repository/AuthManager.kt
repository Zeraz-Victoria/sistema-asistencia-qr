package com.asistenciaqr.app.data.repository

import android.content.Context
import android.content.SharedPreferences
import com.asistenciaqr.app.data.models.Usuario
import com.google.gson.Gson

class AuthManager private constructor(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val gson = Gson()

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    var usuario: Usuario?
        get() {
            val json = prefs.getString(KEY_USUARIO, null) ?: return null
            return try { gson.fromJson(json, Usuario::class.java) } catch (e: Exception) { null }
        }
        set(value) {
            val json = if (value != null) gson.toJson(value) else null
            prefs.edit().putString(KEY_USUARIO, json).apply()
        }

    val estaAutenticado: Boolean
        get() {
            val u = usuario
            val t = token
            val valid = !t.isNullOrBlank() && u != null && !u.email.isNullOrBlank() && u.email != "notiene@notiene.com"
            if (!valid && (!t.isNullOrBlank() || u != null)) {
                cerrarSesion()
            }
            return valid
        }

    fun guardarSesion(token: String, usuario: Usuario) {
        this.token = token
        this.usuario = usuario
    }

    fun cerrarSesion() {
        prefs.edit().remove(KEY_TOKEN).remove(KEY_USUARIO).apply()
    }

    companion object {
        private const val PREFS_NAME = "asistencia_qr_auth"
        private const val KEY_TOKEN = "jwt_token"
        private const val KEY_USUARIO = "usuario_json"

        @Volatile
        private var instance: AuthManager? = null

        fun getInstance(context: Context): AuthManager {
            return instance ?: synchronized(this) {
                instance ?: AuthManager(context.applicationContext).also { instance = it }
            }
        }
    }
}
