package com.cinerelay.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * CineRelay Cinematic V2.1: one Netflix-inspired, original design language for every Android route.
 *
 * Source: approved CineRelay Editorial Edition V2 concept, October 2026.
 * All screen headlines use a standard sans-serif type system, including Telugu fallback.
 * This is presentation-only; source verification, release dates and ranking
 * must always come from existing app state rather than presentation constants.
 */
internal object CineEditorial {
    val Background = Color(0xFF09090D)
    val Surface = Color(0xFF17171D)
    val Raised = Color(0xFF25252D)
    val Outline = Color(0xFF393942)
    val Text = Color(0xFFF8F8FA)
    val Muted = Color(0xFFB4B4C0)
    val Accent = Color(0xFFFF5865)
    val Confirmed = Color(0xFF91DBBB)
    val Developing = Color(0xFFFFCB8A)
    val Error = Color(0xFFFF8E95)
    val Info = Color(0xFFA9C8F3)

    val Gutter = 16.dp
    val SectionGap = 24.dp
    val RailGap = 12.dp
    val ScreenBottom = 120.dp
    val CompactPosterWidth = 136.dp
    val PosterRatio = 2f / 3f
    val ArtworkRatio = 16f / 9f
    val CardRadius = 12.dp
    val HeroRadius = 16.dp
    val TargetSize = 48.dp

    val PageTitle = 22.sp
    val SectionTitle = 18.sp
    val CardTitle = 15.sp
    val Body = 14.sp
    val Metadata = 12.sp
}

/** Event confirmation is independent from the officiality of a source identity. */
internal fun cineEvidenceLabel(verification: String?, itemState: String?): String = when {
    verification == "OFFICIAL" || verification == "CONFIRMED" -> "Confirmed"
    verification == "RELIABLE_REPORT" -> "Reported"
    verification == "DEVELOPING" -> "Developing"
    itemState == "VERIFIED" -> "Verified update"
    else -> "Developing"
}

internal fun cineEvidenceColor(label: String): Color =
    if (label == "Confirmed" || label == "Verified update") CineEditorial.Confirmed else CineEditorial.Developing
