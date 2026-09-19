package com.cinerelay.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val SourceRoleInk = Color(0xFF0D0F13)
private val SourceRolePanel = Color(0xFF15181E)
private val SourceRoleRaised = Color(0xFF1B1F27)
private val SourceRoleText = Color(0xFFF4F1EA)
private val SourceRoleMuted = Color(0xFFA7ADB7)
private val SourceRoleGold = Color(0xFFE7C36B)
private val SourceRoleProduction = Color(0xFF8CB9FF)
private val SourceRoleOtt = Color(0xFF72D6A4)
private val SourceRoleMusic = Color(0xFFF0B862)

private val SourceRoleColors = darkColorScheme(
    primary = SourceRoleGold,
    background = SourceRoleInk,
    surface = SourceRolePanel,
    surfaceVariant = SourceRoleRaised,
    onBackground = SourceRoleText,
    onSurface = SourceRoleText,
    onSurfaceVariant = SourceRoleMuted,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewsroomSourceRoleOverlay(
    selected: NewsroomSourceRole,
    counts: Map<NewsroomSourceRole, Int>,
    onSelect: (NewsroomSourceRole) -> Unit,
    modifier: Modifier = Modifier,
) {
    var open by remember { mutableStateOf(false) }

    MaterialTheme(colorScheme = SourceRoleColors) {
        FilledTonalButton(
            onClick = { open = true },
            modifier = modifier,
            shape = RoundedCornerShape(50),
        ) {
            Icon(Icons.Default.Movie, contentDescription = null, modifier = Modifier.size(17.dp))
            Spacer(Modifier.width(6.dp))
            Text(selected.shortLabel(), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            counts[selected]?.let { count ->
                Spacer(Modifier.width(6.dp))
                Text(count.toString(), color = SourceRoleMuted, fontSize = 10.sp)
            }
        }

        if (open) {
            ModalBottomSheet(
                onDismissRequest = { open = false },
                containerColor = SourceRolePanel,
                contentColor = SourceRoleText,
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp).padding(bottom = 28.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("YOUTUBE SOURCE TYPE", color = SourceRoleGold, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.2.sp)
                    Text("Choose the kind of source", color = SourceRoleText, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                    Text(
                        "This changes only the YouTube lane you see. Confidence filtering stays independent, so you can combine source type with Verified, Developing or other newsroom states.",
                        color = SourceRoleMuted,
                        fontSize = 11.sp,
                        lineHeight = 17.sp,
                        modifier = Modifier.padding(bottom = 7.dp),
                    )

                    NewsroomSourceRole.entries.forEach { role ->
                        val selectedRow = role == selected
                        Surface(
                            color = if (selectedRow) SourceRoleGold.copy(alpha = 0.10f) else SourceRoleRaised,
                            shape = RoundedCornerShape(15.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onSelect(role)
                                    open = false
                                },
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 13.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Box(
                                    Modifier
                                        .size(9.dp)
                                        .clip(CircleShape)
                                        .background(role.color()),
                                )
                                Spacer(Modifier.width(11.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(role.label(), color = if (selectedRow) SourceRoleGold else SourceRoleText, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                    Text(role.description(), color = SourceRoleMuted, fontSize = 10.sp)
                                }
                                Text((counts[role] ?: 0).toString(), color = SourceRoleMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun NewsroomSourceRole.shortLabel(): String = when (this) {
    NewsroomSourceRole.ALL -> "Source type"
    NewsroomSourceRole.PRODUCTION -> "Production"
    NewsroomSourceRole.OTT -> "OTT"
    NewsroomSourceRole.MUSIC -> "Music"
}

private fun NewsroomSourceRole.label(): String = when (this) {
    NewsroomSourceRole.ALL -> "All sources"
    NewsroomSourceRole.PRODUCTION -> "Production houses"
    NewsroomSourceRole.OTT -> "OTT platforms"
    NewsroomSourceRole.MUSIC -> "Music labels"
}

private fun NewsroomSourceRole.description(): String = when (this) {
    NewsroomSourceRole.ALL -> "Show every accepted YouTube source type"
    NewsroomSourceRole.PRODUCTION -> "Studios, banners and production houses"
    NewsroomSourceRole.OTT -> "Streaming platforms and language channels"
    NewsroomSourceRole.MUSIC -> "Official music labels and soundtrack channels"
}

private fun NewsroomSourceRole.color(): Color = when (this) {
    NewsroomSourceRole.ALL -> SourceRoleGold
    NewsroomSourceRole.PRODUCTION -> SourceRoleProduction
    NewsroomSourceRole.OTT -> SourceRoleOtt
    NewsroomSourceRole.MUSIC -> SourceRoleMusic
}
