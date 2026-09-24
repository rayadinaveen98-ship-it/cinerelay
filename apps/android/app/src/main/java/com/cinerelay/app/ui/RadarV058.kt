package com.cinerelay.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cinerelay.app.data.EventCard
import com.cinerelay.app.data.NewsroomSignal
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.Instant
import java.util.Locale

private val RadarInk58 = Color(0xFF0D0F13)
private val RadarPanel58 = Color(0xFF171A20)
private val RadarRaised58 = Color(0xFF20242C)
private val RadarText58 = Color(0xFFF4F1EA)
private val RadarMuted58 = Color(0xFFA8ADB7)
private val RadarGold58 = Color(0xFFE8C56D)
private val RadarGreen58 = Color(0xFF73D6A5)
private val RadarAmber58 = Color(0xFFF0B862)
private val RadarRed58 = Color(0xFFF08079)
private val RadarBlue58 = Color(0xFF8CB9FF)

private data class RawRadarOpportunityV059(
    val signal: NewsroomSignal,
    val label: String,
    val hint: String,
    val score: Int,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RadarV058(
    state: CineRelayUiState,
    onRefresh: () -> Unit,
    onOpen: (EventCard) -> Unit,
    onOpenUpdate: (NewsroomSignal) -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(Unit) {
        while (true) {
            delay(60_000)
            onRefresh()
        }
    }

    val ranked = remember(state.events) {
        state.events.sortedWith(
            compareByDescending<EventCard> { it.radar?.label != null && it.radar.label != "NO_ACTION" }
                .thenByDescending { it.radar?.score ?: 0 }
                .thenByDescending { it.detectedAt ?: "" },
        )
    }
    val actionable = ranked.filter { it.radar?.label != null && it.radar.label != "NO_ACTION" }
    val watchlist = ranked.filter { it !in actionable }
    val canonicalRawIds = remember(ranked) { ranked.mapNotNull { it.evidence?.canonicalUrl }.toSet() }
    val freshSourceOpportunities = remember(state.homeSignals, canonicalRawIds) {
        buildRawRadarOpportunitiesV060(state.homeSignals, canonicalRawIds)
    }

    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = RadarGold58,
            background = RadarInk58,
            surface = RadarPanel58,
            surfaceVariant = RadarRaised58,
            onBackground = RadarText58,
            onSurface = RadarText58,
            onSurfaceVariant = RadarMuted58,
            error = RadarRed58,
        ),
    ) {
        PullToRefreshBox(
            isRefreshing = state.loading,
            onRefresh = onRefresh,
            modifier = modifier.fillMaxSize().background(RadarInk58),
        ) {
            Column(Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(start = 22.dp, end = 10.dp, top = 24.dp, bottom = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(color = RadarGold58.copy(alpha = 0.12f), shape = RoundedCornerShape(14.dp), modifier = Modifier.size(48.dp)) {
                        Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = RadarGold58) }
                    }
                    Spacer(Modifier.width(13.dp))
                    Column(Modifier.weight(1f)) {
                        Text("CINERELAY", color = RadarGold58, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
                        Text("Radar", color = RadarText58, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                        Text("What is worth covering now · rescored every minute", color = RadarMuted58, fontSize = 11.sp)
                    }
                    IconButton(onClick = onRefresh, enabled = !state.loading) {
                        if (state.loading) CircularProgressIndicator(Modifier.size(19.dp), strokeWidth = 2.dp, color = RadarGold58)
                        else Icon(Icons.Default.Refresh, contentDescription = "Refresh Radar", tint = RadarMuted58)
                    }
                }

                if (state.loading && state.events.isEmpty() && state.homeSignals.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = RadarGold58, strokeWidth = 2.dp) }
                } else if (ranked.isEmpty() && freshSourceOpportunities.isEmpty()) {
                    Column(
                        modifier = Modifier.fillMaxSize().padding(horizontal = 28.dp, vertical = 70.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Surface(color = RadarRaised58, shape = CircleShape, modifier = Modifier.size(62.dp)) {
                            Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.TrendingUp, contentDescription = null, tint = RadarGold58, modifier = Modifier.size(30.dp)) }
                        }
                        Spacer(Modifier.height(18.dp))
                        Text("Radar is scanning", color = RadarText58, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(7.dp))
                        Text("CineRelay keeps rescoring trailers, casting, release changes, OTT, production activity and other creator-worthy signals as evidence arrives.", color = RadarMuted58, fontSize = 13.sp, lineHeight = 19.sp)
                    }
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 6.dp, bottom = 110.dp),
                        verticalArrangement = Arrangement.spacedBy(13.dp),
                    ) {
                        item {
                            RadarSummaryV066(
                                actionableCount = actionable.size,
                                sourceOpportunityCount = freshSourceOpportunities.size,
                                totalCount = ranked.size + freshSourceOpportunities.size,
                            )
                        }
                        if (actionable.isNotEmpty()) {
                            item { RadarSectionTitleV058("Cover now", "Fresh, evidence-backed opportunities still inside CineRelay's action horizon") }
                            items(actionable, key = { "action:${it.id}" }) { event -> RadarOpportunityCardV066(event, true) { onOpen(event) } }
                        }
                        if (freshSourceOpportunities.isNotEmpty()) {
                            item { RadarSectionTitleV058("Fresh source signals", "Very recent official or trusted-source activity that may become a full story") }
                            items(freshSourceOpportunities, key = { "raw:${it.signal.id}" }) { opportunity ->
                                RawRadarOpportunityCardV066(opportunity) { onOpenUpdate(opportunity.signal) }
                            }
                        }
                        if (watchlist.isNotEmpty()) {
                            item { RadarSectionTitleV058("Keep watching", "Context remains useful, but these are not in the cover-now lane") }
                            items(watchlist.take(16), key = { "watch:${it.id}" }) { event -> RadarOpportunityCardV066(event, false) { onOpen(event) } }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RadarSummaryV066(actionableCount: Int, sourceOpportunityCount: Int, totalCount: Int) {
    Surface(color = RadarPanel58, shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("LIVE INTELLIGENCE", color = RadarGold58, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.0.sp)
                    Text("${actionableCount + sourceOpportunityCount} things worth checking", color = RadarText58, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                }
                Surface(color = RadarGreen58.copy(alpha = 0.10f), shape = RoundedCornerShape(50)) {
                    Row(Modifier.padding(horizontal = 9.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(6.dp).clip(CircleShape).background(RadarGreen58))
                        Spacer(Modifier.width(5.dp))
                        Text("1 min", color = RadarGreen58, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                RadarSummaryStatV066(actionableCount.toString(), "Ranked", Modifier.weight(1f))
                RadarSummaryStatV066(sourceOpportunityCount.toString(), "Fresh signals", Modifier.weight(1f))
                RadarSummaryStatV066((totalCount - actionableCount - sourceOpportunityCount).coerceAtLeast(0).toString(), "Watchlist", Modifier.weight(1f))
            }
            Text("Radar v2 uses freshness decay, verification, evidence strength and source authority. Stories older than 72 hours leave the cover-now lane.", color = RadarMuted58, fontSize = 9.sp, lineHeight = 14.sp)
        }
    }
}

@Composable
private fun RadarSummaryStatV066(value: String, label: String, modifier: Modifier = Modifier) {
    Surface(color = RadarRaised58, shape = RoundedCornerShape(14.dp), modifier = modifier) {
        Column(Modifier.padding(vertical = 9.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, color = RadarText58, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(label, color = RadarMuted58, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun RadarSectionTitleV058(title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, color = RadarText58, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text(subtitle, color = RadarMuted58, fontSize = 10.sp)
    }
}

@Composable
private fun RadarOpportunityCardV066(event: EventCard, actionable: Boolean, onClick: () -> Unit) {
    val radar = event.radar
    val label = radarLabelV058(event, actionable)
    val accent = when (radar?.label) {
        "TRAILER_ANALYSIS" -> RadarGold58
        "BREAKING_EXPLAINER" -> RadarRed58
        "SHORT_OPPORTUNITY" -> RadarGreen58
        "FOLLOW_UP_NEEDED" -> RadarAmber58
        else -> if (actionable) RadarGold58 else RadarMuted58
    }
    Surface(color = RadarPanel58, shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(accent))
                Spacer(Modifier.width(8.dp))
                Text(label, color = accent, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                RadarScorePillV066(score = radar?.score ?: 0, accent = accent, actionable = actionable)
            }

            event.entityName?.let {
                Text(it, color = RadarGold58, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Text(event.headline, color = RadarText58, fontSize = 18.sp, lineHeight = 23.sp, fontWeight = FontWeight.Bold, maxLines = 3, overflow = TextOverflow.Ellipsis)
            event.summary?.takeIf { it.isNotBlank() }?.let {
                Text(it, color = RadarMuted58, fontSize = 12.sp, lineHeight = 18.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }

            Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                RadarMetaChipV066(radarVerificationLabelV066(event.verificationState), radarVerificationColorV066(event.verificationState))
                if (event.evidenceCount > 0) RadarMetaChipV066("${event.evidenceCount} evidence", RadarBlue58)
                event.detectedAt?.let { RadarMetaChipV066(radarAgeV058(it), RadarMuted58) }
            }

            val reasonSummary = radarReasonSummaryV066(radar?.reasons.orEmpty())
            if (reasonSummary.isNotBlank()) {
                Surface(color = accent.copy(alpha = 0.07f), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(horizontal = 11.dp, vertical = 9.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text("WHY NOW", color = accent, fontSize = 8.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp)
                        Text(reasonSummary, color = RadarText58.copy(alpha = 0.82f), fontSize = 10.sp, lineHeight = 15.sp)
                    }
                }
            }

            Text(radarHintV058(event, actionable), color = RadarMuted58, fontSize = 11.sp, lineHeight = 16.sp)
        }
    }
}

@Composable
private fun RadarScorePillV066(score: Int, accent: Color, actionable: Boolean) {
    Surface(color = accent.copy(alpha = if (actionable) 0.14f else 0.08f), shape = RoundedCornerShape(13.dp)) {
        Row(Modifier.padding(horizontal = 9.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(score.toString(), color = accent, fontSize = 14.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.width(4.dp))
            Text("RADAR", color = accent.copy(alpha = 0.76f), fontSize = 7.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp)
        }
    }
}

@Composable
private fun RadarMetaChipV066(label: String, accent: Color) {
    Surface(color = accent.copy(alpha = 0.09f), shape = RoundedCornerShape(50)) {
        Text(label, color = accent, fontSize = 8.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp))
    }
}

@Composable
private fun RawRadarOpportunityCardV066(opportunity: RawRadarOpportunityV059, onClick: () -> Unit) {
    val signal = opportunity.signal
    val accent = when {
        opportunity.score >= 90 -> RadarRed58
        opportunity.score >= 76 -> RadarGold58
        opportunity.score >= 60 -> RadarGreen58
        else -> RadarBlue58
    }
    Surface(color = RadarPanel58, shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(accent))
                Spacer(Modifier.width(8.dp))
                Text(opportunity.label, color = accent, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                RadarScorePillV066(opportunity.score, accent, actionable = true)
            }
            Text(signal.title, color = RadarText58, fontSize = 17.sp, lineHeight = 22.sp, fontWeight = FontWeight.Bold, maxLines = 3, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(signal.source.name ?: signal.source.handle ?: "CineRelay source", color = RadarGold58, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                Spacer(Modifier.width(8.dp))
                if ((signal.source.authorityTier ?: 99) <= 1) RadarMetaChipV066("Official", RadarGreen58)
                else RadarMetaChipV066(radarSignalAgeV059(signal), RadarMuted58)
            }
            Text(opportunity.hint, color = RadarMuted58, fontSize = 11.sp, lineHeight = 16.sp)
        }
    }
}

private fun buildRawRadarOpportunitiesV060(signals: List<NewsroomSignal>, canonicalUrls: Set<String>): List<RawRadarOpportunityV059> {
    val now = Instant.now()
    return signals.asSequence()
        .distinctBy { it.id }
        .filter { signal ->
            val instant = radarSignalInstantV059(signal)
            instant != Instant.EPOCH && Duration.between(instant, now).toHours() in 0..35
        }
        .filterNot { signal -> !signal.canonicalUrl.isNullOrBlank() && signal.canonicalUrl in canonicalUrls }
        .mapNotNull(::scoreRawRadarOpportunityV060)
        .filter { it.score >= 44 }
        .sortedWith(compareByDescending<RawRadarOpportunityV059> { it.score }.thenByDescending { radarSignalInstantV059(it.signal) })
        .take(36)
        .toList()
}

private fun scoreRawRadarOpportunityV060(signal: NewsroomSignal): RawRadarOpportunityV059? {
    val title = signal.title.lowercase(Locale.ROOT)
    val lowValueCatalog = listOf(
        "full movie", "comedy scene", "best scene", "movie scene", "clip", "episode promo", "serial promo", "recap",
    ).any(title::contains)

    val type = when {
        "trailer" in title -> Triple("Trailer just landed", "A fresh trailer can support a fast breakdown, reaction or craft angle.", 86)
        "teaser" in title || "glimpse" in title -> Triple("Fresh teaser / glimpse", "A new visual drop is time-sensitive. Check the frames, story clues and craft angle while it is fresh.", 80)
        "release date" in title || "releasing on" in title || "date changed" in title || "postponed" in title || "preponed" in title -> Triple("Release update", "A release-date announcement or change is useful for a quick verified explainer.", 88)
        "title reveal" in title || "title announcement" in title -> Triple("Title reveal", "A new title reveal can support a fast update plus first-impression angle.", 72)
        "first look" in title || "motion poster" in title || "character poster" in title || "poster" in title -> Triple("New visual reveal", "A fresh official visual may have a useful design, character or announcement angle.", 66)
        "streaming" in title || "ott" in title || "digital premiere" in title || "premiere" in title -> Triple("Streaming update", "Check whether this adds a new platform, date, language or availability angle.", 76)
        "joins the cast" in title || "joins cast" in title || "cast announcement" in title || "starring" in title || "on board" in title || "onboard" in title -> Triple("Casting update", "A confirmed casting change can become a clean news update or project-context Short.", 67)
        "shoot begins" in title || "shoot starts" in title || "shooting begins" in title || "schedule begins" in title || "new schedule" in title || "wraps shoot" in title || "shoot wrapped" in title || "wrap up" in title || "muhurat" in title || "pooja ceremony" in title -> Triple("Production movement", "Fresh production activity can be worth covering when it changes the project timeline or confirms progress.", 58)
        "censor" in title || "runtime" in title || "advance booking" in title || "bookings open" in title || "pre sales" in title || "pre-sales" in title -> Triple("Release-week signal", "Censor, runtime or booking updates can become useful release-week coverage.", 65)
        "box office" in title || "collections" in title || "crosses" in title || "record" in title || "milestone" in title -> Triple("Performance milestone", "Check whether the number is official or well sourced before turning it into coverage.", 54)
        "sequel" in title || "franchise" in title || "remake" in title || "spin off" in title || "spinoff" in title -> Triple("Project development", "A sequel, franchise or remake development can be worth a context-first update.", 62)
        "behind the scenes" in title || "making of" in title || "making video" in title -> Triple("Making / BTS opportunity", "Fresh making material can support a craft-focused breakdown if it reveals process or technique.", 50)
        "song" in title || "lyrical" in title || "single" in title || "jukebox" in title -> Triple("Music drop", "A fresh song or single may be useful when it reveals visuals, choreography, tone or story context.", 52)
        "announcement" in title || "announced" in title || "launch" in title -> Triple("New announcement", "Fresh official announcements are worth checking for a clean update angle.", 64)
        "interview" in title || "press meet" in title || "event" in title -> Triple("Fresh interview / event", "Look for a new quote, reveal or clip that adds something beyond the event itself.", 46)
        else -> return null
    }

    if (lowValueCatalog && type.third < 60) return null

    var score = type.third
    score += when (signal.source.authorityTier) {
        1 -> 16
        2 -> 10
        3 -> 4
        else -> 0
    }
    if (signal.state == "VERIFIED") score += 6
    if (signal.source.role in setOf("PRODUCTION_HOUSE", "FILM_OFFICIAL", "CAST_CREW_OFFICIAL", "OTT_PLATFORM", "MUSIC_LABEL")) score += 5

    val ageHours = Duration.between(radarSignalInstantV059(signal), Instant.now()).toHours().coerceAtLeast(0)
    score -= when {
        ageHours <= 1 -> 0
        ageHours <= 4 -> 2
        ageHours <= 8 -> 5
        ageHours <= 18 -> 10
        else -> 18
    }
    return RawRadarOpportunityV059(signal, type.first, type.second, score.coerceIn(0, 100))
}

private fun radarLabelV058(event: EventCard, actionable: Boolean): String = when (event.radar?.label) {
    "TRAILER_ANALYSIS" -> "Trailer breakdown opportunity"
    "BREAKING_EXPLAINER" -> "Cover this now"
    "SHORT_OPPORTUNITY" -> "Quick Short / Reel idea"
    "FOLLOW_UP_NEEDED" -> "Developing story"
    else -> if (actionable) "Worth covering" else "Watch this story"
}

private fun radarHintV058(event: EventCard, actionable: Boolean): String = when (event.radar?.label) {
    "TRAILER_ANALYSIS" -> "A fresh trailer or teaser gives you something concrete to analyse."
    "BREAKING_EXPLAINER" -> "Fresh and important enough for a timely explainer or update."
    "SHORT_OPPORTUNITY" -> "Best suited to a fast, self-contained Short or Reel."
    "FOLLOW_UP_NEEDED" -> "The story is moving. Wait for the next strong confirmation or angle."
    else -> if (actionable) "Open the story and supporting source before deciding your angle." else "Not urgent now. CineRelay keeps the context here and will re-elevate it if new evidence arrives."
}

private fun radarReasonSummaryV066(reasons: List<String>): String {
    val phrases = reasons.mapNotNull { reason ->
        when {
            reason == "TYPE_TRAILER_RELEASED" -> "fresh trailer"
            reason == "TYPE_MAJOR_CHANGE" -> "major change"
            reason == "TYPE_MAJOR_ANNOUNCEMENT" -> "major announcement"
            reason == "TYPE_OTT_RELEASED" -> "OTT availability changed"
            reason == "TYPE_HIGH_VALUE_VISUAL" -> "new visual material"
            reason == "TYPE_RELEASE_WEEK_SIGNAL" -> "release-week signal"
            reason == "TYPE_CREATOR_FRIENDLY_UPDATE" -> "creator-friendly update"
            reason == "TYPE_CRAFT_MATERIAL" -> "craft / making material"
            reason == "TYPE_PERFORMANCE_MILESTONE" -> "performance milestone"
            reason == "TYPE_UPCOMING_DROP" -> "upcoming content drop"
            reason == "TYPE_QUOTE_OR_EVENT_OPPORTUNITY" -> "new quote / event angle"
            reason == "TYPE_FOLLOW_UP_EVENT" -> "story needs follow-up"
            reason == "OFFICIAL_SOURCES_2_PLUS" -> "multiple official sources"
            reason == "OFFICIAL_SOURCE_PRESENT" -> "official source"
            reason == "MULTI_SOURCE_CORROBORATION" -> "multiple sources"
            reason == "FRESH_2H" -> "very fresh"
            reason == "FRESH_6H" -> "fresh in the last 6h"
            reason == "FRESH_12H" -> "fresh today"
            reason == "FRESH_24H" -> "within 24h"
            reason == "AGE_OVER_72H_ACTION_HORIZON" -> "outside the 72h cover-now window"
            else -> null
        }
    }.distinct().take(3)
    return phrases.joinToString(" • ")
}

private fun radarVerificationLabelV066(value: String): String = when (value) {
    "OFFICIAL" -> "Official"
    "CONFIRMED" -> "Confirmed"
    "RELIABLE_REPORT" -> "Reliable report"
    "DEVELOPING" -> "Developing"
    "RUMOR" -> "Rumor"
    else -> "Evidence"
}

private fun radarVerificationColorV066(value: String): Color = when (value) {
    "OFFICIAL", "CONFIRMED" -> RadarGreen58
    "RELIABLE_REPORT", "DEVELOPING" -> RadarAmber58
    "RUMOR" -> RadarRed58
    else -> RadarMuted58
}

private fun radarSignalInstantV059(signal: NewsroomSignal): Instant {
    val value = signal.observedAt ?: signal.ingestedAt ?: signal.sourceObservedAt ?: return Instant.EPOCH
    return runCatching { Instant.parse(value) }.getOrDefault(Instant.EPOCH)
}

private fun radarSignalAgeV059(signal: NewsroomSignal): String = radarAgeV058(
    signal.observedAt ?: signal.ingestedAt ?: signal.sourceObservedAt,
)

private fun radarAgeV058(value: String?): String {
    val instant = value?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return ""
    val minutes = Duration.between(instant, Instant.now()).toMinutes().coerceAtLeast(0)
    return when {
        minutes < 1 -> "now"
        minutes < 60 -> "${minutes}m"
        minutes < 1_440 -> "${minutes / 60}h"
        else -> "${minutes / 1_440}d"
    }
}
