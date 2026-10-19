package com.cinerelay.app.ui

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PageSize
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.TextButton
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.produceState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Duration
import java.time.Instant
import java.util.Locale
import kotlin.math.abs

private val Home58Ink = CineEditorial.Background
private val Home58Panel = CineEditorial.Surface
private val Home58Raised = CineEditorial.Raised
private val Home58Text = CineEditorial.Text
private val Home58Muted = CineEditorial.Muted
private val Home58Gold = CineEditorial.Accent
private val Home58Green = CineEditorial.Confirmed
private val Home58Amber = CineEditorial.Developing

internal const val HOME23_HERO_CAP = 10
private const val HOME23_AUTO_REFRESH_MS = 10 * 60 * 1000L

private data class HomeStoryV059(
    val key: String,
    val representative: NewsroomSignal,
    val updates: List<NewsroomSignal>,
    val sourceCount: Int,
    val officialSourceCount: Int,
)

private data class HomeRailV058(val title: String, val items: List<HomeStoryV059>)

private data class HomeDisplayProjectionV1(
    val favoriteSources: List<PersonalizationSource>,
    val heroStories: List<HomeStoryV059>,
    val latest: List<HomeStoryV059>,
    val rails: List<HomeRailV058>,
)

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
    // Foreground-only periodic refresh. The ViewModel preserves caching/throttling;
    // push notification delivery continues through the existing app infrastructure.
    LaunchedEffect(Unit) {
        while (true) {
            delay(HOME23_AUTO_REFRESH_MS)
            onRefresh()
        }
    }

    // Clustering compares stories pairwise and can become expensive as feeds grow.
    // Compute the complete projection on Default, not during UI composition.
    val projection by produceState<HomeDisplayProjectionV1?>(
        initialValue = null,
        key1 = state.homeSignals,
        key2 = personalization,
    ) {
        value = withContext(Dispatchers.Default) {
            // Home's first screen is strictly recent; the discovery shelves may
            // show older *already loaded* stories without calling them breaking.
            // Cap costly pairwise clustering to preserve smooth navigation.
            val discoverySignals = state.homeSignals
                .asSequence()
                .distinctBy { it.id }
                .sortedByDescending(::homeSignalInstantV059)
                .take(160)
                .toList()
            val discoveryStories = clusterHomeStoriesV059(discoverySignals)
            val freshStories = clusterHomeStoriesV059(
                discoverySignals.filter(::isFreshHomeSignalV058),
            )
            val favoriteSources = personalization.availableSources.filter {
                it.identityId in personalization.favoriteSourceIdentityIds
            }
            val favoriteStories = discoveryStories.mapNotNull { story ->
                val matches = story.updates.filter { signal ->
                    favoriteSources.any { source -> source.matchesV058(signal) }
                }
                if (matches.isEmpty()) null
                else story.copy(representative = bestHomeRepresentativeV059(matches))
            }
            // Always newest first: never fill the hero with old, highly scored
            // stories just to reach ten. A missing image uses original fallback art.
            val heroStories = freshStories
                .distinctBy { it.key }
                .sortedByDescending { homeSignalInstantV059(it.representative) }
                .take(HOME23_HERO_CAP)
            val heroKeys = heroStories.map { it.key }.toSet()
            val freshNotFeatured = freshStories.filterNot { it.key in heroKeys }
            val latest = if (freshNotFeatured.isNotEmpty()) freshNotFeatured.take(6)
                else freshStories.take(6)
            HomeDisplayProjectionV1(
                favoriteSources = favoriteSources,
                heroStories = heroStories,
                latest = latest,
                rails = buildHomeRailsV059(
                    discoveryStories, favoriteStories, favoriteSources,
                    personalization.favoriteLanguages, recentStories = freshStories,
                ),
            )
        }
    }
    val favoriteSources = projection?.favoriteSources.orEmpty()
    val heroStories = projection?.heroStories.orEmpty()
    val latestStories = projection?.latest.orEmpty()
    val rails = projection?.rails.orEmpty()
    val visibleRails = rails.mapNotNull { rail ->
        // Latest already shows the newest items; Just In should extend it,
        // not repeat the same thumbnails immediately below the slideshow.
        val items = if (rail.title == "Just In") {
            val recentKeys = (heroStories + latestStories).map { it.key }.toSet()
            rail.items.filterNot { it.key in recentKeys }
        } else rail.items
        if (items.isEmpty()) null else rail.copy(items = items)
    }.sortedWith(compareBy<HomeRailV058> { homeRailPriorityV22(it.title) }.thenBy { it.title })

    var openedRail by rememberSaveable { mutableStateOf<String?>(null) }
    var showCategories by rememberSaveable { mutableStateOf(false) }
    val selectedRail = rails.firstOrNull { it.title == openedRail }
    BackHandler(enabled = selectedRail != null || showCategories) {
        if (selectedRail != null) openedRail = null else showCategories = false
    }

    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Home58Gold, background = Home58Ink, surface = Home58Panel,
            surfaceVariant = Home58Raised, onBackground = Home58Text,
            onSurface = Home58Text, onSurfaceVariant = Home58Muted,
        ),
    ) {
        when {
            selectedRail != null -> {
                Column(Modifier.fillMaxSize().background(Home58Ink)) {
                    CineScreenHeader(
                        title = selectedRail.title,
                        subtitle = "${selectedRail.items.size} available stories",
                        onBack = { openedRail = null },
                    )
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(
                            start = CineEditorial.Gutter, end = CineEditorial.Gutter,
                            bottom = 120.dp,
                        ),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(selectedRail.items, key = { it.key }) { story ->
                            HomeFullStoryRowV1(story) { onOpenUpdate(story.representative) }
                        }
                    }
                }
            }
            showCategories -> {
                Column(Modifier.fillMaxSize().background(Home58Ink)) {
                    CineScreenHeader(
                        title = "Explore cinema",
                        onBack = { showCategories = false },
                    )
                    LazyColumn(
                        contentPadding = PaddingValues(start = CineEditorial.Gutter, end = CineEditorial.Gutter, bottom = 120.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(rails, key = { it.title }) { rail ->
                            HomeCategoryRowV1(rail) {
                                showCategories = false
                                openedRail = rail.title
                            }
                        }
                    }
                }
            }
            else -> {
                PullToRefreshBox(
                    isRefreshing = state.loading,
                    onRefresh = onRefresh,
                    modifier = modifier.fillMaxSize().background(Home58Ink),
                ) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 120.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        item(key = "header") {
                            HomeHeaderV058(
                                onSearch = onSearch,
                                onOpenExplore = { showCategories = true },
                                onOpenArchive = onOpenArchive,
                            )
                        }
                        state.error?.let { message ->
                            item(key = "error") {
                                Text(message, color = CineEditorial.Error, fontSize = 12.sp,
                                    modifier = Modifier.padding(horizontal = CineEditorial.Gutter))
                            }
                        }
                        if (projection == null && state.homeSignals.isNotEmpty()) {
                            item(key = "loading-projection") {
                                Box(Modifier.fillMaxWidth().height(96.dp), contentAlignment = Alignment.Center) {
                                    CircularProgressIndicator(color = Home58Gold, strokeWidth = 2.dp)
                                }
                            }
                        }
                        if (heroStories.isNotEmpty()) {
                            item(key = "top") {
                                HomeHeroPagerV066(heroStories, onOpenUpdate)
                            }
                        }
                        if (latestStories.isNotEmpty()) {
                            item(key = "latest-title") {
                                Spacer(Modifier.height(10.dp))
                                HomeCompactSectionV1("Latest Updates") {
                                    openedRail = "Just In"
                                }
                            }
                            item(key = "latest-cinematic-rail") {
                                LazyRow(
                                    contentPadding = PaddingValues(horizontal = CineEditorial.Gutter),
                                    horizontalArrangement = Arrangement.spacedBy(CineEditorial.RailGap),
                                ) {
                                    items(latestStories, key = { "latest:${it.key}" }) { story ->
                                        HomeCinematicRailCardV21(story) { onOpenUpdate(story.representative) }
                                    }
                                }
                            }
                        }
                        // The Home is a vertical cinema discovery surface. Each shelf
                        // swipes sideways, and See all opens its existing full listing.
                        items(visibleRails, key = { "shelf:${it.title}" }) { rail ->
                            Column(
                                modifier = Modifier.padding(top = 12.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                HomeCompactSectionV1(rail.title) { openedRail = rail.title }
                                LazyRow(
                                    contentPadding = PaddingValues(horizontal = CineEditorial.Gutter),
                                    horizontalArrangement = Arrangement.spacedBy(CineEditorial.RailGap),
                                ) {
                                    items(rail.items, key = { it.key }) { story ->
                                        val open = { onOpenUpdate(story.representative) }
                                        when (homeRailVisualV22(rail.title)) {
                                            HomeRailVisualV22.PORTRAIT -> HomePortraitRailCardV22(story, open)
                                            HomeRailVisualV22.COMPACT -> HomeCompactRailCardV22(story, open)
                                            HomeRailVisualV22.LANDSCAPE -> HomeCinematicRailCardV21(story, open)
                                        }
                                    }
                                }
                            }
                        }
                        if (projection != null && rails.isEmpty() && !state.loading) {
                            item(key = "empty") { HomeHeroEmptyV058(favoriteSources) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeHeaderV058(
    onSearch: () -> Unit,
    onOpenExplore: () -> Unit,
    onOpenArchive: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(
            start = CineEditorial.Gutter, end = CineEditorial.Gutter, top = 10.dp, bottom = 2.dp,
        ),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Surface(
            color = Home58Gold, shape = RoundedCornerShape(9.dp),
            modifier = Modifier.size(36.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text("C", color = Home58Ink, fontWeight = FontWeight.Bold, fontSize = 21.sp)
            }
        }
        Spacer(Modifier.width(10.dp))
        Text(
            "CineRelay", color = Home58Text, fontSize = 20.sp,
            fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f),
            maxLines = 1, overflow = TextOverflow.Ellipsis,
        )
        IconButton(onClick = onSearch, modifier = Modifier.size(CineEditorial.TargetSize)) {
            Icon(Icons.Default.Search, contentDescription = "Search", tint = Home58Text)
        }
        IconButton(onClick = onOpenExplore, modifier = Modifier.size(CineEditorial.TargetSize)) {
            Icon(Icons.Default.GridView, contentDescription = "Explore cinema categories", tint = Home58Text)
        }
        IconButton(onClick = onOpenArchive, modifier = Modifier.size(CineEditorial.TargetSize)) {
            Icon(Icons.Default.Archive, contentDescription = "Archive", tint = Home58Text)
        }
    }
}

@Composable
private fun HomeCompactSectionV1(title: String, onSeeAll: (() -> Unit)? = null) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = CineEditorial.Gutter),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title, fontSize = CineEditorial.SectionTitle,
            fontWeight = FontWeight.SemiBold, color = Home58Text,
            modifier = Modifier.weight(1f),
            maxLines = 1, overflow = TextOverflow.Ellipsis,
        )
        if (onSeeAll != null) {
            TextButton(onClick = onSeeAll) {
                Text("See all", color = Home58Gold, fontSize = CineEditorial.Metadata)
                Icon(
                    Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = Home58Gold,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
    }
}

@Composable
private fun HomeHeroPagerV066(
    heroStories: List<HomeStoryV059>,
    onOpenUpdate: (NewsroomSignal) -> Unit,
) {
    val pager = rememberPagerState(initialPage = 0, pageCount = { heroStories.size })
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        HorizontalPager(
            state = pager,
            modifier = Modifier.fillMaxWidth().padding(horizontal = CineEditorial.Gutter),
            pageSize = PageSize.Fill,
        ) { index ->
            val item = heroStories[index].representative
            val headline = item.canonicalEvent?.headline?.takeIf { it.isNotBlank() } ?: item.title
            Surface(
                color = Home58Panel,
                shape = RoundedCornerShape(CineEditorial.HeroRadius),
                modifier = Modifier.fillMaxWidth().clickable { onOpenUpdate(item) },
            ) {
                Box(Modifier.fillMaxWidth().height(302.dp)) {
                    EditorialArtworkV2(
                        url = item.thumbnailUrl,
                        title = headline,
                        modifier = Modifier.matchParentSize(),
                    )
                    // The scrim keeps both Telugu and Latin headlines readable on any real thumbnail.
                    Box(
                        Modifier.matchParentSize().background(
                            Brush.verticalGradient(
                                colorStops = arrayOf(
                                    0f to Color.Transparent,
                                    0.40f to Home58Ink.copy(alpha = 0.08f),
                                    0.73f to Home58Ink.copy(alpha = 0.46f),
                                    1f to Home58Ink.copy(alpha = 0.99f),
                                ),
                            ),
                        ),
                    )
                    Text(
                        headline,
                        modifier = Modifier.align(Alignment.BottomStart)
                            .fillMaxWidth().padding(horizontal = 20.dp, vertical = 22.dp),
                        color = Home58Text,
                        fontSize = 21.sp,
                        lineHeight = 28.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
        if (heroStories.size > 1) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                repeat(heroStories.size) { index ->
                    Box(
                        Modifier.padding(horizontal = 3.dp)
                            .size(
                                width = if (index == pager.currentPage) 20.dp else 6.dp,
                                height = 6.dp,
                            )
                            .clip(RoundedCornerShape(3.dp))
                            .background(if (index == pager.currentPage) Home58Gold else Home58Muted.copy(alpha = 0.45f)),
                    )
                }
            }
        }
    }
}

/**
 * Artwork-led discovery rail. Full news evidence stays in the detail destination;
 * only real source-supplied thumbnails are used here.
 */
@Composable
private fun HomeCinematicRailCardV21(
    story: HomeStoryV059,
    onClick: () -> Unit,
) {
    val item = story.representative
    val headline = item.canonicalEvent?.headline?.takeIf { it.isNotBlank() } ?: item.title
    Column(
        modifier = Modifier.width(208.dp).clickable(onClick = onClick),
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        EditorialArtworkV2(
            url = item.thumbnailUrl,
            title = headline,
            modifier = Modifier.fillMaxWidth().height(117.dp),
        )
        Text(
            headline,
            color = Home58Text,
            fontSize = CineEditorial.CardTitle,
            lineHeight = 20.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                item.source.name ?: item.source.handle ?: "Source",
                color = Home58Muted,
                fontSize = CineEditorial.Metadata,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(6.dp))
            Text(home58TimeAgo(item.observedAt), color = Home58Muted, fontSize = CineEditorial.Metadata)
        }
    }
}

/**
 * Controlled visual families: art-led film shelves, short latest updates and
 * landscape news stories share fonts/gutters but don't look like clones.
 * All artwork is taken from the underlying update; no invented movie posters.
 */
private enum class HomeRailVisualV22 { PORTRAIT, COMPACT, LANDSCAPE }

private fun homeRailVisualV22(title: String): HomeRailVisualV22 = when {
    title in setOf("Just In", "From Your Favorites", "From the Web") ||
        title.startsWith("Latest from ") -> HomeRailVisualV22.COMPACT
    title in setOf(
        "Indian Cinema", "English & International", "Telugu Cinema",
        "Hindi Cinema", "Tamil Cinema", "Malayalam Cinema", "Kannada Cinema",
        "First Looks & Announcements", "Official Movie Updates",
    ) -> HomeRailVisualV22.PORTRAIT
    else -> HomeRailVisualV22.LANDSCAPE
}

private val HOME22_RAIL_ORDER = listOf(
    "Evolving Stories",
    "Just In",
    "Trending Across Sources",
    "Indian Cinema",
    "English & International",
    "Telugu Cinema",
    "Tamil Cinema",
    "Hindi Cinema",
    "Malayalam Cinema",
    "Kannada Cinema",
    "Trailers & Teasers",
    "First Looks & Announcements",
    "OTT & Streaming Updates",
    "Music & Songs",
    "Interviews & Events",
    "Official Movie Updates",
    "From Your Favorites",
    "From the Web",
)

internal fun homeRailPriorityV22(title: String): Int {
    val index = HOME22_RAIL_ORDER.indexOf(title)
    return if (index >= 0) index else if (title.startsWith("Latest from ")) 100 else 99
}

@Composable
private fun HomePortraitRailCardV22(story: HomeStoryV059, onClick: () -> Unit) {
    val item = story.representative
    val headline = item.canonicalEvent?.headline?.takeIf { it.isNotBlank() } ?: item.title
    Column(
        modifier = Modifier.width(146.dp).clickable(onClick = onClick),
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        EditorialArtworkV2(
            url = item.thumbnailUrl,
            title = headline,
            modifier = Modifier.fillMaxWidth().height(185.dp),
        )
        Text(
            headline,
            color = Home58Text,
            fontSize = CineEditorial.CardTitle,
            lineHeight = 20.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            item.source.name ?: item.source.handle ?: "Source",
            color = Home58Muted,
            fontSize = CineEditorial.Metadata,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun HomeCompactRailCardV22(story: HomeStoryV059, onClick: () -> Unit) {
    val item = story.representative
    val headline = item.canonicalEvent?.headline?.takeIf { it.isNotBlank() } ?: item.title
    Row(
        modifier = Modifier.width(282.dp)
            .clip(RoundedCornerShape(CineEditorial.CardRadius))
            .background(Home58Panel)
            .clickable(onClick = onClick)
            .padding(9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        EditorialArtworkV2(
            url = item.thumbnailUrl,
            title = headline,
            modifier = Modifier.size(width = 98.dp, height = 82.dp),
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                headline,
                color = Home58Text,
                fontSize = CineEditorial.CardTitle,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    item.source.name ?: item.source.handle ?: "Source",
                    modifier = Modifier.weight(1f),
                    color = Home58Muted,
                    fontSize = CineEditorial.Metadata,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    home58TimeAgo(item.observedAt),
                    color = Home58Muted,
                    fontSize = CineEditorial.Metadata,
                )
            }
        }
    }
}

@Composable
private fun HomeHeroEmptyV058(favoriteSources: List<PersonalizationSource>) {
    Surface(
        color = Home58Panel, shape = RoundedCornerShape(CineEditorial.CardRadius),
        modifier = Modifier.fillMaxWidth().padding(horizontal = CineEditorial.Gutter),
    ) {
        Text(
            if (favoriteSources.isEmpty()) "Follow sources to personalize your updates."
            else "No recent updates yet. Pull down to refresh.",
            color = Home58Muted, fontSize = 14.sp, modifier = Modifier.padding(16.dp),
        )
    }
}

@Composable
private fun HomeCategoryRowV1(rail: HomeRailV058, onClick: () -> Unit) {
    Surface(
        color = Home58Panel, shape = RoundedCornerShape(CineEditorial.CardRadius),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    ) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 13.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Text(rail.title, color = Home58Text, fontSize = 15.sp,
                modifier = Modifier.weight(1f), maxLines = 2,
                overflow = TextOverflow.Ellipsis)
            Text("${rail.items.size}", color = Home58Muted, fontSize = 12.sp)
            Spacer(Modifier.width(9.dp))
            Icon(Icons.Default.ArrowBack, contentDescription = null,
                tint = Home58Muted, modifier = Modifier.size(16.dp)
                    .graphicsLayer { rotationZ = 180f })
        }
    }
}

@Composable
private fun HomeFullStoryRowV1(story: HomeStoryV059, onClick: () -> Unit) {
    val item = story.representative
    Row(
        modifier = Modifier.fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 7.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        EditorialArtworkV2(
            url = item.thumbnailUrl,
            title = item.title,
            modifier = Modifier.size(width = 82.dp, height = 70.dp),
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(item.canonicalEvent?.headline?.takeIf { it.isNotBlank() } ?: item.title,
                color = Home58Text, fontSize = 15.sp, fontWeight = FontWeight.Medium,
                lineHeight = 20.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(item.source.name ?: item.source.handle ?: "Source",
                    color = Home58Muted, fontSize = 12.sp,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f))
                Spacer(Modifier.width(6.dp))
                Text(home58TimeAgo(item.observedAt), color = Home58Muted,
                    fontSize = 12.sp)
            }
        }
    }
}


private fun buildHomeRailsV059(
    stories: List<HomeStoryV059>,
    favorites: List<HomeStoryV059>,
    favoriteSources: List<PersonalizationSource>,
    favoriteLanguages: Set<String>,
    recentStories: List<HomeStoryV059>,
): List<HomeRailV058> {
    if (stories.isEmpty()) return emptyList()
    val rails = mutableListOf<HomeRailV058>()
    fun add(title: String, items: List<HomeStoryV059>, minimum: Int = 1, limit: Int = 24) {
        val unique = items.distinctBy { it.key }.take(limit)
        if (unique.size >= minimum) rails += HomeRailV058(title, unique)
    }

    add("From Your Favorites", favorites)
    add(
        "Evolving Stories",
        stories.filter { it.updates.size > 1 || it.sourceCount > 1 }
            .sortedWith(
                compareByDescending<HomeStoryV059> { it.updates.size + it.sourceCount }
                    .thenByDescending { homeSignalInstantV059(it.representative) },
            ),
    )
    add(
        "Trending Across Sources",
        stories.filter { it.sourceCount >= 2 }
            .sortedWith(compareByDescending<HomeStoryV059> { it.sourceCount }.thenByDescending { homeSignalInstantV059(it.representative) }),
    )
    add("Just In", recentStories.take(24))

    val labels = linkedMapOf(
        "te" to "Telugu Cinema",
        "hi" to "Hindi Cinema",
        "ta" to "Tamil Cinema",
        "ml" to "Malayalam Cinema",
        "kn" to "Kannada Cinema",
        "en" to "English & International",
    )
    val indianLanguages = setOf("te", "ta", "ml", "kn", "hi")
    add("Indian Cinema", stories.filter { story -> story.updates.any { (it.languageCode ?: it.canonicalEvent?.primaryLanguage)?.lowercase(Locale.ENGLISH) in indianLanguages } }, limit = 24)
    val languageOrder = (favoriteLanguages.filter { it in labels.keys } + labels.keys).distinct()
    for (code in languageOrder) add(labels.getValue(code), stories.filter { story -> story.updates.any { (it.languageCode ?: it.canonicalEvent?.primaryLanguage)?.lowercase(Locale.ENGLISH) == code } })

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
        val entityId = cluster.mapNotNull { it.canonicalEvent?.entityId?.takeIf(String::isNotBlank) }.firstOrNull()
        val eventId = cluster.mapNotNull { it.canonicalEvent?.id?.takeIf(String::isNotBlank) }.firstOrNull()
        HomeStoryV059(
            key = entityId?.let { "entity:$it" }
                ?: eventId?.let { "event:$it" }
                ?: "story:${cluster.map { it.id }.sorted().first()}",
            representative = representative,
            updates = cluster.sortedByDescending(::homeSignalInstantV059),
            sourceCount = sourceKeys.size.coerceAtLeast(1),
            officialSourceCount = officialKeys.size,
        )
    }.sortedByDescending { homeSignalInstantV059(it.representative) }
}

private fun shouldShareHomeStoryV059(left: NewsroomSignal, right: NewsroomSignal): Boolean {
    val leftInstant = homeSignalInstantV059(left)
    val rightInstant = homeSignalInstantV059(right)
    if (leftInstant != Instant.EPOCH && rightInstant != Instant.EPOCH) {
        if (abs(Duration.between(leftInstant, rightInstant).toMinutes()) > 18L * 60L) return false
    }

    val leftEntity = left.canonicalEvent?.entityId?.takeIf(String::isNotBlank)
    val rightEntity = right.canonicalEvent?.entityId?.takeIf(String::isNotBlank)
    if (leftEntity != null && rightEntity != null) {
        return leftEntity == rightEntity
    }

    val leftEvent = left.canonicalEvent?.id?.takeIf(String::isNotBlank)
    val rightEvent = right.canonicalEvent?.id?.takeIf(String::isNotBlank)
    if (leftEvent != null && rightEvent != null) return leftEvent == rightEvent

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

private fun homeHeroScoreV066(story: HomeStoryV059, favoriteLanguages: Set<String>): Int {
    val signal = story.representative
    var score = 0
    val language = (signal.languageCode ?: signal.canonicalEvent?.primaryLanguage)?.lowercase(Locale.ENGLISH)
    if (language != null && language in favoriteLanguages.map { it.lowercase(Locale.ENGLISH) }) score += 34
    if (language in setOf("te", "ta", "ml", "kn", "hi")) score += 8
    if (!signal.thumbnailUrl.isNullOrBlank()) score += 32
    score += story.officialSourceCount.coerceAtMost(3) * 18
    score += story.sourceCount.coerceAtMost(4) * 8
    score += story.updates.size.coerceAtMost(5) * 6
    when (signal.canonicalEvent?.verificationState) {
        "OFFICIAL" -> score += 35
        "CONFIRMED" -> score += 28
        "RELIABLE_REPORT" -> score += 12
    }
    val radar = signal.canonicalEvent?.radar
    if (radar != null && radar.label != "NO_ACTION") score += radar.score.coerceIn(0, 100) / 4
    if (signal.source.role == "MUSIC_LABEL" && !signal.title.hasAnyV058("trailer", "teaser", "glimpse", "announcement", "poster")) score -= 18
    val ageHours = Duration.between(homeSignalInstantV059(signal), Instant.now()).toHours().coerceAtLeast(0)
    score += when {
        ageHours <= 2 -> 24
        ageHours <= 6 -> 18
        ageHours <= 12 -> 10
        else -> 2
    }
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

private fun friendlyHomeEventTypeV066(value: String?): String = when (value) {
    "TRAILER_RELEASED" -> "TRAILER"
    "TEASER_RELEASED" -> "TEASER"
    "GLIMPSE_RELEASED" -> "GLIMPSE"
    "FIRST_LOOK_RELEASED", "POSTER_RELEASED" -> "NEW LOOK"
    "OTT_DATE_ANNOUNCED", "OTT_DATE_CHANGED", "OTT_PLATFORM_ANNOUNCED", "OTT_RELEASED" -> "OTT UPDATE"
    "THEATRICAL_DATE_ANNOUNCED", "THEATRICAL_DATE_CHANGED" -> "RELEASE UPDATE"
    "CAST_ANNOUNCED", "CREW_ANNOUNCED" -> "PROJECT UPDATE"
    "SONG_RELEASED", "SONG_ANNOUNCED" -> "MUSIC"
    "INTERVIEW_RELEASED", "PRESS_MEET_ANNOUNCED" -> "INTERVIEW / EVENT"
    else -> "TOP STORY"
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
