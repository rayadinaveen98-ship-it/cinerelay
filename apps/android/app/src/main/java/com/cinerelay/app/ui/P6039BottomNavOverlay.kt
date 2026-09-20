package com.cinerelay.app.ui

import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val NavInk = Color(0xFF12151A)
private val NavGold = Color(0xFFE7C36B)
private val NavMuted = Color(0xFFA7ADB7)

@Composable
fun P6039BottomNavOverlay(
    selected: AppTab,
    onSelect: (AppTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    NavigationBar(
        modifier = modifier.fillMaxWidth(),
        containerColor = NavInk,
        tonalElevation = 0.dp,
    ) {
        NavItem(AppTab.LIVE, selected, Icons.Default.Home, "Home", onSelect)
        NavItem(AppTab.FOLLOWING, selected, Icons.Default.List, "Sources", onSelect)
        NavItem(AppTab.RADAR, selected, Icons.Default.Movie, "Radar", onSelect)
        NavItem(AppTab.ALERTS, selected, Icons.Default.Notifications, "Alerts", onSelect)
    }
}

@Composable
private fun RowScope.NavItem(
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
            selectedIconColor = NavGold,
            selectedTextColor = NavGold,
            indicatorColor = NavGold.copy(alpha = 0.13f),
            unselectedIconColor = NavMuted,
            unselectedTextColor = NavMuted,
        ),
    )
}
