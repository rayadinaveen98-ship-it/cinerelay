package com.cinerelay.app.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WelcomeVersionGateV023Test {
    @Test
    fun freshInstallPlaysWelcome() {
        assertTrue(WelcomeVersionGateV023.shouldPlay(null, "0.2.3"))
    }

    @Test
    fun sameVersionSuppressesReplay() {
        assertFalse(WelcomeVersionGateV023.shouldPlay("0.2.3", "0.2.3"))
    }

    @Test
    fun versionChangeReplaysWelcome() {
        assertTrue(WelcomeVersionGateV023.shouldPlay("0.2.2", "0.2.3"))
    }
}