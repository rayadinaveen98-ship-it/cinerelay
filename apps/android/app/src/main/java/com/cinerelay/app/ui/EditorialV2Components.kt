package com.cinerelay.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage

/**
 * Editorial Edition V2 native visual vocabulary.
 * Design source: docs/03-product/ANDROID_EDITORIAL_EDITION_V2_DESIGN.md.
 * Typography uses Android's serif font for Latin headlines and OS fallback for Telugu.
 * Never infer media, verification state, source identity or dates from design content.
 */
@Composable
internal fun EditorialDisplayV2(
    text: String,
    modifier: Modifier = Modifier,
    size: Int = 32,
    lines: Int = 3,
) {
    Text(
        text = text,
        modifier = modifier,
        color = CineEditorial.Text,
        fontFamily = FontFamily.Serif,
        fontSize = size.sp,
        lineHeight = (size * 1.18f).sp,
        fontWeight = FontWeight.Normal,
        maxLines = lines,
        overflow = TextOverflow.Ellipsis,
    )
}

@Composable
internal fun EditorialEyebrowV2(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text.uppercase(),
        modifier = modifier,
        color = CineEditorial.Accent,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.3.sp,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
    )
}

/** The large two-level masthead is a deliberate composition change from legacy TopAppBar. */
@Composable
internal fun EditorialMastheadV2(
    section: String,
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Column(modifier.fillMaxWidth().padding(top = 18.dp, bottom = 4.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(color = CineEditorial.Accent, shape = RoundedCornerShape(8.dp), modifier = Modifier.size(31.dp)) {
                Box(contentAlignment = Alignment.Center) {
                    Text("C", color = CineEditorial.Background, fontSize = 19.sp, fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.width(9.dp))
            Text("CINERELAY", color = CineEditorial.Text, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.3.sp, modifier = Modifier.weight(1f))
            actions()
        }
        Spacer(Modifier.height(4.dp))
        EditorialEyebrowV2(section)
        EditorialDisplayV2(title, size = 34)
        Text(subtitle, color = CineEditorial.Muted, fontSize = 13.sp, lineHeight = 19.sp)
    }
}

/** Official artwork is drawn only when source data supplies a real URL. */
@Composable
internal fun EditorialArtworkV2(
    url: String?,
    title: String,
    modifier: Modifier = Modifier,
    label: String? = null,
) {
    Box(
        modifier = modifier.clip(RoundedCornerShape(16.dp)).background(
            Brush.linearGradient(
                listOf(
                    CineEditorial.Raised,
                    CineEditorial.Surface,
                    CineEditorial.Background,
                ),
            ),
        ),
        contentAlignment = Alignment.Center,
    ) {
        if (!url.isNullOrBlank()) {
            AsyncImage(model = url, contentDescription = title, contentScale = ContentScale.Crop,
                modifier = Modifier.matchParentSize())
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.padding(10.dp)) {
                Icon(Icons.Default.Movie, contentDescription = null, tint = CineEditorial.Accent.copy(alpha = 0.78f), modifier = Modifier.size(26.dp))
                Text(title, color = CineEditorial.Text, fontFamily = FontFamily.Serif,
                    fontSize = 17.sp, lineHeight = 20.sp, maxLines = 3,
                    overflow = TextOverflow.Ellipsis)
                Text("ARTWORK UNAVAILABLE", color = CineEditorial.Muted, fontSize = 9.sp, letterSpacing = 0.8.sp)
            }
        }
        if (!label.isNullOrBlank()) {
            Surface(
                color = CineEditorial.Background.copy(alpha = 0.90f),
                shape = RoundedCornerShape(7.dp),
                modifier = Modifier.align(Alignment.TopStart).padding(9.dp),
            ) {
                Text(label, color = CineEditorial.Accent, fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp))
            }
        }
    }
}

/** A content-first, non-decorative editorial section header shared across destinations. */
@Composable
internal fun EditorialSectionV2(
    label: String,
    title: String,
    modifier: Modifier = Modifier,
    trailing: @Composable RowScope.() -> Unit = {},
) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        EditorialEyebrowV2(label)
        Row(verticalAlignment = Alignment.CenterVertically) {
            EditorialDisplayV2(title, modifier = Modifier.weight(1f), size = 23, lines = 2)
            trailing()
        }
    }
}

/** Low-density contextual summary, used in place of large generic statistics panels. */
@Composable
internal fun EditorialBriefV2(
    kicker: String,
    title: String,
    description: String,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = CineEditorial.Raised,
        shape = RoundedCornerShape(17.dp),
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            EditorialEyebrowV2(kicker)
            EditorialDisplayV2(title, size = 21, lines = 2)
            Text(description, color = CineEditorial.Muted, fontSize = 12.sp, lineHeight = 18.sp)
        }
    }
}
