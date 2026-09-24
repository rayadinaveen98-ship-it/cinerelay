package com.cinerelay.app.ui

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val LanePanel = Color(0xF215181E)
private val LaneGold = Color(0xFFE7C36B)
private val LaneMuted = Color(0xFFA7ADB7)
private val YouTubeRed = Color(0xFFFF3B30)

@Composable
fun NewsroomPlatformOverlay(
    selected: NewsroomPlatform,
    onSelect: (NewsroomPlatform) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }

    Surface(
        modifier = modifier,
        color = LanePanel,
        shape = RoundedCornerShape(18.dp),
        shadowElevation = 7.dp,
    ) {
        Row(
            modifier = Modifier.padding(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (expanded) {
                PlatformIconButton(
                    platform = NewsroomPlatform.YOUTUBE,
                    selected = selected == NewsroomPlatform.YOUTUBE,
                    onClick = {
                        onSelect(NewsroomPlatform.YOUTUBE)
                        expanded = false
                    },
                )
                PlatformIconButton(
                    platform = NewsroomPlatform.WEB,
                    selected = selected == NewsroomPlatform.WEB,
                    onClick = {
                        onSelect(NewsroomPlatform.WEB)
                        expanded = false
                    },
                )
                PlatformIconButton(
                    platform = NewsroomPlatform.X,
                    selected = selected == NewsroomPlatform.X,
                    onClick = {
                        onSelect(NewsroomPlatform.X)
                        expanded = false
                    },
                )
            } else {
                PlatformIconButton(
                    platform = selected,
                    selected = true,
                    onClick = { expanded = true },
                )
            }
        }
    }
}

@Composable
private fun PlatformIconButton(
    platform: NewsroomPlatform,
    selected: Boolean,
    onClick: () -> Unit,
) {
    IconButton(
        onClick = onClick,
        modifier = Modifier.size(43.dp),
    ) {
        when (platform) {
            NewsroomPlatform.YOUTUBE -> {
                Surface(
                    color = if (selected) YouTubeRed else YouTubeRed.copy(alpha = 0.72f),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.size(width = 28.dp, height = 20.dp),
                ) {
                    Icon(
                        Icons.Default.PlayArrow,
                        contentDescription = "YouTube",
                        tint = Color.White,
                        modifier = Modifier.padding(2.dp),
                    )
                }
            }
            NewsroomPlatform.WEB -> {
                Text(
                    "WEB",
                    color = if (selected) LaneGold else LaneMuted,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 0.5.sp,
                )
            }
            NewsroomPlatform.X -> {
                Text(
                    "X",
                    color = if (selected) LaneGold else LaneMuted,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                )
            }
        }
    }
}
