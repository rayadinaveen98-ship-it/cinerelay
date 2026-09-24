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
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.cinerelay.app.data.PersonalizationSource

private val PersonalInk = Color(0xFF0D0F13)
private val PersonalPanel = Color(0xFF171A20)
private val PersonalRaised = Color(0xFF20242C)
private val PersonalText = Color(0xFFF4F1EA)
private val PersonalMuted = Color(0xFFA8ADB7)
private val PersonalGold = Color(0xFFE8C56D)
private val PersonalGreen = Color(0xFF73D6A5)
private val PersonalRed = Color(0xFFF08079)

@Composable
fun PersonalizationOnboardingV055(
    state: ConsumerUiStateV055,
    onToggleLanguage: (String) -> Unit,
    onToggleSource: (String) -> Unit,
    onSave: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val personalization = state.personalization
    var step by remember { mutableIntStateOf(0) }
    var query by remember { mutableStateOf("") }
    var showAllChannels by remember { mutableStateOf(false) }

    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = PersonalGold,
            background = PersonalInk,
            surface = PersonalPanel,
            surfaceVariant = PersonalRaised,
            onBackground = PersonalText,
            onSurface = PersonalText,
            onSurfaceVariant = PersonalMuted,
            error = PersonalRed,
        ),
    ) {
        Surface(modifier = modifier.fillMaxSize(), color = PersonalInk) {
            when {
                state.personalizationLoading || personalization == null -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = PersonalGold, strokeWidth = 2.dp)
                    }
                }
                step == 0 -> {
                    Column(
                        Modifier.fillMaxSize().padding(horizontal = 22.dp, vertical = 28.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        Spacer(Modifier.height(16.dp))
                        Text("Make CineRelay yours", color = PersonalGold, fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
                        Text("Which cinema do you follow?", color = PersonalText, fontSize = 30.sp, fontWeight = FontWeight.Bold, lineHeight = 34.sp)
                        Text("Pick the languages you care about. These choices shape your Home screen, not your notification settings.", color = PersonalMuted, fontSize = 14.sp, lineHeight = 21.sp)

                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            personalization.availableLanguages.forEach { language ->
                                val selected = language.code in state.selectedLanguages
                                Surface(
                                    color = if (selected) PersonalGold.copy(alpha = 0.13f) else PersonalPanel,
                                    shape = RoundedCornerShape(16.dp),
                                    modifier = Modifier.fillMaxWidth().clickable { onToggleLanguage(language.code) },
                                ) {
                                    Row(
                                        Modifier.padding(horizontal = 16.dp, vertical = 15.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Box(
                                            Modifier.size(10.dp).clip(CircleShape)
                                                .background(if (selected) PersonalGreen else PersonalMuted.copy(alpha = 0.35f)),
                                        )
                                        Spacer(Modifier.width(12.dp))
                                        Text(language.label, color = PersonalText, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                                        if (selected) Icon(Icons.Default.Check, contentDescription = null, tint = PersonalGold)
                                    }
                                }
                            }
                        }

                        state.personalizationError?.let {
                            Text(it, color = PersonalRed, fontSize = 12.sp)
                        }
                        Spacer(Modifier.weight(1f))
                        Button(
                            onClick = {
                                if (state.selectedLanguages.isNotEmpty()) {
                                    query = ""
                                    showAllChannels = false
                                    step = 1
                                }
                            },
                            enabled = state.selectedLanguages.isNotEmpty(),
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = PersonalGold, contentColor = Color(0xFF241C09)),
                            contentPadding = PaddingValues(vertical = 15.dp),
                        ) {
                            Text("Choose favorite channels", fontWeight = FontWeight.Bold)
                        }
                    }
                }
                else -> {
                    val recommendations = recommendedSourcesV060(
                        sources = personalization.availableSources,
                        selectedLanguages = state.selectedLanguages,
                    )
                    val filtered = personalization.availableSources.filter { source ->
                        query.isBlank() || source.name.contains(query, ignoreCase = true) || source.handle.orEmpty().contains(query, ignoreCase = true)
                    }
                    val visibleSources = if (showAllChannels) filtered else recommendations

                    Column(Modifier.fillMaxSize()) {
                        Row(
                            Modifier.fillMaxWidth().padding(start = 8.dp, end = 20.dp, top = 18.dp, bottom = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            IconButton(onClick = { step = 0 }) {
                                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = PersonalText)
                            }
                            Column(Modifier.weight(1f)) {
                                Text(if (showAllChannels) "All official channels" else "Recommended for you", color = PersonalText, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                                Text(
                                    if (showAllChannels) "Browse all ${personalization.availableSources.size} official YouTube channels"
                                    else "Start with five strong picks. You can browse every channel anytime.",
                                    color = PersonalMuted,
                                    fontSize = 12.sp,
                                )
                            }
                        }

                        if (showAllChannels) {
                            OutlinedTextField(
                                value = query,
                                onValueChange = { query = it.take(60) },
                                singleLine = true,
                                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                                placeholder = { Text("Search channels", color = PersonalMuted) },
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
                                shape = RoundedCornerShape(16.dp),
                            )
                        } else {
                            val languageLabels = personalization.availableLanguages
                                .filter { it.code in state.selectedLanguages }
                                .joinToString(" • ") { it.label }
                            if (languageLabels.isNotBlank()) {
                                Text(
                                    languageLabels,
                                    color = PersonalGold,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 22.dp, vertical = 6.dp),
                                )
                            }
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "${state.selectedSourceIds.size} selected",
                                color = PersonalGold,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.weight(1f),
                            )
                            TextButton(
                                onClick = {
                                    showAllChannels = !showAllChannels
                                    query = ""
                                },
                            ) {
                                Text(
                                    if (showAllChannels) "Show recommended" else "See all ${personalization.availableSources.size} channels",
                                    color = PersonalGold,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }

                        LazyColumn(
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(9.dp),
                        ) {
                            items(visibleSources, key = { it.identityId }) { source ->
                                FavoriteSourceRowV055(
                                    source = source,
                                    selected = source.identityId in state.selectedSourceIds,
                                    onClick = { onToggleSource(source.identityId) },
                                )
                            }
                        }

                        state.personalizationError?.let {
                            Text(it, color = PersonalRed, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 22.dp, vertical = 6.dp))
                        }
                        Button(
                            onClick = onSave,
                            enabled = state.selectedSourceIds.isNotEmpty() && !state.personalizationBusy,
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PersonalGold, contentColor = Color(0xFF241C09)),
                            contentPadding = PaddingValues(vertical = 15.dp),
                        ) {
                            if (state.personalizationBusy) {
                                CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = Color(0xFF241C09))
                                Spacer(Modifier.width(10.dp))
                            }
                            Text("Build my Home", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FavoriteSourceRowV055(
    source: PersonalizationSource,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        color = if (selected) PersonalGold.copy(alpha = 0.10f) else PersonalPanel,
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    ) {
        Row(
            Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (!source.artworkUrl.isNullOrBlank()) {
                AsyncImage(
                    model = source.artworkUrl,
                    contentDescription = source.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(46.dp).clip(CircleShape).background(PersonalRaised),
                )
            } else {
                Box(
                    Modifier.size(46.dp).clip(CircleShape).background(PersonalRaised),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(source.name.take(1).uppercase(), color = PersonalGold, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(source.name, color = PersonalText, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(source.handle ?: friendlySourceRoleV055(source.role), color = PersonalMuted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Box(
                Modifier.size(24.dp).clip(CircleShape)
                    .background(if (selected) PersonalGold else PersonalRaised),
                contentAlignment = Alignment.Center,
            ) {
                if (selected) Icon(Icons.Default.Check, contentDescription = null, tint = Color(0xFF241C09), modifier = Modifier.size(15.dp))
            }
        }
    }
}

private fun recommendedSourcesV060(
    sources: List<PersonalizationSource>,
    selectedLanguages: Set<String>,
): List<PersonalizationSource> {
    if (sources.size <= 5) return sources
    return sources
        .sortedWith(
            compareByDescending<PersonalizationSource> { sourceLanguageScoreV060(it, selectedLanguages) }
                .thenByDescending { sourceRoleScoreV060(it.role) }
                .thenBy { it.name.lowercase() },
        )
        .take(5)
}

private fun sourceLanguageScoreV060(source: PersonalizationSource, selectedLanguages: Set<String>): Int {
    if (selectedLanguages.isEmpty()) return 0
    val value = "${source.name} ${source.handle.orEmpty()}".lowercase()
    val hints = mapOf(
        "te" to listOf("telugu", "mythri", "sithara", "haarika", "geetha arts", "people media", "dvv", "vyjayanthi", "suresh productions", "aha"),
        "ta" to listOf("tamil", "sun pictures", "lyca", "red giant", "think music", "sathyajyothi"),
        "ml" to listOf("malayalam", "aashirvad", "saregama malayalam", "manorama"),
        "kn" to listOf("kannada", "hombale", "kfi", "anand audio"),
        "hi" to listOf("hindi", "dharma", "yrf", "maddock", "nadiadwala", "tips official"),
        "en" to listOf("netflix", "prime video", "sony pictures", "warner", "universal", "paramount"),
    )
    return selectedLanguages.sumOf { code ->
        if (hints[code].orEmpty().any(value::contains)) 100 else 0
    }
}

private fun sourceRoleScoreV060(role: String?): Int = when (role) {
    "PRODUCTION_HOUSE" -> 40
    "FILM_OFFICIAL" -> 35
    "OTT_PLATFORM" -> 30
    "MUSIC_LABEL" -> 20
    else -> 10
}

private fun friendlySourceRoleV055(role: String?): String = when (role) {
    "PRODUCTION_HOUSE" -> "Movie studio"
    "OTT_PLATFORM" -> "Streaming platform"
    "MUSIC_LABEL" -> "Music channel"
    "FILM_OFFICIAL" -> "Official movie channel"
    else -> "Official channel"
}
