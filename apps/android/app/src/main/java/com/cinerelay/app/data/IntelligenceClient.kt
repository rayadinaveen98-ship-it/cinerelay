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

data class IntelligenceAlias(
    val value: String,
    val type: String,
    val languageCode: String?,
)

data class IntelligenceEntity(
    val id: String,
    val type: String,
    val name: String,
    val slug: String,
    val primaryLanguage: String?,
    val countryCode: String?,
    val followed: Boolean,
    val aliases: List<IntelligenceAlias>,
)

data class IntelligenceEvidenceCounts(
    val total: Int,
    val primary: Int,
    val corroborating: Int,
    val conflicting: Int,
)

data class IntelligenceEvent(
    val id: String,
    val eventType: String,
    val verificationState: String,
    val verificationConfidence: Double?,
    val priorityBand: String?,
    val headline: String,
    val summary: String?,
    val detectedAt: String?,
    val occurredAt: String?,
    val announcedAt: String?,
    val evidence: IntelligenceEvidenceCounts,
)

data class IntelligenceActivitySource(
    val name: String?,
    val authorityTier: Int?,
    val role: String?,
    val platform: String?,
    val handle: String?,
)

data class IntelligenceActivity(
    val rawItemId: String,
    val title: String?,
    val text: String?,
    val itemType: String?,
    val mediaType: String?,
    val canonicalUrl: String?,
    val publishedAt: String?,
    val observedAt: String?,
    val resolutionScore: Double?,
    val source: IntelligenceActivitySource,
)

data class IntelligenceHub(
    val entity: IntelligenceEntity,
    val events: List<IntelligenceEvent>,
    val activity: List<IntelligenceActivity>,
)

data class StoryCluster(
    val event: IntelligenceEvent,
    val entity: IntelligenceEntity?,
)

class IntelligenceClient(
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

    fun search(query: String, limit: Int = 25): List<IntelligenceEntity> {
        val json = invoke(
            JSONObject()
                .put("action", "search")
                .put("query", query.trim())
                .put("limit", limit.coerceIn(1, 40)),
        )
        return json.optJSONArray("items").toEntities()
    }

    fun hub(entityId: String, eventLimit: Int = 30, activityLimit: Int = 30): IntelligenceHub {
        val json = invoke(
            JSONObject()
                .put("action", "hub")
                .put("entityId", entityId)
                .put("eventLimit", eventLimit.coerceIn(1, 75))
                .put("activityLimit", activityLimit.coerceIn(1, 50)),
        )
        val entity = json.optJSONObject("entity")?.toEntity()
            ?: throw ApiException("CineRelay hub is unavailable", 404)
        return IntelligenceHub(
            entity = entity,
            events = json.optJSONArray("events").toIntelligenceEvents(),
            activity = json.optJSONArray("activity").toIntelligenceActivity(),
        )
    }

    fun clusters(limit: Int = 30): List<StoryCluster> {
        val json = invoke(
            JSONObject()
                .put("action", "clusters")
                .put("limit", limit.coerceIn(1, 50)),
        )
        val array = json.optJSONArray("items") ?: JSONArray()
        return buildList {
            for (index in 0 until array.length()) {
                val row = array.optJSONObject(index) ?: continue
                val event = row.toIntelligenceEvent()
                add(StoryCluster(event = event, entity = row.optJSONObject("entity")?.toEntity()))
            }
        }
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
        if (!response.ok) throw ApiException(response.errorMessage ?: "CineRelay intelligence request failed", response.code)
        return response.json
    }

    private fun invokeOnce(body: JSONObject, accessToken: String?): JsonResponse {
        val builder = Request.Builder()
            .url("$baseUrl/functions/v1/cinerelay-intelligence-api")
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
                val error = json.optionalString("error") ?: json.optionalString("message")
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

private fun JSONArray?.toEntities(): List<IntelligenceEntity> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) array.optJSONObject(index)?.let { add(it.toEntity()) }
    }
}

private fun JSONObject.toEntity(): IntelligenceEntity {
    val aliasesJson = optJSONArray("aliases") ?: JSONArray()
    val aliases = buildList {
        for (index in 0 until aliasesJson.length()) {
            val row = aliasesJson.optJSONObject(index) ?: continue
            add(
                IntelligenceAlias(
                    value = row.optString("value"),
                    type = row.optString("type", "OTHER"),
                    languageCode = row.optionalString("languageCode"),
                ),
            )
        }
    }
    return IntelligenceEntity(
        id = optString("id"),
        type = optString("type"),
        name = optString("name"),
        slug = optString("slug"),
        primaryLanguage = optionalString("primaryLanguage"),
        countryCode = optionalString("countryCode"),
        followed = optBoolean("followed", false),
        aliases = aliases,
    )
}

private fun JSONArray?.toIntelligenceEvents(): List<IntelligenceEvent> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) array.optJSONObject(index)?.let { add(it.toIntelligenceEvent()) }
    }
}

private fun JSONObject.toIntelligenceEvent(): IntelligenceEvent {
    val evidenceJson = optJSONObject("evidence") ?: JSONObject()
    return IntelligenceEvent(
        id = optString("id"),
        eventType = optString("eventType"),
        verificationState = optString("verificationState"),
        verificationConfidence = optionalDouble("verificationConfidence"),
        priorityBand = optionalString("priorityBand"),
        headline = optString("headline"),
        summary = optionalString("summary"),
        detectedAt = optionalString("detectedAt"),
        occurredAt = optionalString("occurredAt"),
        announcedAt = optionalString("announcedAt"),
        evidence = IntelligenceEvidenceCounts(
            total = evidenceJson.optInt("total", 0),
            primary = evidenceJson.optInt("primary", 0),
            corroborating = evidenceJson.optInt("corroborating", 0),
            conflicting = evidenceJson.optInt("conflicting", 0),
        ),
    )
}

private fun JSONArray?.toIntelligenceActivity(): List<IntelligenceActivity> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            val source = row.optJSONObject("source") ?: JSONObject()
            add(
                IntelligenceActivity(
                    rawItemId = row.optString("rawItemId"),
                    title = row.optionalString("title"),
                    text = row.optionalString("text"),
                    itemType = row.optionalString("itemType"),
                    mediaType = row.optionalString("mediaType"),
                    canonicalUrl = row.optionalString("canonicalUrl"),
                    publishedAt = row.optionalString("publishedAt"),
                    observedAt = row.optionalString("observedAt"),
                    resolutionScore = row.optionalDouble("resolutionScore"),
                    source = IntelligenceActivitySource(
                        name = source.optionalString("name"),
                        authorityTier = if (source.has("authorityTier") && !source.isNull("authorityTier")) source.optInt("authorityTier") else null,
                        role = source.optionalString("role"),
                        platform = source.optionalString("platform"),
                        handle = source.optionalString("handle"),
                    ),
                ),
            )
        }
    }
}

private fun JSONObject.optionalString(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key).takeIf { it.isNotBlank() }
}

private fun JSONObject.optionalDouble(key: String): Double? {
    if (!has(key) || isNull(key)) return null
    return optDouble(key).takeIf { !it.isNaN() }
}
