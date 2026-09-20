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
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.cinerelay.app.CineRelayApplication
import com.cinerelay.app.R
import com.cinerelay.app.data.EvidenceBundle
import com.cinerelay.app.data.EvidenceDetail
import com.cinerelay.app.data.EventCard
import com.cinerelay.app.data.NewsroomSignal
import com.cinerelay.app.data.NewsroomSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Duration
import java.time.Instant

private val HomeInk = Color(0xFF0D0F13)
private val HomePanel = Color(0xFF15181E)
private val HomeRaised = Color(0xFF1B1F27)
private val HomeLine = Color(0xFF2A303A)
private val HomeText = Color(0xFFF4F1EA)
private val HomeMuted = Color(0xFFA7ADB7)
private val HomeGold = Color(0xFFE7C36B)
private val HomeGreen = Color(0xFF72D6A4)
private val HomeAmber = Color(0xFFF0B862)
private val HomeOrange = Color(0xFFFF9D63)
private val HomeRed = Color(0xFFF08079)
private val HomeBlue = Color(0xFF8CB9FF)

private val HomeColors = darkColorScheme(
    primary = HomeGold,
    onPrimary = Color(0xFF261D08),
    secondary = HomeGreen,
    background = HomeInk,
    surface = HomePanel,
    surfaceVariant = HomeRaised,
    onBackground = HomeText,
    onSurface = HomeText,
    onSurfaceVariant = HomeMuted,
    outline = HomeLine,
    error = HomeRed,
)

@Composable
fun CineRelayRootV049(viewModel: CineRelayViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    if (state.tab == AppTab.LIVE && state.authMode == null) {
        CineRelayHomeV049(state = state, viewModel = viewModel)
    } else {
        CineRelayV02App(viewModel)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CineRelayHomeV049(state: CineRelayUiState, viewModel: CineRelayViewModel) {
    var evidenceEvent by remember { mutableStateOf<EventCard?>(null) }

    MaterialTheme(colorScheme = HomeColors) {
        Surface(modifier = Modifier.fillMaxSize(), color = HomeInk) {
            Scaffold(
                containerColor = HomeInk,
                topBar = { HomeTopBarV049(state, viewModel) },
            ) { padding ->
                Column(Modifier.fillMaxSize().padding(padding)) {
                    state.notice?.let { HomeInlineMessageV049(it, HomeGreen) }
                    state.error?.let { HomeInlineMessageV049(it, HomeRed) }

                    HomeFeedV049(
                        state = state,
                        onCreateAccount = { viewModel.openAuth(AuthMode.CREATE_ACCOUNT) },
                        onFollow = { card -> viewModel.toggleFollow(card) },
                        onEvidence = { card -> evidenceEvent = card },
                    )
                }
            }
        }

        evidenceEvent?.let { card ->
            HomeEvidenceSheetV049(card = card, onDismiss = { evidenceEvent = null })
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HomeTopBarV049(state: CineRelayUiState, viewModel: CineRelayViewModel) {
    TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = HomeInk),
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                HomeBrandMarkV049(40.dp)
                Spacer(Modifier.width(11.dp))
                Column {
                    Text(
                        "CINERELAY",
                        color = HomeGold,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.7.sp,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Home", color = HomeText, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.width(8.dp))
                        Surface(
                            color = HomeRaised,
                            shape = RoundedCornerShape(50),
                        ) {
                            Text(
                                if (state.newsroomPlatform == NewsroomPlatform.YOUTUBE) "YouTube" else "X",
                                color = HomeMuted,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            )
                        }
                    }
                }
            }
        },
        actions = {
            IconButton(onClick = viewModel::refresh, enabled = !state.loading) {
                if (state.loading) {
                    CircularProgressIndicator(Modifier.size(19.dp), strokeWidth = 2.dp, color = HomeGold)
                } else {
                    Icon(Icons.Default.Refresh, contentDescription = "Refresh Home", tint = HomeMuted)
                }
            }
            if (state.authenticated) {
                IconButton(onClick = viewModel::signOut) {
                    Icon(Icons.Default.Logout, contentDescription = "Sign out", tint = HomeMuted)
                }
            } else {
                FilledTonalButton(
                    onClick = { viewModel.openAuth(AuthMode.SIGN_IN) },
                    colors = androidx.compose.material3.ButtonDefaults.filledTonalButtonColors(
                        containerColor = HomeGold.copy(alpha = 0.12f),
                        contentColor = HomeGold,
                    ),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 5.dp),
                ) {
                    Text("Sign in", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(7.dp))
            }
        },
    )
}

@Composable
private fun HomeFeedV049(
    state: CineRelayUiState,
    onCreateAccount: () -> Unit,
    onFollow: (EventCard) -> Unit,
    onEvidence: (EventCard) -> Unit,
) {
    when {
        state.loading && state.newsroomSignals.isEmpty() -> {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = HomeGold, strokeWidth = 2.dp)
            }
        }
        !state.loading && state.newsroomSignals.isEmpty() -> {
            Column(
                modifier = Modifier.fillMaxSize().padding(horizontal = 28.dp, vertical = 52.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                HomeBrandMarkV049(56.dp)
                Spacer(Modifier.height(16.dp))
                Text("Nothing new right now", color = HomeText, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(7.dp))
                Text(
                    "CineRelay is still listening to the selected newsroom lane. Fresh official activity will appear here automatically.",
                    color = HomeMuted,
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                )
            }
        }
        else -> {
            LazyColumn(
                contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 8.dp, bottom = 190.dp),
                verticalArrangement = Arrangement.spacedBy(13.dp),
            ) {
                if (!state.authenticated) {
                    item {
                        HomeGuestStripV049(onCreateAccount)
                    }
                }
                items(state.newsroomSignals, key = { it.id }) { signal ->
                    HomeNewsroomCardV049(
                        signal = signal,
                        authenticated = state.authenticated,
                        onFollow = { signal.canonicalEvent?.let(onFollow) },
                        onEvidence = { signal.canonicalEvent?.let(onEvidence) },
                    )
                }
            }
        }
    }
}

@Composable
private fun HomeGuestStripV049(onCreateAccount: () -> Unit) {
    Surface(color = HomeRaised, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(7.dp).clip(CircleShape).background(HomeBlue))
            Spacer(Modifier.width(9.dp))
            Column(Modifier.weight(1f)) {
                Text("Live newsroom is open", color = HomeText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text("Create an account only when you want follows and alerts.", color = HomeMuted, fontSize = 10.sp)
            }
            TextButton(onClick = onCreateAccount) {
                Text("Create account", fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun HomeNewsroomCardV049(
    signal: NewsroomSignal,
    authenticated: Boolean,
    onFollow: () -> Unit,
    onEvidence: () -> Unit,
) {
    val context = LocalContext.current
    val event = signal.canonicalEvent

    Card(
        colors = CardDefaults.cardColors(containerColor = HomePanel),
        shape = RoundedCornerShape(22.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column {
            Row(
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 13.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                HomeSourceAvatarV049(signal.source, 40.dp)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        signal.source.name ?: signal.source.handle ?: "CineRelay source",
                        color = HomeText,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        listOfNotNull(
                            prettyHomeRoleV049(signal.source.role),
                            signal.source.handle,
                        ).filter { it.isNotBlank() }.joinToString(" • "),
                        color = HomeMuted,
                        fontSize = 9.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Text(homeTimeAgoV049(signal.observedAt), color = HomeMuted, fontSize = 9.sp)
            }

            signal.thumbnailUrl?.takeIf { it.isNotBlank() }?.let { thumbnail ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(16f / 9f)
                        .background(HomeRaised)
                        .let { base ->
                            val url = signal.canonicalUrl
                            if (url.isNullOrBlank()) base
                            else base.clickable {
                                runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                            }
                        },
                ) {
                    AsyncImage(
                        model = thumbnail,
                        contentDescription = signal.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                    Surface(
                        color = HomeInk.copy(alpha = 0.82f),
                        shape = RoundedCornerShape(50),
                        modifier = Modifier.align(Alignment.BottomStart).padding(10.dp),
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = HomeGreen,
                                modifier = Modifier.size(12.dp),
                            )
                            Spacer(Modifier.width(4.dp))
                            Text("Official source", color = HomeText, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Column(Modifier.padding(horizontal = 15.dp, vertical = 14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    HomeStatePillV049(signal.state)
                    Spacer(Modifier.width(7.dp))
                    signal.mediaType?.takeIf { it.isNotBlank() }?.let { media ->
                        HomeTinyPillV049(prettyHomeValueV049(media), HomeBlue)
                    }
                }

                Spacer(Modifier.height(10.dp))
                Text(
                    signal.title,
                    color = HomeText,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    lineHeight = 24.sp,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )

                signal.text?.takeIf { it.isNotBlank() && it.trim() != signal.title.trim() }?.let { body ->
                    Spacer(Modifier.height(7.dp))
                    Text(
                        body,
                        color = HomeMuted,
                        fontSize = 11.sp,
                        lineHeight = 17.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                event?.let { canonical ->
                    Spacer(Modifier.height(12.dp))
                    Surface(color = HomeGold.copy(alpha = 0.07f), shape = RoundedCornerShape(13.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 11.dp, vertical = 9.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text("RESOLVED", color = HomeGold, fontSize = 8.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                Text(
                                    canonical.entityName ?: "Canonical title",
                                    color = HomeText,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                            Text(
                                prettyHomeValueV049(canonical.eventType),
                                color = HomeMuted,
                                fontSize = 9.sp,
                                maxLines = 1,
                            )
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))
                HorizontalDivider(color = HomeLine)
                Spacer(Modifier.height(7.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    signal.canonicalUrl?.takeIf { it.isNotBlank() }?.let { url ->
                        TextButton(
                            onClick = { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } },
                            contentPadding = PaddingValues(horizontal = 7.dp, vertical = 4.dp),
                        ) {
                            Icon(Icons.Default.OpenInNew, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Open", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    Spacer(Modifier.weight(1f))

                    if (event != null) {
                        TextButton(
                            onClick = onEvidence,
                            contentPadding = PaddingValues(horizontal = 7.dp, vertical = 4.dp),
                        ) {
                            Icon(Icons.Default.Info, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Evidence", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                        IconButton(onClick = onFollow, modifier = Modifier.size(36.dp)) {
                            Icon(
                                if (event.followed) Icons.Default.Star else Icons.Outlined.StarBorder,
                                contentDescription = if (event.followed) "Unfollow" else if (authenticated) "Follow" else "Create account to follow",
                                tint = if (event.followed) HomeGold else HomeMuted,
                                modifier = Modifier.size(19.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeSourceAvatarV049(source: NewsroomSource, size: Dp) {
    val initials = (source.name ?: source.handle ?: "CR")
        .split(' ')
        .filter { it.isNotBlank() }
        .take(2)
        .joinToString("") { it.take(1).uppercase() }
        .ifBlank { "CR" }

    Surface(
        color = HomeGold.copy(alpha = 0.10f),
        shape = CircleShape,
        modifier = Modifier.size(size),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(initials, color = HomeGold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            source.artworkUrl?.takeIf { it.isNotBlank() }?.let { url ->
                AsyncImage(
                    model = url,
                    contentDescription = source.name ?: "Source artwork",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize().clip(CircleShape),
                )
            }
        }
    }
}

@Composable
private fun HomeStatePillV049(value: String) {
    val color = when (value) {
        "VERIFIED" -> HomeGreen
        "DEVELOPING" -> HomeAmber
        "UNCONFIRMED" -> HomeOrange
        "CONFLICT_RUMOR" -> HomeRed
        else -> HomeMuted
    }
    val label = if (value == "CONFLICT_RUMOR") "Conflict / Rumor" else prettyHomeValueV049(value)
    HomeTinyPillV049(label, color)
}

@Composable
private fun HomeTinyPillV049(text: String, color: Color) {
    Surface(color = color.copy(alpha = 0.10f), shape = RoundedCornerShape(50)) {
        Text(
            text,
            color = color,
            fontSize = 8.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HomeEvidenceSheetV049(card: EventCard, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val app = context.applicationContext as CineRelayApplication
    var loading by remember(card.id) { mutableStateOf(true) }
    var bundle by remember(card.id) { mutableStateOf<EvidenceBundle?>(null) }
    var error by remember(card.id) { mutableStateOf<String?>(null) }

    LaunchedEffect(card.id) {
        loading = true
        error = null
        runCatching { withContext(Dispatchers.IO) { app.evidenceClient.load(card.id) } }
            .onSuccess { bundle = it }
            .onFailure { error = it.message ?: "Could not load evidence" }
        loading = false
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = HomePanel,
        contentColor = HomeText,
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp).padding(bottom = 30.dp)) {
            Text("EVIDENCE", color = HomeGold, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
            Spacer(Modifier.height(4.dp))
            Text(card.entityName ?: "CineRelay event", color = HomeText, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(5.dp))
            Text(card.headline, color = HomeMuted, fontSize = 12.sp, lineHeight = 18.sp)
            Spacer(Modifier.height(14.dp))

            when {
                loading -> Box(Modifier.fillMaxWidth().padding(vertical = 28.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = HomeGold, strokeWidth = 2.dp)
                }
                error != null -> Text(error.orEmpty(), color = HomeRed, fontSize = 12.sp)
                bundle != null -> HomeEvidenceBundleV049(bundle!!)
            }
        }
    }
}

@Composable
private fun HomeEvidenceBundleV049(bundle: EvidenceBundle) {
    val context = LocalContext.current
    Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        HomeTinyPillV049("${bundle.evidenceCount} source${if (bundle.evidenceCount == 1) "" else "s"}", HomeBlue)
        HomeTinyPillV049(prettyHomeValueV049(bundle.verificationState), HomeGreen)
        if (bundle.conflictingEvidenceCount > 0) HomeTinyPillV049("${bundle.conflictingEvidenceCount} conflict", HomeRed)
    }

    Spacer(Modifier.height(12.dp))
    if (bundle.items.isEmpty()) {
        Text("No linked evidence records yet.", color = HomeMuted, fontSize = 11.sp)
    } else {
        bundle.items.forEachIndexed { index, item ->
            HomeEvidenceItemV049(index + 1, item) { url ->
                runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
            }
            if (index != bundle.items.lastIndex) Spacer(Modifier.height(9.dp))
        }
    }
}

@Composable
private fun HomeEvidenceItemV049(index: Int, item: EvidenceDetail, onOpen: (String) -> Unit) {
    Surface(color = HomeRaised, shape = RoundedCornerShape(15.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(13.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(color = HomeGold.copy(alpha = 0.12f), shape = CircleShape, modifier = Modifier.size(26.dp)) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(index.toString(), color = HomeGold, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(item.sourceName ?: "Unknown source", color = HomeText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text(
                        listOfNotNull(item.platform, item.handle).joinToString(" • "),
                        color = HomeMuted,
                        fontSize = 9.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                HomeTinyPillV049(prettyHomeValueV049(item.role), when (item.role) {
                    "PRIMARY" -> HomeGreen
                    "CORROBORATING" -> HomeBlue
                    "CONFLICTING" -> HomeRed
                    else -> HomeMuted
                })
            }
            item.title?.takeIf { it.isNotBlank() }?.let { title ->
                Spacer(Modifier.height(8.dp))
                Text(title, color = HomeText, fontSize = 11.sp, lineHeight = 16.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            item.canonicalUrl?.takeIf { it.isNotBlank() }?.let { url ->
                TextButton(
                    onClick = { onOpen(url) },
                    contentPadding = PaddingValues(horizontal = 0.dp, vertical = 3.dp),
                ) {
                    Icon(Icons.Default.OpenInNew, contentDescription = null, modifier = Modifier.size(13.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Open source", fontSize = 9.sp)
                }
            }
        }
    }
}

@Composable
private fun HomeInlineMessageV049(message: String, color: Color) {
    Text(
        message,
        color = color,
        fontSize = 10.sp,
        modifier = Modifier
            .fillMaxWidth()
            .background(color.copy(alpha = 0.07f))
            .padding(horizontal = 15.dp, vertical = 7.dp),
    )
}

@Composable
private fun HomeBrandMarkV049(size: Dp) {
    Surface(
        color = HomeGold.copy(alpha = 0.08f),
        shape = RoundedCornerShape(size / 3),
        modifier = Modifier.size(size),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                painter = painterResource(R.drawable.ic_cinerelay_mark),
                contentDescription = null,
                tint = Color.Unspecified,
                modifier = Modifier.size(size * 0.9f),
            )
        }
    }
}

private fun prettyHomeRoleV049(value: String?): String = when (value) {
    "PRODUCTION_HOUSE" -> "Production"
    "OTT_PLATFORM" -> "OTT"
    "MUSIC_LABEL" -> "Music"
    "MEDIA_LIBRARY" -> "Media"
    null -> ""
    else -> prettyHomeValueV049(value)
}

private fun prettyHomeValueV049(value: String): String = value
    .lowercase()
    .split('_')
    .joinToString(" ") { part -> part.replaceFirstChar { char -> char.uppercase() } }

private fun homeTimeAgoV049(value: String?): String {
    if (value.isNullOrBlank()) return ""
    return runCatching {
        val duration = Duration.between(Instant.parse(value), Instant.now())
        when {
            duration.seconds < 60 -> "now"
            duration.toMinutes() < 60 -> "${duration.toMinutes()}m"
            duration.toHours() < 24 -> "${duration.toHours()}h"
            duration.toDays() < 7 -> "${duration.toDays()}d"
            else -> "${duration.toDays() / 7}w"
        }
    }.getOrDefault("")
}
