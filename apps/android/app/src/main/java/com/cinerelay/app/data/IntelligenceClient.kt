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

data class OttProvider(
    val code: String,
    val name: String,
    val homepageUrl: String?,
)

data class OttEvidenceRef(
    val rawItemId: String,
    val eventId: String?,
    val role: String,
    val firstParty: Boolean,
    val observedAt: String?,
    val title: String?,
    val canonicalUrl: String?,
    val publishedAt: String?,
    val source: IntelligenceActivitySource,
)

data class OttEvidenceSummary(
    val total: Int,
    val firstParty: Int,
    val conflicting: Int,
    val refs: List<OttEvidenceRef>,
)

data class OttRelease(
    val id: String,
    val entity: IntelligenceEntity,
    val provider: OttProvider,
    val territory: String,
    val languages: List<String>,
    val releaseType: String,
    val releaseDate: String?,
    val datePrecision: String,
    val state: String,
    val evidenceStatus: String,
    val previousReleaseDate: String?,
    val firstObservedAt: String?,
    val lastVerifiedAt: String?,
    val evidence: OttEvidenceSummary,
)

data class OttReleaseFeed(
    val window: String,
    val territory: String,
    val today: String?,
    val windowEnd: String?,
    val providers: List<OttProvider>,
    val items: List<OttRelease>,
)

data class IntelligenceHub(
    val entity: IntelligenceEntity,
    val events: List<IntelligenceEvent>,
    val activity: List<IntelligenceActivity>,
    val ottReleases: List<OttRelease> = emptyList(),
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
            ottReleases = json.optJSONArray("ottReleases").toOttReleases(),
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

    fun ott(
        window: String = "this_week",
        providerCode: String? = null,
        language: String? = null,
        contentType: String? = null,
        evidenceStatus: String? = null,
        limit: Int = 50,
    ): OttReleaseFeed {
        val body = JSONObject()
            .put("action", "ott")
            .put("window", window)
            .put("territory", "IN")
            .put("limit", limit.coerceIn(1, 75))
        providerCode?.takeIf { it.isNotBlank() }?.let { body.put("providerCode", it) }
        language?.takeIf { it.isNotBlank() }?.let { body.put("language", it) }
        contentType?.takeIf { it.isNotBlank() }?.let { body.put("contentType", it) }
        evidenceStatus?.takeIf { it.isNotBlank() }?.let { body.put("evidenceStatus", it) }

        val json = invoke(body)
        return OttReleaseFeed(
            window = json.optString("window", window),
            territory = json.optString("territory", "IN"),
            today = json.optionalString("today"),
            windowEnd = json.optionalString("windowEnd"),
            providers = json.optJSONArray("providers").toOttProviders(),
            items = json.optJSONArray("items").toOttReleases(),
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
        eventType = optionalString("eventType") ?: optString("type"),
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
                    source = source.toActivitySource(),
                ),
            )
        }
    }
}

private fun JSONArray?.toOttProviders(): List<OttProvider> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            add(
                OttProvider(
                    code = row.optString("code"),
                    name = row.optString("name"),
                    homepageUrl = row.optionalString("homepageUrl"),
                ),
            )
        }
    }
}

private fun JSONArray?.toOttReleases(): List<OttRelease> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) array.optJSONObject(index)?.let { add(it.toOttRelease()) }
    }
}

private fun JSONObject.toOttRelease(): OttRelease {
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
                    eventId = row.optionalString("eventId"),
                    role = row.optString("role"),
                    firstParty = row.optBoolean("firstParty", false),
                    observedAt = row.optionalString("observedAt"),
                    title = row.optionalString("title"),
                    canonicalUrl = row.optionalString("canonicalUrl"),
                    publishedAt = row.optionalString("publishedAt"),
                    source = (row.optJSONObject("source") ?: JSONObject()).toActivitySource(),
                ),
            )
        }
    }
    return OttRelease(
        id = optString("id"),
        entity = entityJson.toEntity(),
        provider = OttProvider(
            code = providerJson.optString("code"),
            name = providerJson.optString("name"),
            homepageUrl = providerJson.optionalString("homepageUrl"),
        ),
        territory = optString("territory", "IN"),
        languages = optJSONArray("languages").toStringList(),
        releaseType = optString("releaseType"),
        releaseDate = optionalString("releaseDate"),
        datePrecision = optString("datePrecision", "TBA"),
        state = optString("state", "TBA"),
        evidenceStatus = optString("evidenceStatus", "TBA"),
        previousReleaseDate = optionalString("previousReleaseDate"),
        firstObservedAt = optionalString("firstObservedAt"),
        lastVerifiedAt = optionalString("lastVerifiedAt"),
        evidence = OttEvidenceSummary(
            total = evidenceJson.optInt("total", 0),
            firstParty = evidenceJson.optInt("firstParty", 0),
            conflicting = evidenceJson.optInt("conflicting", 0),
            refs = refs,
        ),
    )
}

private fun JSONObject.toActivitySource(): IntelligenceActivitySource = IntelligenceActivitySource(
    name = optionalString("name"),
    authorityTier = if (has("authorityTier") && !isNull("authorityTier")) optInt("authorityTier") else null,
    role = optionalString("role"),
    platform = optionalString("platform"),
    handle = optionalString("handle"),
)

private fun JSONArray?.toStringList(): List<String> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) array.optString(index).takeIf { it.isNotBlank() }?.let(::add)
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
