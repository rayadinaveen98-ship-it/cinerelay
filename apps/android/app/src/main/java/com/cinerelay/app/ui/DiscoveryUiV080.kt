package com.cinerelay.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Compact discovery hierarchy shared by OTT, Radar, and Indian cinema history. */
internal object DiscoveryUiV080 {
    val Gold = CineEditorial.Accent
    val Text = CineEditorial.Text
    val Muted = CineEditorial.Muted
    val Panel = CineEditorial.Surface
    val Raised = CineEditorial.Raised
    val Gutter = CineEditorial.Gutter
    val CardWidth = 236.dp
    val CardRadius = CineEditorial.CardRadius
}
@Composable
internal fun DiscoverySectionHeadingV080(title: String, subtitle: String, count: Int, onSeeAll: () -> Unit) {
    CineSectionHeader(
        title = title,
        subtitle = subtitle,
        count = count,
        onSeeAll = onSeeAll,
        modifier = Modifier.padding(horizontal = DiscoveryUiV080.Gutter),
    )
}

@Composable
internal fun DiscoverySubpageHeaderV080(title: String, subtitle: String, onBack: () -> Unit) {
    CineScreenHeader(title = title, subtitle = subtitle, onBack = onBack)
}
