package com.cinerelay.app.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CineRelayStabilityS1SessionTest {
    @Test fun closingDetailBeforeResponseMakesOldResponseInvalid() {
        val detail = RequestEpochV25()
        val opened = detail.advance()
        assertTrue(detail.isCurrent(opened))
        detail.invalidate() // User taps Back during a slow detail request.
        assertFalse(detail.isCurrent(opened))
    }

    @Test fun latestDetailRequestWinsOverOlderRequest() {
        val detail = RequestEpochV25()
        val firstStory = detail.advance()
        val secondStory = detail.advance()
        assertFalse(detail.isCurrent(firstStory))
        assertTrue(detail.isCurrent(secondStory))
    }

    @Test fun accountSwitchInvalidatesOldPersonalizationAndArchive() {
        val requests = RequestEpochV25()
        val userA = requests.advance()
        requests.invalidate() // Logout / auth expiry.
        val userB = requests.advance() // Fresh account login.
        assertFalse(requests.isCurrent(userA))
        assertTrue(requests.isCurrent(userB))
    }

    @Test fun paginationAfterResetCannotRestoreOldArchivedItems() {
        val archive = RequestEpochV25()
        val oldPage = archive.advance()
        archive.invalidate() // Archive was reset on sign-out.
        assertFalse(archive.isCurrent(oldPage))
    }
}
