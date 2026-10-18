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
import androidx.compose.foundation.layout.width
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
 * Consistent V2 page layout for sources, search, settings, archive, story detail,
 * and nested See All pages. This deliberately changes hierarchy, not just colors.
 */
@Composable
internal fun CineScreenHeader(
    title: String,
    subtitle: String? = null,
    eyebrow: String = "CINERELAY / THE EDITORIAL EDITION",
    onBack: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Column(
        modifier.fillMaxWidth().padding(
            start = if (onBack != null) 6.dp else CineEditorial.Gutter,
            end = CineEditorial.Gutter,
            top = 16.dp, bottom = 16.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (onBack != null) {
                IconButton(onClick = onBack, modifier = Modifier.size(CineEditorial.TargetSize)) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back", tint = CineEditorial.Text)
                }
            }
            EditorialEyebrowV2(eyebrow,
                modifier = if (onBack != null) Modifier.weight(1f) else Modifier.weight(1f))
            actions()
        }
        EditorialDisplayV2(title, size = 29, lines = 2)
        if (!subtitle.isNullOrBlank()) {
            Text(subtitle, color = CineEditorial.Muted,
                fontSize = 13.sp, lineHeight = 19.sp,
                maxLines = 3, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
internal fun CineSectionHeader(
    title: String,
    subtitle: String = "",
    count: Int? = null,
    onSeeAll: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            EditorialDisplayV2(title, modifier = Modifier.weight(1f), size = 23, lines = 2)
            if (onSeeAll != null) {
                TextButton(onClick = onSeeAll,
                    enabled = count == null || count > 0,
                    modifier = Modifier.sizeIn(minHeight = CineEditorial.TargetSize)) {
                    Text(if (count == null) "See all" else "See all ($count)",
                        color = if (count == 0) CineEditorial.Muted else CineEditorial.Accent,
                        fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.width(4.dp))
                    Icon(Icons.Default.ChevronRight, contentDescription = null,
                        tint = CineEditorial.Accent, modifier = Modifier.size(16.dp))
                }
            }
        }
        if (subtitle.isNotBlank()) {
            Text(subtitle, color = CineEditorial.Muted,
                fontSize = 12.sp, lineHeight = 18.sp,
                maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}
