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

data class ArchivePage(
    val items: List<ConsumerUpdate>,
    val page: Int,
    val pageSize: Int,
    val total: Int,
    val hasMore: Boolean,
    val retentionDays: Int,
)

class ArchiveClient(
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

    fun page(page: Int = 0, pageSize: Int = 60): ArchivePage {
        val body = JSONObject()
            .put("action", "archive")
            .put("page", page.coerceAtLeast(0))
            .put("pageSize", pageSize.coerceIn(10, 100))
        val json = invoke(body)
        val array = json.optJSONArray("items") ?: JSONArray()
        val items = buildList {
            for (index in 0 until array.length()) {
                val row = array.optJSONObject(index) ?: continue
                add(row.toArchiveUpdate())
            }
        }
        return ArchivePage(
            items = items,
            page = json.optInt("page", page),
            pageSize = json.optInt("pageSize", pageSize),
            total = json.optInt("total", items.size),
            hasMore = json.optBoolean("hasMore", false),
            retentionDays = json.optInt("retentionDays", 90),
        )
    }

    private fun invoke(body: JSONObject): JSONObject {
        var session = sessionStore.read()
        val now = System.currentTimeMillis() / 1000L
        if (session != null && session.expiresAtEpochSeconds <= now + 60L) {
            session = backendClient.refreshSession()
        }
        val builder = Request.Builder()
            .url("$baseUrl/functions/v1/cinerelay-archive-api")
            .header("apikey", publishableKey)
            .header("X-Client-Info", "cinerelay-android/${BuildConfig.VERSION_NAME}")
            .post(body.toString().toRequestBody(jsonType))
        if (session != null) builder.header("Authorization", "Bearer ${session.accessToken}")
        try {
            http.newCall(builder.build()).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                val json = if (raw.isBlank()) JSONObject() else runCatching { JSONObject(raw) }.getOrElse { JSONObject().put("raw", raw) }
                if (!response.isSuccessful) {
                    throw ApiException(json.optString("error", "Archive unavailable"), response.code)
                }
                return json
            }
        } catch (error: IOException) {
            throw ApiException("Network unavailable: ${error.message ?: "request failed"}", -1)
        }
    }
}

private fun JSONObject.toArchiveUpdate(): ConsumerUpdate {
    val sourceObject = optJSONObject("source") ?: JSONObject()
    return ConsumerUpdate(
        id = optString("id"),
        title = optString("title", "CineRelay update"),
        text = optNullableArchiveString("text"),
        languageCode = optNullableArchiveString("languageCode"),
        itemType = optNullableArchiveString("itemType"),
        mediaType = optNullableArchiveString("mediaType"),
        thumbnailUrl = optNullableArchiveString("thumbnailUrl"),
        canonicalUrl = optNullableArchiveString("canonicalUrl"),
        observedAt = optNullableArchiveString("observedAt"),
        eventId = null,
        source = ConsumerSource(
            identityId = sourceObject.optNullableArchiveString("identityId"),
            name = sourceObject.optNullableArchiveString("name"),
            handle = sourceObject.optNullableArchiveString("handle"),
            platform = sourceObject.optNullableArchiveString("platform"),
            role = sourceObject.optNullableArchiveString("role"),
            artworkUrl = sourceObject.optNullableArchiveString("artworkUrl"),
        ),
    )
}

private fun JSONObject.optNullableArchiveString(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key).takeIf { it.isNotBlank() }
}
