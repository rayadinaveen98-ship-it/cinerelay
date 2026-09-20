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
        val json = post(
            function = "cinerelay-sources-api",
            body = JSONObject()
                .put("action", "sources")
                .put("platform", platform.uppercase()),
            fallbackError = "Source directory request failed",
        )
        return SourceDirectory(
            sourceCount = json.optInt("sourceCount", 0),
            activeInLast24h = json.optInt("activeInLast24h", 0),
            newItems24h = json.optInt("newItems24h", 0),
            items = json.optJSONArray("items").toSourceDirectoryItems(),
        )
    }

    fun sourceFeed(platform: String, identityId: String, limit: Int = 100): List<NewsroomSignal> {
        val json = post(
            function = "cinerelay-newsroom-api",
            body = JSONObject()
                .put("action", "newsroom")
                .put("platform", platform.uppercase())
                .put("sourceIdentityId", identityId)
                .put("limit", limit.coerceIn(1, 100)),
            fallbackError = "Source feed request failed",
        )
        return json.optJSONArray("items").toSourceNewsroomSignals()
    }

    private fun post(function: String, body: JSONObject, fallbackError: String): JSONObject {
        val request = Request.Builder()
            .url("$baseUrl/functions/v1/$function")
            .header("apikey", publishableKey)
            .header("X-Client-Info", "cinerelay-android/${BuildConfig.VERSION_NAME}")
            .post(body.toString().toRequestBody(jsonType))
            .build()

        try {
            http.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                val json = if (raw.isBlank()) JSONObject() else runCatching { JSONObject(raw) }
                    .getOrElse { JSONObject().put("raw", raw) }
                if (!response.isSuccessful) {
                    throw ApiException(json.optString("error").ifBlank { fallbackError }, response.code)
                }
                return json
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
                    handle = row.optNullableStringForSources("handle"),
                    platform = row.optString("platform"),
                    role = row.optNullableStringForSources("role"),
                    authorityTier = if (row.has("authorityTier") && !row.isNull("authorityTier")) row.optInt("authorityTier") else null,
                    canonicalUrl = row.optNullableStringForSources("canonicalUrl"),
                    newCount24h = row.optInt("newCount24h", 0),
                    latestObservedAt = row.optNullableStringForSources("latestObservedAt"),
                ),
            )
        }
    }
}

private fun JSONArray?.toSourceNewsroomSignals(): List<NewsroomSignal> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            val source = row.optJSONObject("source") ?: JSONObject()
            add(
                NewsroomSignal(
                    id = row.optString("id"),
                    state = row.optString("state", "UNCONFIRMED"),
                    source = NewsroomSource(
                        name = source.optNullableStringForSources("name"),
                        authorityTier = if (source.has("authorityTier") && !source.isNull("authorityTier")) source.optInt("authorityTier") else null,
                        role = source.optNullableStringForSources("role"),
                        platform = source.optNullableStringForSources("platform"),
                        handle = source.optNullableStringForSources("handle"),
                    ),
                    itemType = row.optNullableStringForSources("itemType"),
                    mediaType = row.optNullableStringForSources("mediaType"),
                    languageCode = row.optNullableStringForSources("languageCode"),
                    title = row.optString("title", "Untitled source update"),
                    text = row.optNullableStringForSources("text"),
                    canonicalUrl = row.optNullableStringForSources("canonicalUrl"),
                    sourceObservedAt = row.optNullableStringForSources("sourceObservedAt"),
                    observedAt = row.optNullableStringForSources("observedAt"),
                    ingestedAt = row.optNullableStringForSources("ingestedAt"),
                    enrichmentState = row.optString("enrichmentState", "RAW"),
                    canonicalEvent = row.optJSONObject("canonicalEvent").toSourceEventCard(),
                ),
            )
        }
    }
}

private fun JSONObject?.toSourceEventCard(): EventCard? {
    val row = this ?: return null
    val id = row.optString("id")
    if (id.isBlank()) return null
    return EventCard(
        id = id,
        entityId = row.optString("entityId"),
        entityName = row.optNullableStringForSources("entityName"),
        entityType = row.optNullableStringForSources("entityType"),
        primaryLanguage = row.optNullableStringForSources("primaryLanguage"),
        followed = row.optBoolean("followed", false),
        eventType = row.optString("eventType"),
        verificationState = row.optString("verificationState"),
        priorityBand = row.optString("priorityBand"),
        headline = row.optString("headline", "CineRelay event"),
        summary = row.optNullableStringForSources("summary"),
        summaryStatus = row.optNullableStringForSources("summaryStatus"),
        evidenceCount = row.optInt("evidenceCount", 0),
        conflictingEvidenceCount = row.optInt("conflictingEvidenceCount", 0),
        status = row.optString("status"),
        detectedAt = row.optNullableStringForSources("detectedAt"),
        evidence = null,
        radar = null,
    )
}

private fun JSONObject.optNullableStringForSources(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key).takeIf { it.isNotBlank() }
}
