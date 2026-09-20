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
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.Instant

private val RadarInk58 = Color(0xFF0D0F13)
private val RadarPanel58 = Color(0xFF171A20)
private val RadarRaised58 = Color(0xFF20242C)
private val RadarText58 = Color(0xFFF4F1EA)
private val RadarMuted58 = Color(0xFFA8ADB7)
private val RadarGold58 = Color(0xFFE8C56D)
private val RadarGreen58 = Color(0xFF73D6A5)
private val RadarAmber58 = Color(0xFFF0B862)
private val RadarRed58 = Color(0xFFF08079)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RadarV058(
    state: CineRelayUiState,
    onRefresh: () -> Unit,
    onOpen: (EventCard) -> Unit,
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
                        Text("Fresh opportunities · updates automatically", color = RadarMuted58, fontSize = 11.sp)
                    }
                    IconButton(onClick = onRefresh, enabled = !state.loading) {
                        if (state.loading) CircularProgressIndicator(Modifier.size(19.dp), strokeWidth = 2.dp, color = RadarGold58)
                        else Icon(Icons.Default.Refresh, contentDescription = "Refresh Radar", tint = RadarMuted58)
                    }
                }

                if (state.loading && state.events.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = RadarGold58, strokeWidth = 2.dp) }
                } else if (ranked.isEmpty()) {
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
                        Text("Pull down anytime. New movie, trailer, OTT and announcement opportunities will appear as CineRelay detects them.", color = RadarMuted58, fontSize = 13.sp, lineHeight = 19.sp)
                    }
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 6.dp, bottom = 110.dp),
                        verticalArrangement = Arrangement.spacedBy(13.dp),
                    ) {
                        item {
                            RadarSummaryV058(actionableCount = actionable.size, totalCount = ranked.size)
                        }
                        if (actionable.isNotEmpty()) {
                            item { RadarSectionTitleV058("Fresh opportunities", "Best things to look at first") }
                            items(actionable, key = { "action:${it.id}" }) { event -> RadarOpportunityCardV058(event, true) { onOpen(event) } }
                        }
                        if (watchlist.isNotEmpty()) {
                            item { RadarSectionTitleV058("Keep watching", "Fresh signals that may become stronger") }
                            items(watchlist.take(16), key = { "watch:${it.id}" }) { event -> RadarOpportunityCardV058(event, false) { onOpen(event) } }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RadarSummaryV058(actionableCount: Int, totalCount: Int) {
    Surface(color = RadarPanel58, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Live scan", color = RadarGold58, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Text("$actionableCount opportunities from $totalCount fresh signals", color = RadarText58, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
            Text("1 min", color = RadarMuted58, fontSize = 10.sp)
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
private fun RadarOpportunityCardV058(event: EventCard, actionable: Boolean, onClick: () -> Unit) {
    val label = radarLabelV058(event, actionable)
    val accent = when (event.radar?.label) {
        "TRAILER_ANALYSIS" -> RadarGold58
        "BREAKING_EXPLAINER" -> RadarRed58
        "SHORT_OPPORTUNITY" -> RadarGreen58
        "FOLLOW_UP_NEEDED" -> RadarAmber58
        else -> if (actionable) RadarGold58 else RadarMuted58
    }
    Surface(color = RadarPanel58, shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(accent))
                Spacer(Modifier.width(8.dp))
                Text(label, color = accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                Text(radarAgeV058(event.detectedAt), color = RadarMuted58, fontSize = 10.sp)
            }
            event.entityName?.let { Text(it, color = RadarGold58, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis) }
            Text(event.headline, color = RadarText58, fontSize = 17.sp, lineHeight = 22.sp, fontWeight = FontWeight.Bold, maxLines = 3, overflow = TextOverflow.Ellipsis)
            event.summary?.takeIf { it.isNotBlank() }?.let { Text(it, color = RadarMuted58, fontSize = 12.sp, lineHeight = 18.sp, maxLines = 2, overflow = TextOverflow.Ellipsis) }
            Text(radarHintV058(event, actionable), color = RadarMuted58, fontSize = 11.sp, lineHeight = 16.sp)
        }
    }
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
    else -> if (actionable) "Open the story and supporting source before deciding your angle." else "Not urgent yet, but CineRelay will keep rescoring it as new evidence arrives."
}

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
