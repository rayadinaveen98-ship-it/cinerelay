package com.cinerelay.app.ui

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val SearchLauncherPanel = Color(0xF215181E)
private val SearchLauncherGold = Color(0xFFE7C36B)
private val SearchLauncherText = Color(0xFFF4F1EA)

@Composable
fun IntelligenceSearchLauncherV053(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        onClick = onClick,
        color = SearchLauncherPanel,
        contentColor = SearchLauncherText,
        shape = RoundedCornerShape(50),
        shadowElevation = 8.dp,
        modifier = modifier,
    ) {
        androidx.compose.foundation.layout.Row(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.Search, contentDescription = "Search CineRelay", tint = SearchLauncherGold, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(7.dp))
            Text("Search", fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}
