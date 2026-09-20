package com.cinerelay.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.collectIsDraggedAsState
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
import java.util.Locale
import kotlin.math.abs

private val Home58Ink = Color(0xFF0C0E12)
private val Home58Panel = Color(0xFF171A20)
private val Home58Raised = Color(0xFF20242C)
private val Home58Text = Color(0xFFF5F2EA)
private val Home58Muted = Color(0xFFA8ADB7)
private val Home58Gold = Color(0xFFE8C56D)
private val Home58Green = Color(0xFF73D6A5)

private data class HomeStoryV059(
    val key: String,
    val representative: NewsroomSignal,
    val updates: List<NewsroomSignal>,
    val sourceCount: Int,
    val officialSourceCount: Int,
)

private data class HomeRailV058(val title: String, val items: List<HomeStoryV059>)

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
    val freshStories = remember(freshSignals) { clusterHomeStoriesV059(freshSignals) }
    val favoriteSources = remember(personalization) {
        personalization.availableSources.filter { it.identityId in personalization.favoriteSourceIdentityIds }
    }
    val favoriteSignals = remember(freshSignals, favoriteSources) {
        freshSignals.filter { signal -> favoriteSources.any { it.matchesV058(signal) } }
    }
    val favoriteStories = remember(favoriteSignals) { clusterHomeStoriesV059(favoriteSignals) }
    val heroItems = remember(favoriteStories) {
        favoriteStories.map { it.representative }
            .filter { !it.thumbnailUrl.isNullOrBlank() }
            .take(8)
            .ifEmpty { favoriteStories.map { it.representative }.take(8) }
    }
    val rails = remember(freshStories, favoriteStories, favoriteSources, personalization.favoriteLanguages) {
        buildHomeRailsV059(freshStories, favoriteStories, favoriteSources, personalization.favoriteLanguages)
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
    val isDragged by pagerState.interactionSource.collectIsDraggedAsState()

    LaunchedEffect(heroItems.size, isDragged) {
        if (heroItems.size <= 1 || isDragged) return@LaunchedEffect
        while (true) {
            delay(6_500)
            if (pagerState.isScrollInProgress) continue
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
            items(rail.items, key = { "${rail.title}:${it.key}" }) { story -> HomeCardV059(story) { onOpenUpdate(story.representative) } }
        }
    }
}

@Composable
private fun HomeCardV059(story: HomeStoryV059, onClick: () -> Unit) {
    val item = story.representative
    Column(modifier = Modifier.width(220.dp).clickable(onClick = onClick), verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(17.dp)).background(Home58Raised)) {
            if (!item.thumbnailUrl.isNullOrBlank()) {
                AsyncImage(model = item.thumbnailUrl, contentDescription = item.title, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            }
            Surface(color = Home58Ink.copy(alpha = 0.84f), shape = RoundedCornerShape(50), modifier = Modifier.align(Alignment.BottomStart).padding(8.dp)) {
                Text(home58StateLabel(item.state), color = if (item.state == "VERIFIED") Home58Green else Home58Gold, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
            }
            if (story.sourceCount > 1) {
                Surface(color = Home58Ink.copy(alpha = 0.88f), shape = RoundedCornerShape(50), modifier = Modifier.align(Alignment.TopEnd).padding(8.dp)) {
                    Text("${story.sourceCount} sources", color = Home58Text, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                }
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

private fun buildHomeRailsV059(
    stories: List<HomeStoryV059>,
    favorites: List<HomeStoryV059>,
    favoriteSources: List<PersonalizationSource>,
    favoriteLanguages: Set<String>,
): List<HomeRailV058> {
    if (stories.isEmpty()) return emptyList()
    val rails = mutableListOf<HomeRailV058>()
    fun add(title: String, items: List<HomeStoryV059>, minimum: Int = 1, limit: Int = 24) {
        val unique = items.distinctBy { it.key }.take(limit)
        if (unique.size >= minimum) rails += HomeRailV058(title, unique)
    }

    add("From Your Favorites", favorites)
    add(
        "Trending Across Sources",
        stories.filter { it.sourceCount >= 2 }
            .sortedWith(compareByDescending<HomeStoryV059> { it.sourceCount }.thenByDescending { homeSignalInstantV059(it.representative) }),
    )
    add("Just In", stories.take(24))

    val labels = linkedMapOf(
        "te" to "Latest Telugu Updates",
        "hi" to "Latest Hindi Updates",
        "ta" to "Tamil Cinema",
        "ml" to "Malayalam Cinema",
        "kn" to "Kannada Cinema",
        "en" to "English & International",
    )
    val languageOrder = (favoriteLanguages.filter { it in labels.keys } + labels.keys).distinct()
    for (code in languageOrder) add(labels.getValue(code), stories.filter { story -> story.updates.any { it.languageCode?.lowercase() == code } })

    add("Trailers & Teasers", stories.filter { it.hasAnyTitleV059("trailer", "teaser", "glimpse") })
    add("First Looks & Announcements", stories.filter { it.hasAnyTitleV059("first look", "poster", "announcement", "launch") })
    add("OTT & Streaming Updates", stories.filter { story -> story.updates.any { it.source.role == "OTT_PLATFORM" } || story.hasAnyTitleV059("ott", "streaming", "digital premiere", "premiere") })
    add("Official Movie Updates", stories.filter { story -> story.updates.any { it.source.role in setOf("PRODUCTION_HOUSE", "FILM_OFFICIAL", "CAST_CREW_OFFICIAL") } })
    add("Music & Songs", stories.filter { story -> story.updates.any { it.source.role == "MUSIC_LABEL" } || story.hasAnyTitleV059("song", "lyrical", "single", "music video", "jukebox") })
    add("Interviews & Events", stories.filter { it.hasAnyTitleV059("interview", "press meet", "event", "pre release", "success meet") })
    add("From the Web", stories.filter { story -> story.updates.any { it.source.platform == "WEB" || it.source.platform == "RSS" } })

    for (source in favoriteSources) {
        val sourceStories = stories.mapNotNull { story ->
            val matching = story.updates.filter { source.matchesV058(it) }
            if (matching.isEmpty()) null else story.copy(representative = bestHomeRepresentativeV059(matching))
        }
        add("Latest from ${source.name}", sourceStories, minimum = 2, limit = 16)
    }
    return rails.distinctBy { it.title }
}

private fun clusterHomeStoriesV059(signals: List<NewsroomSignal>): List<HomeStoryV059> {
    if (signals.isEmpty()) return emptyList()
    val ordered = signals.distinctBy { it.id }.sortedByDescending(::homeSignalInstantV059)
    val clusters = mutableListOf<MutableList<NewsroomSignal>>()

    for (signal in ordered) {
        val index = clusters.indexOfFirst { existing ->
            existing.isNotEmpty() && shouldShareHomeStoryV059(signal, bestHomeRepresentativeV059(existing))
        }
        if (index >= 0) clusters[index].add(signal) else clusters += mutableListOf(signal)
    }

    return clusters.map { cluster ->
        val representative = bestHomeRepresentativeV059(cluster)
        val sourceKeys = cluster.map(::homeSourceKeyV059).filter { it.isNotBlank() }.toSet()
        val officialKeys = cluster.filter { (it.source.authorityTier ?: 99) <= 1 }.map(::homeSourceKeyV059).filter { it.isNotBlank() }.toSet()
        val eventId = cluster.mapNotNull { it.canonicalEvent?.id?.takeIf(String::isNotBlank) }.firstOrNull()
        HomeStoryV059(
            key = eventId?.let { "event:$it" } ?: "story:${cluster.map { it.id }.sorted().first()}",
            representative = representative,
            updates = cluster.sortedByDescending(::homeSignalInstantV059),
            sourceCount = sourceKeys.size.coerceAtLeast(1),
            officialSourceCount = officialKeys.size,
        )
    }.sortedByDescending { homeSignalInstantV059(it.representative) }
}

private fun shouldShareHomeStoryV059(left: NewsroomSignal, right: NewsroomSignal): Boolean {
    val leftEvent = left.canonicalEvent?.id?.takeIf(String::isNotBlank)
    val rightEvent = right.canonicalEvent?.id?.takeIf(String::isNotBlank)
    if (leftEvent != null && rightEvent != null) return leftEvent == rightEvent

    val leftInstant = homeSignalInstantV059(left)
    val rightInstant = homeSignalInstantV059(right)
    if (leftInstant != Instant.EPOCH && rightInstant != Instant.EPOCH) {
        if (abs(Duration.between(leftInstant, rightInstant).toMinutes()) > 18L * 60L) return false
    }

    val leftLanguages = explicitHomeLanguagesV059(left.title)
    val rightLanguages = explicitHomeLanguagesV059(right.title)
    if (leftLanguages.isNotEmpty() && rightLanguages.isNotEmpty() && leftLanguages.intersect(rightLanguages).isEmpty()) return false

    val normalizedLeft = normalizedHomeStoryTitleV059(left.title)
    val normalizedRight = normalizedHomeStoryTitleV059(right.title)
    if (normalizedLeft.length >= 12 && normalizedLeft == normalizedRight) return true

    val leftKind = homeStoryKindV059(left.title)
    val rightKind = homeStoryKindV059(right.title)
    if (leftKind != rightKind && leftKind != "GENERAL" && rightKind != "GENERAL") return false

    val leftTokens = homeStoryTokensV059(left.title)
    val rightTokens = homeStoryTokensV059(right.title)
    if (leftTokens.size < 2 || rightTokens.size < 2) return false
    val shared = leftTokens.intersect(rightTokens)
    val union = leftTokens.union(rightTokens)
    if (union.isEmpty()) return false
    val similarity = shared.size.toDouble() / union.size.toDouble()
    val strongAnchor = shared.any { it.length >= 5 && it !in HOME59_GENERIC_TOKENS }
    if (!strongAnchor) return false

    return if (leftKind == rightKind) {
        shared.size >= 3 && similarity >= 0.34
    } else {
        shared.size >= 4 && similarity >= 0.46
    }
}

private fun bestHomeRepresentativeV059(items: List<NewsroomSignal>): NewsroomSignal =
    items.maxWithOrNull(
        compareBy<NewsroomSignal> { homeRepresentativeScoreV059(it) }
            .thenBy { homeSignalInstantV059(it) },
    ) ?: items.first()

private fun homeRepresentativeScoreV059(signal: NewsroomSignal): Int {
    var score = 0
    if (!signal.thumbnailUrl.isNullOrBlank()) score += 15
    if (signal.state == "VERIFIED") score += 35
    if (signal.canonicalEvent != null) score += 20
    when (signal.canonicalEvent?.verificationState) {
        "OFFICIAL", "CONFIRMED" -> score += 35
        "RELIABLE_REPORT", "DEVELOPING" -> score += 12
    }
    score += when (signal.source.authorityTier) {
        1 -> 80
        2 -> 50
        3 -> 25
        4 -> 8
        else -> 0
    }
    if (signal.source.role in HOME59_FIRST_PARTY_ROLES) score += 20
    return score
}

private fun homeSignalInstantV059(signal: NewsroomSignal): Instant {
    val value = signal.observedAt ?: signal.ingestedAt ?: signal.sourceObservedAt ?: return Instant.EPOCH
    return runCatching { Instant.parse(value) }.getOrDefault(Instant.EPOCH)
}

private fun homeSourceKeyV059(signal: NewsroomSignal): String = listOfNotNull(
    signal.source.platform,
    signal.source.handle,
    signal.source.name,
).joinToString("|").trim().lowercase(Locale.ROOT)

private fun HomeStoryV059.hasAnyTitleV059(vararg needles: String): Boolean = updates.any { it.title.hasAnyV058(*needles) }

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

private fun normalizedHomeStoryTitleV059(title: String): String = title
    .lowercase(Locale.ROOT)
    .replace(Regex("[^\\p{L}\\p{N}]+"), " ")
    .trim()
    .replace(Regex("\\s+"), " ")

private fun homeStoryTokensV059(title: String): Set<String> = normalizedHomeStoryTitleV059(title)
    .split(' ')
    .asSequence()
    .map(String::trim)
    .filter { it.length >= 3 }
    .filterNot { it in HOME59_STOP_TOKENS }
    .toSet()

private fun explicitHomeLanguagesV059(title: String): Set<String> {
    val normalized = normalizedHomeStoryTitleV059(title)
    return HOME59_LANGUAGE_MARKERS.filterValues { markers -> markers.any { marker -> Regex("(^| )${Regex.escape(marker)}( |$)").containsMatchIn(normalized) } }.keys
}

private fun homeStoryKindV059(title: String): String {
    val value = title.lowercase(Locale.ROOT)
    return when {
        value.contains("trailer") -> "TRAILER"
        value.contains("teaser") -> "TEASER"
        value.contains("glimpse") || value.contains("sneak peek") -> "GLIMPSE"
        value.contains("first look") || value.contains("poster") -> "VISUAL"
        value.contains("song") || value.contains("lyrical") || value.contains("single") || value.contains("jukebox") -> "MUSIC"
        value.contains("ott") || value.contains("streaming") || value.contains("premiere") -> "STREAMING"
        value.contains("interview") || value.contains("press meet") || value.contains("event") -> "EVENT"
        else -> "GENERAL"
    }
}

private val HOME59_FIRST_PARTY_ROLES = setOf("PRODUCTION_HOUSE", "FILM_OFFICIAL", "CAST_CREW_OFFICIAL", "OTT_PLATFORM", "MUSIC_LABEL")

private val HOME59_LANGUAGE_MARKERS = mapOf(
    "te" to setOf("telugu"),
    "hi" to setOf("hindi"),
    "ta" to setOf("tamil"),
    "ml" to setOf("malayalam"),
    "kn" to setOf("kannada"),
    "en" to setOf("english"),
)

private val HOME59_GENERIC_TOKENS = setOf(
    "official", "video", "watch", "streaming", "premiere", "release", "released", "update", "latest",
    "movie", "film", "cinema", "trailer", "teaser", "glimpse", "song", "poster", "first", "look",
    "hotstar", "jiohotstar", "netflix", "prime", "sony", "sunnxt", "zee5", "specials",
)

private val HOME59_STOP_TOKENS = HOME59_GENERIC_TOKENS + setOf(
    "the", "and", "for", "from", "with", "this", "that", "into", "over", "now", "full", "new",
    "today", "tomorrow", "here", "out", "only", "your", "their", "our", "its", "you", "all", "2026",
)

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
