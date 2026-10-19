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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cinerelay.app.data.OttProvider
import com.cinerelay.app.data.OttRelease
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val OttInk = CineEditorial.Background
private val OttPanel = CineEditorial.Surface
private val OttRaised = CineEditorial.Raised
private val OttLine = CineEditorial.Outline
private val OttText = CineEditorial.Text
private val OttMuted = CineEditorial.Muted
private val OttGold = CineEditorial.Accent
private val OttGreen = CineEditorial.Confirmed
private val OttAmber = CineEditorial.Developing
private val OttBlue = CineEditorial.Info
private val OttRed = CineEditorial.Error

private val OttColors = darkColorScheme(
    primary = OttGold,
    background = OttInk,
    surface = OttPanel,
    surfaceVariant = OttRaised,
    onBackground = OttText,
    onSurface = OttText,
    onSurfaceVariant = OttMuted,
    outline = OttLine,
    error = OttRed,
)

private val OttLanguages = listOf(
    null to "All languages",
    "te" to "Telugu",
    "ta" to "Tamil",
    "ml" to "Malayalam",
    "kn" to "Kannada",
    "hi" to "Hindi",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OttReleasesV054(
    state: OttUiState,
    onRefresh: () -> Unit,
    onSelectWindow: (OttWindow) -> Unit,
    onSelectProvider: (String?) -> Unit,
    onSelectLanguage: (String?) -> Unit,
    onSelectContentType: (OttContentType) -> Unit,
    onSelectEvidence: (OttEvidenceFilter) -> Unit,
    onClearFilters: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var filtersExpanded by rememberSaveable { mutableStateOf(false) }
    val landingListState=rememberLazyListState()
    var openedCategory by rememberSaveable { mutableStateOf<String?>(null) }
    var openedReleaseId by rememberSaveable { mutableStateOf<String?>(null) }
    val activeFilters = listOf(
        state.providerCode != null,
        state.language != null,
        state.contentType != OttContentType.ALL,
        state.evidence != OttEvidenceFilter.ALL,
    ).count { it }
        BackHandler(enabled=openedCategory!=null||openedReleaseId!=null){
        if(openedReleaseId!=null) openedReleaseId=null else openedCategory=null
    }
    MaterialTheme(colorScheme = OttColors) {
        Surface(modifier = modifier.fillMaxSize(), color = OttInk) {
            val sections = listOf(
                Triple("weekend","This Weekend",state.weekendItems),
                Triple("today","Today's OTT Releases",state.todayItems),
                Triple("streaming","Now Streaming",state.nowStreamingItems),
                Triple("upcoming","Coming in the Next 30 Days",state.upcomingItems),
            )
            val chosen = state.items.firstOrNull { it.id==openedReleaseId }
            val category = sections.firstOrNull { it.first==openedCategory }
            if (filtersExpanded && chosen == null && category == null) {
                ModalBottomSheet(
                    onDismissRequest = { filtersExpanded = false },
                    containerColor = OttPanel,
                    contentColor = OttText,
                ) {
                    OttFiltersV060(
                        state = state,
                        onClose = { filtersExpanded = false },
                        onSelectProvider = onSelectProvider,
                        onSelectLanguage = onSelectLanguage,
                        onSelectContentType = onSelectContentType,
                        onSelectEvidence = onSelectEvidence,
                        onClearFilters = onClearFilters,
                    )
                }
            }
            if(chosen!=null) {
                LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(bottom=128.dp),
                    verticalArrangement=Arrangement.spacedBy(10.dp)){
                    item{DiscoverySubpageHeaderV080(chosen.entity.name,"Release details",onBack={openedReleaseId=null})}
                    item{OttReleaseCardV069(chosen,Modifier.fillMaxWidth().padding(horizontal=16.dp))}
                }
            }else if(category!=null){
                LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(bottom=128.dp),
                    verticalArrangement=Arrangement.spacedBy(10.dp)){
                    item{DiscoverySubpageHeaderV080(category.second,category.third.size.toString()+" releases",
                        onBack={openedCategory=null})}
                    if(category.third.isEmpty())item{
                        Text("No matching releases.",color=OttMuted,fontSize=14.sp,modifier=Modifier.padding(20.dp))
                    }
                    items(category.third,key={it.id}){release->
                        OttCompactListRowV080(release,Modifier.padding(horizontal=16.dp)){openedReleaseId=release.id}
                    }
                }
            }else Scaffold(
                containerColor = OttInk,
                topBar = {},
            ) { padding ->
                LazyColumn(
                    state=landingListState,
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentPadding = PaddingValues(start = CineEditorial.Gutter, end = CineEditorial.Gutter, top = 0.dp, bottom = 118.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    item {
                        EditorialMastheadV2(
                            section = "STREAMING JOURNAL / INDIA",
                            title = "Streaming",
                            subtitle = "",
                            actions = {
                                TextButton(onClick = { filtersExpanded = true }) {
                                    Icon(
                                        Icons.Default.Tune,
                                        contentDescription = null,
                                        tint = OttGold,
                                        modifier = Modifier.size(19.dp),
                                    )
                                    Spacer(Modifier.width(5.dp))
                                    Text(
                                        if (activeFilters == 0) "Refine" else "Refine ($activeFilters)",
                                        color = OttGold,
                                        fontSize = CineEditorial.Metadata,
                                        maxLines = 1,
                                    )
                                }
                                IconButton(onClick = onRefresh, enabled = !state.loading) {
                                    if (state.loading) CircularProgressIndicator(
                                        Modifier.size(19.dp), strokeWidth = 2.dp, color = OttGold,
                                    ) else Icon(Icons.Default.Refresh,
                                        contentDescription = "Refresh OTT releases", tint = OttMuted)
                                }
                            },
                        )
                    }
                    state.error?.let { message ->
                        item {
                            Surface(color = OttRed.copy(alpha = 0.10f), shape = RoundedCornerShape(CineEditorial.CardRadius)) {
                                Text(message, color = OttRed, fontSize = CineEditorial.Metadata, modifier = Modifier.fillMaxWidth().padding(12.dp))
                            }
                        }
                    }

                    if (state.loading && !state.loaded) {
                        item {
                            Box(Modifier.fillMaxWidth().height(180.dp), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(color = OttGold, strokeWidth = 2.dp)
                            }
                        }
                    } else {
                        if (state.weekendItems.isEmpty() && state.todayItems.isEmpty() &&
                            state.nowStreamingItems.isEmpty() && state.upcomingItems.isEmpty()) {
                            item {
                                Column(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 28.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(10.dp),
                                ) {
                                    Text("No matching releases", color = OttText, fontSize = CineEditorial.SectionTitle)
                                    TextButton(onClick = { filtersExpanded = true }) {
                                        Text("Adjust filters", color = OttGold)
                                    }
                                }
                            }
                        }
                        if (state.weekendItems.isNotEmpty()) item {
                            OttReleaseSectionV066(
                                eyebrow = "WEEKEND",
                                title = "This Weekend",
                                subtitle = ottWeekendLabelV060(state.weekendStart, state.weekendEnd),
                                items = state.weekendItems,
                                emptyMessage = "No confirmed releases listed for this weekend yet.",
                                onSeeAll = { openedCategory="weekend" },
                                onOpenRelease = { openedReleaseId=it.id },
                            )
                        }
                        if (state.todayItems.isNotEmpty()) item {
                            OttReleaseSectionV066(
                                eyebrow = "TODAY",
                                title = "Today’s OTT Releases",
                                subtitle = state.today?.let { formatOttDateV054(it) } ?: "What is available today",
                                items = state.todayItems,
                                emptyMessage = "No evidence-backed OTT premieres are dated for today yet.",
                                onSeeAll = { openedCategory="today" },
                                onOpenRelease = { openedReleaseId=it.id },
                            )
                        }
                        if (state.nowStreamingItems.isNotEmpty()) item {
                            OttReleaseSectionV066(
                                eyebrow = "AVAILABLE NOW",
                                title = "Now Streaming",
                                subtitle = "",
                                items = state.nowStreamingItems,
                                emptyMessage = "No matching now-streaming releases are currently backed by retained evidence.",
                                onSeeAll = { openedCategory="streaming" },
                                onOpenRelease = { openedReleaseId=it.id },
                            )
                        }
                        if (state.upcomingItems.isNotEmpty()) item {
                            OttReleaseSectionV066(
                                eyebrow = "COMING SOON",
                                title = "Coming in the Next 30 Days",
                                subtitle = state.windowEnd?.let { "Through ${formatOttDateV054(it)}" } ?: "",
                                items = state.upcomingItems,
                                emptyMessage = "No matching upcoming releases are currently backed by retained evidence.",
                                onSeeAll = { openedCategory="upcoming" },
                                onOpenRelease = { openedReleaseId=it.id },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OttOverviewV069(state: OttUiState, onOpenCategory: (String) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item { OttCountPillV060("Weekend", state.weekendItems.size) { onOpenCategory("weekend") } }
        item { OttCountPillV060("Today", state.todayItems.size) { onOpenCategory("today") } }
        item { OttCountPillV060("Streaming", state.nowStreamingItems.size) { onOpenCategory("streaming") } }
        item { OttCountPillV060("Next 30d", state.upcomingItems.size) { onOpenCategory("upcoming") } }
    }
}

@Composable
private fun OttCountPillV060(label: String, count: Int, onClick: () -> Unit) {
    Surface(
        color = OttPanel,
        shape = RoundedCornerShape(CineEditorial.CardRadius),
        modifier = Modifier.width(89.dp).heightIn(min = 80.dp).clickable(enabled = count > 0, onClick = onClick),
    ) {
        Column(
            Modifier.padding(11.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            EditorialDisplayV2(count.toString().padStart(2, '0'), size = 22, lines = 1)
            Text(label, color = OttMuted, fontSize = 10.sp, maxLines = 1)
        }
    }
}

@Composable
private fun OttFiltersV060(
    state: OttUiState,
    onClose: () -> Unit,
    onSelectProvider: (String?) -> Unit,
    onSelectLanguage: (String?) -> Unit,
    onSelectContentType: (OttContentType) -> Unit,
    onSelectEvidence: (OttEvidenceFilter) -> Unit,
    onClearFilters: () -> Unit,
) {
    val activeCount = listOf(
        state.providerCode != null,
        state.language != null,
        state.contentType != OttContentType.ALL,
        state.evidence != OttEvidenceFilter.ALL,
    ).count { it }

    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Refine results",
                color = OttText,
                fontSize = CineEditorial.SectionTitle,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            if (activeCount > 0) {
                TextButton(onClick = onClearFilters) {
                    Text("Reset ($activeCount)", color = OttGold, fontSize = CineEditorial.Metadata)
                }
            }
        }
        OttProviderRowV054(state.providers, state.providerCode, onSelectProvider)
        Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text("LANGUAGE", color = OttMuted, fontSize = CineEditorial.Metadata)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(OttLanguages, key = { it.first ?: "all" }) { (code, label) ->
                    OttChipV054(label, state.language == code) { onSelectLanguage(code) }
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text("TYPE", color = OttMuted, fontSize = CineEditorial.Metadata)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { OttChipV054("All", state.contentType == OttContentType.ALL) { onSelectContentType(OttContentType.ALL) } }
                item { OttChipV054("Movies", state.contentType == OttContentType.MOVIES) { onSelectContentType(OttContentType.MOVIES) } }
                item { OttChipV054("Series", state.contentType == OttContentType.SERIES) { onSelectContentType(OttContentType.SERIES) } }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text("EVIDENCE", color = OttMuted, fontSize = CineEditorial.Metadata)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { OttChipV054("All", state.evidence == OttEvidenceFilter.ALL) { onSelectEvidence(OttEvidenceFilter.ALL) } }
                item { OttChipV054("Confirmed", state.evidence == OttEvidenceFilter.CONFIRMED) { onSelectEvidence(OttEvidenceFilter.CONFIRMED) } }
                item { OttChipV054("Reported", state.evidence == OttEvidenceFilter.REPORTED) { onSelectEvidence(OttEvidenceFilter.REPORTED) } }
            }
        }
        Button(
            onClick = onClose,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            colors = ButtonDefaults.buttonColors(containerColor = OttGold, contentColor = OttInk),
        ) {
            Text("Show results", fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(22.dp))
    }
}

@Composable
private fun OttReleaseSectionV066(
    eyebrow: String,
    title: String,
    subtitle: String,
    items: List<OttRelease>,
    emptyMessage: String,
    onSeeAll: () -> Unit,
    onOpenRelease: (OttRelease) -> Unit,
) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(11.dp)) {
        EditorialSectionV2(eyebrow, title, trailing = {
            TextButton(onClick = onSeeAll, enabled = items.isNotEmpty()) {
                Text("See all →", color = if (items.isNotEmpty()) OttGold else OttMuted, fontSize = 12.sp)
            }
        })
        if (subtitle.isNotBlank()) {
            Text(
                subtitle,
                color = OttMuted,
                fontSize = CineEditorial.Metadata,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (items.isEmpty()) {
            Text(emptyMessage, color = OttMuted, fontSize = CineEditorial.Body,
                lineHeight = 19.sp, modifier = Modifier.padding(vertical = 16.dp))
        } else {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(items.take(12), key = { it.id }) { release ->
                    OttCompactCardV080(release) { onOpenRelease(release) }
                }
            }
        }
    }
}

@Composable
private fun OttCompactCardV080(release: OttRelease, onClick: () -> Unit) {
    val confirmed = release.evidenceStatus == "CONFIRMED"
    val status = if (confirmed) "Confirmed" else prettyOttV054(release.evidenceStatus)
    val date = ottDisplayDateV081(release.releaseDate, release.datePrecision, release.state)
    // No official poster URL exists in this feed. Use original typography-based
    // cover art, never an invented movie poster or an unlicensed thumbnail.
    Surface(
        color = OttPanel,
        shape = RoundedCornerShape(CineEditorial.CardRadius),
        modifier = Modifier.width(168.dp).clickable(onClick = onClick),
    ) {
        Column {
            CineTitleCoverV21(
                title = release.entity.name,
                eyebrow = "STREAMING",
                modifier = Modifier.fillMaxWidth().height(194.dp),
            )
            Column(
                modifier = Modifier.fillMaxWidth().padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OttProviderMarkV066(release.provider)
                    Spacer(Modifier.width(6.dp))
                    Text(
                        release.provider.name,
                        color = OttText,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        if (confirmed) Icons.Default.CheckCircle else Icons.Default.Info,
                        contentDescription = status,
                        tint = if (confirmed) OttGreen else OttAmber,
                        modifier = Modifier.size(15.dp),
                    )
                    Spacer(Modifier.width(5.dp))
                    Text(
                        date,
                        color = OttMuted,
                        fontSize = CineEditorial.Metadata,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
private fun OttCompactListRowV080(release:OttRelease,modifier:Modifier=Modifier,onClick:()->Unit){
    Surface(color=OttPanel,shape=RoundedCornerShape(DiscoveryUiV080.CardRadius),
        modifier=modifier.fillMaxWidth().clickable(onClick=onClick)){
        Row(Modifier.padding(14.dp),horizontalArrangement=Arrangement.spacedBy(12.dp),verticalAlignment=Alignment.CenterVertically){
            OttProviderMarkV066(release.provider)
            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(5.dp)){
                Text(release.entity.name,color=OttText,fontSize=CineEditorial.CardTitle,lineHeight=22.sp,fontWeight=FontWeight.Bold,
                    maxLines=2,overflow=TextOverflow.Ellipsis)
                Text(release.provider.name+" • "+ottDisplayDateV081(release.releaseDate, release.datePrecision, release.state),
                    color=OttMuted,fontSize=CineEditorial.Metadata)
                Text(if(release.evidenceStatus=="CONFIRMED")"Confirmed" else prettyOttV054(release.evidenceStatus),
                    color=if(release.evidenceStatus=="CONFIRMED")OttGreen else OttAmber,fontSize = CineEditorial.Metadata)
            }
        }
    }
}

@Composable
private fun OttProviderRowV054(providers: List<OttProvider>, selectedCode: String?, onSelect: (String?) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text("PLATFORM", color = OttMuted, fontSize = CineEditorial.Metadata, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item { OttChipV054("All", selectedCode == null) { onSelect(null) } }
            items(providers, key = { it.code }) { provider ->
                OttChipV054(provider.name, selectedCode == provider.code) { onSelect(provider.code) }
            }
        }
    }
}

@Composable
private fun OttChipV054(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        color = if (selected) OttGold.copy(alpha = 0.16f) else OttRaised,
        contentColor = if (selected) OttGold else OttMuted,
        shape = RoundedCornerShape(50),
        modifier = Modifier.clickable(onClick = onClick),
    ) {
        Text(
            label,
            fontSize = CineEditorial.Metadata,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 11.dp, vertical = 7.dp),
        )
    }
}

@Composable
private fun OttReleaseCardV069(release: OttRelease, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val evidenceColor = when (release.evidenceStatus) {
        "CONFIRMED" -> OttGreen
        "REPORTED" -> OttAmber
        else -> OttBlue
    }
    val stateLabel = when (release.state) {
        "RELEASED" -> "Now streaming"
        "UPCOMING" -> "Upcoming"
        "DELAYED" -> "Delayed"
        else -> "Date TBA"
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = OttRaised),
        shape = RoundedCornerShape(CineEditorial.CardRadius),
        modifier = modifier,
    ) {
        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                OttProviderMarkV066(release.provider)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        release.provider.name.ifBlank { release.provider.code.ifBlank { "OTT" } },
                        color = OttText,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(stateLabel, color = OttMuted, fontSize = CineEditorial.Metadata, fontWeight = FontWeight.SemiBold)
                }
                Surface(color = evidenceColor.copy(alpha = 0.12f), shape = RoundedCornerShape(50)) {
                    Text(
                        if (release.evidenceStatus == "CONFIRMED") "Confirmed" else prettyOttV054(release.evidenceStatus),
                        color = evidenceColor,
                        fontSize = CineEditorial.Metadata,
                        fontWeight = FontWeight.Black,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                    )
                }
            }

            Row(verticalAlignment = Alignment.Top) {
                Surface(color = OttGold.copy(alpha = 0.10f), shape = RoundedCornerShape(CineEditorial.CardRadius)) {
                    Column(
                        modifier = Modifier.width(62.dp).padding(horizontal = 7.dp, vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(ottDatePrimaryV054(release), color = OttGold, fontSize = 20.sp, fontWeight = FontWeight.Black)
                        Text(ottDateSecondaryV054(release), color = OttMuted, fontSize = CineEditorial.Metadata, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Text(
                        release.entity.name,
                        color = OttText,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        lineHeight = 22.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                        maxItemsInEachRow = 3,
                    ) {
                        OttMetaChipV066(
                            when (release.entity.type.uppercase(Locale.ENGLISH)) {
                                "SERIES", "SEASON" -> "Series"
                                else -> "Movie"
                            },
                            OttGold,
                        )
                        release.languages.take(2).forEach { language -> OttMetaChipV066(languageNameV054(language), OttBlue) }
                        ottReleaseTypeLabelV066(release.releaseType)?.let { OttMetaChipV066(it, OttMuted) }
                    }
                }
            }

            release.previousReleaseDate?.takeIf { it != release.releaseDate }?.let { previous ->
                Surface(color = OttAmber.copy(alpha = 0.08f), shape = RoundedCornerShape(11.dp)) {
                    Text(
                        "Date updated from ${formatOttDateV054(previous)}",
                        color = OttAmber,
                        fontSize = CineEditorial.Metadata,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 9.dp, vertical = 7.dp),
                    )
                }
            }

            if (release.evidence.conflicting > 0) {
                Surface(color = OttAmber.copy(alpha = 0.08f), shape = RoundedCornerShape(11.dp)) {
                    Text(
                        "Sources disagree on this date. Check the source before sharing.",
                        color = OttAmber,
                        fontSize = CineEditorial.Metadata,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 9.dp, vertical = 7.dp),
                    )
                }
            }

            HorizontalDivider(color = OttLine)

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (release.evidence.firstParty > 0) Icons.Default.CheckCircle else Icons.Default.Info,
                    contentDescription = null,
                    tint = if (release.evidence.firstParty > 0) OttGreen else OttMuted,
                    modifier = Modifier.size(14.dp),
                )
                Spacer(Modifier.width(6.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        when {
                            release.evidence.firstParty > 0 -> "${release.evidence.firstParty} official source${if (release.evidence.firstParty == 1) "" else "s"}"
                            else -> "${release.evidence.total} source${if (release.evidence.total == 1) "" else "s"}"
                        },
                        color = OttMuted,
                        fontSize = CineEditorial.Metadata,
                    )
                    release.lastVerifiedAt?.let {
                        Text("Checked ${ottTimeAgoV066(it)}", color = OttMuted, fontSize = CineEditorial.Metadata)
                    }
                }
            }

            val sourceRef = release.evidence.refs.firstOrNull { !it.canonicalUrl.isNullOrBlank() }
            if (sourceRef != null) {
                Surface(color = OttInk.copy(alpha = 0.34f), shape = RoundedCornerShape(CineEditorial.CardRadius), modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.padding(start = 10.dp, end = 5.dp, top = 6.dp, bottom = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("Source", color = OttMuted, fontSize = CineEditorial.Metadata, fontWeight = FontWeight.Black, letterSpacing = 0.7.sp)
                            Text(
                                sourceRef.source.name ?: sourceRef.title ?: "Evidence source",
                                color = OttText,
                                fontSize = CineEditorial.Metadata,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        TextButton(
                            onClick = {
                                sourceRef.canonicalUrl?.let { url ->
                                    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                                }
                            },
                            contentPadding = PaddingValues(horizontal = 7.dp, vertical = 1.dp),
                        ) {
                            Icon(Icons.Default.OpenInNew, contentDescription = null, modifier = Modifier.size(12.dp))
                            Spacer(Modifier.width(3.dp))
                            Text("Open", fontSize = CineEditorial.Metadata, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OttProviderMarkV066(provider: OttProvider) {
    Surface(color = OttGold.copy(alpha = 0.12f), shape = RoundedCornerShape(CineEditorial.CardRadius), modifier = Modifier.size(42.dp)) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                ottProviderMarkV066(provider.code, provider.name),
                color = OttGold,
                fontSize = if (provider.code == "AHA") 10.sp else 12.sp,
                fontWeight = FontWeight.Black,
            )
        }
    }
}

@Composable
private fun OttMetaChipV066(label: String, accent: Color) {
    Surface(color = accent.copy(alpha = 0.09f), shape = RoundedCornerShape(50)) {
        Text(label, color = accent, fontSize = CineEditorial.Metadata, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 7.dp, vertical = 4.dp))
    }
}

private fun ottProviderMarkV066(code: String, name: String): String = when (code.uppercase(Locale.ENGLISH)) {
    "NETFLIX" -> "N"
    "PRIME_VIDEO" -> "PV"
    "JIOHOTSTAR" -> "JH"
    "ZEE5" -> "Z5"
    "SONYLIV" -> "SL"
    "AHA" -> "aha"
    "SUN_NXT" -> "SN"
    "ETV_WIN" -> "EW"
    else -> name.split(' ').mapNotNull { it.firstOrNull()?.uppercase() }.take(2).joinToString("").ifBlank { "OTT" }
}

private fun ottReleaseTypeLabelV066(value: String): String? = when (value) {
    "ORIGINAL" -> "OTT original"
    "POST_THEATRICAL" -> "Post-theatrical"
    else -> null
}

private fun ottWeekendLabelV060(start: String?, end: String?): String {
    if (start.isNullOrBlank() || end.isNullOrBlank()) return "Friday to Sunday"
    val startDate = runCatching { LocalDate.parse(start) }.getOrNull() ?: return "Friday to Sunday"
    val endDate = runCatching { LocalDate.parse(end) }.getOrNull() ?: return "Friday to Sunday"
    val formatter = DateTimeFormatter.ofPattern("d MMM", Locale.ENGLISH)
    return if (startDate == endDate) startDate.format(formatter) else "${startDate.format(formatter)} – ${endDate.format(formatter)}"
}

private fun ottDatePrimaryV054(release: OttRelease): String =
    ottDateTilePartsV081(release.releaseDate, release.datePrecision, release.state).first

private fun ottDateSecondaryV054(release: OttRelease): String =
    ottDateTilePartsV081(release.releaseDate, release.datePrecision, release.state).second

/** Date precision is evidence, not an invitation to invent a calendar day. */
internal fun ottDateTilePartsV081(dateIso: String?, precision: String?, state: String): Pair<String, String> {
    val date = dateIso?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
    val month = date?.format(DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH))?.uppercase(Locale.ENGLISH)
    return when {
        date == null || precision == null || precision.equals("TBA", ignoreCase = true) ->
            (if (state == "RELEASED") "NOW" else "TBA") to "DATE UNKNOWN"
        precision.equals("DAY", ignoreCase = true) -> date.dayOfMonth.toString() to (month ?: "—")
        precision.equals("MONTH", ignoreCase = true) -> (month ?: "TBA") to date.year.toString()
        precision.equals("YEAR", ignoreCase = true) -> date.year.toString() to "YEAR ONLY"
        else -> "TBA" to "DATE UNKNOWN"
    }
}

internal fun ottDisplayDateV081(dateIso: String?, precision: String?, state: String): String {
    val date = dateIso?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
    if (date == null || precision == null) {
        return if (state == "RELEASED") "Available now · date unknown" else "Date to be announced"
    }
    return when (precision.uppercase(Locale.ENGLISH)) {
        "DAY" -> date.format(DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH))
        "MONTH" -> date.format(DateTimeFormatter.ofPattern("MMM yyyy", Locale.ENGLISH)) + " · day TBA"
        "YEAR" -> date.year.toString() + " · month TBA"
        else -> if (state == "RELEASED") "Available now · date unknown" else "Date to be announced"
    }
}

private fun formatOttDateV054(value: String): String = runCatching {
    LocalDate.parse(value).format(DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH))
}.getOrDefault(value)

private fun languageNameV054(value: String): String = when (value.lowercase()) {
    "te" -> "Telugu"
    "ta" -> "Tamil"
    "ml" -> "Malayalam"
    "kn" -> "Kannada"
    "hi" -> "Hindi"
    "en" -> "English"
    else -> value.uppercase(Locale.ENGLISH)
}

private fun prettyOttV054(value: String): String = value
    .lowercase(Locale.ENGLISH)
    .split('_')
    .joinToString(" ") { token -> token.replaceFirstChar { it.titlecase(Locale.ENGLISH) } }

private fun ottTimeAgoV066(value: String): String {
    val instant = runCatching { Instant.parse(value) }.getOrNull() ?: return "recently"
    val minutes = Duration.between(instant, Instant.now()).toMinutes().coerceAtLeast(0)
    return when {
        minutes < 1 -> "now"
        minutes < 60 -> "${minutes}m ago"
        minutes < 1_440 -> "${minutes / 60}h ago"
        else -> "${minutes / 1_440}d ago"
    }
}
