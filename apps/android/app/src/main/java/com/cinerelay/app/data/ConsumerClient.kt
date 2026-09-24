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

data class PersonalizationLanguage(
    val code: String,
    val label: String,
)

data class PersonalizationSource(
    val identityId: String,
    val sourceId: String,
    val name: String,
    val handle: String?,
    val role: String?,
    val artworkUrl: String?,
)

data class PersonalizationState(
    val completed: Boolean,
    val onboardingVersion: Int,
    val requiredVersion: Int,
    val favoriteSourceIdentityIds: Set<String>,
    val favoriteLanguages: Set<String>,
    val availableLanguages: List<PersonalizationLanguage>,
    val availableSources: List<PersonalizationSource>,
)

data class ConsumerSource(
    val identityId: String?,
    val name: String?,
    val handle: String?,
    val platform: String?,
    val role: String?,
    val artworkUrl: String?,
)

data class ConsumerUpdate(
    val id: String,
    val title: String,
    val text: String?,
    val languageCode: String?,
    val itemType: String?,
    val mediaType: String?,
    val thumbnailUrl: String?,
    val canonicalUrl: String?,
    val observedAt: String?,
    val eventId: String?,
    val source: ConsumerSource,
)

data class ConsumerEvidence(
    val role: String?,
    val title: String?,
    val canonicalUrl: String?,
    val publishedAt: String?,
    val thumbnailUrl: String?,
    val source: ConsumerSource,
)

data class ConsumerStoryTimelineEntry(
    val id: String,
    val current: Boolean,
    val eventType: String?,
    val verificationState: String?,
    val priorityBand: String?,
    val headline: String,
    val summary: String?,
    val status: String?,
    val detectedAt: String?,
    val announcedAt: String?,
    val occurredAt: String?,
)

data class ConsumerStory(
    val lifecycle: String,
    val evidenceCount: Int,
    val sourceCount: Int,
    val officialSourceCount: Int,
    val firstEvidenceAt: String?,
    val latestEvidenceAt: String?,
    val timeline: List<ConsumerStoryTimelineEntry>,
)

data class ConsumerEvent(
    val id: String,
    val entityId: String,
    val entityName: String?,
    val entityType: String?,
    val primaryLanguage: String?,
    val followed: Boolean,
    val eventType: String?,
    val verificationState: String?,
    val priorityBand: String?,
    val headline: String,
    val summary: String?,
    val detectedAt: String?,
    val story: ConsumerStory?,
    val evidence: List<ConsumerEvidence>,
)

sealed interface ConsumerDeepLinkTarget {
    data class SourceUpdate(val item: ConsumerUpdate) : ConsumerDeepLinkTarget
    data class Event(val event: ConsumerEvent) : ConsumerDeepLinkTarget
}

class ConsumerClient(
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

    fun personalization(): PersonalizationState {
        val json = invoke(JSONObject().put("action", "personalization"), requireAuth = true)
        return PersonalizationState(
            completed = json.optBoolean("completed", false),
            onboardingVersion = json.optInt("onboardingVersion", 0),
            requiredVersion = json.optInt("requiredVersion", 1),
            favoriteSourceIdentityIds = json.optJSONArray("favoriteSourceIdentityIds").toStringSet(),
            favoriteLanguages = json.optJSONArray("favoriteLanguages").toStringSet(),
            availableLanguages = json.optJSONArray("availableLanguages").toLanguages(),
            availableSources = json.optJSONArray("availableSources").toSources(),
        )
    }

    fun savePersonalization(
        sourceIdentityIds: Collection<String>,
        languageCodes: Collection<String>,
        complete: Boolean = true,
    ) {
        val result = invoke(
            JSONObject()
                .put("action", "savePersonalization")
                .put("sourceIdentityIds", JSONArray(sourceIdentityIds.toList()))
                .put("languageCodes", JSONArray(languageCodes.toList()))
                .put("complete", complete),
            requireAuth = true,
        )
        if (!result.optBoolean("ok", false)) {
            throw ApiException(result.optString("error", "Could not save your favorites"), 400)
        }
    }

    fun rawItem(rawItemId: String): ConsumerDeepLinkTarget.SourceUpdate {
        val json = invoke(
            JSONObject().put("action", "rawItem").put("rawItemId", rawItemId),
            requireAuth = false,
        )
        val item = json.optJSONObject("item") ?: throw ApiException("This update is no longer available", 404)
        return ConsumerDeepLinkTarget.SourceUpdate(item.toConsumerUpdate())
    }

    fun event(eventId: String): ConsumerDeepLinkTarget.Event {
        val json = invoke(
            JSONObject().put("action", "event").put("eventId", eventId),
            requireAuth = false,
        )
        val event = json.optJSONObject("event") ?: throw ApiException("This story is no longer available", 404)
        return ConsumerDeepLinkTarget.Event(event.toConsumerEvent())
    }

    private fun invoke(body: JSONObject, requireAuth: Boolean): JSONObject {
        var session = sessionStore.read()
        if (requireAuth && session == null) throw ApiException("Please sign in", 401)

        val now = System.currentTimeMillis() / 1000L
        if (session != null && session.expiresAtEpochSeconds <= now + 60L) {
            session = backendClient.refreshSession()
        }

        var response = invokeOnce(body, session?.accessToken)
        if (response.code == 401 && session != null) {
            session = backendClient.refreshSession()
            response = invokeOnce(body, session.accessToken)
        }
        if (!response.ok) throw ApiException(response.errorMessage ?: "CineRelay request failed", response.code)
        return response.json
    }

    private fun invokeOnce(body: JSONObject, accessToken: String?): JsonResponse {
        val builder = Request.Builder()
            .url("$baseUrl/functions/v1/cinerelay-consumer-api")
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
                val error = json.optionalConsumerString("error") ?: json.optionalConsumerString("message")
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

private fun JSONArray?.toStringSet(): Set<String> {
    val array = this ?: JSONArray()
    return buildSet {
        for (index in 0 until array.length()) array.optString(index).takeIf { it.isNotBlank() }?.let(::add)
    }
}

private fun JSONArray?.toLanguages(): List<PersonalizationLanguage> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            add(PersonalizationLanguage(row.optString("code"), row.optString("label")))
        }
    }
}

private fun JSONArray?.toSources(): List<PersonalizationSource> {
    val array = this ?: JSONArray()
    return buildList {
        for (index in 0 until array.length()) {
            val row = array.optJSONObject(index) ?: continue
            add(
                PersonalizationSource(
                    identityId = row.optString("identityId"),
                    sourceId = row.optString("sourceId"),
                    name = row.optString("name", "CineRelay source"),
                    handle = row.optionalConsumerString("handle"),
                    role = row.optionalConsumerString("role"),
                    artworkUrl = row.optionalConsumerString("artworkUrl"),
                ),
            )
        }
    }
}

private fun JSONObject.toConsumerSource(): ConsumerSource = ConsumerSource(
    identityId = optionalConsumerString("identityId"),
    name = optionalConsumerString("name"),
    handle = optionalConsumerString("handle"),
    platform = optionalConsumerString("platform"),
    role = optionalConsumerString("role"),
    artworkUrl = optionalConsumerString("artworkUrl"),
)

private fun JSONObject.toConsumerUpdate(): ConsumerUpdate = ConsumerUpdate(
    id = optString("id"),
    title = optString("title", "CineRelay update"),
    text = optionalConsumerString("text"),
    languageCode = optionalConsumerString("languageCode"),
    itemType = optionalConsumerString("itemType"),
    mediaType = optionalConsumerString("mediaType"),
    thumbnailUrl = optionalConsumerString("thumbnailUrl"),
    canonicalUrl = optionalConsumerString("canonicalUrl"),
    observedAt = optionalConsumerString("observedAt"),
    eventId = optionalConsumerString("eventId"),
    source = (optJSONObject("source") ?: JSONObject()).toConsumerSource(),
)

private fun JSONObject.toConsumerStory(): ConsumerStory {
    val timelineArray = optJSONArray("timeline") ?: JSONArray()
    val timeline = buildList {
        for (index in 0 until timelineArray.length()) {
            val row = timelineArray.optJSONObject(index) ?: continue
            add(
                ConsumerStoryTimelineEntry(
                    id = row.optString("id"),
                    current = row.optBoolean("current", false),
                    eventType = row.optionalConsumerString("eventType"),
                    verificationState = row.optionalConsumerString("verificationState"),
                    priorityBand = row.optionalConsumerString("priorityBand"),
                    headline = row.optString("headline", "Story update"),
                    summary = row.optionalConsumerString("summary"),
                    status = row.optionalConsumerString("status"),
                    detectedAt = row.optionalConsumerString("detectedAt"),
                    announcedAt = row.optionalConsumerString("announcedAt"),
                    occurredAt = row.optionalConsumerString("occurredAt"),
                ),
            )
        }
    }
    return ConsumerStory(
        lifecycle = optString("lifecycle", "NEW"),
        evidenceCount = optInt("evidenceCount", 0),
        sourceCount = optInt("sourceCount", 0),
        officialSourceCount = optInt("officialSourceCount", 0),
        firstEvidenceAt = optionalConsumerString("firstEvidenceAt"),
        latestEvidenceAt = optionalConsumerString("latestEvidenceAt"),
        timeline = timeline,
    )
}

private fun JSONObject.toConsumerEvent(): ConsumerEvent {
    val evidenceArray = optJSONArray("evidence") ?: JSONArray()
    val evidence = buildList {
        for (index in 0 until evidenceArray.length()) {
            val row = evidenceArray.optJSONObject(index) ?: continue
            add(
                ConsumerEvidence(
                    role = row.optionalConsumerString("role"),
                    title = row.optionalConsumerString("title"),
                    canonicalUrl = row.optionalConsumerString("canonicalUrl"),
                    publishedAt = row.optionalConsumerString("publishedAt"),
                    thumbnailUrl = row.optionalConsumerString("thumbnailUrl"),
                    source = (row.optJSONObject("source") ?: JSONObject()).toConsumerSource(),
                ),
            )
        }
    }
    return ConsumerEvent(
        id = optString("id"),
        entityId = optString("entityId"),
        entityName = optionalConsumerString("entityName"),
        entityType = optionalConsumerString("entityType"),
        primaryLanguage = optionalConsumerString("primaryLanguage"),
        followed = optBoolean("followed", false),
        eventType = optionalConsumerString("eventType"),
        verificationState = optionalConsumerString("verificationState"),
        priorityBand = optionalConsumerString("priorityBand"),
        headline = optString("headline", "CineRelay story"),
        summary = optionalConsumerString("summary"),
        detectedAt = optionalConsumerString("detectedAt"),
        story = optJSONObject("story")?.toConsumerStory(),
        evidence = evidence,
    )
}

private fun JSONObject.optionalConsumerString(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key).takeIf { it.isNotBlank() }
}
