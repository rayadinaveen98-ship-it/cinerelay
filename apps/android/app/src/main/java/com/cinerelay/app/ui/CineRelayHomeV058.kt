package com.cinerelay.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.cinerelay.app.data.NewsroomSignal
import com.cinerelay.app.data.PersonalizationSource
import com.cinerelay.app.data.PersonalizationState
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.Instant

private val Home58Ink = Color(0xFF0C0E12)
private val Home58Panel = Color(0xFF171A20)
private val Home58Raised = Color(0xFF20242C)
private val Home58Text = Color(0xFFF5F2EA)
private val Home58Muted = Color(0xFFA8ADB7)
private val Home58Gold = Color(0xFFE8C56D)
private val Home58Green = Color(0xFF73D6A5)

private data class HomeRailV058(val title: String, val items: List<NewsroomSignal>)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CineRelayHomeV058(
    state: CineRelayUiState,
    personalization: PersonalizationState,
    onRefresh: () -> Unit,
    onSearch: () -> Unit,
    onOpenArchive: () -> Unit,
    onOpenUpdate: (NewsroomSignal) -> Unit,
    modifier: Modifier = Modifier,
) {
    val freshSignals = remember(state.homeSignals) { state.homeSignals.filter(::isFreshHomeSignalV058) }
    val favoriteSources = remember(personalization) {
        personalization.availableSources.filter { it.identityId in personalization.favoriteSourceIdentityIds }
    }
    val favoriteSignals = remember(freshSignals, favoriteSources) {
        freshSignals.filter { signal -> favoriteSources.any { it.matchesV058(signal) } }
    }
    val heroItems = remember(favoriteSignals) {
        favoriteSignals.filter { !it.thumbnailUrl.isNullOrBlank() }.take(8).ifEmpty { favoriteSignals.take(8) }
    }
    val rails = remember(freshSignals, favoriteSignals, favoriteSources, personalization.favoriteLanguages) {
        buildHomeRailsV058(freshSignals, favoriteSignals, favoriteSources, personalization.favoriteLanguages)
    }

    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Home58Gold,
            background = Home58Ink,
            surface = Home58Panel,
            surfaceVariant = Home58Raised,
            onBackground = Home58Text,
            onSurface = Home58Text,
            onSurfaceVariant = Home58Muted,
        ),
    ) {
        PullToRefreshBox(
            isRefreshing = state.loading,
            onRefresh = onRefresh,
            modifier = modifier.fillMaxSize().background(Home58Ink),
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 118.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                item { HomeHeaderV058(state.loading, onRefresh, onSearch) }
                item {
                    if (heroItems.isNotEmpty()) HomeHeroPagerV058(heroItems, onOpenUpdate)
                    else HomeHeroEmptyV058(favoriteSources)
                }
                item { HomeArchiveEntryV058(onOpenArchive) }
                if (state.error != null) {
                    item { Text(state.error, color = Color(0xFFF0B862), fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp)) }
                }
                if (rails.isEmpty() && !state.loading) {
                    item {
                        Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 24.dp)) {
                            Text("You're caught up", color = Home58Text, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(6.dp))
                            Text("Pull down anytime. CineRelay will check your favorites and trusted movie sources for something new.", color = Home58Muted, fontSize = 13.sp, lineHeight = 19.sp)
                        }
                    }
                }
                items(rails, key = { it.title }) { rail -> HomeRailV058(rail, onOpenUpdate) }
            }
        }
    }
}

@Composable
private fun HomeHeaderV058(loading: Boolean, onRefresh: () -> Unit, onSearch: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 10.dp, top = 26.dp, bottom = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(45.dp).clip(RoundedCornerShape(14.dp)).background(Home58Gold.copy(alpha = 0.10f)),
            contentAlignment = Alignment.Center,
        ) { Text("C", color = Home58Gold, fontSize = 25.sp, fontWeight = FontWeight.Black) }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text("CINERELAY", color = Home58Gold, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.7.sp)
            Text("For You", color = Home58Text, fontSize = 25.sp, fontWeight = FontWeight.Bold)
        }
        IconButton(onClick = onSearch) { Icon(Icons.Default.Search, contentDescription = "Search CineRelay", tint = Home58Text) }
        IconButton(onClick = onRefresh, enabled = !loading) {
            if (loading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = Home58Gold)
            else Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = Home58Muted)
        }
    }
}

@Composable
private fun HomeHeroPagerV058(heroItems: List<NewsroomSignal>, onOpenUpdate: (NewsroomSignal) -> Unit) {
    val pagerState = rememberPagerState(initialPage = 0, pageCount = { heroItems.size })
    LaunchedEffect(pagerState.currentPage, heroItems.size) {
        if (heroItems.size <= 1) return@LaunchedEffect
        delay(6_500)
        if (!pagerState.isScrollInProgress) {
            pagerState.animateScrollToPage((pagerState.currentPage + 1) % heroItems.size)
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        HorizontalPager(
            state = pagerState,
            contentPadding = PaddingValues(horizontal = 16.dp),
            pageSpacing = 10.dp,
            beyondViewportPageCount = 1,
        ) { page ->
            val item = heroItems[page]
            Box(
                modifier = Modifier.fillMaxWidth().aspectRatio(1.68f).clip(RoundedCornerShape(26.dp)).background(Home58Raised).clickable { onOpenUpdate(item) },
            ) {
                if (!item.thumbnailUrl.isNullOrBlank()) {
                    AsyncImage(model = item.thumbnailUrl, contentDescription = item.title, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                }
                Box(
                    Modifier.fillMaxSize().background(
                        Brush.verticalGradient(listOf(Color.Transparent, Color.Transparent, Home58Ink.copy(alpha = 0.92f))),
                    ),
                )
                Column(
                    modifier = Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(horizontal = 18.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    Text(
                        item.source.name ?: item.source.handle ?: "Favorite channel",
                        color = Home58Gold,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(item.title, color = Home58Text, fontSize = 19.sp, lineHeight = 23.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(home58TimeAgo(item.observedAt), color = Home58Text.copy(alpha = 0.68f), fontSize = 10.sp)
                }
            }
        }
        if (heroItems.size > 1) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                repeat(heroItems.size) { dot ->
                    Box(
                        Modifier.padding(horizontal = 3.dp).size(if (dot == pagerState.currentPage) 18.dp else 6.dp, 5.dp)
                            .clip(CircleShape)
                            .background(if (dot == pagerState.currentPage) Home58Gold else Home58Muted.copy(alpha = 0.42f)),
                    )
                }
            }
        }
    }
}

@Composable
private fun HomeHeroEmptyV058(favoriteSources: List<PersonalizationSource>) {
    Surface(color = Home58Panel, shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text("Your favorites are quiet right now", color = Home58Text, fontSize = 19.sp, fontWeight = FontWeight.Bold)
            Text(if (favoriteSources.isEmpty()) "Choose favorite channels to personalize this space." else "The next fresh upload from your favorite channels will appear here first.", color = Home58Muted, fontSize = 13.sp)
        }
    }
}

@Composable
private fun HomeArchiveEntryV058(onOpenArchive: () -> Unit) {
    Surface(
        color = Home58Panel,
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).clickable(onClick = onOpenArchive),
    ) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(color = Home58Gold.copy(alpha = 0.12f), shape = RoundedCornerShape(12.dp), modifier = Modifier.size(38.dp)) {
                Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.Archive, contentDescription = null, tint = Home58Gold, modifier = Modifier.size(20.dp)) }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text("Archive", color = Home58Text, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Text("Updates older than 24h · last 90 days", color = Home58Muted, fontSize = 10.sp)
            }
            Text("Open", color = Home58Gold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun HomeRailV058(rail: HomeRailV058, onOpenUpdate: (NewsroomSignal) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(rail.title, color = Home58Text, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 20.dp))
        LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            items(rail.items, key = { "${rail.title}:${it.id}" }) { item -> HomeCardV058(item) { onOpenUpdate(item) } }
        }
    }
}

@Composable
private fun HomeCardV058(item: NewsroomSignal, onClick: () -> Unit) {
    Column(modifier = Modifier.width(220.dp).clickable(onClick = onClick), verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(17.dp)).background(Home58Raised)) {
            if (!item.thumbnailUrl.isNullOrBlank()) {
                AsyncImage(model = item.thumbnailUrl, contentDescription = item.title, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            }
            Surface(color = Home58Ink.copy(alpha = 0.84f), shape = RoundedCornerShape(50), modifier = Modifier.align(Alignment.BottomStart).padding(8.dp)) {
                Text(home58StateLabel(item.state), color = if (item.state == "VERIFIED") Home58Green else Home58Gold, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
            }
        }
        Text(item.title, color = Home58Text, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, lineHeight = 17.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(item.source.name ?: item.source.handle ?: "CineRelay", color = Home58Muted, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Spacer(Modifier.width(7.dp))
            Text(home58TimeAgo(item.observedAt), color = Home58Muted, fontSize = 9.sp)
        }
    }
}

private fun buildHomeRailsV058(
    signals: List<NewsroomSignal>,
    favorites: List<NewsroomSignal>,
    favoriteSources: List<PersonalizationSource>,
    favoriteLanguages: Set<String>,
): List<HomeRailV058> {
    if (signals.isEmpty()) return emptyList()
    val rails = mutableListOf<HomeRailV058>()
    fun add(title: String, items: List<NewsroomSignal>, minimum: Int = 1, limit: Int = 24) {
        val unique = items.distinctBy { it.id }.take(limit)
        if (unique.size >= minimum) rails += HomeRailV058(title, unique)
    }
    add("From Your Favorites", favorites)
    add("Just In", signals.take(24))
    val labels = linkedMapOf(
        "te" to "Latest Telugu Updates",
        "hi" to "Latest Hindi Updates",
        "ta" to "Tamil Cinema",
        "ml" to "Malayalam Cinema",
        "kn" to "Kannada Cinema",
        "en" to "English & International",
    )
    val languageOrder = (favoriteLanguages.filter { it in labels.keys } + labels.keys).distinct()
    for (code in languageOrder) add(labels.getValue(code), signals.filter { it.languageCode?.lowercase() == code })
    add("Trailers & Teasers", signals.filter { it.title.hasAnyV058("trailer", "teaser", "glimpse") })
    add("First Looks & Announcements", signals.filter { it.title.hasAnyV058("first look", "poster", "announcement", "launch") })
    add("OTT & Streaming Updates", signals.filter { it.source.role == "OTT_PLATFORM" || it.title.hasAnyV058("ott", "streaming", "digital premiere", "premiere") })
    add("Official Movie Updates", signals.filter { it.source.role in setOf("PRODUCTION_HOUSE", "FILM_OFFICIAL", "CAST_CREW_OFFICIAL") })
    add("Music & Songs", signals.filter { it.source.role == "MUSIC_LABEL" || it.title.hasAnyV058("song", "lyrical", "single", "music video", "jukebox") })
    add("Interviews & Events", signals.filter { it.title.hasAnyV058("interview", "press meet", "event", "pre release", "success meet") })
    add("From the Web", signals.filter { it.source.platform == "WEB" || it.source.platform == "RSS" })
    for (source in favoriteSources) add("Latest from ${source.name}", signals.filter { source.matchesV058(it) }, minimum = 2, limit = 16)
    return rails.distinctBy { it.title }
}

private fun PersonalizationSource.matchesV058(signal: NewsroomSignal): Boolean {
    val signalHandle = signal.source.handle?.trim()?.lowercase()
    val favoriteHandle = handle?.trim()?.lowercase()
    if (!favoriteHandle.isNullOrBlank() && signalHandle == favoriteHandle) return true
    return signal.source.name?.trim()?.equals(name.trim(), ignoreCase = true) == true
}

private fun String.hasAnyV058(vararg needles: String): Boolean {
    val value = lowercase()
    return needles.any(value::contains)
}

private fun isFreshHomeSignalV058(signal: NewsroomSignal): Boolean {
    val timestamp = signal.observedAt ?: signal.ingestedAt ?: return true
    val instant = runCatching { Instant.parse(timestamp) }.getOrNull() ?: return true
    return Duration.between(instant, Instant.now()).toHours() < 24
}

private fun home58StateLabel(state: String): String = when (state) {
    "VERIFIED" -> "Official"
    "DEVELOPING" -> "Reported"
    "UNCONFIRMED" -> "Developing"
    "CONFLICT_RUMOR" -> "Unconfirmed"
    else -> "Update"
}

private fun home58TimeAgo(value: String?): String {
    val then = value?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return ""
    val minutes = Duration.between(then, Instant.now()).toMinutes().coerceAtLeast(0)
    return when {
        minutes < 1 -> "now"
        minutes < 60 -> "${minutes}m"
        minutes < 1_440 -> "${minutes / 60}h"
        else -> "${minutes / 1_440}d"
    }
}
