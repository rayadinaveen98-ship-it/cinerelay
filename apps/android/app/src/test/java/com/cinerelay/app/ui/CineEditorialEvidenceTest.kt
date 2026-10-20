package com.cinerelay.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class CineEditorialEvidenceTest {
    @Test
    fun confirmedRequiresActualEventVerification() {
        assertEquals("Confirmed", cineEvidenceLabel("OFFICIAL", null))
        assertEquals("Confirmed", cineEvidenceLabel("CONFIRMED", null))
        assertEquals("Reported", cineEvidenceLabel("RELIABLE_REPORT", null))
        assertEquals("Developing", cineEvidenceLabel("DEVELOPING", null))
    }

    @Test
    fun missingEventVerificationIsNotAutomaticallyOfficial() {
        assertEquals("Developing", cineEvidenceLabel(null, null))
        assertEquals("Developing", cineEvidenceLabel(null, "PENDING"))
        assertEquals("Verified update", cineEvidenceLabel(null, "VERIFIED"))
    }

    @Test
    fun cinematicTypographyKeepsExactSharedHierarchy() {
        assertEquals(40, cineCompactDisplaySize(45))
        assertEquals(22, cineCompactDisplaySize(23))
        assertEquals(22, cineCompactDisplaySize(22))
        assertEquals(18, cineCompactDisplaySize(18))
        assertEquals(15, cineCompactDisplaySize(15))
        assertEquals(14, cineCompactDisplaySize(12))
    }
}
