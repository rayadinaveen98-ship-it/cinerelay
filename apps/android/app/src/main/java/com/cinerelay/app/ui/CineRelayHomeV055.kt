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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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

private val Home55Ink = Color(0xFF0C0E12)
private val Home55Panel = Color(0xFF171A20)
private val Home55Raised = Color(0xFF20242C)
private val Home55Text = Color(0xFFF5F2EA)
private val Home55Muted = Color(0xFFA8ADB7)
private val Home55Gold = Color(0xFFE8C56D)
private val Home55Green = Color(0xFF73D6A5)
private val Home55Amber = Color(0xFFF0B862)

private data class HomeRailV055(
    val title: String,
    val items: List<NewsroomSignal>,
)

@Composable
fun CineRelayHomeV055(
    state: CineRelayUiState,
    personalization: PersonalizationState,
    onRefresh: () -> Unit,
    onSearch: () -> Unit,
    onOpenUpdate: (NewsroomSignal) -> Unit,
    modifier: Modifier = Modifier,
) {
    val signals = state.homeSignals
    val favoriteSources = remember(personalization) {
        personalization.availableSources.filter { it.identityId in personalization.favoriteSourceIdentityIds }
    }
    val favoriteSignals = remember(signals, favoriteSources) {
        signals.filter { signal -> favoriteSources.any { it.matches(signal) } }
    }
    val heroItems = remember(favoriteSignals) {
        favoriteSignals
            .filter { !it.thumbnailUrl.isNullOrBlank() }
            .take(8)
            .ifEmpty { favoriteSignals.take(8) }
    }
    val rails = remember(signals, favoriteSignals, favoriteSources, personalization.favoriteLanguages) {
        buildHomeRailsV055(signals, favoriteSignals, favoriteSources, personalization.favoriteLanguages)
    }

    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Home55Gold,
            background = Home55Ink,
            surface = Home55Panel,
            surfaceVariant = Home55Raised,
            onBackground = Home55Text,
            onSurface = Home55Text,
            onSurfaceVariant = Home55Muted,
        ),
    ) {
        Surface(modifier = modifier.fillMaxSize(), color = Home55Ink) {
            when {
                state.loading && signals.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Home55Gold, strokeWidth = 2.dp)
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 118.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp),
                    ) {
                        item {
                            HomeHeaderV055(
                                loading = state.loading,
                                onRefresh = onRefresh,
                                onSearch = onSearch,
                            )
                        }

                        item {
                            if (heroItems.isNotEmpty()) {
                                HomeHeroCarouselV055(heroItems = heroItems, onOpenUpdate = onOpenUpdate)
                            } else {
                                HomeHeroEmptyV055(favoriteSources)
                            }
                        }

                        if (state.error != null) {
                            item {
                                Text(
                                    state.error,
                                    color = Home55Amber,
                                    fontSize = 12.sp,
                                    modifier = Modifier.padding(horizontal = 20.dp),
                                )
                            }
                        }

                        if (rails.isEmpty() && !state.loading) {
                            item {
                                Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 30.dp)) {
                                    Text("Nothing new right now", color = Home55Text, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                                    Spacer(Modifier.height(6.dp))
                                    Text("CineRelay is watching your favorite channels and trusted movie sources. New updates will appear here automatically.", color = Home55Muted, fontSize = 13.sp, lineHeight = 19.sp)
                                }
                            }
                        }

                        items(rails, key = { it.title }) { rail ->
                            HomeRailSectionV055(rail = rail, onOpenUpdate = onOpenUpdate)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeHeaderV055(
    loading: Boolean,
    onRefresh: () -> Unit,
    onSearch: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 10.dp, top = 26.dp, bottom = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(45.dp).clip(RoundedCornerShape(14.dp)).background(Home55Gold.copy(alpha = 0.10f)),
            contentAlignment = Alignment.Center,
        ) {
            Text("C", color = Home55Gold, fontSize = 25.sp, fontWeight = FontWeight.Black)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text("CINERELAY", color = Home55Gold, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.7.sp)
            Text("For You", color = Home55Text, fontSize = 25.sp, fontWeight = FontWeight.Bold)
        }
        IconButton(onClick = onSearch) {
            Icon(Icons.Default.Search, contentDescription = "Search CineRelay", tint = Home55Text)
        }
        IconButton(onClick = onRefresh, enabled = !loading) {
            if (loading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = Home55Gold)
            else Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = Home55Muted)
        }
    }
}

@Composable
private fun HomeHeroCarouselV055(
    heroItems: List<NewsroomSignal>,
    onOpenUpdate: (NewsroomSignal) -> Unit,
) {
    var index by remember(heroItems) { mutableIntStateOf(0) }
    LaunchedEffect(heroItems.size) {
        if (heroItems.size <= 1) return@LaunchedEffect
        while (true) {
            delay(5_500)
            index = (index + 1) % heroItems.size
        }
    }
    val item = heroItems[index.coerceIn(0, heroItems.lastIndex)]

    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .aspectRatio(1.55f)
                .clip(RoundedCornerShape(26.dp))
                .background(Home55Raised)
                .clickable { onOpenUpdate(item) },
        ) {
            item.thumbnailUrl?.let {
                AsyncImage(
                    model = it,
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            Box(
                Modifier.fillMaxSize().background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Home55Ink.copy(alpha = 0.22f), Home55Ink.copy(alpha = 0.96f)),
                    ),
                ),
            )
            Column(
                modifier = Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = Home55Gold.copy(alpha = 0.92f), shape = RoundedCornerShape(50)) {
                        Text("FROM YOUR FAVORITES", color = Color(0xFF241C09), fontSize = 9.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp))
                    }
                    Spacer(Modifier.width(8.dp))
                    Text(home55TimeAgo(item.observedAt), color = Home55Text.copy(alpha = 0.78f), fontSize = 10.sp)
                }
                Text(
                    item.title,
                    color = Home55Text,
                    fontSize = 22.sp,
                    lineHeight = 26.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    item.source.name ?: item.source.handle ?: "Favorite channel",
                    color = Home55Muted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (heroItems.size > 1) {
                Row(
                    modifier = Modifier.align(Alignment.TopEnd).padding(14.dp),
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    repeat(heroItems.size) { dot ->
                        Box(
                            Modifier.size(if (dot == index) 15.dp else 6.dp, 6.dp)
                                .clip(CircleShape)
                                .background(if (dot == index) Home55Gold else Home55Text.copy(alpha = 0.42f)),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeHeroEmptyV055(favoriteSources: List<PersonalizationSource>) {
    Surface(
        color = Home55Panel,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text("Your favorites are quiet right now", color = Home55Text, fontSize = 19.sp, fontWeight = FontWeight.Bold)
            Text(
                if (favoriteSources.isEmpty()) "Choose favorite channels to personalize this space."
                else "The next fresh upload from your favorite channels will appear here first.",
                color = Home55Muted,
                fontSize = 13.sp,
                lineHeight = 19.sp,
            )
        }
    }
}

@Composable
private fun HomeRailSectionV055(
    rail: HomeRailV055,
    onOpenUpdate: (NewsroomSignal) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            rail.title,
            color = Home55Text,
            fontSize = 19.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 20.dp),
        )
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(rail.items, key = { "${rail.title}:${it.id}" }) { item ->
                HomeRailCardV055(item = item, onClick = { onOpenUpdate(item) })
            }
        }
    }
}

@Composable
private fun HomeRailCardV055(
    item: NewsroomSignal,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier.width(220.dp).clickable(onClick = onClick),
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Box(
            modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(17.dp)).background(Home55Raised),
        ) {
            if (!item.thumbnailUrl.isNullOrBlank()) {
                AsyncImage(
                    model = item.thumbnailUrl,
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        (item.source.name ?: "CineRelay").take(1).uppercase(),
                        color = Home55Gold,
                        fontSize = 34.sp,
                        fontWeight = FontWeight.Black,
                    )
                }
            }
            Surface(
                color = Home55Ink.copy(alpha = 0.84f),
                shape = RoundedCornerShape(50),
                modifier = Modifier.align(Alignment.BottomStart).padding(8.dp),
            ) {
                Text(
                    home55StateLabel(item.state),
                    color = if (item.state == "VERIFIED") Home55Green else Home55Gold,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                )
            }
        }
        Text(
            item.title,
            color = Home55Text,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            lineHeight = 17.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                item.source.name ?: item.source.handle ?: "CineRelay source",
                color = Home55Muted,
                fontSize = 10.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(7.dp))
            Text(home55TimeAgo(item.observedAt), color = Home55Muted, fontSize = 9.sp)
        }
    }
}

private fun buildHomeRailsV055(
    signals: List<NewsroomSignal>,
    favorites: List<NewsroomSignal>,
    favoriteSources: List<PersonalizationSource>,
    favoriteLanguages: Set<String>,
): List<HomeRailV055> {
    if (signals.isEmpty()) return emptyList()
    val rails = mutableListOf<HomeRailV055>()
    fun add(title: String, items: List<NewsroomSignal>, minimum: Int = 1, limit: Int = 24) {
        val unique = items.distinctBy { it.id }.take(limit)
        if (unique.size >= minimum) rails += HomeRailV055(title, unique)
    }

    add("From Your Favorites", favorites)
    add("Just In", signals.take(24))

    val languageLabels = linkedMapOf(
        "te" to "Latest Telugu Updates",
        "hi" to "Latest Hindi Updates",
        "ta" to "Tamil Cinema",
        "ml" to "Malayalam Cinema",
        "kn" to "Kannada Cinema",
        "en" to "English & International",
    )
    val orderedLanguageCodes = (favoriteLanguages.filter { it in languageLabels.keys } + languageLabels.keys).distinct()
    for (code in orderedLanguageCodes) {
        val items = signals.filter { it.languageCode?.lowercase() == code }
        add(languageLabels.getValue(code), items)
    }

    add("Trailers & Teasers", signals.filter { it.title.hasAnyV055("trailer", "teaser", "glimpse") })
    add("First Looks & Announcements", signals.filter { it.title.hasAnyV055("first look", "poster", "title announcement", "announcement", "launch") })
    add("OTT & Streaming Updates", signals.filter { it.source.role == "OTT_PLATFORM" || it.title.hasAnyV055("ott", "streaming", "digital premiere", "premiere") })
    add("Official Movie Updates", signals.filter { it.source.role in setOf("PRODUCTION_HOUSE", "FILM_OFFICIAL", "CAST_CREW_OFFICIAL") })
    add("Music & Songs", signals.filter { it.source.role == "MUSIC_LABEL" || it.title.hasAnyV055("song", "lyrical", "single", "music video", "jukebox") })
    add("Interviews & Events", signals.filter { it.title.hasAnyV055("interview", "press meet", "event", "pre release", "success meet", "media interaction") })
    add("From the Web", signals.filter { it.source.platform == "WEB" || it.source.platform == "RSS" })

    for (source in favoriteSources) {
        val sourceItems = signals.filter { source.matches(it) }
        add("Latest from ${source.name}", sourceItems, minimum = 2, limit = 16)
    }

    return rails.distinctBy { it.title }
}

private fun PersonalizationSource.matches(signal: NewsroomSignal): Boolean {
    val signalHandle = signal.source.handle?.trim()?.lowercase()
    val favoriteHandle = handle?.trim()?.lowercase()
    if (!favoriteHandle.isNullOrBlank() && signalHandle == favoriteHandle) return true
    return signal.source.name?.trim()?.equals(name.trim(), ignoreCase = true) == true
}

private fun String.hasAnyV055(vararg needles: String): Boolean {
    val haystack = lowercase()
    return needles.any { haystack.contains(it) }
}

private fun home55StateLabel(state: String): String = when (state) {
    "VERIFIED" -> "Official"
    "DEVELOPING" -> "Reported"
    "UNCONFIRMED" -> "Developing"
    "CONFLICT_RUMOR" -> "Unconfirmed"
    else -> "Update"
}

private fun home55TimeAgo(value: String?): String {
    if (value.isNullOrBlank()) return ""
    val then = runCatching { Instant.parse(value) }.getOrNull() ?: return ""
    val duration = Duration.between(then, Instant.now())
    val minutes = duration.toMinutes().coerceAtLeast(0)
    return when {
        minutes < 1 -> "now"
        minutes < 60 -> "${minutes}m"
        minutes < 1_440 -> "${minutes / 60}h"
        minutes < 10_080 -> "${minutes / 1_440}d"
        else -> "${minutes / 10_080}w"
    }
}
