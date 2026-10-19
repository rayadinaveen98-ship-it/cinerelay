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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
/** Professional cinematic type roles shared across the entire app.
 * The 40sp exception is only used for numeric dates in Today.
 */
internal fun cineCompactDisplaySize(size: Int): Int = when {
    size >= 40 -> 40 // date numerals only
    size >= 22 -> 22 // all page titles
    size >= 18 -> 18 // section titles
    size >= 15 -> 15 // card titles
    else -> 14
}

@Composable
internal fun EditorialDisplayV2(
    text: String,
    modifier: Modifier = Modifier,
    size: Int = 22,
    lines: Int = 2,
) {
    val font = cineCompactDisplaySize(size)
    Text(
        text = text,
        modifier = modifier,
        color = CineEditorial.Text,
        fontFamily = FontFamily.SansSerif,
        fontSize = font.sp,
        lineHeight = (font * 1.35f).sp,
        fontWeight = FontWeight.SemiBold,
        maxLines = lines,
        overflow = TextOverflow.Ellipsis,
    )
}

@Composable
internal fun EditorialEyebrowV2(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        modifier = modifier,
        color = CineEditorial.Muted,
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}

/** One consistent compact masthead on OTT, Radar and other destinations. */
@Composable
internal fun EditorialMastheadV2(
    section: String,
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Column(
        modifier.fillMaxWidth().padding(top = 12.dp, bottom = 4.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            EditorialDisplayV2(title, modifier = Modifier.weight(1f), size = 22)
            actions()
        }
        if (subtitle.isNotBlank()) {
            Text(
                subtitle,
                color = CineEditorial.Muted,
                fontSize = 12.sp,
                maxLines = 2,
                lineHeight = 17.sp,
                overflow = TextOverflow.Ellipsis,
            )
        }
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
    var imageFailed by remember(url) { mutableStateOf(false) }
    Box(
        modifier = modifier.clip(RoundedCornerShape(CineEditorial.CardRadius)).background(
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
        if (!url.isNullOrBlank() && !imageFailed) {
            AsyncImage(model = url, contentDescription = title, contentScale = ContentScale.Crop,
                onError = { imageFailed = true },
                modifier = Modifier.matchParentSize())
        } else {
            // No repeated headline inside an empty image frame.
            Icon(
                Icons.Default.Movie,
                contentDescription = null,
                tint = CineEditorial.Muted.copy(alpha = 0.65f),
                modifier = Modifier.size(24.dp),
            )
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

/**
 * A cinematic typographic title cover when the upstream catalogue supplies no
 * licensed/sourced artwork. Never presented as an official film poster.
 * Both OTT and title search use the same visual proportions and type hierarchy.
 */
@Composable
internal fun CineTitleCoverV21(
    title: String,
    eyebrow: String,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier.clip(RoundedCornerShape(CineEditorial.CardRadius))
            .background(Brush.linearGradient(
                listOf(CineEditorial.Raised, CineEditorial.Surface, CineEditorial.Background),
            )),
    ) {
        if (eyebrow.isNotBlank()) {
            Text(
                eyebrow,
                color = CineEditorial.Accent,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.align(Alignment.TopStart).padding(12.dp),
            )
        }
        Text(
            title,
            color = CineEditorial.Text,
            fontSize = 17.sp,
            lineHeight = 23.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 4,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.align(Alignment.BottomStart).padding(12.dp),
        )
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
    Row(
        modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        EditorialDisplayV2(
            title,
            modifier = Modifier.weight(1f),
            size = 18,
            lines = 2,
        )
        trailing()
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
        color = CineEditorial.Surface,
        shape = RoundedCornerShape(CineEditorial.CardRadius),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            EditorialEyebrowV2(kicker)
            EditorialDisplayV2(title, size = 18, lines = 2)
            Text(description, color = CineEditorial.Muted, fontSize = 12.sp, lineHeight = 17.sp,
                maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}
