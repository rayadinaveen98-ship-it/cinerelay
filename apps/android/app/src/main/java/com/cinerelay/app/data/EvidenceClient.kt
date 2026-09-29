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

class EvidenceClient(
    private val sessionStore: SessionStore,
    private val backendClient: BackendClient,
    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build(),
) {
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
    private val publishableKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY

    fun load(eventId: String): EvidenceBundle {
        var session = sessionStore.read()
        val now = System.currentTimeMillis() / 1000L
        if (session != null && session.expiresAtEpochSeconds <= now + 60L) {
            session = backendClient.refreshSession()
        }

        var response = invoke(eventId, session?.accessToken)
        if (response.code == 401 && session != null) {
            session = backendClient.refreshSession()
            response = invoke(eventId, session.accessToken)
        }
        if (!response.ok) throw ApiException(response.errorMessage ?: "Evidence request failed", response.code)
        return response.json.toEvidenceBundle()
    }

    private fun invoke(eventId: String, accessToken: String?): JsonResponse {
        val builder = Request.Builder()
            .url("$baseUrl/functions/v1/cinerelay-evidence-api")
            .header("apikey", publishableKey)
            .header("X-Client-Info", "cinerelay-android/${BuildConfig.VERSION_NAME}")
            .post(JSONObject().put("eventId", eventId).toString().toRequestBody(jsonType))
        if (!accessToken.isNullOrBlank()) builder.header("Authorization", "Bearer $accessToken")
        return execute(builder.build())
    }

    private fun execute(request: Request): JsonResponse {
        try {
            http.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                val json = if (raw.isBlank()) JSONObject() else runCatching { JSONObject(raw) }
                    .getOrElse { JSONObject().put("raw", raw) }
                val error = json.optString("error").takeIf { it.isNotBlank() }
                    ?: json.optString("message").takeIf { it.isNotBlank() }
                return JsonResponse(response.code, response.isSuccessful, json, error)
            }
        } catch (error: IOException) {
            throw ApiException("Network unavailable: ${error.message ?: "request failed"}", -1)
        }
    }

    private fun JSONObject.toEvidenceBundle(): EvidenceBundle {
        val event = optJSONObject("event") ?: JSONObject()
        val array = optJSONArray("items") ?: JSONArray()
        val items = buildList {
            for (index in 0 until array.length()) {
                val row = array.optJSONObject(index) ?: continue
                add(
                    EvidenceDetail(
                        rawItemId = row.optString("rawItemId"),
                        role = row.optString("role", "SUPPORTING"),
                        weight = row.optInt("weight", 0),
                        sourceName = row.optionalString("sourceName"),
                        authorityTier = if (row.has("authorityTier") && !row.isNull("authorityTier")) row.optInt("authorityTier") else null,
                        sourceRole = row.optionalString("sourceRole"),
                        platform = row.optionalString("platform"),
                        handle = row.optionalString("handle"),
                        title = row.optionalString("title"),
                        canonicalUrl = row.optionalString("canonicalUrl"),
                        publishedAt = row.optionalString("publishedAt"),
                        receivedAt = row.optionalString("receivedAt"),
                    ),
                )
            }
        }
        return EvidenceBundle(
            eventId = event.optString("id"),
            headline = event.optString("headline"),
            verificationState = event.optString("verificationState"),
            detectedAt = event.optionalString("detectedAt"),
            evidenceCount = optInt("evidenceCount", items.size),
            conflictingEvidenceCount = optInt("conflictingEvidenceCount", items.count { it.role == "CONFLICTING" }),
            items = items,
        )
    }

    private fun JSONObject.optionalString(key: String): String? {
        if (!has(key) || isNull(key)) return null
        return optString(key).takeIf { it.isNotBlank() }
    }

    private data class JsonResponse(
        val code: Int,
        val ok: Boolean,
        val json: JSONObject,
        val errorMessage: String?,
    )
}
