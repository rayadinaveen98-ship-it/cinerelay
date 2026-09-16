package com.cinerelay.app.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.cinerelay.app.data.AlertItem
import com.cinerelay.app.data.EventCard
import java.time.Duration
import java.time.Instant

private val Ink = Color(0xFF111318)
private val Panel = Color(0xFF191C22)
private val PanelRaised = Color(0xFF20242C)
private val Line = Color(0xFF303640)
private val TextPrimary = Color(0xFFF1F3F5)
private val TextSecondary = Color(0xFFA9B0BA)
private val Signal = Color(0xFFE8C26A)
private val Trusted = Color(0xFF73D9A6)
private val Developing = Color(0xFFF2B85B)
private val Caution = Color(0xFFF07A75)
private val InfoBlue = Color(0xFF86B9FF)

private val CineRelayColors = darkColorScheme(
    primary = Signal,
    onPrimary = Color(0xFF231B08),
    secondary = Trusted,
    background = Ink,
    surface = Panel,
    surfaceVariant = PanelRaised,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    onSurfaceVariant = TextSecondary,
    outline = Line,
    error = Caution,
)

@Composable
fun CineRelayApp(viewModel: CineRelayViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    MaterialTheme(colorScheme = CineRelayColors) {
        Surface(modifier = Modifier.fillMaxSize(), color = Ink) {
            if (state.authenticated) SignalRoom(state, viewModel)
            else LoginScreen(state.error, state.signingIn, viewModel::signIn)
        }
    }
}

@Composable
private fun LoginScreen(error: String?, busy: Boolean, onSignIn: (String, String) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 28.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(44.dp).background(Signal, RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Default.PlayArrow, contentDescription = null, tint = Ink, modifier = Modifier.size(28.dp))
            }
            Spacer(Modifier.width(14.dp))
            Column {
                Text("CineRelay", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Text("Cinema intelligence, not noise.", color = TextSecondary, fontSize = 13.sp)
            }
        }

        Spacer(Modifier.height(38.dp))
        Text("Enter the signal room", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(8.dp))
        Text(
            "Use your CineRelay account. The app talks only to authenticated mobile APIs; privileged backend credentials never enter your phone.",
            color = TextSecondary,
            lineHeight = 20.sp,
        )
        Spacer(Modifier.height(24.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Email") },
            singleLine = true,
            enabled = !busy,
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            enabled = !busy,
        )
        if (!error.isNullOrBlank()) {
            Spacer(Modifier.height(12.dp))
            Text(error, color = Caution, fontSize = 13.sp)
        }
        Spacer(Modifier.height(20.dp))
        Button(
            onClick = { onSignIn(email, password) },
            modifier = Modifier.fillMaxWidth(),
            enabled = !busy,
            contentPadding = PaddingValues(vertical = 14.dp),
        ) {
            if (busy) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = Ink)
            else Text("Sign in")
        }
        Spacer(Modifier.height(18.dp))
        Text("V0.1 Canary • ${BuildConfig.VERSION_NAME}", color = TextSecondary, fontSize = 11.sp)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SignalRoom(state: CineRelayUiState, viewModel: CineRelayViewModel) {
    Scaffold(
        containerColor = Ink,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink),
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier.size(30.dp).background(Signal, RoundedCornerShape(9.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Default.PlayArrow, null, tint = Ink, modifier = Modifier.size(19.dp))
                        }
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(tabTitle(state.tab), fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Text("CineRelay signal room", color = TextSecondary, fontSize = 11.sp)
                        }
                    }
                },
                actions = {
                    IconButton(onClick = viewModel::refresh, enabled = !state.loading) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = TextSecondary)
                    }
                    IconButton(onClick = viewModel::signOut) {
                        Icon(Icons.Default.Logout, contentDescription = "Sign out", tint = TextSecondary)
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Panel) {
                BottomDestination(AppTab.LIVE, state.tab, Icons.Default.Home, "Live", viewModel::selectTab)
                BottomDestination(AppTab.FOLLOWING, state.tab, Icons.Default.Star, "Following", viewModel::selectTab)
                BottomDestination(AppTab.RADAR, state.tab, Icons.Default.Movie, "Radar", viewModel::selectTab)
                BottomDestination(AppTab.ALERTS, state.tab, Icons.Default.Notifications, "Alerts", viewModel::selectTab)
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            StatusStrip(state)
            if (!state.error.isNullOrBlank()) {
                Text(
                    state.error,
                    color = Caution,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
            if (state.tab == AppTab.ALERTS) AlertsContent(state, viewModel)
            else FeedContent(state, viewModel)
        }
    }
}

@Composable
private fun BottomDestination(tab: AppTab, selected: AppTab, icon: ImageVector, label: String, onSelect: (AppTab) -> Unit) {
    NavigationBarItem(
        selected = tab == selected,
        onClick = { onSelect(tab) },
        icon = { Icon(icon, contentDescription = label) },
        label = { Text(label) },
    )
}

@Composable
private fun StatusStrip(state: CineRelayUiState) {
    Row(
        modifier = Modifier.fillMaxWidth().background(Panel).padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(7.dp).background(Trusted, RoundedCornerShape(50)))
        Spacer(Modifier.width(8.dp))
        Text("Hosted backend connected", color = TextSecondary, fontSize = 11.sp)
        Spacer(Modifier.weight(1f))
        state.bootstrap?.let {
            Text("${it.followCount} followed  •  ${it.alertCount} alerts", color = TextSecondary, fontSize = 11.sp)
        }
        if (state.loading) {
            Spacer(Modifier.width(10.dp))
            CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
        }
    }
}

@Composable
private fun FeedContent(state: CineRelayUiState, viewModel: CineRelayViewModel) {
    if (!state.loading && state.events.isEmpty()) {
        EmptyState(
            title = when (state.tab) {
                AppTab.FOLLOWING -> "Nothing followed yet"
                AppTab.RADAR -> "Radar is quiet"
                else -> "No active signals"
            },
            body = when (state.tab) {
                AppTab.FOLLOWING -> "Follow a title from Live and its updates will appear here."
                AppTab.RADAR -> "Creator Radar entries appear when the deterministic scoring layer materializes them."
                else -> "CineRelay has no active canonical events to show right now."
            },
        )
        return
    }

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(state.events, key = { it.id }) { card -> SignalCard(card) { viewModel.toggleFollow(card) } }
        item { Spacer(Modifier.height(8.dp)) }
    }
}

@Composable
private fun SignalCard(card: EventCard, onFollow: () -> Unit) {
    val context = LocalContext.current
    Card(
        colors = CardDefaults.cardColors(containerColor = Panel),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                VerificationBadge(card.verificationState)
                Spacer(Modifier.width(8.dp))
                Text(
                    pretty(card.eventType),
                    color = TextSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.weight(1f))
                Text(timeAgo(card.detectedAt), color = TextSecondary, fontSize = 11.sp)
            }

            Spacer(Modifier.height(12.dp))
            Text(
                card.entityName ?: "Unresolved title",
                color = Signal,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.4.sp,
            )
            Spacer(Modifier.height(5.dp))
            Text(card.headline, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, lineHeight = 24.sp)

            if (!card.summary.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(card.summary, color = TextSecondary, fontSize = 13.sp, lineHeight = 19.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }

            card.radar?.let { radar ->
                Spacer(Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth().background(PanelRaised, RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("RADAR ${radar.score}", color = Signal, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.width(8.dp))
                    Text(pretty(radar.label), color = TextSecondary, fontSize = 11.sp)
                }
            }

            Spacer(Modifier.height(13.dp))
            HorizontalDivider(color = Line)
            Spacer(Modifier.height(11.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(card.evidence?.sourceName ?: "Evidence pending", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    val evidenceText = buildString {
                        append(card.evidenceCount)
                        append(if (card.evidenceCount == 1) " evidence" else " evidence items")
                        if (card.conflictingEvidenceCount > 0) append("  •  ${card.conflictingEvidenceCount} conflict")
                    }
                    Text(evidenceText, color = if (card.conflictingEvidenceCount > 0) Caution else TextSecondary, fontSize = 11.sp)
                }
                IconButton(onClick = onFollow) {
                    Icon(
                        if (card.followed) Icons.Default.Star else Icons.Outlined.StarBorder,
                        contentDescription = if (card.followed) "Unfollow" else "Follow",
                        tint = if (card.followed) Signal else TextSecondary,
                    )
                }
                val sourceUrl = card.evidence?.canonicalUrl
                if (!sourceUrl.isNullOrBlank()) {
                    TextButton(onClick = { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(sourceUrl))) } }) {
                        Text("Source")
                    }
                }
            }
        }
    }
}

@Composable
private fun AlertsContent(state: CineRelayUiState, viewModel: CineRelayViewModel) {
    val context = LocalContext.current
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) viewModel.registerPush()
    }
    val notificationGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            PushCanaryCard(
                state = state,
                notificationGranted = notificationGranted,
                onEnable = {
                    if (BuildConfig.FIREBASE_CONFIGURED) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !notificationGranted) {
                            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        } else {
                            viewModel.registerPush()
                        }
                    }
                },
            )
        }
        if (state.alerts.isEmpty() && !state.loading) {
            item {
                EmptyState(
                    title = "No alert history yet",
                    body = "When followed projects produce eligible canonical events, your alert outbox will appear here.",
                )
            }
        } else {
            items(state.alerts, key = { it.id }) { alert -> AlertCard(alert) }
        }
    }
}

@Composable
private fun PushCanaryCard(state: CineRelayUiState, notificationGranted: Boolean, onEnable: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = PanelRaised), shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (state.pushState.registered) Icons.Default.CheckCircle else Icons.Default.Notifications,
                    contentDescription = null,
                    tint = if (state.pushState.registered) Trusted else Signal,
                )
                Spacer(Modifier.width(10.dp))
                Column {
                    Text("Real-device alert canary", fontWeight = FontWeight.Bold)
                    Text(
                        when {
                            !BuildConfig.FIREBASE_CONFIGURED -> "Firebase client config required"
                            !notificationGranted -> "Notification permission required"
                            state.pushState.registered -> "Device registered"
                            else -> "Ready for FCM registration"
                        },
                        color = TextSecondary,
                        fontSize = 12.sp,
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            Text(state.pushState.message, color = TextSecondary, fontSize = 12.sp, lineHeight = 18.sp)
            Spacer(Modifier.height(14.dp))
            Button(
                onClick = onEnable,
                enabled = BuildConfig.FIREBASE_CONFIGURED && !state.loading,
                colors = ButtonDefaults.buttonColors(containerColor = Signal, contentColor = Ink),
            ) {
                Text(if (state.pushState.registered) "Re-register token" else "Enable real alerts")
            }
            if (!BuildConfig.FIREBASE_CONFIGURED) {
                Spacer(Modifier.height(8.dp))
                Text("Package locked for Firebase: com.cinerelay.app", color = InfoBlue, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun AlertCard(alert: AlertItem) {
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(16.dp)) {
        Column(Modifier.padding(15.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(alert.deliveryKind, color = Signal, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.width(8.dp))
                AlertStatus(alert.status)
                Spacer(Modifier.weight(1f))
                Text(timeAgo(alert.createdAt), color = TextSecondary, fontSize = 11.sp)
            }
            Spacer(Modifier.height(9.dp))
            Text(alert.event?.entityName ?: "CineRelay", color = TextSecondary, fontSize = 11.sp)
            Text(alert.event?.headline ?: "Alert event unavailable", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            alert.scheduledFor?.let {
                Spacer(Modifier.height(7.dp))
                Text("Scheduled ${timeAgo(it)}", color = TextSecondary, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun VerificationBadge(value: String) {
    val color = when (value) {
        "OFFICIAL", "CONFIRMED" -> Trusted
        "DEVELOPING" -> Developing
        "RUMOR" -> Caution
        else -> InfoBlue
    }
    val icon = when (value) {
        "OFFICIAL", "CONFIRMED" -> Icons.Default.CheckCircle
        "DEVELOPING", "RUMOR" -> Icons.Default.Warning
        else -> Icons.Default.Info
    }
    Row(
        modifier = Modifier.background(color.copy(alpha = 0.12f), RoundedCornerShape(50)).padding(horizontal = 8.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = color, modifier = Modifier.size(13.dp))
        Spacer(Modifier.width(5.dp))
        Text(pretty(value), color = color, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun AlertStatus(status: String) {
    val color = when (status) {
        "SENT" -> Trusted
        "FAILED", "SUPPRESSED" -> Caution
        "DEFERRED" -> Developing
        else -> InfoBlue
    }
    Text(
        pretty(status),
        color = color,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.background(color.copy(alpha = 0.12f), RoundedCornerShape(50)).padding(horizontal = 7.dp, vertical = 4.dp),
    )
}

@Composable
private fun EmptyState(title: String, body: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(30.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(Icons.Default.Movie, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(34.dp))
        Spacer(Modifier.height(12.dp))
        Text(title, fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
        Spacer(Modifier.height(6.dp))
        Text(body, color = TextSecondary, fontSize = 13.sp, lineHeight = 19.sp)
    }
}

private fun tabTitle(tab: AppTab): String = when (tab) {
    AppTab.LIVE -> "Live"
    AppTab.FOLLOWING -> "Following"
    AppTab.RADAR -> "Creator Radar"
    AppTab.ALERTS -> "Alerts"
}

private fun pretty(value: String): String = value
    .lowercase()
    .split('_')
    .joinToString(" ") { part -> part.replaceFirstChar { it.uppercase() } }

private fun timeAgo(value: String?): String {
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
