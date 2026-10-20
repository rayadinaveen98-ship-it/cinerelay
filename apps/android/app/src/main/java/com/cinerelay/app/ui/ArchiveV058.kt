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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.cinerelay.app.data.ConsumerUpdate
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val ArchiveInk58 = CineEditorial.Background
private val ArchivePanel58 = CineEditorial.Surface
private val ArchiveRaised58 = CineEditorial.Raised
private val ArchiveText58 = CineEditorial.Text
private val ArchiveMuted58 = CineEditorial.Muted
private val ArchiveGold58 = CineEditorial.Accent

@Composable
fun ArchiveV058(
    state: ArchiveUiStateV058,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onQueryChange: (String) -> Unit,
    onLoadMore: () -> Unit,
    onOpen: (ConsumerUpdate) -> Unit,
    modifier: Modifier = Modifier,
) {
    val filtered = remember(state.items, state.query) {
        val query = state.query.trim().lowercase()
        if (query.isBlank()) state.items else state.items.filter {
            it.title.lowercase().contains(query) ||
                it.source.name?.lowercase()?.contains(query) == true ||
                it.languageCode?.lowercase()?.contains(query) == true
        }
    }

    MaterialTheme(colorScheme = darkColorScheme(background = ArchiveInk58, surface = ArchivePanel58, primary = ArchiveGold58)) {
        Surface(modifier.fillMaxSize(), color = ArchiveInk58) {
            Column(Modifier.fillMaxSize()) {
                CineScreenHeader(
                    title = "Archive",
                    subtitle = "Updates from the last ${state.retentionDays} days",
                    onBack = onBack,
                    actions = {
                        IconButton(onClick = onRefresh, enabled = !state.loading) {
                            if (state.loading) CircularProgressIndicator(Modifier.size(18.dp),
                                strokeWidth = 2.dp, color = ArchiveGold58)
                            else Icon(Icons.Default.Refresh, contentDescription = "Refresh archive", tint = ArchiveMuted58)
                        }
                    },
                )

                OutlinedTextField(
                    value = state.query,
                    onValueChange = onQueryChange,
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    placeholder = { Text("Search archived updates") },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = CineEditorial.Gutter, vertical = 8.dp),
                )

                when {
                    state.loading && state.items.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = ArchiveGold58)
                    }
                    filtered.isEmpty() -> Column(
                        Modifier.fillMaxSize().padding(28.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Icon(Icons.Default.Archive, contentDescription = null, tint = ArchiveGold58, modifier = Modifier.size(44.dp))
                        Spacer(Modifier.height(14.dp))
                        Text("No archived updates found", color = ArchiveText58, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(6.dp))
                        Text("Home keeps the latest 24 hours. Older updates stay here for up to ${state.retentionDays} days.", color = ArchiveMuted58, fontSize = 12.sp)
                    }
                    else -> LazyColumn(
                        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 8.dp, bottom = 110.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(filtered, key = { it.id }) { item -> ArchiveCardV058(item, onClick = { onOpen(item) }) }
                        if (state.hasMore && state.query.isBlank()) {
                            item {
                                Surface(
                                    color = ArchiveRaised58,
                                    shape = RoundedCornerShape(CineEditorial.CardRadius),
                                    modifier = Modifier.fillMaxWidth().clickable(enabled = !state.loadingMore) { onLoadMore() },
                                ) {
                                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                                        if (state.loadingMore) CircularProgressIndicator(Modifier.size(17.dp), strokeWidth = 2.dp, color = ArchiveGold58)
                                        else Text("Load more", color = ArchiveGold58, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ArchiveCardV058(item: ConsumerUpdate, onClick: () -> Unit) {
    Surface(
        color = ArchivePanel58,
        shape = RoundedCornerShape(CineEditorial.CardRadius),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(13.dp)) {
            EditorialArtworkV2(
                url = item.thumbnailUrl,
                title = item.title,
                modifier = Modifier.width(108.dp).height(72.dp),
            )
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                EditorialDisplayV2(item.title, size = 15, lines = 2)
                Text(item.source.name ?: "CineRelay source",
                    color = ArchiveMuted58, fontSize = CineEditorial.Metadata, maxLines = 1,
                    overflow = TextOverflow.Ellipsis)
                Text(archiveDateV058(item.observedAt),
                    color = ArchiveGold58, fontSize = CineEditorial.Metadata)
            }
        }
    }
}

private fun archiveDateV058(value: String?): String {
    val instant = value?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return ""
    return DateTimeFormatter.ofPattern("dd MMM yyyy · h:mm a")
        .withZone(ZoneId.of("Asia/Kolkata"))
        .format(instant)
}
