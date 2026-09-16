package com.cinerelay.app.data

import android.content.Context
import java.util.UUID

class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("cinerelay_session", Context.MODE_PRIVATE)

    fun read(): Session? {
        val accessToken = prefs.getString("access_token", null) ?: return null
        val refreshToken = prefs.getString("refresh_token", null) ?: return null
        val userId = prefs.getString("user_id", null) ?: return null
        return Session(
            accessToken = accessToken,
            refreshToken = refreshToken,
            userId = userId,
            email = prefs.getString("email", null),
            expiresAtEpochSeconds = prefs.getLong("expires_at", 0L),
        )
    }

    fun write(session: Session) {
        prefs.edit()
            .putString("access_token", session.accessToken)
            .putString("refresh_token", session.refreshToken)
            .putString("user_id", session.userId)
            .putString("email", session.email)
            .putLong("expires_at", session.expiresAtEpochSeconds)
            .apply()
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    fun installationId(): String {
        val existing = prefs.getString("installation_id", null)
        if (!existing.isNullOrBlank()) return existing
        val created = UUID.randomUUID().toString()
        prefs.edit().putString("installation_id", created).apply()
        return created
    }
}
