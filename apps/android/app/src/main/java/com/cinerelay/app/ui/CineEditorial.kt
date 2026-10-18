package com.cinerelay.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Shared, design-reviewed visual primitives for the CineRelay Android editorial UI.
 *
 * Source: CineRelay Home/OTT Figma-led design proposals, October 2026.
 * This is presentation-only; source verification, release dates and ranking
 * must always come from existing app state rather than presentation constants.
 */
internal object CineEditorial {
    val Background = Color(0xFF0D1015)
    val Surface = Color(0xFF181C23)
    val Raised = Color(0xFF232933)
    val Outline = Color(0xFF333C49)
    val Text = Color(0xFFF5F3EF)
    val Muted = Color(0xFFAEB6C1)
    val Accent = Color(0xFFE3BC70)
    val Confirmed = Color(0xFF79CFAD)
    val Developing = Color(0xFFF2B970)
    val Error = Color(0xFFEB847C)
    val Info = Color(0xFF91BAED)

    val Gutter = 16.dp
    val SectionGap = 24.dp
    val CardRadius = 18.dp
    val HeroRadius = 20.dp
    val TargetSize = 48.dp

    val PageTitle = 26.sp
    val SectionTitle = 20.sp
    val CardTitle = 16.sp
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
