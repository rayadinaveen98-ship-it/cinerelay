package com.cinerelay.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class HomeCacheSnapshot(
    val youtube: List<NewsroomSignal>,
    val web: List<NewsroomSignal>,
)

class HomeCache(context: Context) {
    private val prefs = context.getSharedPreferences("cinerelay_home_cache", Context.MODE_PRIVATE)

    fun read(userId: String): HomeCacheSnapshot? {
        val normalizedUserId = userId.trim()
        if (normalizedUserId.isBlank()) return null
        val youtube = prefs.getString(key(normalizedUserId, "youtube"), null)?.let(::parseSignals).orEmpty()
        val web = prefs.getString(key(normalizedUserId, "web"), null)?.let(::parseSignals).orEmpty()
        if (youtube.isEmpty() && web.isEmpty()) return null
        return HomeCacheSnapshot(youtube = youtube, web = web)
    }

    fun write(userId: String, youtube: List<NewsroomSignal>, web: List<NewsroomSignal>) {
        val normalizedUserId = userId.trim()
        if (normalizedUserId.isBlank()) return
        prefs.edit()
            .putString(key(normalizedUserId, "youtube"), JSONArray(youtube.map(::signalToJson)).toString())
            .putString(key(normalizedUserId, "web"), JSONArray(web.map(::signalToJson)).toString())
            .apply()
    }

    private fun key(userId: String, lane: String): String = "home_v1_${userId}_$lane"

    private fun parseSignals(raw: String): List<NewsroomSignal> {
        return runCatching {
            val array = JSONArray(raw)
            buildList {
                for (index in 0 until array.length()) {
                    array.optJSONObject(index)?.let { add(it.toSignal()) }
                }
            }
        }.getOrDefault(emptyList())
    }
}

private fun signalToJson(signal: NewsroomSignal): JSONObject = JSONObject().apply {
    put("id", signal.id)
    put("state", signal.state)
    put("source", JSONObject().apply {
        putNullable("name", signal.source.name)
        putNullable("authorityTier", signal.source.authorityTier)
        putNullable("role", signal.source.role)
        putNullable("platform", signal.source.platform)
        putNullable("handle", signal.source.handle)
        putNullable("artworkUrl", signal.source.artworkUrl)
        putNullable("identityId", signal.source.identityId)
    })
    putNullable("itemType", signal.itemType)
    putNullable("mediaType", signal.mediaType)
    putNullable("languageCode", signal.languageCode)
    put("title", signal.title)
    putNullable("text", signal.text)
    putNullable("thumbnailUrl", signal.thumbnailUrl)
    putNullable("canonicalUrl", signal.canonicalUrl)
    putNullable("sourceObservedAt", signal.sourceObservedAt)
    putNullable("observedAt", signal.observedAt)
    putNullable("ingestedAt", signal.ingestedAt)
    put("enrichmentState", signal.enrichmentState)
    putNullable("canonicalEvent", signal.canonicalEvent?.let(::eventToJson))
}

private fun eventToJson(event: EventCard): JSONObject = JSONObject().apply {
    put("id", event.id)
    put("entityId", event.entityId)
    putNullable("entityName", event.entityName)
    putNullable("entityType", event.entityType)
    putNullable("primaryLanguage", event.primaryLanguage)
    put("followed", event.followed)
    put("eventType", event.eventType)
    put("verificationState", event.verificationState)
    put("priorityBand", event.priorityBand)
    put("headline", event.headline)
    putNullable("summary", event.summary)
    putNullable("summaryStatus", event.summaryStatus)
    put("evidenceCount", event.evidenceCount)
    put("conflictingEvidenceCount", event.conflictingEvidenceCount)
    put("status", event.status)
    putNullable("detectedAt", event.detectedAt)
    putNullable("evidence", event.evidence?.let(::evidenceToJson))
    putNullable("radar", event.radar?.let(::radarToJson))
}

private fun evidenceToJson(evidence: Evidence): JSONObject = JSONObject().apply {
    putNullable("sourceName", evidence.sourceName)
    putNullable("authorityTier", evidence.authorityTier)
    putNullable("sourceRole", evidence.sourceRole)
    putNullable("platform", evidence.platform)
    putNullable("handle", evidence.handle)
    putNullable("title", evidence.title)
    putNullable("canonicalUrl", evidence.canonicalUrl)
    putNullable("publishedAt", evidence.publishedAt)
}

private fun radarToJson(radar: RadarSignal): JSONObject = JSONObject().apply {
    put("score", radar.score)
    put("label", radar.label)
    put("reasons", JSONArray(radar.reasons))
}

private fun JSONObject.toSignal(): NewsroomSignal = NewsroomSignal(
    id = optString("id"),
    state = optString("state", "UNCONFIRMED"),
    source = optJSONObject("source")?.toNewsroomSource() ?: NewsroomSource(null, null, null, null, null, null),
    itemType = optNullableString("itemType"),
    mediaType = optNullableString("mediaType"),
    languageCode = optNullableString("languageCode"),
    title = optString("title", "Untitled source update"),
    text = optNullableString("text"),
    thumbnailUrl = optNullableString("thumbnailUrl"),
    canonicalUrl = optNullableString("canonicalUrl"),
    sourceObservedAt = optNullableString("sourceObservedAt"),
    observedAt = optNullableString("observedAt"),
    ingestedAt = optNullableString("ingestedAt"),
    enrichmentState = optString("enrichmentState", "RAW"),
    canonicalEvent = optJSONObject("canonicalEvent")?.toEventCard(),
)

private fun JSONObject.toNewsroomSource(): NewsroomSource = NewsroomSource(
    name = optNullableString("name"),
    authorityTier = if (has("authorityTier") && !isNull("authorityTier")) optInt("authorityTier") else null,
    role = optNullableString("role"),
    platform = optNullableString("platform"),
    handle = optNullableString("handle"),
    artworkUrl = optNullableString("artworkUrl"),
    identityId = optNullableString("identityId"),
)

private fun JSONObject.toEventCard(): EventCard = EventCard(
    id = optString("id"),
    entityId = optString("entityId"),
    entityName = optNullableString("entityName"),
    entityType = optNullableString("entityType"),
    primaryLanguage = optNullableString("primaryLanguage"),
    followed = optBoolean("followed", false),
    eventType = optString("eventType"),
    verificationState = optString("verificationState"),
    priorityBand = optString("priorityBand"),
    headline = optString("headline"),
    summary = optNullableString("summary"),
    summaryStatus = optNullableString("summaryStatus"),
    evidenceCount = optInt("evidenceCount", 0),
    conflictingEvidenceCount = optInt("conflictingEvidenceCount", 0),
    status = optString("status"),
    detectedAt = optNullableString("detectedAt"),
    evidence = optJSONObject("evidence")?.toEvidence(),
    radar = optJSONObject("radar")?.toRadar(),
)

private fun JSONObject.toEvidence(): Evidence = Evidence(
    sourceName = optNullableString("sourceName"),
    authorityTier = if (has("authorityTier") && !isNull("authorityTier")) optInt("authorityTier") else null,
    sourceRole = optNullableString("sourceRole"),
    platform = optNullableString("platform"),
    handle = optNullableString("handle"),
    title = optNullableString("title"),
    canonicalUrl = optNullableString("canonicalUrl"),
    publishedAt = optNullableString("publishedAt"),
)

private fun JSONObject.toRadar(): RadarSignal {
    val reasons = optJSONArray("reasons") ?: JSONArray()
    return RadarSignal(
        score = optInt("score", 0),
        label = optString("label", "NO_ACTION"),
        reasons = buildList { for (index in 0 until reasons.length()) add(reasons.optString(index)) },
    )
}

private fun JSONObject.putNullable(key: String, value: Any?) {
    put(key, value ?: JSONObject.NULL)
}

private fun JSONObject.optNullableString(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key).takeIf { it.isNotBlank() }
}
