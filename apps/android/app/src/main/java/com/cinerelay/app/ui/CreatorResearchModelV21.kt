package com.cinerelay.app.ui

import android.content.Context
import org.json.JSONObject
import java.util.Locale

/**
 * C21 Android-only discovery, not YouTube Data API evidence.
 * Never persists data from the historical C2/C10/C11 API snapshots.
 */
internal data class CreatorResearchLeadV21(
    val id: String,
    val name: String,
    val handle: String?,
    val locale: String,
    val category: String,
    val provisionalTier: String,
    val sourceUrl: String,
)

internal object CreatorResearchV21 {
    const val ASSET = "creator_research_leads_v21.json"
    const val NOTICE = "Research leads only · Not YouTube-verified"

    fun load(context: Context): List<CreatorResearchLeadV21> = runCatching {
        val json = context.assets.open(ASSET).bufferedReader().use { it.readText() }
        val root = JSONObject(json)
        require(root.optString("kind") == "CINERELAY_CREATOR_PROVISIONAL_RESEARCH_BETA")
        val leads = root.getJSONArray("leads")
        List(leads.length()) { index ->
            val item = leads.getJSONObject(index)
            CreatorResearchLeadV21(
                id = item.getString("id"),
                name = item.getString("name"),
                handle = item.optString("handle").takeIf { it.startsWith("@") },
                locale = item.getString("locale"),
                category = item.getString("category"),
                provisionalTier = item.getString("tier"),
                sourceUrl = item.getString("source"),
            )
        }.distinctBy { it.id }
    }.getOrDefault(emptyList())

    fun filter(
        leads: List<CreatorResearchLeadV21>,
        query: String,
        locale: String,
        tier: String,
    ): List<CreatorResearchLeadV21> {
        val needle = query.trim().lowercase(Locale.ROOT)
        return leads.filter { item ->
            (locale == "all" || item.locale == locale) &&
                (tier == "all" || item.provisionalTier == tier) &&
                (
                    needle.isEmpty() ||
                        listOf(item.name, item.handle.orEmpty(), item.category, item.locale)
                            .any { it.lowercase(Locale.ROOT).contains(needle) }
                    )
        }
    }

    fun localeLabel(code: String): String = when (code) {
        "te" -> "Telugu"
        "ta" -> "Tamil"
        "kn" -> "Kannada"
        "ml" -> "Malayalam"
        "mr" -> "Marathi"
        "bn" -> "Bengali"
        "hi-en" -> "Hindi + English"
        "en" -> "English"
        "multi-global" -> "Global / Multilingual"
        else -> code
    }

    fun tierLabel(code: String): String = when (code) {
        "NANO_LT10K" -> "Nano · under 10K"
        "MICRO_10K_100K" -> "Micro · 10K–100K"
        "MID_100K_1M" -> "Mid · 100K–1M"
        "LARGE_1M_10M" -> "Large · 1M–10M"
        "MEGA_10M_PLUS" -> "Mega · 10M+"
        else -> "Size unknown"
    }
}
