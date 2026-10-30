package com.cinerelay.app.data

import org.json.JSONObject
import java.time.Instant

/**
 * C22: API-verified channel ID is NOT permission to monitor the channel.
 * This response is never cached on disk; only unexpired operator-only records
 * from the C19 service are accepted. No public API observations in APK assets.
 */
data class CreatorVerifiedIdentityV22(
    val channelId: String,
    val officialTitle: String,
    val listedHandle: String,
    val language: String,
    val provisionalCategory: String,
    val observedAt: String,
    val expiresAt: String,
    val sourceUrl: String,
)

internal object CreatorIdentityParserV22 {
    private val idPattern = Regex("^UC[A-Za-z0-9_-]{22}$")

    fun parse(payload: JSONObject, now: Instant = Instant.now()): List<CreatorVerifiedIdentityV22> {
        if (payload.optBoolean("monitoringAuthorized", true) ||
            payload.optBoolean("comparisonsAuthorized", true)) {
            throw ApiException("Verified evidence cannot authorize tracking", -2)
        }
        val status = payload.optString("status")
        if (status !in setOf("FRESH_IDENTITIES_REVIEW_PENDING", "NO_FRESH_IDENTITY_EVIDENCE")) {
            throw ApiException("Unknown verified identity response", -2)
        }
        val records = payload.optJSONArray("channels")
            ?: throw ApiException("Verified identity list missing", -2)
        if (records.length() > 20 ||
            (status == "NO_FRESH_IDENTITY_EVIDENCE" && records.length() != 0) ||
            (status == "FRESH_IDENTITIES_REVIEW_PENDING" && records.length() == 0)) {
            throw ApiException("Verified identity response inconsistent", -2)
        }
        val seen = mutableSetOf<String>()
        return buildList {
            for (index in 0 until records.length()) {
                val row = records.optJSONObject(index)
                    ?: throw ApiException("Invalid verified identity row", -2)
                val id = row.optString("channelId")
                val title = row.optString("officialChannelTitle").trim()
                val handle = row.optString("listedHandle")
                val source = row.optString("sourceUrl")
                val observed = row.optString("observedAt")
                val expires = row.optString("expiresAt")
                if (!idPattern.matches(id) || !seen.add(id) ||
                    row.optString("uploadsPlaylistId") != "UU" + id.removePrefix("UC") ||
                    title.isEmpty() || handle.isBlank() ||
                    row.optString("reviewState") != "REVIEW_PENDING" ||
                    row.optBoolean("operatorApproved", true) ||
                    row.optBoolean("monitoringEnabled", true) ||
                    row.optBoolean("metricsEnabled", true) ||
                    !source.startsWith("https://")) {
                    throw ApiException("Unapproved or inconsistent identity data", -2)
                }
                val observedAt = runCatching { Instant.parse(observed) }.getOrNull()
                val expiresAt = runCatching { Instant.parse(expires) }.getOrNull()
                if (observedAt == null || expiresAt == null ||
                    observedAt.isAfter(now) || !expiresAt.isAfter(now) ||
                    expiresAt.isAfter(observedAt.plusSeconds(28L * 86400L))) {
                    // Fail closed: never display expired/overlong stored API data.
                    throw ApiException("Verified identity expired or invalid", -2)
                }
                add(CreatorVerifiedIdentityV22(
                    channelId = id,
                    officialTitle = title,
                    listedHandle = handle,
                    language = row.optString("locale"),
                    provisionalCategory = row.optString("categoryProvisional"),
                    observedAt = observed,
                    expiresAt = expires,
                    sourceUrl = source,
                ))
            }
        }
    }
}
