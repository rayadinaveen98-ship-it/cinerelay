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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
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

private val OttInk = Color(0xFF0D0F13)
private val OttPanel = Color(0xFF15181E)
private val OttRaised = Color(0xFF1B1F27)
private val OttLine = Color(0xFF2A303A)
private val OttText = Color(0xFFF4F1EA)
private val OttMuted = Color(0xFFA7ADB7)
private val OttGold = Color(0xFFE7C36B)
private val OttGreen = Color(0xFF72D6A4)
private val OttAmber = Color(0xFFF0B862)
private val OttBlue = Color(0xFF8CB9FF)
private val OttRed = Color(0xFFF08079)

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
    modifier: Modifier = Modifier,
) {
    var filtersExpanded by remember { mutableStateOf(false) }
    MaterialTheme(colorScheme = OttColors) {
        Surface(modifier = modifier.fillMaxSize(), color = OttInk) {
            Scaffold(
                containerColor = OttInk,
                topBar = {
                    TopAppBar(
                        colors = TopAppBarDefaults.topAppBarColors(containerColor = OttInk),
                        title = {
                            Column {
                                Text("CINERELAY OTT", color = OttGold, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.7.sp)
                                Text("Streaming Guide", color = OttText, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                            }
                        },
                        actions = {
                            IconButton(onClick = onRefresh, enabled = !state.loading) {
                                if (state.loading) CircularProgressIndicator(Modifier.size(19.dp), strokeWidth = 2.dp, color = OttGold)
                                else Icon(Icons.Default.Refresh, contentDescription = "Refresh OTT releases", tint = OttMuted)
                            }
                        },
                    )
                },
            ) { padding ->
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 4.dp, bottom = 118.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    item { OttOverviewV066(state) }

                    item {
                        OttFiltersV060(
                            state = state,
                            expanded = filtersExpanded,
                            onToggle = { filtersExpanded = !filtersExpanded },
                            onSelectProvider = onSelectProvider,
                            onSelectLanguage = onSelectLanguage,
                            onSelectContentType = onSelectContentType,
                            onSelectEvidence = onSelectEvidence,
                        )
                    }

                    state.error?.let { message ->
                        item {
                            Surface(color = OttRed.copy(alpha = 0.10f), shape = RoundedCornerShape(14.dp)) {
                                Text(message, color = OttRed, fontSize = 11.sp, modifier = Modifier.fillMaxWidth().padding(12.dp))
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
                        item {
                            OttReleaseSectionV066(
                                eyebrow = "WEEKEND",
                                title = "This Weekend",
                                subtitle = ottWeekendLabelV060(state.weekendStart, state.weekendEnd),
                                items = state.weekendItems,
                                emptyMessage = "No confirmed or reported releases are mapped to this weekend yet.",
                            )
                        }
                        item {
                            OttReleaseSectionV066(
                                eyebrow = "TODAY",
                                title = "Today’s OTT Releases",
                                subtitle = state.today?.let { formatOttDateV054(it) } ?: "What is available today",
                                items = state.todayItems,
                                emptyMessage = "No evidence-backed OTT premieres are dated for today yet.",
                            )
                        }
                        item {
                            OttReleaseSectionV066(
                                eyebrow = "COMING SOON",
                                title = "Coming in the Next 30 Days",
                                subtitle = state.windowEnd?.let { "Through ${formatOttDateV054(it)}" } ?: "Confirmed and reported upcoming premieres",
                                items = state.upcomingItems,
                                emptyMessage = "No matching upcoming releases are currently backed by retained evidence.",
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OttOverviewV066(state: OttUiState) {
    Surface(color = OttPanel, shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("OTT RELEASE INTELLIGENCE", color = OttGold, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.1.sp)
                    Text("What should I watch next?", color = OttText, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                }
                Surface(color = OttGreen.copy(alpha = 0.10f), shape = RoundedCornerShape(50)) {
                    Row(Modifier.padding(horizontal = 9.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(6.dp).clip(CircleShape).background(OttGreen))
                        Spacer(Modifier.width(5.dp))
                        Text("Evidence-backed", color = OttGreen, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
            Text(
                "Weekend first, then today and the next 30 days. Platform, language and verification controls stay optional.",
                color = OttMuted,
                fontSize = 11.sp,
                lineHeight = 17.sp,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OttCountPillV060("Weekend", state.weekendItems.size, Modifier.weight(1f))
                OttCountPillV060("Today", state.todayItems.size, Modifier.weight(1f))
                OttCountPillV060("30 days", state.upcomingItems.size, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun OttCountPillV060(label: String, count: Int, modifier: Modifier = Modifier) {
    Surface(color = OttRaised, shape = RoundedCornerShape(16.dp), modifier = modifier) {
        Column(Modifier.padding(horizontal = 10.dp, vertical = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(count.toString(), color = OttGold, fontSize = 17.sp, fontWeight = FontWeight.Black)
            Text(label, color = OttMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun OttFiltersV060(
    state: OttUiState,
    expanded: Boolean,
    onToggle: () -> Unit,
    onSelectProvider: (String?) -> Unit,
    onSelectLanguage: (String?) -> Unit,
    onSelectContentType: (OttContentType) -> Unit,
    onSelectEvidence: (OttEvidenceFilter) -> Unit,
) {
    val activeCount = listOf(
        state.providerCode != null,
        state.language != null,
        state.contentType != OttContentType.ALL,
        state.evidence != OttEvidenceFilter.ALL,
    ).count { it }

    Surface(color = OttPanel, shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth().clickable(onClick = onToggle).padding(horizontal = 15.dp, vertical = 13.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Filters", color = OttText, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text(
                        if (activeCount == 0) "Optional · platform, language and verification" else "$activeCount active filter${if (activeCount == 1) "" else "s"}",
                        color = if (activeCount == 0) OttMuted else OttGold,
                        fontSize = 9.sp,
                    )
                }
                Text(if (expanded) "Hide" else "Show", color = OttGold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }

            if (expanded) {
                HorizontalDivider(color = OttLine)
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                    OttProviderRowV054(state.providers, state.providerCode, onSelectProvider)
                    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        Text("LANGUAGE", color = OttMuted, fontSize = 8.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(OttLanguages, key = { it.first ?: "all" }) { (code, label) ->
                                OttChipV054(label, state.language == code) { onSelectLanguage(code) }
                            }
                        }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        Text("CONTENT", color = OttMuted, fontSize = 8.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            item { OttChipV054("Movies + Series", state.contentType == OttContentType.ALL) { onSelectContentType(OttContentType.ALL) } }
                            item { OttChipV054("Movies", state.contentType == OttContentType.MOVIES) { onSelectContentType(OttContentType.MOVIES) } }
                            item { OttChipV054("Series", state.contentType == OttContentType.SERIES) { onSelectContentType(OttContentType.SERIES) } }
                        }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        Text("VERIFICATION", color = OttMuted, fontSize = 8.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            item { OttChipV054("All evidence", state.evidence == OttEvidenceFilter.ALL) { onSelectEvidence(OttEvidenceFilter.ALL) } }
                            item { OttChipV054("Confirmed", state.evidence == OttEvidenceFilter.CONFIRMED) { onSelectEvidence(OttEvidenceFilter.CONFIRMED) } }
                            item { OttChipV054("Reported", state.evidence == OttEvidenceFilter.REPORTED) { onSelectEvidence(OttEvidenceFilter.REPORTED) } }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OttReleaseSectionV066(
    eyebrow: String,
    title: String,
    subtitle: String,
    items: List<OttRelease>,
    emptyMessage: String,
) {
    Surface(color = OttPanel, shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(vertical = 15.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(eyebrow, color = OttGold, fontSize = 8.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
                    Text(title, color = OttText, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(3.dp))
                    Text(subtitle, color = OttMuted, fontSize = 10.sp)
                }
                Surface(color = OttRaised, shape = RoundedCornerShape(50)) {
                    Text("${items.size}", color = OttGold, fontSize = 10.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp))
                }
            }
            if (items.isEmpty()) {
                Text(
                    emptyMessage,
                    color = OttMuted,
                    fontSize = 11.sp,
                    lineHeight = 17.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                )
            } else {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 14.dp),
                    horizontalArrangement = Arrangement.spacedBy(11.dp),
                ) {
                    items(items, key = { it.id }) { release ->
                        OttReleaseCardV066(release, Modifier.width(300.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun OttProviderRowV054(providers: List<OttProvider>, selectedCode: String?, onSelect: (String?) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text("PLATFORM", color = OttMuted, fontSize = 8.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
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
            fontSize = 10.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 11.dp, vertical = 7.dp),
        )
    }
}

@Composable
private fun OttReleaseCardV066(release: OttRelease, modifier: Modifier = Modifier) {
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
        shape = RoundedCornerShape(22.dp),
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
                    Text(stateLabel, color = OttMuted, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
                }
                Surface(color = evidenceColor.copy(alpha = 0.12f), shape = RoundedCornerShape(50)) {
                    Text(
                        if (release.evidenceStatus == "CONFIRMED") "Confirmed" else prettyOttV054(release.evidenceStatus),
                        color = evidenceColor,
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Black,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                    )
                }
            }

            Row(verticalAlignment = Alignment.Top) {
                Surface(color = OttGold.copy(alpha = 0.10f), shape = RoundedCornerShape(15.dp)) {
                    Column(
                        modifier = Modifier.width(62.dp).padding(horizontal = 7.dp, vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(ottDatePrimaryV054(release), color = OttGold, fontSize = 20.sp, fontWeight = FontWeight.Black)
                        Text(ottDateSecondaryV054(release), color = OttMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
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
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
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
                        fontSize = 9.sp,
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
                Text(
                    when {
                        release.evidence.firstParty > 0 -> "${release.evidence.firstParty} official source${if (release.evidence.firstParty == 1) "" else "s"}"
                        else -> "${release.evidence.total} retained source${if (release.evidence.total == 1) "" else "s"}"
                    },
                    color = OttMuted,
                    fontSize = 9.sp,
                    modifier = Modifier.weight(1f),
                )
                release.lastVerifiedAt?.let {
                    Text("Verified ${ottTimeAgoV066(it)}", color = OttMuted, fontSize = 8.sp)
                }
            }

            val sourceRef = release.evidence.refs.firstOrNull { !it.canonicalUrl.isNullOrBlank() }
            if (sourceRef != null) {
                Surface(color = OttInk.copy(alpha = 0.34f), shape = RoundedCornerShape(13.dp), modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.padding(start = 10.dp, end = 5.dp, top = 6.dp, bottom = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("SOURCE", color = OttMuted, fontSize = 7.sp, fontWeight = FontWeight.Black, letterSpacing = 0.7.sp)
                            Text(
                                sourceRef.source.name ?: sourceRef.title ?: "Evidence source",
                                color = OttText,
                                fontSize = 9.sp,
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
                            Text("Open", fontSize = 8.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OttProviderMarkV066(provider: OttProvider) {
    Surface(color = OttGold.copy(alpha = 0.12f), shape = RoundedCornerShape(13.dp), modifier = Modifier.size(42.dp)) {
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
        Text(label, color = accent, fontSize = 8.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 7.dp, vertical = 4.dp))
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

private fun ottDatePrimaryV054(release: OttRelease): String {
    val date = release.releaseDate ?: return "TBA"
    return runCatching { LocalDate.parse(date).dayOfMonth.toString() }.getOrDefault("—")
}

private fun ottDateSecondaryV054(release: OttRelease): String {
    val date = release.releaseDate ?: return release.datePrecision
    return runCatching {
        LocalDate.parse(date).format(DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH)).uppercase(Locale.ENGLISH)
    }.getOrDefault("DATE")
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
