package com.cinerelay.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cinerelay.app.data.NewsroomSignal
import com.cinerelay.app.data.SourceDirectoryItem
import java.time.Duration
import java.time.Instant

private val SourcesInk = Color(0xFF0D0F13)
private val SourcesPanel = Color(0xFF15181E)
private val SourcesPanelRaised = Color(0xFF1B1F27)
private val SourcesLine = Color(0xFF2A303A)
private val SourcesText = Color(0xFFF4F1EA)
private val SourcesMuted = Color(0xFFA7ADB7)
private val SourcesGold = Color(0xFFE7C36B)
private val SourcesGreen = Color(0xFF72D6A4)
private val SourcesAmber = Color(0xFFF0B862)
private val SourcesRed = Color(0xFFF08079)
private val SourcesBlue = Color(0xFF8CB9FF)

@Composable
fun SourcesDirectoryV039(
    state: SourcesUiState,
    onRefresh: () -> Unit,
    onOpenSource: (SourceDirectoryItem) -> Unit,
    onCloseSource: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(modifier = modifier.fillMaxSize(), color = SourcesInk) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding(),
        ) {
            SourcesTopBar(
                state = state,
                onRefresh = onRefresh,
                onBack = onCloseSource,
            )

            state.error?.let { message ->
                Surface(
                    color = SourcesRed.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                        .fillMaxWidth(),
                ) {
                    Text(
                        message,
                        color = SourcesRed,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
                    )
                }
            }

            if (state.selectedSource == null) {
                SourcesDirectoryList(state = state, onOpenSource = onOpenSource)
            } else {
                SourceDetailFeed(
                    source = state.selectedSource,
                    signals = state.selectedSignals,
                    loading = state.loading,
                )
            }
        }
    }
}

@Composable
private fun SourcesTopBar(
    state: SourcesUiState,
    onRefresh: () -> Unit,
    onBack: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (state.selectedSource != null) {
            IconButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back to sources", tint = SourcesText)
            }
        } else {
            SourceBrandMark()
            Spacer(Modifier.width(10.dp))
        }

        Column(Modifier.weight(1f)) {
            Text(
                "CINERELAY",
                color = SourcesGold,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.4.sp,
            )
            Text(
                state.selectedSource?.name ?: "Sources",
                color = SourcesText,
                fontSize = if (state.selectedSource == null) 22.sp else 18.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (state.selectedSource != null) {
                Text(
                    listOfNotNull(
                        state.selectedSource.handle,
                        prettySourceRole(state.selectedSource.role),
                    ).joinToString(" • "),
                    color = SourcesMuted,
                    fontSize = 10.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        IconButton(onClick = onRefresh, enabled = !state.loading) {
            if (state.loading) {
                CircularProgressIndicator(Modifier.size(19.dp), strokeWidth = 2.dp, color = SourcesGold)
            } else {
                Icon(Icons.Default.Refresh, contentDescription = "Refresh sources", tint = SourcesMuted)
            }
        }
    }
}

@Composable
private fun SourceBrandMark() {
    Surface(
        shape = RoundedCornerShape(13.dp),
        color = SourcesGold.copy(alpha = 0.12f),
        modifier = Modifier.size(40.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text("CR", color = SourcesGold, fontSize = 12.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
private fun SourcesDirectoryList(
    state: SourcesUiState,
    onOpenSource: (SourceDirectoryItem) -> Unit,
) {
    if (!state.loading && state.sources.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 32.dp, vertical = 80.dp),
            contentAlignment = Alignment.TopCenter,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    if (state.platform == NewsroomPlatform.X) "No active X sources" else "No sources available",
                    color = SourcesText,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    if (state.platform == NewsroomPlatform.X)
                        "X is intentionally dormant. Switch back to YouTube for the active newsroom source directory."
                    else
                        "CineRelay could not find an active source directory for this platform.",
                    color = SourcesMuted,
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                )
            }
        }
        return
    }

    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 160.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item { SourcesSummaryCard(state) }
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp, bottom = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("OFFICIAL SOURCES", color = SourcesMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.2.sp)
                Spacer(Modifier.weight(1f))
                Text("Recent activity first", color = SourcesMuted, fontSize = 9.sp)
            }
        }
        items(state.sources, key = { it.identityId }) { source ->
            SourceRow(source = source, onClick = { onOpenSource(source) })
        }
    }
}

@Composable
private fun SourcesSummaryCard(state: SourcesUiState) {
    Surface(
        color = SourcesPanelRaised,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                if (state.platform == NewsroomPlatform.YOUTUBE) "YouTube source desk" else "X source desk",
                color = SourcesText,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "${state.sourceCount} official sources • ${state.activeInLast24h} active in the last 24h",
                color = SourcesMuted,
                fontSize = 11.sp,
            )
            Spacer(Modifier.height(13.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MetricPill(label = "Sources", value = state.sourceCount.toString())
                MetricPill(label = "Active 24h", value = state.activeInLast24h.toString())
                MetricPill(label = "New posts", value = state.newItems24h.toString())
            }
        }
    }
}

@Composable
private fun RowScope.MetricPill(label: String, value: String) {
    Surface(
        color = SourcesInk.copy(alpha = 0.6f),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.weight(1f),
    ) {
        Column(Modifier.padding(horizontal = 10.dp, vertical = 9.dp)) {
            Text(value, color = SourcesGold, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Text(label, color = SourcesMuted, fontSize = 9.sp)
        }
    }
}

@Composable
private fun SourceRow(source: SourceDirectoryItem, onClick: () -> Unit) {
    Surface(
        color = SourcesPanel,
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SourceAvatar(source.name)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    source.name,
                    color = SourcesText,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    listOfNotNull(source.handle, prettySourceRole(source.role)).joinToString(" • "),
                    color = SourcesMuted,
                    fontSize = 10.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            if (source.newCount24h > 0) {
                Surface(
                    color = SourcesGreen.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(50),
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.size(6.dp).clip(CircleShape).background(SourcesGreen))
                        Spacer(Modifier.width(6.dp))
                        Text(
                            "${source.newCount24h} new",
                            color = SourcesGreen,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                Spacer(Modifier.width(4.dp))
            }

            Icon(Icons.Default.KeyboardArrowRight, contentDescription = null, tint = SourcesMuted, modifier = Modifier.size(20.dp))
        }
    }
}

@Composable
private fun SourceAvatar(name: String) {
    val initials = name
        .split(' ')
        .filter { it.isNotBlank() }
        .take(2)
        .joinToString("") { it.take(1).uppercase() }
        .ifBlank { "CR" }

    Surface(
        shape = CircleShape,
        color = SourcesGold.copy(alpha = 0.11f),
        modifier = Modifier.size(42.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(initials, color = SourcesGold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun SourceDetailFeed(
    source: SourceDirectoryItem,
    signals: List<NewsroomSignal>,
    loading: Boolean,
) {
    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 160.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { SourceDetailHeader(source) }

        if (!loading && signals.isEmpty()) {
            item {
                Surface(
                    color = SourcesPanel,
                    shape = RoundedCornerShape(18.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(18.dp)) {
                        Text("No recent newsroom items", color = SourcesText, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(5.dp))
                        Text(
                            "This source is active in CineRelay, but none of its recent tracked items are in the current newsroom window.",
                            color = SourcesMuted,
                            fontSize = 11.sp,
                            lineHeight = 17.sp,
                        )
                    }
                }
            }
        } else {
            items(signals, key = { it.id }) { signal -> SourceNewsroomCard(signal) }
        }
    }
}

@Composable
private fun SourceDetailHeader(source: SourceDirectoryItem) {
    Surface(
        color = SourcesPanelRaised,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SourceAvatar(source.name)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(source.name, color = SourcesText, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                Text(
                    listOfNotNull(source.handle, prettySourceRole(source.role)).joinToString(" • "),
                    color = SourcesMuted,
                    fontSize = 10.sp,
                )
                source.latestObservedAt?.let {
                    Text("Latest activity ${sourceTimeAgo(it)}", color = SourcesMuted, fontSize = 9.sp)
                }
            }
            if (source.newCount24h > 0) {
                Surface(color = SourcesGreen.copy(alpha = 0.12f), shape = RoundedCornerShape(50)) {
                    Text(
                        "${source.newCount24h} new / 24h",
                        color = SourcesGreen,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 6.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun SourceNewsroomCard(signal: NewsroomSignal) {
    val context = LocalContext.current
    Card(
        colors = CardDefaults.cardColors(containerColor = SourcesPanel),
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(15.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SourceStateBadge(signal.state)
                Spacer(Modifier.width(8.dp))
                Text(
                    signal.source.name ?: signal.source.handle ?: "CineRelay source",
                    color = SourcesGold,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(sourceTimeAgo(signal.observedAt), color = SourcesMuted, fontSize = 9.sp)
            }

            Spacer(Modifier.height(12.dp))
            Text(signal.title, color = SourcesText, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, lineHeight = 23.sp)
            signal.text?.takeIf { it.isNotBlank() && it.trim() != signal.title.trim() }?.let { body ->
                Spacer(Modifier.height(7.dp))
                Text(body, color = SourcesMuted, fontSize = 11.sp, lineHeight = 17.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }

            signal.canonicalEvent?.let { event ->
                Spacer(Modifier.height(10.dp))
                Surface(color = SourcesGold.copy(alpha = 0.07f), shape = RoundedCornerShape(12.dp)) {
                    Column(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp)) {
                        Text("CANONICAL", color = SourcesGold, fontSize = 8.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.7.sp)
                        Text(event.entityName ?: event.headline, color = SourcesText, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(Modifier.height(11.dp))
            HorizontalDivider(color = SourcesLine)
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    listOfNotNull(signal.mediaType, signal.languageCode).joinToString(" • ").ifBlank { "Official source activity" },
                    color = SourcesMuted,
                    fontSize = 9.sp,
                    modifier = Modifier.weight(1f),
                )
                signal.canonicalUrl?.let { url ->
                    TextButton(
                        onClick = {
                            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                        },
                    ) {
                        Icon(Icons.Default.OpenInNew, contentDescription = null, modifier = Modifier.size(14.dp), tint = SourcesGold)
                        Spacer(Modifier.width(4.dp))
                        Text("Open", color = SourcesGold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun SourceStateBadge(state: String) {
    val color = when (state) {
        "VERIFIED" -> SourcesGreen
        "DEVELOPING" -> SourcesAmber
        "UNCONFIRMED" -> SourcesBlue
        else -> SourcesRed
    }
    Surface(color = color.copy(alpha = 0.11f), shape = RoundedCornerShape(50)) {
        Text(
            state.replace('_', ' '),
            color = color,
            fontSize = 8.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 7.dp, vertical = 4.dp),
        )
    }
}

private fun prettySourceRole(role: String?): String? = when (role) {
    "PRODUCTION_HOUSE" -> "Production"
    "OTT_PLATFORM" -> "OTT"
    "MUSIC_LABEL" -> "Music"
    "MEDIA_LIBRARY" -> "Media"
    null, "" -> null
    else -> role.lowercase().replace('_', ' ').replaceFirstChar { it.uppercase() }
}

private fun sourceTimeAgo(value: String?): String {
    if (value.isNullOrBlank()) return ""
    return runCatching {
        val duration = Duration.between(Instant.parse(value), Instant.now())
        when {
            duration.isNegative -> "now"
            duration.toMinutes() < 1 -> "now"
            duration.toMinutes() < 60 -> "${duration.toMinutes()}m ago"
            duration.toHours() < 24 -> "${duration.toHours()}h ago"
            duration.toDays() < 7 -> "${duration.toDays()}d ago"
            else -> "${duration.toDays() / 7}w ago"
        }
    }.getOrDefault("")
}
