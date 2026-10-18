package com.cinerelay.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Screen-level editorial header shared by discovery, history and utility screens.
 * Actions are passed by the hosting screen to preserve their current behavior.
 */
@Composable
internal fun CineScreenHeader(
    title: String,
    subtitle: String? = null,
    eyebrow: String = "CINERELAY",
    onBack: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(
            start = if (onBack != null) 4.dp else CineEditorial.Gutter,
            end = CineEditorial.Gutter,
            top = 18.dp,
            bottom = 12.dp,
        ),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null) {
            IconButton(onClick = onBack, modifier = Modifier.size(CineEditorial.TargetSize)) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = CineEditorial.Text)
            }
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(eyebrow, color = CineEditorial.Accent, fontSize = CineEditorial.Metadata,
                fontWeight = FontWeight.Bold, letterSpacing = 1.sp,
                maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(title, color = CineEditorial.Text, fontSize = CineEditorial.PageTitle,
                fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (!subtitle.isNullOrBlank()) {
                Text(subtitle, color = CineEditorial.Muted, fontSize = CineEditorial.Metadata,
                    maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
        actions()
    }
}

/** Reusable section anatomy for rails, lists, and See All destinations. */
@Composable
internal fun CineSectionHeader(
    title: String,
    subtitle: String = "",
    count: Int? = null,
    onSeeAll: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, color = CineEditorial.Text, fontSize = CineEditorial.SectionTitle,
                fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (subtitle.isNotBlank()) {
                Text(subtitle, color = CineEditorial.Muted, fontSize = CineEditorial.Metadata,
                    maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
        if (onSeeAll != null) {
            TextButton(onClick = onSeeAll, enabled = count == null || count > 0,
                modifier = Modifier.sizeIn(minHeight = CineEditorial.TargetSize)) {
                val label = if (count == null) "See all" else "See all ($count)"
                Text(label, color = if (count == 0) CineEditorial.Muted else CineEditorial.Accent,
                    fontSize = CineEditorial.Metadata, fontWeight = FontWeight.SemiBold,
                    maxLines = 1)
                Icon(Icons.Default.ChevronRight, contentDescription = null,
                    tint = CineEditorial.Accent, modifier = Modifier.size(18.dp))
            }
        }
    }
}
