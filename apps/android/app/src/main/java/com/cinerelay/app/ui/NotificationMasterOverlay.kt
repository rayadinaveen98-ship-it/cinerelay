package com.cinerelay.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val MasterPanel = Color(0xFF171A20)
private val MasterLine = Color(0xFF2A303A)
private val MasterText = Color(0xFFF4F1EA)
private val MasterMuted = Color(0xFFA7ADB7)
private val MasterGold = Color(0xFFE7C36B)
private val MasterGreen = Color(0xFF72D6A4)
private val MasterRed = Color(0xFFF08079)
private val MasterInk = Color(0xFF0D0F13)

@Composable
fun NotificationMasterOverlay(
    state: NotificationOnboardingState,
    onToggle: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!state.authenticated || !state.setupKnown || !state.setupCompleted) return

    val selectedCount = state.selectedSourceIds.size
    val typeLabel = buildList {
        if (state.includeVideos) add("Videos")
        if (state.includeShorts) add("Shorts")
    }.joinToString(" + ").ifBlank { "No upload types" }

    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MasterPanel.copy(alpha = 0.98f),
        shape = RoundedCornerShape(20.dp),
        shadowElevation = 10.dp,
        tonalElevation = 0.dp,
    ) {
        Column(Modifier.padding(horizontal = 15.dp, vertical = 13.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .background(
                            color = if (state.masterEnabled) MasterGreen.copy(alpha = 0.12f) else MasterLine,
                            shape = CircleShape,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = if (state.masterEnabled) Icons.Default.Notifications else Icons.Default.NotificationsOff,
                        contentDescription = null,
                        tint = if (state.masterEnabled) MasterGreen else MasterMuted,
                        modifier = Modifier.size(19.dp),
                    )
                }
                Spacer(Modifier.width(11.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        text = "Source notifications",
                        color = MasterText,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = when {
                            selectedCount == 0 -> "No channels selected"
                            state.masterEnabled -> "$selectedCount channels • $typeLabel • Live"
                            else -> "$selectedCount channels • $typeLabel • Paused"
                        },
                        color = if (state.masterEnabled) MasterGreen else MasterMuted,
                        fontSize = 10.sp,
                    )
                }
                if (state.saving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(22.dp),
                        strokeWidth = 2.dp,
                        color = MasterGold,
                    )
                } else {
                    Switch(
                        checked = state.masterEnabled,
                        onCheckedChange = onToggle,
                        enabled = selectedCount > 0,
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = MasterInk,
                            checkedTrackColor = MasterGold,
                            uncheckedThumbColor = MasterMuted,
                            uncheckedTrackColor = MasterLine,
                        ),
                    )
                }
            }

            state.error?.takeIf { it.isNotBlank() }?.let { message ->
                Spacer(Modifier.size(8.dp))
                Text(
                    text = message,
                    color = MasterRed,
                    fontSize = 10.sp,
                    lineHeight = 15.sp,
                )
            }
        }
    }
}
