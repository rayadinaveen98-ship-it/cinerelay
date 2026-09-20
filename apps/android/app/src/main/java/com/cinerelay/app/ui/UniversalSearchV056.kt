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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.cinerelay.app.data.IntelligenceHub
import com.cinerelay.app.data.UniversalChannelResult
import com.cinerelay.app.data.UniversalStreamingResult
import com.cinerelay.app.data.UniversalTitleResult
import com.cinerelay.app.data.UniversalUpdateResult

private val SearchInk56 = Color(0xFF0D0F13)
private val SearchPanel56 = Color(0xFF171A20)
private val SearchRaised56 = Color(0xFF20242C)
private val SearchLine56 = Color(0xFF333946)
private val SearchText56 = Color(0xFFF6F3EC)
private val SearchMuted56 = Color(0xFFADB3BD)
private val SearchGold56 = Color(0xFFE8C56D)
private val SearchGreen56 = Color(0xFF73D6A5)
private val SearchRed56 = Color(0xFFF08079)

@Composable
fun UniversalSearchV056(
    state: UniversalSearchUiStateV056,
    onBack: () -> Unit,
    onQueryChange: (String) -> Unit,
    onSearch: () -> Unit,
    onOpenHub: (String) -> Unit,
    onToggleFollow: () -> Unit,
    onOpenUpdate: (UniversalUpdateResult) -> Unit,
    onOpenChannel: (UniversalChannelResult) -> Unit,
    modifier: Modifier = Modifier,
) {
    val keyboard = LocalSoftwareKeyboardController.current
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = SearchGold56,
            background = SearchInk56,
            surface = SearchPanel56,
            surfaceVariant = SearchRaised56,
            onBackground = SearchText56,
            onSurface = SearchText56,
            onSurfaceVariant = SearchMuted56,
            error = SearchRed56,
        ),
    ) {
        Surface(modifier = modifier.fillMaxSize(), color = SearchInk56) {
            Column(Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(start = 8.dp, end = 18.dp, top = 18.dp, bottom = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = SearchText56)
                    }
                    Spacer(Modifier.width(4.dp))
                    Column(Modifier.weight(1f)) {
                        Text("CINERELAY", color = SearchGold56, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.6.sp)
                        Text(if (state.hub == null) "Search" else state.hub.entity.name, color = SearchText56, fontSize = 24.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (state.hub == null) Text("Movies, updates, channels & streaming", color = SearchMuted56, fontSize = 11.sp)
                    }
                }

                if (state.hub != null) {
                    UniversalHubV056(
                        hub = state.hub,
                        loading = state.loading,
                        onToggleFollow = onToggleFollow,
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    OutlinedTextField(
                        value = state.query,
                        onValueChange = onQueryChange,
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = SearchGold56) },
                        placeholder = { Text("Search Irumudi, Sony LIV, trailers…", color = SearchMuted56) },
                        textStyle = androidx.compose.ui.text.TextStyle(color = SearchText56, fontSize = 17.sp, fontWeight = FontWeight.Medium),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(onSearch = {
                            keyboard?.hide()
                            onSearch()
                        }),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = SearchRaised56,
                            unfocusedContainerColor = SearchRaised56,
                            focusedBorderColor = SearchGold56,
                            unfocusedBorderColor = SearchLine56,
                            cursorColor = SearchGold56,
                            focusedTextColor = SearchText56,
                            unfocusedTextColor = SearchText56,
                        ),
                        shape = RoundedCornerShape(18.dp),
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp),
                    )

                    if (state.loading) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(18.dp),
                            horizontalArrangement = Arrangement.Center,
                        ) {
                            CircularProgressIndicator(color = SearchGold56, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
                        }
                    }

                    state.error?.let {
                        Text(it, color = SearchRed56, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp))
                    }

                    UniversalSearchResultsV056(
                        state = state,
                        onOpenHub = onOpenHub,
                        onOpenUpdate = onOpenUpdate,
                        onOpenChannel = onOpenChannel,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun UniversalSearchResultsV056(
    state: UniversalSearchUiStateV056,
    onOpenHub: (String) -> Unit,
    onOpenUpdate: (UniversalUpdateResult) -> Unit,
    onOpenChannel: (UniversalChannelResult) -> Unit,
    modifier: Modifier = Modifier,
) {
    val result = state.result
    when {
        state.query.trim().length < 2 -> {
            Column(
                modifier = modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 34.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(Icons.Default.Search, contentDescription = null, tint = SearchGold56, modifier = Modifier.size(36.dp))
                Spacer(Modifier.height(12.dp))
                Text("Search all of CineRelay", color = SearchText56, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(6.dp))
                Text("Find a movie or series, recent updates, official channels and streaming information.", color = SearchMuted56, fontSize = 13.sp, lineHeight = 19.sp)
            }
        }
        result == null -> Spacer(modifier)
        !state.hasAnyResult && !state.loading -> {
            Column(
                modifier = modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 36.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("Nothing found yet", color = SearchText56, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(7.dp))
                Text("Try another spelling or a movie, actor, channel or streaming platform name.", color = SearchMuted56, fontSize = 13.sp, lineHeight = 19.sp)
            }
        }
        else -> {
            LazyColumn(
                modifier = modifier.fillMaxWidth(),
                contentPadding = PaddingValues(top = 18.dp, bottom = 100.dp),
                verticalArrangement = Arrangement.spacedBy(22.dp),
            ) {
                if (result.titles.isNotEmpty()) {
                    item { SearchSectionTitleV056("Movies & series") }
                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 18.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            items(result.titles, key = { it.id }) { title ->
                                SearchTitleCardV056(title, onClick = { onOpenHub(title.id) })
                            }
                        }
                    }
                }

                if (result.updates.isNotEmpty()) {
                    item { SearchSectionTitleV056("Latest updates") }
                    items(result.updates, key = { it.id }) { update ->
                        SearchUpdateCardV056(update, onClick = { onOpenUpdate(update) })
                    }
                }

                if (result.channels.isNotEmpty()) {
                    item { SearchSectionTitleV056("Channels") }
                    items(result.channels, key = { it.identityId }) { channel ->
                        SearchChannelRowV056(channel, onClick = { onOpenChannel(channel) })
                    }
                }

                if (result.streaming.isNotEmpty()) {
                    item { SearchSectionTitleV056("Streaming") }
                    items(result.streaming, key = { it.id }) { item ->
                        SearchStreamingRowV056(item, onClick = { onOpenHub(item.entityId) })
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchSectionTitleV056(title: String) {
    Text(title, color = SearchText56, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 18.dp))
}

@Composable
private fun SearchTitleCardV056(item: UniversalTitleResult, onClick: () -> Unit) {
    Surface(
        color = SearchPanel56,
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.width(170.dp).clickable(onClick = onClick),
    ) {
        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Surface(color = SearchGold56.copy(alpha = 0.12f), shape = RoundedCornerShape(12.dp), modifier = Modifier.size(42.dp)) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Movie, contentDescription = null, tint = SearchGold56)
                }
            }
            Text(item.name, color = SearchText56, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(
                listOfNotNull(friendlyTypeV056(item.type), friendlyLanguageV056(item.primaryLanguage)).joinToString(" • "),
                color = SearchMuted56,
                fontSize = 10.sp,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun SearchUpdateCardV056(item: UniversalUpdateResult, onClick: () -> Unit) {
    Surface(
        color = SearchPanel56,
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp).clickable(onClick = onClick),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            if (!item.thumbnailUrl.isNullOrBlank()) {
                AsyncImage(
                    model = item.thumbnailUrl,
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.width(104.dp).aspectRatio(16f / 9f).clip(RoundedCornerShape(12.dp)).background(SearchRaised56),
                )
                Spacer(Modifier.width(12.dp))
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(item.source.name ?: "Movie update", color = SearchGold56, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(item.title, color = SearchText56, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 3, overflow = TextOverflow.Ellipsis)
                Text(friendlyLanguageV056(item.languageCode), color = SearchMuted56, fontSize = 10.sp)
            }
        }
    }
}

@Composable
private fun SearchChannelRowV056(item: UniversalChannelResult, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp).clip(RoundedCornerShape(18.dp)).background(SearchPanel56).clickable(onClick = onClick).padding(13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (!item.artworkUrl.isNullOrBlank()) {
            AsyncImage(
                model = item.artworkUrl,
                contentDescription = item.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(46.dp).clip(CircleShape).background(SearchRaised56),
            )
        } else {
            Box(Modifier.size(46.dp).clip(CircleShape).background(SearchRaised56), contentAlignment = Alignment.Center) {
                Text(item.name.take(1).uppercase(), color = SearchGold56, fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(item.name, color = SearchText56, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(item.handle ?: friendlyRoleV056(item.role), color = SearchMuted56, fontSize = 11.sp, maxLines = 1)
        }
        Text("View", color = SearchGold56, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SearchStreamingRowV056(item: UniversalStreamingResult, onClick: () -> Unit) {
    Surface(
        color = SearchPanel56,
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp).clickable(onClick = onClick),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(color = SearchGold56.copy(alpha = 0.12f), shape = RoundedCornerShape(12.dp), modifier = Modifier.size(44.dp)) {
                Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.PlayCircle, contentDescription = null, tint = SearchGold56) }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(item.title, color = SearchText56, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                Text(
                    listOfNotNull(item.providerName, item.releaseDate ?: friendlyReleaseStateV056(item.state)).joinToString(" • "),
                    color = SearchMuted56,
                    fontSize = 11.sp,
                )
            }
            if (item.evidenceStatus == "CONFIRMED") {
                Icon(Icons.Default.CheckCircle, contentDescription = "Confirmed", tint = SearchGreen56, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun UniversalHubV056(
    hub: IntelligenceHub,
    loading: Boolean,
    onToggleFollow: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        item {
            Surface(color = SearchPanel56, shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(hub.entity.name, color = SearchText56, fontSize = 27.sp, fontWeight = FontWeight.Bold)
                        Text(
                            listOfNotNull(friendlyTypeV056(hub.entity.type), friendlyLanguageV056(hub.entity.primaryLanguage)).joinToString(" • "),
                            color = SearchMuted56,
                            fontSize = 12.sp,
                        )
                    }
                    IconButton(onClick = onToggleFollow, enabled = !loading) {
                        Icon(
                            if (hub.entity.followed) Icons.Default.Star else Icons.Outlined.StarBorder,
                            contentDescription = if (hub.entity.followed) "Unfollow" else "Follow",
                            tint = SearchGold56,
                        )
                    }
                }
            }
        }

        if (hub.ottReleases.isNotEmpty()) {
            item { Text("Streaming", color = SearchText56, fontSize = 19.sp, fontWeight = FontWeight.Bold) }
            items(hub.ottReleases, key = { it.id }) { release ->
                Surface(color = SearchPanel56, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(release.provider.name, color = SearchGold56, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        Text(release.releaseDate ?: friendlyReleaseStateV056(release.state), color = SearchText56, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        Text(if (release.evidenceStatus == "CONFIRMED") "Confirmed" else "Reported", color = SearchMuted56, fontSize = 11.sp)
                    }
                }
            }
        }

        if (hub.events.isNotEmpty()) {
            item { Text("Story timeline", color = SearchText56, fontSize = 19.sp, fontWeight = FontWeight.Bold) }
            items(hub.events, key = { it.id }) { event ->
                Surface(color = SearchPanel56, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(friendlyVerificationV056(event.verificationState), color = SearchGold56, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        Text(event.headline, color = SearchText56, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        event.summary?.let { Text(it, color = SearchMuted56, fontSize = 12.sp, lineHeight = 18.sp, maxLines = 4, overflow = TextOverflow.Ellipsis) }
                    }
                }
            }
        }

        if (hub.activity.isNotEmpty()) {
            item { Text("Latest updates", color = SearchText56, fontSize = 19.sp, fontWeight = FontWeight.Bold) }
            items(hub.activity, key = { it.rawItemId }) { activity ->
                Surface(color = SearchPanel56, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(activity.source.name ?: "Source", color = SearchGold56, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        Text(activity.title ?: "Update", color = SearchText56, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }

        item { Spacer(Modifier.height(80.dp)) }
    }
}

private fun friendlyTypeV056(value: String?): String = when (value) {
    "MOVIE" -> "Movie"
    "SERIES" -> "Series"
    "SEASON" -> "Season"
    else -> "Title"
}

private fun friendlyLanguageV056(value: String?): String = when (value?.lowercase()) {
    "te" -> "Telugu"
    "hi" -> "Hindi"
    "ta" -> "Tamil"
    "ml" -> "Malayalam"
    "kn" -> "Kannada"
    "en" -> "English"
    null, "" -> ""
    else -> value.uppercase()
}

private fun friendlyRoleV056(value: String?): String = when (value) {
    "PRODUCTION_HOUSE" -> "Movie studio"
    "OTT_PLATFORM" -> "Streaming platform"
    "MUSIC_LABEL" -> "Music channel"
    "FILM_OFFICIAL", "PROJECT_OFFICIAL" -> "Official movie channel"
    "TRADE_MEDIA" -> "Entertainment media"
    else -> "Official channel"
}

private fun friendlyReleaseStateV056(value: String?): String = when (value) {
    "RELEASED" -> "Streaming now"
    "UPCOMING" -> "Coming soon"
    "DELAYED" -> "Date changed"
    else -> "Date to be announced"
}

private fun friendlyVerificationV056(value: String?): String = when (value) {
    "OFFICIAL", "CONFIRMED" -> "Official"
    "RELIABLE_REPORT" -> "Reported"
    "DEVELOPING" -> "Developing"
    "RUMOR" -> "Unconfirmed"
    else -> "Update"
}
