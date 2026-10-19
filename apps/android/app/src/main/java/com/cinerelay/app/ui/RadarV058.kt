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
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.runtime.produceState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.activity.compose.BackHandler
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cinerelay.app.data.EventCard
import com.cinerelay.app.data.NewsroomSignal
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Duration
import java.time.Instant
import java.util.Locale

private val RadarInk58 = CineEditorial.Background
private val RadarPanel58 = CineEditorial.Surface
private val RadarRaised58 = CineEditorial.Raised
private val RadarText58 = CineEditorial.Text
private val RadarMuted58 = CineEditorial.Muted
private val RadarGold58 = CineEditorial.Accent
private val RadarGreen58 = CineEditorial.Confirmed
private val RadarAmber58 = CineEditorial.Developing
private val RadarRed58 = CineEditorial.Error
private val RadarBlue58 = CineEditorial.Info

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

    val landingListState=rememberLazyListState()
    var openedLane by rememberSaveable { mutableStateOf<String?>(null) }
    BackHandler(enabled=openedLane!=null){ openedLane=null }
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
    val freshSourceOpportunities by produceState(
        initialValue = emptyList<RawRadarOpportunityV059>(),
        key1 = state.homeSignals,
        key2 = canonicalRawIds,
    ) {
        value = withContext(Dispatchers.Default) {
            buildRawRadarOpportunitiesV060(state.homeSignals, canonicalRawIds)
        }
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
        if(openedLane!=null) {
            val title=when(openedLane) {
                "cover"->"Cover now"
                "fresh"->"Fresh source signals"
                else->"Keep watching"
            }
            LazyColumn(Modifier.fillMaxSize().background(RadarInk58),
                contentPadding=PaddingValues(bottom=120.dp),
                verticalArrangement=Arrangement.spacedBy(12.dp)) {
                item { DiscoverySubpageHeaderV080(title,"All available opportunities",onBack={openedLane=null}) }
                when(openedLane){
                    "cover"->items(actionable,key={it.id}){event->
                        Box(Modifier.padding(horizontal=16.dp)){
                            RadarOpportunityCardV066(event,true){onOpen(event)}
                        }
                    }
                    "fresh"->items(freshSourceOpportunities,key={it.signal.id}){opportunity->
                        Box(Modifier.padding(horizontal=16.dp)){
                            RawRadarOpportunityCardV066(opportunity){onOpenUpdate(opportunity.signal)}
                        }
                    }
                    else->items(watchlist,key={it.id}){event->
                        Box(Modifier.padding(horizontal=16.dp)){
                            RadarOpportunityCardV066(event,false){onOpen(event)}
                        }
                    }
                }
            }
        } else {
        PullToRefreshBox(
            isRefreshing = state.loading,
            onRefresh = onRefresh,
            modifier = modifier.fillMaxSize().background(RadarInk58),
        ) {
            Column(Modifier.fillMaxSize()) {
                EditorialMastheadV2(
                    section = "SIGNAL DESK / FRESH STORIES",
                    title = "Radar",
                    subtitle = "",
                    modifier = Modifier.padding(horizontal = CineEditorial.Gutter),
                    actions = {
                        IconButton(onClick = onRefresh, enabled = !state.loading) {
                            if (state.loading) CircularProgressIndicator(Modifier.size(19.dp),
                                strokeWidth = 2.dp, color = RadarGold58)
                            else Icon(Icons.Default.Refresh,
                                contentDescription = "Refresh Radar", tint = RadarMuted58)
                        }
                    },
                )

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
                        Text("Radar is scanning", color = RadarText58, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(7.dp))
                        Text("New updates will appear here.", color = RadarMuted58, fontSize = 14.sp, lineHeight = 19.sp)
                    }
                } else {
                    LazyColumn(
                        state=landingListState,
                        contentPadding = PaddingValues(start = CineEditorial.Gutter, end = CineEditorial.Gutter, top = 8.dp, bottom = 110.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        item {
                            RadarSummaryV066(
                                actionableCount = actionable.size,
                                sourceOpportunityCount = freshSourceOpportunities.size,
                                totalCount = ranked.size + freshSourceOpportunities.size,
                            )
                        }
                        if(actionable.isNotEmpty()){
                            item{EditorialSectionV2("OPPORTUNITIES / PRIORITY","Cover now",modifier=Modifier.padding(horizontal=0.dp),trailing={
                                    androidx.compose.material3.TextButton(onClick={openedLane="cover"}) {
                                        Text("See all →",color=RadarGold58,fontSize=12.sp)
                                    }
                                })}
                            item{LazyRow(contentPadding=PaddingValues(0.dp),
                                horizontalArrangement=Arrangement.spacedBy(12.dp)){
                                items(actionable.take(10),key={it.id}){event->
                                    RadarPreviewCardV080(radarLabelV058(event,true),event.headline,
                                        event.radar?.score?:0,event.entityName){onOpen(event)}
                                }
                            }}
                        }
                        if(freshSourceOpportunities.isNotEmpty()){
                            item{EditorialSectionV2("SOURCE ACTIVITY / NEW","Fresh source signals",modifier=Modifier.padding(horizontal=0.dp),trailing={
                                    androidx.compose.material3.TextButton(onClick={openedLane="fresh"}) {
                                        Text("See all →",color=RadarGold58,fontSize=12.sp)
                                    }
                                })}
                            item{LazyRow(contentPadding=PaddingValues(0.dp),
                                horizontalArrangement=Arrangement.spacedBy(12.dp)){
                                items(freshSourceOpportunities.take(10),key={it.signal.id}){opportunity->
                                    RadarPreviewCardV080(opportunity.label,opportunity.signal.title,
                                        opportunity.score,opportunity.signal.source.name,
                                        artworkUrl = opportunity.signal.thumbnailUrl){
                                        onOpenUpdate(opportunity.signal)
                                    }
                                }
                            }}
                        }
                        if(watchlist.isNotEmpty()){
                            item{EditorialSectionV2("DEVELOPING / MONITOR","Keep watching",modifier=Modifier.padding(horizontal=0.dp),trailing={
                                    androidx.compose.material3.TextButton(onClick={openedLane="watch"}) {
                                        Text("See all →",color=RadarGold58,fontSize=12.sp)
                                    }
                                })}
                            item{LazyRow(contentPadding=PaddingValues(0.dp),
                                horizontalArrangement=Arrangement.spacedBy(12.dp)){
                                items(watchlist.take(10),key={it.id}){event->
                                    RadarPreviewCardV080(radarLabelV058(event,false),event.headline,
                                        event.radar?.score?:0,event.entityName){onOpen(event)}
                                }
                            }}
                        }
                    }
                }
            }
        }
        }
    }
}

@Composable
private fun RadarPreviewCardV080(
    label: String,
    headline: String,
    score: Int,
    source: String?,
    artworkUrl: String? = null,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier.width(214.dp).clickable(onClick = onClick),
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        if (!artworkUrl.isNullOrBlank()) {
            EditorialArtworkV2(
                url = artworkUrl,
                title = headline,
                modifier = Modifier.fillMaxWidth().height(120.dp),
                label = label,
            )
        } else {
            // An original signal graphic is not presented as an official movie poster.
            Box(
                modifier = Modifier.fillMaxWidth().height(120.dp)
                    .clip(RoundedCornerShape(CineEditorial.CardRadius))
                    .background(Brush.linearGradient(listOf(RadarRaised58, RadarPanel58))),
            ) {
                Icon(
                    Icons.Default.TrendingUp,
                    contentDescription = null,
                    tint = RadarGold58.copy(alpha = 0.55f),
                    modifier = Modifier.align(Alignment.Center).size(34.dp),
                )
                Text(
                    label,
                    modifier = Modifier.align(Alignment.BottomStart).padding(12.dp),
                    color = RadarGold58,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Text(
            headline,
            color = RadarText58,
            fontSize = CineEditorial.CardTitle,
            lineHeight = 20.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                source?.takeIf { it.isNotBlank() } ?: "CineRelay",
                modifier = Modifier.weight(1f),
                color = RadarMuted58,
                fontSize = CineEditorial.Metadata,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.width(6.dp))
            Text(
                "Signal $score",
                color = RadarMuted58,
                fontSize = CineEditorial.Metadata,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun RadarSummaryV066(actionableCount: Int, sourceOpportunityCount: Int, totalCount: Int) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "$totalCount updates to explore",
            modifier = Modifier.weight(1f),
            color = RadarText58,
            fontSize = CineEditorial.Body,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            "${actionableCount + sourceOpportunityCount} priority signals",
            color = RadarMuted58,
            fontSize = CineEditorial.Metadata,
        )
    }
}

@Composable
private fun RadarSectionTitleV058(title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, color = RadarText58, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text(subtitle, color = RadarMuted58, fontSize = 12.sp)
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
    Surface(color = RadarPanel58, shape = RoundedCornerShape(CineEditorial.CardRadius), modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(accent))
                Spacer(Modifier.width(8.dp))
                Text(label, color = accent, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                RadarScorePillV066(score = radar?.score ?: 0, accent = accent, actionable = actionable)
            }

            event.entityName?.let {
                Text(it, color = RadarGold58, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Text(event.headline, color = RadarText58, fontSize = CineEditorial.CardTitle, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
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
                Surface(color = accent.copy(alpha = 0.07f), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(horizontal = 11.dp, vertical = 9.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text("WHY IT MATTERS", color = accent, fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp)
                        Text(reasonSummary, color = RadarText58.copy(alpha = 0.82f), fontSize = 12.sp, lineHeight = 15.sp)
                    }
                }
            }

            Text(radarHintV058(event, actionable), color = RadarMuted58, fontSize = 12.sp, lineHeight = 16.sp)
        }
    }
}

@Composable
private fun RadarScorePillV066(score: Int, accent: Color, actionable: Boolean) {
    Surface(color = accent.copy(alpha = if (actionable) 0.14f else 0.08f), shape = RoundedCornerShape(12.dp)) {
        Row(Modifier.padding(horizontal = 9.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(score.toString(), color = accent, fontSize = 14.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.width(4.dp))
            Text("RADAR", color = accent.copy(alpha = 0.76f), fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp)
        }
    }
}

@Composable
private fun RadarMetaChipV066(label: String, accent: Color) {
    Surface(color = accent.copy(alpha = 0.09f), shape = RoundedCornerShape(50)) {
        Text(label, color = accent, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp))
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
    Surface(color = RadarPanel58, shape = RoundedCornerShape(CineEditorial.CardRadius), modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(accent))
                Spacer(Modifier.width(8.dp))
                Text(opportunity.label, color = accent, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                RadarScorePillV066(opportunity.score, accent, actionable = true)
            }
            Text(signal.title, color = RadarText58, fontSize = CineEditorial.CardTitle, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(signal.source.name ?: signal.source.handle ?: "CineRelay source", color = RadarGold58, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                Spacer(Modifier.width(8.dp))
                if ((signal.source.authorityTier ?: 99) <= 1) RadarMetaChipV066("Official", RadarGreen58)
                else RadarMetaChipV066(radarSignalAgeV059(signal), RadarMuted58)
            }
            Text(opportunity.hint, color = RadarMuted58, fontSize = 12.sp, lineHeight = 16.sp)
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
