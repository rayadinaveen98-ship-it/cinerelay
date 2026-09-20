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
    MaterialTheme(colorScheme = OttColors) {
        Surface(modifier = modifier.fillMaxSize(), color = OttInk) {
            Scaffold(
                containerColor = OttInk,
                topBar = {
                    TopAppBar(
                        colors = TopAppBarDefaults.topAppBarColors(containerColor = OttInk),
                        title = {
                            Column {
                                Text("OTT", color = OttGold, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.7.sp)
                                Text("OTT Releases", color = OttText, fontSize = 22.sp, fontWeight = FontWeight.Bold)
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
                    contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 6.dp, bottom = 104.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item {
                        Text(
                            "Evidence-backed streaming calendar for India. Confirmed dates stay separate from reported dates.",
                            color = OttMuted,
                            fontSize = 11.sp,
                            lineHeight = 16.sp,
                        )
                    }

                    item {
                        OttWindowRowV054(state.window, onSelectWindow)
                    }

                    item {
                        OttProviderRowV054(state.providers, state.providerCode, onSelectProvider)
                    }

                    item {
                        OttFilterRowsV054(
                            state = state,
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

                    if (state.loading && state.items.isEmpty()) {
                        item {
                            Box(Modifier.fillMaxWidth().height(180.dp), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(color = OttGold, strokeWidth = 2.dp)
                            }
                        }
                    } else if (!state.loading && state.items.isEmpty()) {
                        item { OttEmptyV054(state) }
                    } else {
                        items(state.items, key = { it.id }) { release ->
                            OttReleaseCardV054(release)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OttWindowRowV054(selected: OttWindow, onSelect: (OttWindow) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item { OttChipV054("Today", selected == OttWindow.TODAY) { onSelect(OttWindow.TODAY) } }
        item { OttChipV054("This week", selected == OttWindow.THIS_WEEK) { onSelect(OttWindow.THIS_WEEK) } }
        item { OttChipV054("Upcoming", selected == OttWindow.UPCOMING) { onSelect(OttWindow.UPCOMING) } }
        item { OttChipV054("Released", selected == OttWindow.RELEASED) { onSelect(OttWindow.RELEASED) } }
    }
}

@Composable
private fun OttProviderRowV054(providers: List<OttProvider>, selectedCode: String?, onSelect: (String?) -> Unit) {
    Column {
        Text("PLATFORM", color = OttMuted, fontSize = 8.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
        Spacer(Modifier.height(7.dp))
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item { OttChipV054("All", selectedCode == null) { onSelect(null) } }
            items(providers, key = { it.code }) { provider ->
                OttChipV054(provider.name, selectedCode == provider.code) { onSelect(provider.code) }
            }
        }
    }
}

@Composable
private fun OttFilterRowsV054(
    state: OttUiState,
    onSelectLanguage: (String?) -> Unit,
    onSelectContentType: (OttContentType) -> Unit,
    onSelectEvidence: (OttEvidenceFilter) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(OttLanguages, key = { it.first ?: "all" }) { (code, label) ->
                OttChipV054(label, state.language == code) { onSelectLanguage(code) }
            }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item { OttChipV054("Movies + Series", state.contentType == OttContentType.ALL) { onSelectContentType(OttContentType.ALL) } }
            item { OttChipV054("Movies", state.contentType == OttContentType.MOVIES) { onSelectContentType(OttContentType.MOVIES) } }
            item { OttChipV054("Series", state.contentType == OttContentType.SERIES) { onSelectContentType(OttContentType.SERIES) } }
            item { OttChipV054("All evidence", state.evidence == OttEvidenceFilter.ALL) { onSelectEvidence(OttEvidenceFilter.ALL) } }
            item { OttChipV054("Confirmed", state.evidence == OttEvidenceFilter.CONFIRMED) { onSelectEvidence(OttEvidenceFilter.CONFIRMED) } }
            item { OttChipV054("Reported", state.evidence == OttEvidenceFilter.REPORTED) { onSelectEvidence(OttEvidenceFilter.REPORTED) } }
            item { OttChipV054("Date TBA", state.evidence == OttEvidenceFilter.TBA) { onSelectEvidence(OttEvidenceFilter.TBA) } }
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
private fun OttEmptyV054(state: OttUiState) {
    Surface(color = OttPanel, shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(horizontal = 20.dp, vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(9.dp).clip(CircleShape).background(OttGold))
            Spacer(Modifier.height(12.dp))
            Text("No matching OTT releases yet", color = OttText, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(6.dp))
            Text(
                "CineRelay will not invent a date to fill this screen. Releases appear when evidence reaches the selected window and filters.",
                color = OttMuted,
                fontSize = 11.sp,
                lineHeight = 17.sp,
            )
            if (state.providers.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                Text(
                    "Tracking ${state.providers.size} OTT platforms in the India registry.",
                    color = OttGold,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
private fun OttReleaseCardV054(release: OttRelease) {
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
        colors = CardDefaults.cardColors(containerColor = OttPanel),
        shape = RoundedCornerShape(22.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(15.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Surface(color = OttGold.copy(alpha = 0.10f), shape = RoundedCornerShape(14.dp)) {
                    Column(
                        modifier = Modifier.width(64.dp).padding(horizontal = 8.dp, vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(ottDatePrimaryV054(release), color = OttGold, fontSize = 16.sp, fontWeight = FontWeight.Black)
                        Text(ottDateSecondaryV054(release), color = OttMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            release.provider.name.ifBlank { release.provider.code.ifBlank { "OTT" } },
                            color = OttGold,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Spacer(Modifier.width(7.dp))
                        Surface(color = evidenceColor.copy(alpha = 0.12f), shape = RoundedCornerShape(50)) {
                            Text(
                                prettyOttV054(release.evidenceStatus),
                                color = evidenceColor,
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Black,
                                modifier = Modifier.padding(horizontal = 7.dp, vertical = 4.dp),
                            )
                        }
                    }
                    Spacer(Modifier.height(5.dp))
                    Text(
                        release.entity.name,
                        color = OttText,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                        lineHeight = 23.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        listOfNotNull(
                            release.entity.type.takeIf { it.isNotBlank() }?.let(::prettyOttV054),
                            release.languages.takeIf { it.isNotEmpty() }?.joinToString(" • ") { languageNameV054(it) },
                            stateLabel,
                        ).joinToString("  •  "),
                        color = OttMuted,
                        fontSize = 10.sp,
                    )
                }
            }

            release.previousReleaseDate?.takeIf { it != release.releaseDate }?.let { previous ->
                Spacer(Modifier.height(11.dp))
                Surface(color = OttAmber.copy(alpha = 0.08f), shape = RoundedCornerShape(12.dp)) {
                    Text(
                        "Date updated from ${formatOttDateV054(previous)}",
                        color = OttAmber,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
                    )
                }
            }

            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = OttLine)
            Spacer(Modifier.height(10.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (release.evidence.firstParty > 0) Icons.Default.CheckCircle else Icons.Default.Info,
                    contentDescription = null,
                    tint = if (release.evidence.firstParty > 0) OttGreen else OttMuted,
                    modifier = Modifier.size(15.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    "${release.evidence.total} evidence • ${release.evidence.firstParty} first-party${if (release.evidence.conflicting > 0) " • ${release.evidence.conflicting} conflicting" else ""}",
                    color = OttMuted,
                    fontSize = 10.sp,
                    modifier = Modifier.weight(1f),
                )
            }

            val sourceRef = release.evidence.refs.firstOrNull { !it.canonicalUrl.isNullOrBlank() }
            if (sourceRef != null) {
                Spacer(Modifier.height(7.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        sourceRef.source.name ?: sourceRef.title ?: "Evidence source",
                        color = OttText,
                        fontSize = 10.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(
                        onClick = {
                            sourceRef.canonicalUrl?.let { url ->
                                runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                            }
                        },
                        contentPadding = PaddingValues(horizontal = 7.dp, vertical = 2.dp),
                    ) {
                        Icon(Icons.Default.OpenInNew, contentDescription = null, modifier = Modifier.size(13.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Evidence", fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            release.lastVerifiedAt?.let { verified ->
                Spacer(Modifier.height(3.dp))
                Text("Last verified ${verified.take(10)}", color = OttMuted, fontSize = 8.sp)
            }
        }
    }
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
