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

class OttCalendarClient(
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

    fun ott(
        window: String = "next_30_days",
        providerCode: String? = null,
        language: String? = null,
        contentType: String? = null,
        evidenceStatus: String? = null,
        limit: Int = 75,
    ): OttReleaseFeed {
        val body = JSONObject()
            .put("window", window)
            .put("territory", "IN")
            .put("limit", limit.coerceIn(1, 100))
        providerCode?.takeIf { it.isNotBlank() }?.let { body.put("providerCode", it) }
        language?.takeIf { it.isNotBlank() }?.let { body.put("language", it) }
        contentType?.takeIf { it.isNotBlank() }?.let { body.put("contentType", it) }
        evidenceStatus?.takeIf { it.isNotBlank() }?.let { body.put("evidenceStatus", it) }

        val json = invoke(body)
        return OttReleaseFeed(
            window = json.optString("window", window),
            territory = json.optString("territory", "IN"),
            today = json.optionalStringV054("today"),
            windowEnd = json.optionalStringV054("windowEnd"),
            providers = json.optJSONArray("providers").toOttProvidersV054(),
            items = json.optJSONArray("items").toOttReleasesV054(),
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
        if (!response.ok) throw ApiException(response.errorMessage ?: "CineRelay OTT calendar request failed", response.code)
        return response.json
    }

    private fun invokeOnce(body: JSONObject, accessToken: String?): JsonResponse {
        val builder = Request.Builder()
            .url("$baseUrl/functions/v1/cinerelay-ott-calendar-api")
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
                val error = json.optionalStringV054("error") ?: json.optionalStringV054("message")
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

private fun JSONArray?.toOttProvidersV054(): List<OttProvider> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            add(
                OttProvider(
                    code = row.optString("code"),
                    name = row.optString("name"),
                    homepageUrl = row.optionalStringV054("homepageUrl"),
                ),
            )
        }
    }
}

private fun JSONArray?.toOttReleasesV054(): List<OttRelease> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            add(row.toOttReleaseV054())
        }
    }
}

private fun JSONObject.toOttReleaseV054(): OttRelease {
    val entityJson = optJSONObject("entity") ?: JSONObject()
    val providerJson = optJSONObject("provider") ?: JSONObject()
    val evidenceJson = optJSONObject("evidence") ?: JSONObject()
    val refsJson = evidenceJson.optJSONArray("refs") ?: JSONArray()
    val refs = buildList {
        for (index in 0 until refsJson.length()) {
            val row = refsJson.optJSONObject(index) ?: continue
            add(
                OttEvidenceRef(
                    rawItemId = row.optString("rawItemId"),
                    eventId = row.optionalStringV054("eventId"),
                    role = row.optString("role"),
                    firstParty = row.optBoolean("firstParty", false),
                    observedAt = row.optionalStringV054("observedAt"),
                    title = row.optionalStringV054("title"),
                    canonicalUrl = row.optionalStringV054("canonicalUrl"),
                    publishedAt = row.optionalStringV054("publishedAt"),
                    source = (row.optJSONObject("source") ?: JSONObject()).toActivitySourceV054(),
                ),
            )
        }
    }
    return OttRelease(
        id = optString("id"),
        entity = IntelligenceEntity(
            id = entityJson.optString("id"),
            type = entityJson.optString("type"),
            name = entityJson.optString("name"),
            slug = entityJson.optString("slug"),
            primaryLanguage = entityJson.optionalStringV054("primaryLanguage"),
            countryCode = entityJson.optionalStringV054("countryCode"),
            followed = entityJson.optBoolean("followed", false),
            aliases = emptyList(),
        ),
        provider = OttProvider(
            code = providerJson.optString("code"),
            name = providerJson.optString("name"),
            homepageUrl = providerJson.optionalStringV054("homepageUrl"),
        ),
        territory = optString("territory", "IN"),
        languages = optJSONArray("languages").toStringListV054(),
        releaseType = optString("releaseType"),
        releaseDate = optionalStringV054("releaseDate"),
        datePrecision = optString("datePrecision", "TBA"),
        state = optString("state", "TBA"),
        evidenceStatus = optString("evidenceStatus", "TBA"),
        previousReleaseDate = optionalStringV054("previousReleaseDate"),
        firstObservedAt = optionalStringV054("firstObservedAt"),
        lastVerifiedAt = optionalStringV054("lastVerifiedAt"),
        evidence = OttEvidenceSummary(
            total = evidenceJson.optInt("total", 0),
            firstParty = evidenceJson.optInt("firstParty", 0),
            conflicting = evidenceJson.optInt("conflicting", 0),
            refs = refs,
        ),
    )
}

private fun JSONObject.toActivitySourceV054(): IntelligenceActivitySource = IntelligenceActivitySource(
    name = optionalStringV054("name"),
    authorityTier = if (has("authorityTier") && !isNull("authorityTier")) optInt("authorityTier") else null,
    role = optionalStringV054("role"),
    platform = optionalStringV054("platform"),
    handle = optionalStringV054("handle"),
)

private fun JSONArray?.toStringListV054(): List<String> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) {
            array.optString(index).takeIf { it.isNotBlank() }?.let(::add)
        }
    }
}

private fun JSONObject.optionalStringV054(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key).takeIf { it.isNotBlank() }
}
