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

data class UniversalTitleResult(
    val id: String,
    val type: String,
    val name: String,
    val slug: String,
    val primaryLanguage: String?,
    val countryCode: String?,
    val followed: Boolean,
    val aliases: List<String>,
)

data class UniversalSearchSource(
    val identityId: String?,
    val sourceId: String?,
    val name: String?,
    val handle: String?,
    val platform: String?,
    val role: String?,
    val authorityTier: Int?,
    val artworkUrl: String?,
)

data class UniversalUpdateResult(
    val id: String,
    val title: String,
    val text: String?,
    val languageCode: String?,
    val itemType: String?,
    val mediaType: String?,
    val thumbnailUrl: String?,
    val canonicalUrl: String?,
    val observedAt: String?,
    val source: UniversalSearchSource,
)

data class UniversalChannelResult(
    val identityId: String,
    val sourceId: String,
    val name: String,
    val handle: String?,
    val platform: String,
    val role: String?,
    val authorityTier: Int?,
    val canonicalUrl: String?,
    val artworkUrl: String?,
)

data class UniversalStreamingResult(
    val id: String,
    val entityId: String,
    val title: String,
    val contentType: String?,
    val primaryLanguage: String?,
    val providerCode: String?,
    val providerName: String?,
    val territory: String,
    val languages: List<String>,
    val releaseType: String?,
    val releaseDate: String?,
    val datePrecision: String?,
    val state: String?,
    val evidenceStatus: String?,
    val lastVerifiedAt: String?,
)

data class UniversalSearchResult(
    val query: String,
    val titles: List<UniversalTitleResult>,
    val updates: List<UniversalUpdateResult>,
    val channels: List<UniversalChannelResult>,
    val streaming: List<UniversalStreamingResult>,
)

class UniversalSearchClient(
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

    fun search(query: String, limit: Int = 12): UniversalSearchResult {
        val body = JSONObject()
            .put("action", "search")
            .put("query", query.trim())
            .put("limit", limit.coerceIn(4, 25))
        val json = invoke(body)
        val sections = json.optJSONObject("sections") ?: JSONObject()
        return UniversalSearchResult(
            query = json.optString("query", query.trim()),
            titles = sections.optJSONArray("titles").toUniversalTitles(),
            updates = sections.optJSONArray("updates").toUniversalUpdates(),
            channels = sections.optJSONArray("channels").toUniversalChannels(),
            streaming = sections.optJSONArray("streaming").toUniversalStreaming(),
        )
    }

    private fun invoke(body: JSONObject): JSONObject {
        var session = sessionStore.read()
        val now = System.currentTimeMillis() / 1000L
        if (session != null && session.expiresAtEpochSeconds <= now + 60L) {
            session = backendClient.refreshSession()
        }

        var response = invokeOnce(body, session?.accessToken)
        if (response.code == 401 && session != null) {
            session = backendClient.refreshSession()
            response = invokeOnce(body, session.accessToken)
        }
        if (!response.ok) throw ApiException(response.errorMessage ?: "Search is unavailable right now", response.code)
        return response.json
    }

    private fun invokeOnce(body: JSONObject, accessToken: String?): JsonResponse {
        val builder = Request.Builder()
            .url("$baseUrl/functions/v1/cinerelay-universal-search-api")
            .header("apikey", publishableKey)
            .header("X-Client-Info", "cinerelay-android/${BuildConfig.VERSION_NAME}")
            .post(body.toString().toRequestBody(jsonType))
        if (!accessToken.isNullOrBlank()) builder.header("Authorization", "Bearer $accessToken")
        return execute(builder.build())
    }

    private fun execute(request: Request): JsonResponse {
        try {
            http.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                val json = if (raw.isBlank()) JSONObject() else runCatching { JSONObject(raw) }
                    .getOrElse { JSONObject().put("raw", raw) }
                val error = json.optionalUniversalString("error") ?: json.optionalUniversalString("message")
                return JsonResponse(response.code, response.isSuccessful, json, error)
            }
        } catch (error: IOException) {
            throw ApiException("Network unavailable: ${error.message ?: "request failed"}", -1)
        }
    }

    private data class JsonResponse(
        val code: Int,
        val ok: Boolean,
        val json: JSONObject,
        val errorMessage: String?,
    )
}

private fun JSONArray?.toUniversalTitles(): List<UniversalTitleResult> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            add(
                UniversalTitleResult(
                    id = row.optString("id"),
                    type = row.optString("type"),
                    name = row.optString("name"),
                    slug = row.optString("slug"),
                    primaryLanguage = row.optionalUniversalString("primaryLanguage"),
                    countryCode = row.optionalUniversalString("countryCode"),
                    followed = row.optBoolean("followed", false),
                    aliases = row.optJSONArray("aliases").toUniversalStrings(),
                ),
            )
        }
    }
}

private fun JSONObject.toUniversalSource(): UniversalSearchSource = UniversalSearchSource(
    identityId = optionalUniversalString("identityId"),
    sourceId = optionalUniversalString("sourceId"),
    name = optionalUniversalString("name"),
    handle = optionalUniversalString("handle"),
    platform = optionalUniversalString("platform"),
    role = optionalUniversalString("role"),
    authorityTier = if (has("authorityTier") && !isNull("authorityTier")) optInt("authorityTier") else null,
    artworkUrl = optionalUniversalString("artworkUrl"),
)

private fun JSONArray?.toUniversalUpdates(): List<UniversalUpdateResult> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            add(
                UniversalUpdateResult(
                    id = row.optString("id"),
                    title = row.optString("title", "CineRelay update"),
                    text = row.optionalUniversalString("text"),
                    languageCode = row.optionalUniversalString("languageCode"),
                    itemType = row.optionalUniversalString("itemType"),
                    mediaType = row.optionalUniversalString("mediaType"),
                    thumbnailUrl = row.optionalUniversalString("thumbnailUrl"),
                    canonicalUrl = row.optionalUniversalString("canonicalUrl"),
                    observedAt = row.optionalUniversalString("observedAt"),
                    source = (row.optJSONObject("source") ?: JSONObject()).toUniversalSource(),
                ),
            )
        }
    }
}

private fun JSONArray?.toUniversalChannels(): List<UniversalChannelResult> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            add(
                UniversalChannelResult(
                    identityId = row.optString("identityId"),
                    sourceId = row.optString("sourceId"),
                    name = row.optString("name", "CineRelay channel"),
                    handle = row.optionalUniversalString("handle"),
                    platform = row.optString("platform", "YOUTUBE"),
                    role = row.optionalUniversalString("role"),
                    authorityTier = if (row.has("authorityTier") && !row.isNull("authorityTier")) row.optInt("authorityTier") else null,
                    canonicalUrl = row.optionalUniversalString("canonicalUrl"),
                    artworkUrl = row.optionalUniversalString("artworkUrl"),
                ),
            )
        }
    }
}

private fun JSONArray?.toUniversalStreaming(): List<UniversalStreamingResult> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            add(
                UniversalStreamingResult(
                    id = row.optString("id"),
                    entityId = row.optString("entityId"),
                    title = row.optString("title", "Streaming title"),
                    contentType = row.optionalUniversalString("contentType"),
                    primaryLanguage = row.optionalUniversalString("primaryLanguage"),
                    providerCode = row.optionalUniversalString("providerCode"),
                    providerName = row.optionalUniversalString("providerName"),
                    territory = row.optString("territory", "IN"),
                    languages = row.optJSONArray("languages").toUniversalStrings(),
                    releaseType = row.optionalUniversalString("releaseType"),
                    releaseDate = row.optionalUniversalString("releaseDate"),
                    datePrecision = row.optionalUniversalString("datePrecision"),
                    state = row.optionalUniversalString("state"),
                    evidenceStatus = row.optionalUniversalString("evidenceStatus"),
                    lastVerifiedAt = row.optionalUniversalString("lastVerifiedAt"),
                ),
            )
        }
    }
}

private fun JSONArray?.toUniversalStrings(): List<String> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) array.optString(index).takeIf { it.isNotBlank() }?.let(::add)
    }
}

private fun JSONObject.optionalUniversalString(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key).takeIf { it.isNotBlank() }
}
