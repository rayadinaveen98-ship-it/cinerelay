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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cinerelay.app.data.IntelligenceActivity
import com.cinerelay.app.data.IntelligenceEntity
import com.cinerelay.app.data.IntelligenceEvent
import java.time.Duration
import java.time.Instant

private val IntelligenceInk = Color(0xFF0D0F13)
private val IntelligencePanel = Color(0xFF15181E)
private val IntelligenceRaised = Color(0xFF1B1F27)
private val IntelligenceLine = Color(0xFF2A303A)
private val IntelligenceText = Color(0xFFF4F1EA)
private val IntelligenceMuted = Color(0xFFA7ADB7)
private val IntelligenceGold = Color(0xFFE7C36B)
private val IntelligenceGreen = Color(0xFF72D6A4)
private val IntelligenceAmber = Color(0xFFF0B862)
private val IntelligenceRed = Color(0xFFF08079)
private val IntelligenceBlue = Color(0xFF8CB9FF)

@Composable
fun IntelligenceSearchV053(
    state: IntelligenceUiState,
    onBack: () -> Unit,
    onQueryChange: (String) -> Unit,
    onSearch: () -> Unit,
    onOpenHub: (IntelligenceEntity) -> Unit,
    onToggleFollow: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(modifier = modifier.fillMaxSize(), color = IntelligenceInk) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding(),
        ) {
            IntelligenceHeader(
                title = state.hub?.entity?.name ?: "Search",
                subtitle = if (state.hub == null) "Films, series and canonical stories" else prettyIntelligenceValue(state.hub.entity.type),
                onBack = onBack,
            )

            state.error?.let { error ->
                Surface(
                    color = IntelligenceRed.copy(alpha = 0.10f),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 5.dp).fillMaxWidth(),
                ) {
                    Text(error, color = IntelligenceRed, fontSize = 11.sp, modifier = Modifier.padding(11.dp))
                }
            }

            if (state.hub == null) {
                SearchBody(
                    state = state,
                    onQueryChange = onQueryChange,
                    onSearch = onSearch,
                    onOpenHub = onOpenHub,
                )
            } else {
                HubBody(
                    state = state,
                    onToggleFollow = onToggleFollow,
                )
            }
        }
    }
}

@Composable
private fun IntelligenceHeader(title: String, subtitle: String, onBack: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = IntelligenceText)
        }
        Surface(
            color = IntelligenceGold.copy(alpha = 0.10f),
            shape = RoundedCornerShape(13.dp),
            modifier = Modifier.size(40.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Search, contentDescription = null, tint = IntelligenceGold, modifier = Modifier.size(21.dp))
            }
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text("CINERELAY INTELLIGENCE", color = IntelligenceGold, fontSize = 8.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
            Text(title, color = IntelligenceText, fontSize = 20.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(subtitle, color = IntelligenceMuted, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun SearchBody(
    state: IntelligenceUiState,
    onQueryChange: (String) -> Unit,
    onSearch: () -> Unit,
    onOpenHub: (IntelligenceEntity) -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = state.query,
            onValueChange = onQueryChange,
            singleLine = true,
            placeholder = { Text("Search a film or series", color = IntelligenceMuted) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            trailingIcon = {
                if (state.loading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = IntelligenceGold)
            },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { onSearch() }),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        )

        when {
            state.query.trim().length < 2 && state.results.isEmpty() -> {
                SearchEmptyIntro()
            }
            !state.loading && state.query.trim().length >= 2 && state.results.isEmpty() && state.error == null -> {
                Box(Modifier.fillMaxSize().padding(horizontal = 28.dp, vertical = 50.dp), contentAlignment = Alignment.TopCenter) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No canonical title found", color = IntelligenceText, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(7.dp))
                        Text(
                            "CineRelay only shows reviewed film and series hubs. Raw posts do not become titles automatically.",
                            color = IntelligenceMuted,
                            fontSize = 11.sp,
                            lineHeight = 17.sp,
                        )
                    }
                }
            }
            else -> {
                LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 120.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    if (state.results.isNotEmpty()) {
                        item {
                            Text(
                                "CANONICAL RESULTS",
                                color = IntelligenceMuted,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.1.sp,
                            )
                        }
                    }
                    items(state.results, key = { it.id }) { entity ->
                        EntitySearchRow(entity = entity, onClick = { onOpenHub(entity) })
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchEmptyIntro() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 34.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Surface(color = IntelligenceGold.copy(alpha = 0.09f), shape = CircleShape, modifier = Modifier.size(58.dp)) {
            Box(contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Search, contentDescription = null, tint = IntelligenceGold, modifier = Modifier.size(28.dp))
            }
        }
        Spacer(Modifier.height(14.dp))
        Text("Find the story, not the post", color = IntelligenceText, fontSize = 19.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(7.dp))
        Text(
            "Search across reviewed CineRelay film and series identities. One hub collects the canonical story and its resolved source evidence.",
            color = IntelligenceMuted,
            fontSize = 12.sp,
            lineHeight = 18.sp,
        )
    }
}

@Composable
private fun EntitySearchRow(entity: IntelligenceEntity, onClick: () -> Unit) {
    Surface(
        color = IntelligencePanel,
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(color = IntelligenceGold.copy(alpha = 0.10f), shape = CircleShape, modifier = Modifier.size(42.dp)) {
                Box(contentAlignment = Alignment.Center) {
                    Text(entity.name.take(1).uppercase(), color = IntelligenceGold, fontSize = 15.sp, fontWeight = FontWeight.Black)
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(entity.name, color = IntelligenceText, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    listOfNotNull(prettyIntelligenceValue(entity.type), entity.primaryLanguage?.uppercase()).joinToString(" • "),
                    color = IntelligenceMuted,
                    fontSize = 10.sp,
                )
                entity.aliases.firstOrNull { it.value != entity.name }?.let { alias ->
                    Text(alias.value, color = IntelligenceMuted, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            if (entity.followed) Icon(Icons.Default.Star, contentDescription = null, tint = IntelligenceGold, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
private fun HubBody(state: IntelligenceUiState, onToggleFollow: () -> Unit) {
    val hub = state.hub ?: return
    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Surface(color = IntelligenceRaised, shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(hub.entity.name, color = IntelligenceText, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                            Text(
                                listOfNotNull(prettyIntelligenceValue(hub.entity.type), hub.entity.primaryLanguage?.uppercase()).joinToString(" • "),
                                color = IntelligenceMuted,
                                fontSize = 10.sp,
                            )
                        }
                        IconButton(onClick = onToggleFollow, enabled = !state.loading) {
                            Icon(
                                if (hub.entity.followed) Icons.Default.Star else Icons.Outlined.StarBorder,
                                contentDescription = if (hub.entity.followed) "Unfollow" else "Follow",
                                tint = if (hub.entity.followed) IntelligenceGold else IntelligenceMuted,
                            )
                        }
                    }
                    if (hub.entity.aliases.isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            hub.entity.aliases.map { it.value }.distinct().take(4).joinToString(" • "),
                            color = IntelligenceMuted,
                            fontSize = 9.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }

        item { IntelligenceSectionLabel("STORY TIMELINE", "${hub.events.size} canonical event${if (hub.events.size == 1) "" else "s"}") }
        if (hub.events.isEmpty()) {
            item { HubEmptyCard("No canonical story yet", "CineRelay has the reviewed title identity, but no classified story event is ready yet.") }
        } else {
            items(hub.events, key = { it.id }) { event -> IntelligenceEventCard(event) }
        }

        item { IntelligenceSectionLabel("RESOLVED SOURCE ACTIVITY", "${hub.activity.size} item${if (hub.activity.size == 1) "" else "s"}") }
        if (hub.activity.isEmpty()) {
            item { HubEmptyCard("No resolved source activity yet", "Evidence will appear here after the deterministic resolver links tracked source items to this title.") }
        } else {
            items(hub.activity, key = { it.rawItemId }) { item -> IntelligenceActivityCard(item) }
        }
    }
}

@Composable
private fun IntelligenceSectionLabel(title: String, detail: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = IntelligenceMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.1.sp)
        Spacer(Modifier.weight(1f))
        Text(detail, color = IntelligenceMuted, fontSize = 9.sp)
    }
}

@Composable
private fun IntelligenceEventCard(event: IntelligenceEvent) {
    val stateColor = when (event.verificationState) {
        "CONFIRMED", "OFFICIAL" -> IntelligenceGreen
        "RELIABLE_REPORT", "DEVELOPING" -> IntelligenceAmber
        "RUMOR" -> IntelligenceRed
        else -> IntelligenceBlue
    }
    Card(colors = CardDefaults.cardColors(containerColor = IntelligencePanel), shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(15.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(color = stateColor.copy(alpha = 0.10f), shape = RoundedCornerShape(50)) {
                    Text(
                        prettyIntelligenceValue(event.verificationState),
                        color = stateColor,
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                    )
                }
                Spacer(Modifier.width(7.dp))
                Text(prettyIntelligenceValue(event.eventType), color = IntelligenceMuted, fontSize = 9.sp, modifier = Modifier.weight(1f))
                Text(intelligenceTimeAgo(event.detectedAt), color = IntelligenceMuted, fontSize = 9.sp)
            }
            Spacer(Modifier.height(10.dp))
            Text(event.headline, color = IntelligenceText, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, lineHeight = 22.sp)
            event.summary?.takeIf { it.isNotBlank() }?.let { summary ->
                Spacer(Modifier.height(6.dp))
                Text(summary, color = IntelligenceMuted, fontSize = 11.sp, lineHeight = 17.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.height(10.dp))
            HorizontalDivider(color = IntelligenceLine)
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = IntelligenceGreen, modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(5.dp))
                Text("${event.evidence.total} evidence", color = IntelligenceMuted, fontSize = 9.sp)
                if (event.evidence.conflicting > 0) {
                    Spacer(Modifier.width(8.dp))
                    Text("${event.evidence.conflicting} conflict", color = IntelligenceRed, fontSize = 9.sp)
                }
            }
        }
    }
}

@Composable
private fun IntelligenceActivityCard(item: IntelligenceActivity) {
    val context = LocalContext.current
    Surface(color = IntelligencePanel, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(item.source.name ?: "CineRelay source", color = IntelligenceGold, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(intelligenceTimeAgo(item.observedAt), color = IntelligenceMuted, fontSize = 9.sp)
            }
            Text(
                listOfNotNull(item.source.platform, item.source.handle).joinToString(" • "),
                color = IntelligenceMuted,
                fontSize = 9.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            item.title?.takeIf { it.isNotBlank() }?.let { title ->
                Spacer(Modifier.height(8.dp))
                Text(title, color = IntelligenceText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, lineHeight = 19.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
            item.canonicalUrl?.takeIf { it.isNotBlank() }?.let { url ->
                TextButton(
                    onClick = { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } },
                    contentPadding = PaddingValues(horizontal = 0.dp, vertical = 3.dp),
                ) {
                    Icon(Icons.Default.OpenInNew, contentDescription = null, modifier = Modifier.size(13.dp), tint = IntelligenceGold)
                    Spacer(Modifier.width(4.dp))
                    Text("Open source", color = IntelligenceGold, fontSize = 9.sp)
                }
            }
        }
    }
}

@Composable
private fun HubEmptyCard(title: String, body: String) {
    Surface(color = IntelligencePanel, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text(title, color = IntelligenceText, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(5.dp))
            Text(body, color = IntelligenceMuted, fontSize = 10.sp, lineHeight = 16.sp)
        }
    }
}

private fun prettyIntelligenceValue(value: String): String = value
    .lowercase()
    .split('_')
    .joinToString(" ") { it.replaceFirstChar { char -> char.uppercase() } }

private fun intelligenceTimeAgo(value: String?): String {
    if (value.isNullOrBlank()) return ""
    return runCatching {
        val duration = Duration.between(Instant.parse(value), Instant.now())
        when {
            duration.isNegative || duration.toMinutes() < 1 -> "now"
            duration.toMinutes() < 60 -> "${duration.toMinutes()}m"
            duration.toHours() < 24 -> "${duration.toHours()}h"
            duration.toDays() < 7 -> "${duration.toDays()}d"
            else -> "${duration.toDays() / 7}w"
        }
    }.getOrDefault("")
}
