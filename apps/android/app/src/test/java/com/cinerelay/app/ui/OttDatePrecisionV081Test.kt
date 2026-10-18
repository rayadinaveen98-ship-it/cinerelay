package com.cinerelay.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class OttDatePrecisionV081Test {
    @Test
    fun dayPrecisionMayShowTheExactDate() {
        assertEquals("18 Oct 2026", ottDisplayDateV081("2026-10-18", "DAY", "UPCOMING"))
        assertEquals("18" to "OCT", ottDateTilePartsV081("2026-10-18", "DAY", "UPCOMING"))
    }

    @Test
    fun monthAndYearPrecisionNeverInventTheDay() {
        assertEquals("Oct 2026 · day TBA", ottDisplayDateV081("2026-10-01", "MONTH", "UPCOMING"))
        assertEquals("OCT" to "2026", ottDateTilePartsV081("2026-10-01", "MONTH", "UPCOMING"))
        assertEquals("2026 · month TBA", ottDisplayDateV081("2026-01-01", "YEAR", "UPCOMING"))
        assertEquals("2026" to "YEAR ONLY", ottDateTilePartsV081("2026-01-01", "YEAR", "UPCOMING"))
    }

    @Test
    fun unknownPrecisionOrBadDateIsNotPromotedToExactReleaseDay() {
        assertEquals("Date to be announced", ottDisplayDateV081("2026-10-18", "TBA", "UPCOMING"))
        assertEquals("Date to be announced", ottDisplayDateV081("not-a-date", "DAY", "UPCOMING"))
        assertEquals("Available now · date unknown", ottDisplayDateV081(null, "TBA", "RELEASED"))
        assertEquals("NOW" to "DATE UNKNOWN", ottDateTilePartsV081(null, "TBA", "RELEASED"))
    }
}
