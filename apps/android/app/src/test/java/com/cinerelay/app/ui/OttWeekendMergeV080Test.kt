package com.cinerelay.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class OttWeekendMergeV080Test {
    private data class SampleRelease(val id: String, val date: String?)

    @Test
    fun weekendWindowKeepsFridayAfterFridayHasPassed() {
        assertEquals(
            LocalDate.parse("2026-10-16") to LocalDate.parse("2026-10-18"),
            weekendRangeV060("2026-10-16"),
        )
        assertEquals(
            LocalDate.parse("2026-10-16") to LocalDate.parse("2026-10-18"),
            weekendRangeV060("2026-10-17"),
        )
        assertEquals(
            LocalDate.parse("2026-10-16") to LocalDate.parse("2026-10-18"),
            weekendRangeV060("2026-10-18"),
        )
    }

    @Test
    fun weekdayWindowTargetsNextFridayThroughSunday() {
        assertEquals(
            LocalDate.parse("2026-10-23") to LocalDate.parse("2026-10-25"),
            weekendRangeV060("2026-10-19"),
        )
        assertEquals(null, weekendRangeV060(null))
    }

    @Test
    fun weekendMergeKeepsEarlierPremieresDeduplicatedAcrossApiWindows() {
        val weekend = weekendRangeV060("2026-10-18")
        val actual = mergeOttWeekendReleasesV080(
            today = listOf(SampleRelease("sunday", "2026-10-18")),
            upcoming = listOf(
                SampleRelease("saturday", "2026-10-17"),
                SampleRelease("sunday", "2026-10-18"),
                SampleRelease("next-week", "2026-10-23"),
            ),
            released = listOf(
                SampleRelease("friday", "2026-10-16"),
                SampleRelease("saturday", "2026-10-17"),
                SampleRelease("unknown", null),
                SampleRelease("invalid", "not-a-date"),
            ),
            weekend = weekend,
            releaseId = { it.id },
            releaseDate = { it.date },
        )

        assertEquals(listOf("sunday", "saturday", "friday"), actual.map { it.id })
    }

    @Test
    fun missingWeekendNeverInventsReleases() {
        val entries = mergeOttWeekendReleasesV080(
            today = listOf(SampleRelease("known", "2026-10-18")),
            upcoming = emptyList(),
            released = emptyList(),
            weekend = null,
            releaseId = { it.id },
            releaseDate = { it.date },
        )
        assertTrue(entries.isEmpty())
    }
}
