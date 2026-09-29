package com.cinerelay.app.ui

import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.PlayArrow
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
    ottSelected: Boolean,
    historySelected: Boolean,
    onSelect: (AppTab) -> Unit,
    onOpenOtt: () -> Unit,
    onOpenHistory: () -> Unit,
    onOpenControlRoom: () -> Unit,
    modifier: Modifier = Modifier,
) {
    NavigationBar(
        modifier = modifier.fillMaxWidth(),
        containerColor = NavInk,
        tonalElevation = 0.dp,
    ) {
        NavItem(AppTab.LIVE, !ottSelected && !historySelected && selected == AppTab.LIVE, Icons.Default.Home, "Home", onSelect)
        OttNavItem(ottSelected, onOpenOtt)
        NavItem(AppTab.RADAR, !ottSelected && !historySelected && selected == AppTab.RADAR, Icons.Default.Movie, "Radar", onSelect)
        HistoryNavItem(historySelected, onOpenHistory)
        ControlNavItem(onOpenControlRoom)
    }
}

@Composable
private fun RowScope.NavItem(
    tab: AppTab,
    selected: Boolean,
    icon: ImageVector,
    label: String,
    onSelect: (AppTab) -> Unit,
) {
    NavigationBarItem(
        selected = selected,
        onClick = { onSelect(tab) },
        icon = { Icon(icon, contentDescription = label, modifier = Modifier.size(22.dp)) },
        label = { Text(label, maxLines = 1, fontSize = 10.sp) },
        colors = navigationItemColors(),
    )
}

@Composable
private fun RowScope.OttNavItem(selected: Boolean, onOpenOtt: () -> Unit) {
    NavigationBarItem(
        selected = selected,
        onClick = onOpenOtt,
        icon = { Icon(Icons.Default.PlayArrow, contentDescription = "OTT releases", modifier = Modifier.size(22.dp)) },
        label = { Text("OTT", maxLines = 1, fontSize = 10.sp) },
        colors = navigationItemColors(),
    )
}

@Composable
private fun RowScope.HistoryNavItem(selected: Boolean, onOpenHistory: () -> Unit) {
    NavigationBarItem(
        selected = selected,
        onClick = onOpenHistory,
        icon = { Icon(Icons.Default.CalendarMonth, contentDescription = "On This Day", modifier = Modifier.size(22.dp)) },
        label = { Text("Today", maxLines = 1, fontSize = 10.sp) },
        colors = navigationItemColors(),
    )
}

@Composable
private fun RowScope.ControlNavItem(onOpenControlRoom: () -> Unit) {
    NavigationBarItem(
        selected = false,
        onClick = onOpenControlRoom,
        icon = {
            Icon(
                Icons.Default.AccountCircle,
                contentDescription = "Open settings",
                modifier = Modifier.size(22.dp),
            )
        },
        label = { Text("You", maxLines = 1, fontSize = 10.sp) },
        colors = navigationItemColors(),
    )
}

@Composable
private fun navigationItemColors() = NavigationBarItemDefaults.colors(
    selectedIconColor = NavGold,
    selectedTextColor = NavGold,
    indicatorColor = NavGold.copy(alpha = 0.13f),
    unselectedIconColor = NavMuted,
    unselectedTextColor = NavMuted,
)
