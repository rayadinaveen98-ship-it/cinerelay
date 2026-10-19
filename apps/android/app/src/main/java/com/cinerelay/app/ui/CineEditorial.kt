package com.cinerelay.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Shared, design-reviewed visual primitives for the CineRelay Android editorial UI.
 *
 * Source: approved CineRelay Editorial Edition V2 concept, October 2026.
 * All screen headlines use a standard sans-serif type system, including Telugu fallback.
 * This is presentation-only; source verification, release dates and ranking
 * must always come from existing app state rather than presentation constants.
 */
internal object CineEditorial {
    val Background = Color(0xFF10141F)
    val Surface = Color(0xFF19212D)
    val Raised = Color(0xFF222C39)
    val Outline = Color(0xFF354352)
    val Text = Color(0xFFF6F2E9)
    val Muted = Color(0xFFA1ADBA)
    val Accent = Color(0xFFE7C29B)
    val Confirmed = Color(0xFF9ADAC9)
    val Developing = Color(0xFFEEC596)
    val Error = Color(0xFFEC9E99)
    val Info = Color(0xFFA9BED5)

    val Gutter = 16.dp
    val SectionGap = 24.dp
    val CardRadius = 12.dp
    val HeroRadius = 14.dp
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
