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
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cinerelay.app.data.EventCard

private val RadarInk56 = Color(0xFF0D0F13)
private val RadarPanel56 = Color(0xFF171A20)
private val RadarRaised56 = Color(0xFF20242C)
private val RadarText56 = Color(0xFFF4F1EA)
private val RadarMuted56 = Color(0xFFA8ADB7)
private val RadarGold56 = Color(0xFFE8C56D)
private val RadarGreen56 = Color(0xFF73D6A5)
private val RadarAmber56 = Color(0xFFF0B862)
private val RadarRed56 = Color(0xFFF08079)

@Composable
fun RadarV056(
    state: CineRelayUiState,
    onRefresh: () -> Unit,
    onOpen: (EventCard) -> Unit,
    modifier: Modifier = Modifier,
) {
    val actionableEvents = state.events.filter { event ->
        val label = event.radar?.label
        label != null && label != "NO_ACTION"
    }

    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = RadarGold56,
            background = RadarInk56,
            surface = RadarPanel56,
            surfaceVariant = RadarRaised56,
            onBackground = RadarText56,
            onSurface = RadarText56,
            onSurfaceVariant = RadarMuted56,
            error = RadarRed56,
        ),
    ) {
        Surface(modifier = modifier.fillMaxSize(), color = RadarInk56) {
            Column(Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(start = 22.dp, end = 10.dp, top = 24.dp, bottom = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(color = RadarGold56.copy(alpha = 0.12f), shape = RoundedCornerShape(14.dp), modifier = Modifier.size(48.dp)) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = RadarGold56)
                        }
                    }
                    Spacer(Modifier.width(13.dp))
                    Column(Modifier.weight(1f)) {
                        Text("CINERELAY", color = RadarGold56, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
                        Text("Radar", color = RadarText56, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                        Text("Fresh stories that may be worth covering", color = RadarMuted56, fontSize = 11.sp)
                    }
                    IconButton(onClick = onRefresh, enabled = !state.loading) {
                        if (state.loading) CircularProgressIndicator(Modifier.size(19.dp), strokeWidth = 2.dp, color = RadarGold56)
                        else Icon(Icons.Default.Refresh, contentDescription = "Refresh Radar", tint = RadarMuted56)
                    }
                }

                when {
                    state.loading && state.events.isEmpty() -> {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = RadarGold56, strokeWidth = 2.dp)
                        }
                    }
                    actionableEvents.isEmpty() -> {
                        Column(
                            modifier = Modifier.fillMaxSize().padding(horizontal = 28.dp, vertical = 70.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Surface(color = RadarRaised56, shape = CircleShape, modifier = Modifier.size(62.dp)) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(Icons.Default.TrendingUp, contentDescription = null, tint = RadarGold56, modifier = Modifier.size(30.dp))
                                }
                            }
                            Spacer(Modifier.height(18.dp))
                            Text("Nothing urgent right now", color = RadarText56, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(7.dp))
                            Text(
                                "Radar watches new movie and series updates continuously. Strong opportunities will appear here automatically.",
                                color = RadarMuted56,
                                fontSize = 13.sp,
                                lineHeight = 19.sp,
                            )
                        }
                    }
                    else -> {
                        LazyColumn(
                            contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 8.dp, bottom = 110.dp),
                            verticalArrangement = Arrangement.spacedBy(13.dp),
                        ) {
                            item {
                                Text("Worth a look", color = RadarText56, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                            }
                            items(actionableEvents, key = { it.id }) { event ->
                                RadarOpportunityCardV056(event = event, onClick = { onOpen(event) })
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RadarOpportunityCardV056(event: EventCard, onClick: () -> Unit) {
    val opportunity = friendlyRadarOpportunityV056(event)
    val accent = when (event.radar?.label) {
        "TRAILER_ANALYSIS" -> RadarGold56
        "BREAKING_EXPLAINER" -> RadarRed56
        "SHORT_OPPORTUNITY" -> RadarGreen56
        "FOLLOW_UP_NEEDED" -> RadarAmber56
        else -> RadarMuted56
    }

    Surface(
        color = RadarPanel56,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(accent))
                Spacer(Modifier.width(8.dp))
                Text(opportunity, color = accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                Text(friendlyRadarVerificationV056(event.verificationState), color = RadarMuted56, fontSize = 10.sp)
            }
            event.entityName?.let {
                Text(it, color = RadarGold56, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Text(event.headline, color = RadarText56, fontSize = 17.sp, lineHeight = 23.sp, fontWeight = FontWeight.Bold, maxLines = 3, overflow = TextOverflow.Ellipsis)
            event.summary?.let {
                Text(it, color = RadarMuted56, fontSize = 12.sp, lineHeight = 18.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
            Text(friendlyRadarHintV056(event), color = RadarMuted56, fontSize = 11.sp, lineHeight = 16.sp)
        }
    }
}

private fun friendlyRadarOpportunityV056(event: EventCard): String = when (event.radar?.label) {
    "TRAILER_ANALYSIS" -> "Trailer analysis"
    "BREAKING_EXPLAINER" -> "Worth covering now"
    "SHORT_OPPORTUNITY" -> "Quick Short idea"
    "FOLLOW_UP_NEEDED" -> "Keep watching"
    else -> "Worth a look"
}

private fun friendlyRadarHintV056(event: EventCard): String = when (event.radar?.label) {
    "TRAILER_ANALYSIS" -> "A fresh trailer gives you something concrete to break down."
    "BREAKING_EXPLAINER" -> "This update may be useful for a timely explainer or news post."
    "SHORT_OPPORTUNITY" -> "This looks suited to a quick, self-contained Short or Reel."
    "FOLLOW_UP_NEEDED" -> "The story is still developing; wait for stronger confirmation before treating it as settled."
    else -> "Open the story to see the update and its supporting sources."
}

private fun friendlyRadarVerificationV056(value: String): String = when (value) {
    "OFFICIAL", "CONFIRMED" -> "Official"
    "RELIABLE_REPORT" -> "Reported"
    "DEVELOPING" -> "Developing"
    "RUMOR" -> "Unconfirmed"
    else -> "Update"
}
