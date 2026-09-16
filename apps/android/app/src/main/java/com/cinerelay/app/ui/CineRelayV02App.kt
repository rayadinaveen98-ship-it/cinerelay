package com.cinerelay.app.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.cinerelay.app.BuildConfig
import com.cinerelay.app.CineRelayApplication
import com.cinerelay.app.data.AlertItem
import com.cinerelay.app.data.EvidenceBundle
import com.cinerelay.app.data.EvidenceDetail
import com.cinerelay.app.data.EventCard
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Duration
import java.time.Instant

private val V2Ink = Color(0xFF0D0F13)
private val V2Panel = Color(0xFF15181E)
private val V2PanelRaised = Color(0xFF1B1F27)
private val V2Line = Color(0xFF2A303A)
private val V2Text = Color(0xFFF4F1EA)
private val V2Muted = Color(0xFFA7ADB7)
private val V2Gold = Color(0xFFE7C36B)
private val V2GoldDeep = Color(0xFF8F6B25)
private val V2Green = Color(0xFF72D6A4)
private val V2Amber = Color(0xFFF0B862)
private val V2Red = Color(0xFFF08079)
private val V2Blue = Color(0xFF8CB9FF)

private val V2Colors = darkColorScheme(
    primary = V2Gold,
    onPrimary = Color(0xFF261D08),
    secondary = V2Green,
    background = V2Ink,
    surface = V2Panel,
    surfaceVariant = V2PanelRaised,
    onBackground = V2Text,
    onSurface = V2Text,
    onSurfaceVariant = V2Muted,
    outline = V2Line,
    error = V2Red,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CineRelayV02App(viewModel: CineRelayViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var evidenceEvent by remember { mutableStateOf<EventCard?>(null) }

    MaterialTheme(colorScheme = V2Colors) {
        Surface(modifier = Modifier.fillMaxSize(), color = V2Ink) {
            Scaffold(
                containerColor = V2Ink,
                topBar = { PremiumTopBar(state, viewModel) },
                bottomBar = { PremiumBottomBar(state.tab, viewModel::selectTab) },
            ) { padding ->
                Column(Modifier.fillMaxSize().padding(padding)) {
                    state.notice?.takeIf { state.authMode == null }?.let { InlineV2(it, V2Green) }
                    state.error?.takeIf { state.authMode == null }?.let { InlineV2(it, V2Red) }
                    when {
                        !state.authenticated && state.tab.requiresV2Account() -> LockedV2(state.tab, viewModel)
                        state.tab == AppTab.ALERTS -> AlertsV2(state, viewModel)
                        else -> FeedV2(state, viewModel, onEvidence = { evidenceEvent = it })
                    }
                }
            }
        }

        state.authMode?.let { mode ->
            AuthSheetV2(
                mode = mode,
                busy = state.authBusy,
                error = state.error,
                notice = state.notice,
                onDismiss = viewModel::closeAuth,
                onSwitchMode = viewModel::switchAuthMode,
                onSignIn = viewModel::signIn,
                onCreateAccount = viewModel::createAccount,
            )
        }

        evidenceEvent?.let { card ->
            EvidenceSheetV2(card = card, onDismiss = { evidenceEvent = null })
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PremiumTopBar(state: CineRelayUiState, viewModel: CineRelayViewModel) {
    TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = V2Ink),
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                BrandMarkV2(38.dp)
                Spacer(Modifier.width(12.dp))
                Column {
                    Text("CINERELAY", color = V2Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp)
                    Text(tabTitleV2(state.tab), color = V2Text, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                }
            }
        },
        actions = {
            IconButton(
                onClick = viewModel::refresh,
                enabled = !state.loading && (!state.tab.requiresV2Account() || state.authenticated),
            ) {
                if (state.loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                else Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = V2Muted)
            }
            if (state.authenticated) {
                IconButton(onClick = viewModel::signOut) {
                    Icon(Icons.Default.Logout, contentDescription = "Sign out", tint = V2Muted)
                }
            } else {
                FilledTonalButton(
                    onClick = { viewModel.openAuth(AuthMode.SIGN_IN) },
                    colors = ButtonDefaults.filledTonalButtonColors(containerColor = V2Gold.copy(alpha = 0.13f), contentColor = V2Gold),
                    contentPadding = PaddingValues(horizontal = 13.dp, vertical = 6.dp),
                ) { Text("Sign in", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                Spacer(Modifier.width(8.dp))
            }
        },
    )
}

@Composable
private fun PremiumBottomBar(selected: AppTab, onSelect: (AppTab) -> Unit) {
    NavigationBar(containerColor = Color(0xFF12151A), tonalElevation = 0.dp) {
        NavV2(AppTab.LIVE, selected, Icons.Default.Home, "Live", onSelect)
        NavV2(AppTab.FOLLOWING, selected, Icons.Default.Star, "Following", onSelect)
        NavV2(AppTab.RADAR, selected, Icons.Default.Movie, "Radar", onSelect)
        NavV2(AppTab.ALERTS, selected, Icons.Default.Notifications, "Alerts", onSelect)
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.NavV2(
    tab: AppTab,
    selected: AppTab,
    icon: ImageVector,
    label: String,
    onSelect: (AppTab) -> Unit,
) {
    NavigationBarItem(
        selected = selected == tab,
        onClick = { onSelect(tab) },
        icon = { Icon(icon, contentDescription = label, modifier = Modifier.size(22.dp)) },
        label = { Text(label, maxLines = 1, fontSize = 10.sp) },
        colors = NavigationBarItemDefaults.colors(
            selectedIconColor = V2Gold,
            selectedTextColor = V2Gold,
            indicatorColor = V2Gold.copy(alpha = 0.13f),
            unselectedIconColor = V2Muted,
            unselectedTextColor = V2Muted,
        ),
    )
}

@Composable
private fun FeedV2(state: CineRelayUiState, viewModel: CineRelayViewModel, onEvidence: (EventCard) -> Unit) {
    if (!state.loading && state.events.isEmpty()) {
        EmptyV2(
            when (state.tab) {
                AppTab.FOLLOWING -> "Nothing followed yet"
                AppTab.RADAR -> "Radar is quiet"
                else -> "No active signals"
            },
            when (state.tab) {
                AppTab.FOLLOWING -> "Follow a title from Live and its updates will collect here."
                AppTab.RADAR -> "Creator opportunities appear when Radar materializes a signal."
                else -> "CineRelay has no active canonical events to show right now."
            },
        )
        return
    }

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (!state.authenticated && state.tab == AppTab.LIVE) item { GuestStripV2(viewModel) }
        items(state.events, key = { it.id }) { card ->
            SignalCardV2(
                card = card,
                authenticated = state.authenticated,
                onFollow = { viewModel.toggleFollow(card) },
                onEvidence = { onEvidence(card) },
            )
        }
        item { Spacer(Modifier.height(10.dp)) }
    }
}

@Composable
private fun GuestStripV2(viewModel: CineRelayViewModel) {
    Surface(
        color = V2PanelRaised,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(V2Blue))
            Spacer(Modifier.width(9.dp))
            Column(Modifier.weight(1f)) {
                Text("Guest preview", color = V2Text, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text("Live + Radar are open. Sign in only for follows and alerts.", color = V2Muted, fontSize = 11.sp)
            }
            TextButton(onClick = { viewModel.openAuth(AuthMode.CREATE_ACCOUNT) }) {
                Text("Create account", fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun SignalCardV2(
    card: EventCard,
    authenticated: Boolean,
    onFollow: () -> Unit,
    onEvidence: () -> Unit,
) {
    val context = LocalContext.current
    Card(
        colors = CardDefaults.cardColors(containerColor = V2Panel),
        shape = RoundedCornerShape(22.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                EntityTileV2(card)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        card.entityName ?: "Unresolved title",
                        color = V2Gold,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        VerificationV2(card.verificationState)
                        Spacer(Modifier.width(7.dp))
                        Text(prettyV2(card.eventType), color = V2Muted, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                Text(timeAgoV2(card.detectedAt), color = V2Muted, fontSize = 10.sp)
            }

            Spacer(Modifier.height(15.dp))
            Text(card.headline, color = V2Text, fontSize = 19.sp, fontWeight = FontWeight.SemiBold, lineHeight = 25.sp)

            if (!card.summary.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(card.summary, color = V2Muted, fontSize = 13.sp, lineHeight = 19.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }

            card.radar?.let { radar ->
                Spacer(Modifier.height(12.dp))
                Surface(color = V2Gold.copy(alpha = 0.08f), shape = RoundedCornerShape(12.dp)) {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 11.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("RADAR ${radar.score}", color = V2Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.width(8.dp))
                        Text(prettyV2(radar.label), color = V2Muted, fontSize = 10.sp)
                    }
                }
            }

            Spacer(Modifier.height(14.dp))
            HorizontalDivider(color = V2Line)
            Spacer(Modifier.height(12.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        evidenceHeadlineV2(card),
                        color = if (card.conflictingEvidenceCount > 0) V2Red else V2Text,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        card.evidence?.sourceName ?: "Open proof trail",
                        color = V2Muted,
                        fontSize = 10.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                TextButton(onClick = onEvidence, contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)) {
                    Icon(Icons.Default.Info, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(5.dp))
                    Text("Evidence", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                IconButton(onClick = onFollow, modifier = Modifier.size(40.dp)) {
                    Icon(
                        if (card.followed) Icons.Default.Star else Icons.Outlined.StarBorder,
                        contentDescription = if (card.followed) "Unfollow" else if (authenticated) "Follow" else "Create account to follow",
                        tint = if (card.followed) V2Gold else V2Muted,
                    )
                }
            }

            card.evidence?.canonicalUrl?.takeIf { it.isNotBlank() }?.let { sourceUrl ->
                Spacer(Modifier.height(4.dp))
                TextButton(
                    onClick = { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(sourceUrl))) } },
                    contentPadding = PaddingValues(horizontal = 0.dp, vertical = 4.dp),
                ) {
                    Icon(Icons.Default.OpenInNew, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(5.dp))
                    Text("Open strongest source", fontSize = 10.sp)
                }
            }
        }
    }
}

@Composable
private fun EntityTileV2(card: EventCard) {
    val initials = (card.entityName ?: "CR")
        .split(' ')
        .filter { it.isNotBlank() }
        .take(2)
        .joinToString("") { it.first().uppercase() }
        .ifBlank { "CR" }
    Box(
        modifier = Modifier
            .size(width = 54.dp, height = 62.dp)
            .background(
                Brush.linearGradient(listOf(V2GoldDeep.copy(alpha = 0.9f), Color(0xFF2B303A))),
                RoundedCornerShape(14.dp),
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(initials, color = V2Text, fontSize = 16.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun VerificationV2(value: String) {
    val color = when (value) {
        "OFFICIAL", "CONFIRMED" -> V2Green
        "DEVELOPING" -> V2Amber
        "RUMOR" -> V2Red
        else -> V2Blue
    }
    val icon = when (value) {
        "OFFICIAL", "CONFIRMED" -> Icons.Default.CheckCircle
        "DEVELOPING", "RUMOR" -> Icons.Default.Warning
        else -> Icons.Default.Info
    }
    Surface(color = color.copy(alpha = 0.11f), shape = RoundedCornerShape(50)) {
        Row(Modifier.padding(horizontal = 7.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(12.dp))
            Spacer(Modifier.width(4.dp))
            Text(prettyV2(value), color = color, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        }
    }
}

private fun evidenceHeadlineV2(card: EventCard): String {
    val base = when (card.evidenceCount) {
        0 -> "Evidence pending"
        1 -> "1 linked source"
        else -> "${card.evidenceCount} linked sources"
    }
    return if (card.conflictingEvidenceCount > 0) "$base • ${card.conflictingEvidenceCount} conflict" else base
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EvidenceSheetV2(card: EventCard, onDismiss: () -> Unit) {
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
        containerColor = V2Panel,
        contentColor = V2Text,
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp).padding(bottom = 28.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("EVIDENCE TRAIL", color = V2Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.2.sp)
                    Text(card.entityName ?: "CineRelay event", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                }
                IconButton(onClick = onDismiss) { Icon(Icons.Default.Close, contentDescription = "Close") }
            }
            Spacer(Modifier.height(8.dp))
            Text(card.headline, color = V2Muted, fontSize = 13.sp, lineHeight = 19.sp)
            Spacer(Modifier.height(14.dp))

            when {
                loading -> Row(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalArrangement = Arrangement.Center) {
                    CircularProgressIndicator(modifier = Modifier.size(26.dp), strokeWidth = 2.dp)
                }
                error != null -> Text(error.orEmpty(), color = V2Red, fontSize = 13.sp)
                bundle != null -> EvidenceBundleContentV2(bundle!!)
            }
        }
    }
}

@Composable
private fun EvidenceBundleContentV2(bundle: EvidenceBundle) {
    val context = LocalContext.current
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        MetricPillV2("${bundle.evidenceCount} source${if (bundle.evidenceCount == 1) "" else "s"}", V2Blue)
        MetricPillV2(prettyV2(bundle.verificationState), if (bundle.verificationState == "OFFICIAL" || bundle.verificationState == "CONFIRMED") V2Green else V2Amber)
        if (bundle.conflictingEvidenceCount > 0) MetricPillV2("${bundle.conflictingEvidenceCount} conflict", V2Red)
    }

    if (bundle.evidenceCount == 1) {
        Spacer(Modifier.height(12.dp))
        Surface(color = V2Blue.copy(alpha = 0.08f), shape = RoundedCornerShape(12.dp)) {
            Text(
                "Why only one? CineRelay currently has one canonical evidence record linked to this event. Counts are never inflated; additional sources appear only after they are ingested and linked to the same event.",
                color = V2Muted,
                fontSize = 11.sp,
                lineHeight = 17.sp,
                modifier = Modifier.padding(12.dp),
            )
        }
    }

    Spacer(Modifier.height(14.dp))
    if (bundle.items.isEmpty()) {
        Text("No linked evidence records are available yet.", color = V2Muted, fontSize = 12.sp)
    } else {
        bundle.items.forEachIndexed { index, item ->
            EvidenceItemV2(index + 1, item) { url ->
                runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
            }
            if (index != bundle.items.lastIndex) Spacer(Modifier.height(10.dp))
        }
    }
}

@Composable
private fun MetricPillV2(text: String, color: Color) {
    Surface(color = color.copy(alpha = 0.1f), shape = RoundedCornerShape(50)) {
        Text(text, color = color, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp))
    }
}

@Composable
private fun EvidenceItemV2(index: Int, item: EvidenceDetail, onOpen: (String) -> Unit) {
    Surface(color = V2PanelRaised, shape = RoundedCornerShape(16.dp)) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(26.dp).background(V2Gold.copy(alpha = 0.14f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) { Text(index.toString(), color = V2Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(item.sourceName ?: "Unknown source", color = V2Text, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text(
                        listOfNotNull(item.platform, item.handle).joinToString(" • ").ifBlank { prettyV2(item.sourceRole ?: "source") },
                        color = V2Muted,
                        fontSize = 10.sp,
                    )
                }
                MetricPillV2(prettyV2(item.role), roleColorV2(item.role))
            }
            item.title?.takeIf { it.isNotBlank() }?.let {
                Spacer(Modifier.height(10.dp))
                Text(it, color = V2Text, fontSize = 12.sp, lineHeight = 17.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.height(9.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                val tier = item.authorityTier?.let { "Tier $it" } ?: "Authority n/a"
                Text("$tier • weight ${item.weight}", color = V2Muted, fontSize = 10.sp)
                Spacer(Modifier.weight(1f))
                item.canonicalUrl?.takeIf { it.isNotBlank() }?.let { url ->
                    TextButton(onClick = { onOpen(url) }, contentPadding = PaddingValues(horizontal = 8.dp, vertical = 3.dp)) {
                        Icon(Icons.Default.OpenInNew, contentDescription = null, modifier = Modifier.size(13.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Open source", fontSize = 10.sp)
                    }
                }
            }
        }
    }
}

private fun roleColorV2(role: String): Color = when (role) {
    "PRIMARY" -> V2Green
    "CORROBORATING" -> V2Blue
    "CONFLICTING" -> V2Red
    else -> V2Muted
}

@Composable
private fun LockedV2(tab: AppTab, viewModel: CineRelayViewModel) {
    Column(
        modifier = Modifier.fillMaxSize().padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        BrandMarkV2(52.dp)
        Spacer(Modifier.height(18.dp))
        Text(if (tab == AppTab.ALERTS) "Your alerts, your device" else "Build your own signal feed", fontSize = 21.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            if (tab == AppTab.ALERTS) "Sign in to connect a device, receive alerts and inspect delivery history."
            else "Sign in to follow films and series and collect their updates here.",
            color = V2Muted,
            fontSize = 13.sp,
            lineHeight = 19.sp,
        )
        Spacer(Modifier.height(20.dp))
        Button(onClick = { viewModel.openAuth(AuthMode.CREATE_ACCOUNT) }) { Text("Create account") }
        TextButton(onClick = { viewModel.openAuth(AuthMode.SIGN_IN) }) { Text("I already have an account") }
        TextButton(onClick = { viewModel.selectTab(AppTab.LIVE) }) { Text("Back to Live") }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AuthSheetV2(
    mode: AuthMode,
    busy: Boolean,
    error: String?,
    notice: String?,
    onDismiss: () -> Unit,
    onSwitchMode: (AuthMode) -> Unit,
    onSignIn: (String, String) -> Unit,
    onCreateAccount: (String, String) -> Unit,
) {
    var email by remember(mode) { mutableStateOf("") }
    var password by remember(mode) { mutableStateOf("") }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = V2Panel, contentColor = V2Text) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(bottom = 28.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                BrandMarkV2(42.dp)
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(if (mode == AuthMode.CREATE_ACCOUNT) "Create your account" else "Welcome back", fontSize = 21.sp, fontWeight = FontWeight.Bold)
                    Text("Following and alerts stay tied to you.", color = V2Muted, fontSize = 11.sp)
                }
            }
            Spacer(Modifier.height(20.dp))
            OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), label = { Text("Email") }, singleLine = true, enabled = !busy)
            Spacer(Modifier.height(11.dp))
            OutlinedTextField(
                password,
                { password = it },
                Modifier.fillMaxWidth(),
                label = { Text("Password") },
                singleLine = true,
                enabled = !busy,
                visualTransformation = PasswordVisualTransformation(),
            )
            if (!notice.isNullOrBlank()) { Spacer(Modifier.height(9.dp)); Text(notice, color = V2Green, fontSize = 12.sp) }
            if (!error.isNullOrBlank()) { Spacer(Modifier.height(9.dp)); Text(error, color = V2Red, fontSize = 12.sp) }
            Spacer(Modifier.height(17.dp))
            Button(
                onClick = { if (mode == AuthMode.CREATE_ACCOUNT) onCreateAccount(email, password) else onSignIn(email, password) },
                modifier = Modifier.fillMaxWidth(),
                enabled = !busy,
            ) {
                if (busy) CircularProgressIndicator(Modifier.size(19.dp), strokeWidth = 2.dp, color = V2Ink)
                else Text(if (mode == AuthMode.CREATE_ACCOUNT) "Create account" else "Sign in")
            }
            TextButton(
                onClick = { onSwitchMode(if (mode == AuthMode.CREATE_ACCOUNT) AuthMode.SIGN_IN else AuthMode.CREATE_ACCOUNT) },
                modifier = Modifier.fillMaxWidth(),
                enabled = !busy,
            ) {
                Text(if (mode == AuthMode.CREATE_ACCOUNT) "Already have an account? Sign in" else "New to CineRelay? Create account")
            }
        }
    }
}

@Composable
private fun AlertsV2(state: CineRelayUiState, viewModel: CineRelayViewModel) {
    val context = LocalContext.current
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted -> if (granted) viewModel.registerPush() }
    val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Surface(color = V2PanelRaised, shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(16.dp)) {
                    Text("REAL-DEVICE ALERTS", color = V2Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                    Spacer(Modifier.height(5.dp))
                    Text(
                        when {
                            !BuildConfig.FIREBASE_CONFIGURED -> "Firebase connection pending"
                            state.pushState.registered -> "This device is registered"
                            else -> "Ready to register this phone"
                        },
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(7.dp))
                    Text(state.pushState.message, color = V2Muted, fontSize = 12.sp, lineHeight = 18.sp)
                    Spacer(Modifier.height(12.dp))
                    Button(
                        enabled = BuildConfig.FIREBASE_CONFIGURED && !state.loading,
                        onClick = {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !granted) permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                            else viewModel.registerPush()
                        },
                    ) { Text(if (state.pushState.registered) "Re-register device" else "Enable real alerts") }
                }
            }
        }
        if (state.alerts.isEmpty() && !state.loading) item { EmptyV2("No alert history yet", "Eligible signals from followed titles will appear here.") }
        else items(state.alerts, key = { it.id }) { AlertCardV2(it) }
    }
}

@Composable
private fun AlertCardV2(alert: AlertItem) {
    Card(colors = CardDefaults.cardColors(containerColor = V2Panel), shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.padding(15.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(alert.deliveryKind, color = V2Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.width(8.dp))
                MetricPillV2(prettyV2(alert.status), when (alert.status) {
                    "SENT" -> V2Green
                    "FAILED", "SUPPRESSED" -> V2Red
                    "DEFERRED" -> V2Amber
                    else -> V2Blue
                })
                Spacer(Modifier.weight(1f))
                Text(timeAgoV2(alert.createdAt), color = V2Muted, fontSize = 10.sp)
            }
            Spacer(Modifier.height(9.dp))
            Text(alert.event?.entityName ?: "CineRelay", color = V2Muted, fontSize = 11.sp)
            Text(alert.event?.headline ?: "Alert event unavailable", color = V2Text, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun InlineV2(message: String, color: Color) {
    Text(message, color = color, fontSize = 11.sp, modifier = Modifier.fillMaxWidth().background(color.copy(alpha = 0.07f)).padding(horizontal = 16.dp, vertical = 8.dp))
}

@Composable
private fun EmptyV2(title: String, body: String) {
    Column(Modifier.fillMaxWidth().padding(34.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        BrandMarkV2(38.dp)
        Spacer(Modifier.height(13.dp))
        Text(title, color = V2Text, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text(body, color = V2Muted, fontSize = 12.sp, lineHeight = 18.sp)
    }
}

@Composable
private fun BrandMarkV2(size: androidx.compose.ui.unit.Dp) {
    Box(
        modifier = Modifier.size(size).background(Brush.linearGradient(listOf(V2Gold, Color(0xFFD9A93E))), RoundedCornerShape(size / 3)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(Icons.Default.PlayArrow, contentDescription = null, tint = V2Ink, modifier = Modifier.size(size * 0.62f))
    }
}

private fun AppTab.requiresV2Account(): Boolean = this == AppTab.FOLLOWING || this == AppTab.ALERTS

private fun tabTitleV2(tab: AppTab): String = when (tab) {
    AppTab.LIVE -> "Live Signals"
    AppTab.FOLLOWING -> "Following"
    AppTab.RADAR -> "Creator Radar"
    AppTab.ALERTS -> "Alerts"
}

private fun prettyV2(value: String): String = value.lowercase().split('_').joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }

private fun timeAgoV2(value: String?): String {
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
