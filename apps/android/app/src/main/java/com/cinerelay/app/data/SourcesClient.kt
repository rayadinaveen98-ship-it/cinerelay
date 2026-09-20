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

data class SourceDirectoryItem(
    val identityId: String,
    val sourceId: String,
    val name: String,
    val handle: String?,
    val platform: String,
    val role: String?,
    val authorityTier: Int?,
    val canonicalUrl: String?,
    val newCount24h: Int,
    val latestObservedAt: String?,
)

data class SourceDirectory(
    val sourceCount: Int,
    val activeInLast24h: Int,
    val newItems24h: Int,
    val items: List<SourceDirectoryItem>,
)

class SourcesClient(
    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build(),
) {
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
    private val publishableKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY

    fun sources(platform: String): SourceDirectory {
        val request = Request.Builder()
            .url("$baseUrl/functions/v1/cinerelay-sources-api")
            .header("apikey", publishableKey)
            .header("X-Client-Info", "cinerelay-android/${BuildConfig.VERSION_NAME}")
            .post(
                JSONObject()
                    .put("action", "sources")
                    .put("platform", platform.uppercase())
                    .toString()
                    .toRequestBody(jsonType),
            )
            .build()

        try {
            http.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                val json = if (raw.isBlank()) JSONObject() else runCatching { JSONObject(raw) }
                    .getOrElse { JSONObject().put("raw", raw) }
                if (!response.isSuccessful) {
                    throw ApiException(
                        json.optString("error").ifBlank { "Source directory request failed" },
                        response.code,
                    )
                }
                return SourceDirectory(
                    sourceCount = json.optInt("sourceCount", 0),
                    activeInLast24h = json.optInt("activeInLast24h", 0),
                    newItems24h = json.optInt("newItems24h", 0),
                    items = json.optJSONArray("items").toSourceDirectoryItems(),
                )
            }
        } catch (error: IOException) {
            throw ApiException("Network unavailable: ${error.message ?: "request failed"}", -1)
        }
    }
}

private fun JSONArray?.toSourceDirectoryItems(): List<SourceDirectoryItem> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            add(
                SourceDirectoryItem(
                    identityId = row.optString("identityId"),
                    sourceId = row.optString("sourceId"),
                    name = row.optString("name", "CineRelay source"),
                    handle = row.optString("handle").takeIf { it.isNotBlank() },
                    platform = row.optString("platform"),
                    role = row.optString("role").takeIf { it.isNotBlank() },
                    authorityTier = if (row.has("authorityTier") && !row.isNull("authorityTier")) row.optInt("authorityTier") else null,
                    canonicalUrl = row.optString("canonicalUrl").takeIf { it.isNotBlank() },
                    newCount24h = row.optInt("newCount24h", 0),
                    latestObservedAt = row.optString("latestObservedAt").takeIf { it.isNotBlank() },
                ),
            )
        }
    }
}
