package com.cinerelay.app.ui

import com.cinerelay.app.data.PersonalizationState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

class CineRelayV25HomeFastReturnTest {
    private fun setup() = PersonalizationState(
        completed = true,
        onboardingVersion = 1,
        requiredVersion = 1,
        favoriteSourceIdentityIds = emptySet(),
        favoriteLanguages = emptySet(),
        availableLanguages = emptyList(),
        availableSources = emptyList(),
    )

    @Test fun slideshowAdvancesEveryFiveSeconds() {
        assertEquals(5000L, HOME25_HERO_INTERVAL_MS)
        assertEquals(10, HOME23_HERO_CAP)
    }

    @Test fun cacheReusesProjectionButNeverAcrossAccounts() {
        val cache = HomeProjectionCacheV25()
        val settings = setup()
        val snapshot = HomeDisplayProjectionV1(
            favoriteSources = emptyList(),
            heroStories = emptyList(),
            latest = emptyList(),
            rails = emptyList(),
        )
        cache.store("accountA", emptyList(), settings, snapshot)
        assertSame(snapshot, cache.read("accountA", emptyList(), settings))
        assertNull(cache.read("accountB", emptyList(), settings))
    }

    @Test fun changingPersonalizationInvalidatesOldProjection() {
        val cache = HomeProjectionCacheV25()
        val oldSetup = setup()
        val projection = HomeDisplayProjectionV1(emptyList(), emptyList(), emptyList(), emptyList())
        cache.store("accountA", emptyList(), oldSetup, projection)
        assertNull(cache.read("accountA", emptyList(),
            oldSetup.copy(favoriteLanguages = setOf("te"))))
    }
}
