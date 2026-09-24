package com.cinerelay.app.data

import com.cinerelay.app.BuildConfig
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

data class NotificationSourceSubscription(
    val sourceIdentityId: String,
    val enabled: Boolean,
    val includeVideos: Boolean,
    val includeShorts: Boolean,
)

data class NotificationPreferenceState(
    val masterEnabled: Boolean = false,
    val includeVideos: Boolean = true,
    val includeShorts: Boolean = false,
    val setupCompleted: Boolean = false,
    val selectedSourceCount: Int = 0,
    val subscriptions: List<NotificationSourceSubscription> = emptyList(),
) {
    val selectedSourceIds: Set<String>
        get() = subscriptions.filter { it.enabled }.mapTo(linkedSetOf()) { it.sourceIdentityId }
}

class NotificationPreferencesClient(
    private val sessionStore: SessionStore,
    private val backend: BackendClient,
    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build(),
) {
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
    private val publishableKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY

    fun get(): NotificationPreferenceState =
        parseState(invoke(JSONObject().put("action", "get")))

    fun replace(
        sourceIdentityIds: Collection<String>,
        includeVideos: Boolean,
        includeShorts: Boolean,
        masterEnabled: Boolean,
        completeSetup: Boolean = true,
    ): NotificationPreferenceState {
        val ids = JSONArray()
        sourceIdentityIds.distinct().forEach(ids::put)
        val result = invoke(
            JSONObject()
                .put("action", "replace")
                .put("sourceIdentityIds", ids)
                .put("includeVideos", includeVideos)
                .put("includeShorts", includeShorts)
                .put("enabled", masterEnabled)
                .put("completeSetup", completeSetup),
        )
        return parseState(result.optJSONObject("state") ?: result)
    }

    fun setSource(
        sourceIdentityId: String,
        enabled: Boolean,
        includeVideos: Boolean,
        includeShorts: Boolean,
    ): NotificationPreferenceState {
        val result = invoke(
            JSONObject()
                .put("action", "setSource")
                .put("sourceIdentityId", sourceIdentityId)
                .put("enabled", enabled)
                .put("includeVideos", includeVideos)
                .put("includeShorts", includeShorts),
        )
        return parseState(result.optJSONObject("state") ?: result)
    }

    fun setMaster(enabled: Boolean): NotificationPreferenceState {
        val result = invoke(JSONObject().put("action", "setMaster").put("enabled", enabled))
        return parseState(result.optJSONObject("state") ?: result)
    }

    private fun invoke(body: JSONObject): JSONObject {
        var session = validSession()
        var response = invokeOnce(body, session.accessToken)
        if (response.code == 401) {
            session = backend.refreshSession()
            response = invokeOnce(body, session.accessToken)
        }
        if (!response.ok) {
            throw ApiException(response.error ?: "Notification preferences request failed", response.code)
        }
        return response.json
    }

    private fun validSession(): Session {
        val current = sessionStore.read() ?: throw ApiException("Please sign in", 401)
        val now = System.currentTimeMillis() / 1000L
        return if (current.expiresAtEpochSeconds <= now + 60L) backend.refreshSession() else current
    }

    private fun invokeOnce(body: JSONObject, accessToken: String): ResponsePayload {
        val request = Request.Builder()
            .url("$baseUrl/functions/v1/cinerelay-notification-preferences-api")
            .header("apikey", publishableKey)
            .header("Authorization", "Bearer $accessToken")
            .header("X-Client-Info", "cinerelay-android/${BuildConfig.VERSION_NAME}")
            .post(body.toString().toRequestBody(jsonType))
            .build()

        try {
            http.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                val json = if (raw.isBlank()) JSONObject() else runCatching { JSONObject(raw) }
                    .getOrElse { JSONObject().put("raw", raw) }
                val error = json.optString("error").takeIf { it.isNotBlank() }
                    ?: json.optString("message").takeIf { it.isNotBlank() }
                return ResponsePayload(response.code, response.isSuccessful, json, error)
            }
        } catch (error: IOException) {
            throw ApiException("Network unavailable: ${error.message ?: "request failed"}", -1)
        }
    }

    private fun parseState(json: JSONObject): NotificationPreferenceState {
        val subscriptionsJson = json.optJSONArray("subscriptions") ?: JSONArray()
        val subscriptions = buildList {
            for (index in 0 until subscriptionsJson.length()) {
                val row = subscriptionsJson.optJSONObject(index) ?: continue
                val sourceIdentityId = row.optString("sourceIdentityId")
                if (sourceIdentityId.isBlank()) continue
                add(
                    NotificationSourceSubscription(
                        sourceIdentityId = sourceIdentityId,
                        enabled = row.optBoolean("enabled", true),
                        includeVideos = row.optBoolean("includeVideos", true),
                        includeShorts = row.optBoolean("includeShorts", false),
                    ),
                )
            }
        }
        return NotificationPreferenceState(
            masterEnabled = json.optBoolean("masterEnabled", false),
            includeVideos = json.optBoolean("includeVideos", true),
            includeShorts = json.optBoolean("includeShorts", false),
            setupCompleted = json.optBoolean("setupCompleted", false),
            selectedSourceCount = json.optInt("selectedSourceCount", subscriptions.size),
            subscriptions = subscriptions,
        )
    }

    private data class ResponsePayload(
        val code: Int,
        val ok: Boolean,
        val json: JSONObject,
        val error: String?,
    )
}
