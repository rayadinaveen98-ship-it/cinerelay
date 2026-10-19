package com.cinerelay.app.ui

import org.junit.Assert.assertTrue
import org.junit.Test

class CineRelayHomeV22LayoutTest {
    @Test fun importantDiscoveryShelvesFollowLatestUpdates() {
        assertTrue(homeRailPriorityV22("Evolving Stories") < homeRailPriorityV22("Just In"))
        assertTrue(homeRailPriorityV22("Just In") < homeRailPriorityV22("Indian Cinema"))
        assertTrue(homeRailPriorityV22("Indian Cinema") < homeRailPriorityV22("English & International"))
        assertTrue(homeRailPriorityV22("English & International") < homeRailPriorityV22("Trailers & Teasers"))
    }

    @Test fun followedSourceShelvesAreNotPrioritizedOverTheMainDiscoveries() {
        assertTrue(homeRailPriorityV22("From Your Favorites") < homeRailPriorityV22("Latest from Test Source"))
        assertTrue(homeRailPriorityV22("From the Web") < homeRailPriorityV22("Latest from Test Source"))
    }
}
