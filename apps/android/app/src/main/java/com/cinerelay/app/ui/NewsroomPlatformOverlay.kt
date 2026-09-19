package com.cinerelay.app.ui

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val LanePanel = Color(0xF215181E)
private val LaneSelected = Color(0xFFE7C36B)
private val LaneSelectedText = Color(0xFF261D08)
private val LaneMuted = Color(0xFFA7ADB7)

@Composable
fun NewsroomPlatformOverlay(
    selected: NewsroomPlatform,
    onSelect: (NewsroomPlatform) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        color = LanePanel,
        shape = RoundedCornerShape(18.dp),
        shadowElevation = 6.dp,
    ) {
        Row(Modifier.padding(5.dp)) {
            LaneButton(
                label = "YouTube",
                selected = selected == NewsroomPlatform.YOUTUBE,
                onClick = { onSelect(NewsroomPlatform.YOUTUBE) },
                minWidth = 82.dp,
            )
            Spacer(Modifier.width(4.dp))
            LaneButton(
                label = "X",
                selected = selected == NewsroomPlatform.X,
                onClick = { onSelect(NewsroomPlatform.X) },
                minWidth = 58.dp,
            )
        }
    }
}

@Composable
private fun LaneButton(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    minWidth: Dp,
) {
    Surface(
        color = if (selected) LaneSelected else Color.Transparent,
        contentColor = if (selected) LaneSelectedText else LaneMuted,
        shape = RoundedCornerShape(13.dp),
    ) {
        TextButton(
            onClick = onClick,
            modifier = Modifier.width(minWidth),
        ) {
            Text(
                text = label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = if (selected) LaneSelectedText else LaneMuted,
            )
        }
    }
}
