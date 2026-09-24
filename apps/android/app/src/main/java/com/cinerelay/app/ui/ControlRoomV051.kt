package com.cinerelay.app.ui

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val ControlInk = Color(0xFF0D0F13)
private val ControlPanel = Color(0xFF15181E)
private val ControlRaised = Color(0xFF1B1F27)
private val ControlLine = Color(0xFF2A303A)
private val ControlText = Color(0xFFF4F1EA)
private val ControlMuted = Color(0xFFA7ADB7)
private val ControlGold = Color(0xFFE7C36B)
private val ControlGreen = Color(0xFF72D6A4)

@Composable
fun ControlRoomV051(
    state: CineRelayUiState,
    notificationState: NotificationOnboardingState,
    onBack: () -> Unit,
    onSelectPlatform: (NewsroomPlatform) -> Unit,
    onSelectFilter: (NewsroomFilter) -> Unit,
    onSelectSourceRole: (NewsroomSourceRole) -> Unit,
    onToggleNotificationMaster: (Boolean) -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(modifier = modifier.fillMaxSize(), color = ControlInk) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding(),
        ) {
            ControlHeader(onBack)

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    ControlAccountCard(
                        email = state.email,
                        onSignOut = onSignOut,
                    )
                }

                item {
                    ControlNewsroomCard(
                        state = state,
                        onSelectPlatform = onSelectPlatform,
                        onSelectFilter = onSelectFilter,
                        onSelectSourceRole = onSelectSourceRole,
                    )
                }

                item {
                    ControlNotificationsCard(
                        state = notificationState,
                        onToggleMaster = onToggleNotificationMaster,
                    )
                }
            }
        }
    }
}

@Composable
private fun ControlHeader(onBack: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = ControlText)
        }
        Surface(
            color = ControlGold.copy(alpha = 0.10f),
            shape = RoundedCornerShape(13.dp),
            modifier = Modifier.size(40.dp),
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Icon(Icons.Default.Settings, contentDescription = null, tint = ControlGold, modifier = Modifier.size(22.dp))
            }
        }
        Spacer(Modifier.size(10.dp))
        Column {
            Text("CINERELAY", color = ControlGold, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
            Text("Control Room", color = ControlText, fontSize = 21.sp, fontWeight = FontWeight.Bold)
            Text("Newsroom, notifications and account", color = ControlMuted, fontSize = 10.sp)
        }
    }
}

@Composable
private fun ControlAccountCard(email: String?, onSignOut: () -> Unit) {
    ControlCard(title = "Account", subtitle = "Your CineRelay identity") {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(email ?: "Signed in", color = ControlText, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                Text("Authenticated session", color = ControlGreen, fontSize = 10.sp)
            }
            TextButton(onClick = onSignOut) {
                Text("Sign out", color = ControlGold, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun ControlNewsroomCard(
    state: CineRelayUiState,
    onSelectPlatform: (NewsroomPlatform) -> Unit,
    onSelectFilter: (NewsroomFilter) -> Unit,
    onSelectSourceRole: (NewsroomSourceRole) -> Unit,
) {
    ControlCard(
        title = "Newsroom",
        subtitle = "The feed stays clean; detailed controls live here.",
    ) {
        ControlLabel("Source lane")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ControlChip(
                label = "YouTube",
                selected = state.newsroomPlatform == NewsroomPlatform.YOUTUBE,
                onClick = { onSelectPlatform(NewsroomPlatform.YOUTUBE) },
            )
            ControlChip(
                label = "Web",
                selected = state.newsroomPlatform == NewsroomPlatform.WEB,
                onClick = { onSelectPlatform(NewsroomPlatform.WEB) },
            )
            FilterChip(
                selected = state.newsroomPlatform == NewsroomPlatform.X,
                onClick = {},
                enabled = false,
                label = { Text("X • paused", fontSize = 11.sp) },
                colors = controlChipColors(),
            )
        }

        if (state.newsroomPlatform == NewsroomPlatform.YOUTUBE) {
            Spacer(Modifier.height(16.dp))
            ControlLabel("YouTube source type")
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                ControlChip("All", state.newsroomSourceRole == NewsroomSourceRole.ALL) { onSelectSourceRole(NewsroomSourceRole.ALL) }
                ControlChip("Production", state.newsroomSourceRole == NewsroomSourceRole.PRODUCTION) { onSelectSourceRole(NewsroomSourceRole.PRODUCTION) }
            }
            Spacer(Modifier.height(7.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                ControlChip("OTT channels", state.newsroomSourceRole == NewsroomSourceRole.OTT) { onSelectSourceRole(NewsroomSourceRole.OTT) }
                ControlChip("Music", state.newsroomSourceRole == NewsroomSourceRole.MUSIC) { onSelectSourceRole(NewsroomSourceRole.MUSIC) }
            }
        }

        Spacer(Modifier.height(16.dp))
        ControlLabel("Signal confidence")
        Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            ControlChip("All", state.newsroomFilter == NewsroomFilter.ALL) { onSelectFilter(NewsroomFilter.ALL) }
            ControlChip("Verified", state.newsroomFilter == NewsroomFilter.VERIFIED) { onSelectFilter(NewsroomFilter.VERIFIED) }
            ControlChip("Developing", state.newsroomFilter == NewsroomFilter.DEVELOPING) { onSelectFilter(NewsroomFilter.DEVELOPING) }
        }
        Spacer(Modifier.height(7.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            ControlChip("Unconfirmed", state.newsroomFilter == NewsroomFilter.UNCONFIRMED) { onSelectFilter(NewsroomFilter.UNCONFIRMED) }
            ControlChip("Rumor / conflict", state.newsroomFilter == NewsroomFilter.CONFLICT_RUMOR) { onSelectFilter(NewsroomFilter.CONFLICT_RUMOR) }
        }
    }
}

@Composable
private fun ControlNotificationsCard(
    state: NotificationOnboardingState,
    onToggleMaster: (Boolean) -> Unit,
) {
    ControlCard(
        title = "Source notifications",
        subtitle = "Your selected official YouTube channels remain intact when alerts are paused.",
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    if (state.masterEnabled) "Notifications on" else "Notifications paused",
                    color = ControlText,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "${state.selectedSourceIds.size} selected YouTube sources",
                    color = ControlMuted,
                    fontSize = 11.sp,
                )
            }
            Switch(
                checked = state.masterEnabled,
                onCheckedChange = onToggleMaster,
                enabled = state.setupCompleted && !state.saving,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = ControlInk,
                    checkedTrackColor = ControlGold,
                    uncheckedThumbColor = ControlMuted,
                    uncheckedTrackColor = ControlRaised,
                    uncheckedBorderColor = ControlLine,
                ),
            )
        }

        Spacer(Modifier.height(12.dp))
        Surface(
            color = ControlRaised,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 11.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(if (state.includeVideos) "Videos • on" else "Videos • off", color = ControlMuted, fontSize = 11.sp)
                Text(if (state.includeShorts) "Shorts • on" else "Shorts • off", color = ControlMuted, fontSize = 11.sp)
            }
        }

        state.error?.let {
            Spacer(Modifier.height(10.dp))
            Text(it, color = Color(0xFFF08079), fontSize = 10.sp, lineHeight = 15.sp)
        }
    }
}

@Composable
private fun ControlCard(
    title: String,
    subtitle: String,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = ControlPanel),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            Text(title, color = ControlText, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(3.dp))
            Text(subtitle, color = ControlMuted, fontSize = 11.sp, lineHeight = 16.sp)
            Spacer(Modifier.height(14.dp))
            content()
        }
    }
}

@Composable
private fun ControlLabel(text: String) {
    Text(text, color = ControlMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(7.dp))
}

@Composable
private fun ControlChip(label: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label, fontSize = 11.sp) },
        colors = controlChipColors(),
    )
}

@Composable
private fun controlChipColors() = FilterChipDefaults.filterChipColors(
    containerColor = ControlRaised,
    labelColor = ControlMuted,
    selectedContainerColor = ControlGold.copy(alpha = 0.14f),
    selectedLabelColor = ControlGold,
    disabledContainerColor = ControlRaised.copy(alpha = 0.55f),
    disabledLabelColor = ControlMuted.copy(alpha = 0.55f),
)
