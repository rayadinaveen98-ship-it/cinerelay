package com.cinerelay.app.ui

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CineRelayV23VisualContractTest {
    private val now = Instant.parse("2026-10-19T10:00:00Z")

    @Test fun heroIsCappedAtTenDistinctRecentStories() {
        assertEquals(10, HOME23_HERO_CAP)
    }

    @Test fun heroRejectsStaleAndFutureDatedStories() {
        assertTrue(homeHeroRecentV23(now, now))
        assertTrue(homeHeroRecentV23(now.minusSeconds(10 * 60), now))
        assertTrue(homeHeroRecentV23(now.minusSeconds(23 * 3600), now))
        assertFalse(homeHeroRecentV23(now.minusSeconds(25 * 3600), now))
        assertFalse(homeHeroRecentV23(now.plusSeconds(10 * 60), now))
    }

    @Test fun movieHistoryFallbackHasAnExplicitDesignMood() {
        assertEquals(CineArtworkMoodV23.HISTORY, CineArtworkMoodV23.valueOf("HISTORY"))
        assertEquals(CineArtworkMoodV23.STREAMING, CineArtworkMoodV23.valueOf("STREAMING"))
    }
}
