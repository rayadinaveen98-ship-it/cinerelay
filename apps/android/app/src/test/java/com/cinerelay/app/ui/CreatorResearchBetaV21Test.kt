package com.cinerelay.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CreatorResearchBetaV21Test {
    private val leads = listOf(
        CreatorResearchLeadV21(
            id = "demo-1", name = "Telugu Sound School", handle = "@telugusound",
            locale = "te", category = "Education", provisionalTier = "NANO_LT10K",
            sourceUrl = "https://example.org/research",
        ),
        CreatorResearchLeadV21(
            id = "demo-2", name = "Kannada Camera Journal", handle = null,
            locale = "kn", category = "Filmmaking", provisionalTier = "MID_100K_1M",
            sourceUrl = "https://example.org/research",
        ),
        CreatorResearchLeadV21(
            id = "demo-3", name = "Malayalam Home Cinema", handle = "@samplefilm",
            locale = "ml", category = "Film", provisionalTier = "MICRO_10K_100K",
            sourceUrl = "https://example.org/research",
        ),
    )

    @Test fun languageFilterIsNotTeluguOnly() {
        assertEquals("demo-2", CreatorResearchV21.filter(leads, "", "kn", "all").single().id)
        assertEquals("demo-3", CreatorResearchV21.filter(leads, "", "ml", "all").single().id)
        assertEquals(3, CreatorResearchV21.filter(leads, "", "all", "all").size)
    }

    @Test fun queryMatchesNameHandleCategoryCaseInsensitively() {
        assertEquals("demo-1", CreatorResearchV21.filter(leads, "SOUND", "all", "all").single().id)
        assertEquals("demo-3", CreatorResearchV21.filter(leads, "@SAMPLEFILM", "all", "all").single().id)
        assertEquals("demo-2", CreatorResearchV21.filter(leads, "filmmaking", "all", "all").single().id)
    }

    @Test fun provisionalTierFilterNeverComputesRealSubscriberNumbers() {
        assertEquals("demo-2",
            CreatorResearchV21.filter(leads, "", "all", "MID_100K_1M").single().id)
        assertEquals(0, CreatorResearchV21.filter(leads, "", "te", "MID_100K_1M").size)
    }

    @Test fun unknownResearchHandlesStayUnknown() {
        assertNull(leads.single { it.id == "demo-2" }.handle)
    }

    @Test fun regionLabelsCoverDifferentIndianLanguages() {
        assertEquals("Telugu", CreatorResearchV21.localeLabel("te"))
        assertEquals("Kannada", CreatorResearchV21.localeLabel("kn"))
        assertEquals("Malayalam", CreatorResearchV21.localeLabel("ml"))
        assertEquals("Global / Multilingual", CreatorResearchV21.localeLabel("multi-global"))
    }
}
