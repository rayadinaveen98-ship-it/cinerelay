package com.cinerelay.app.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Synthetic account IDs only; no Supabase accounts, network calls or secrets.
 * Tests the same callback predicate used by Home/Newsroom/Follow/Push results.
 */
class AccountCallbackGuardV26Test {
    @Test fun callbackForCurrentAuthenticatedAccountIsAllowed() {
        assertTrue(accountCallbackValidV26("test-account-a", "test-account-a", true))
    }

    @Test fun oldAccountRefreshCannotUpdateNewAccountOnSameTab() {
        // Both users can have LIVE selected; tab equality is not a user boundary.
        assertFalse(accountCallbackValidV26("test-account-a", "test-account-b", true))
    }

    @Test fun lateFollowResultCannotChangeOtherUsersCount() {
        assertFalse(accountCallbackValidV26("test-account-a", "test-account-b", true))
    }

    @Test fun latePushRegistrationCannotOverwriteNewAccountStatus() {
        assertFalse(accountCallbackValidV26("test-account-a", "test-account-b", true))
    }

    @Test fun callbackAfterSignOutIsBlocked() {
        assertFalse(accountCallbackValidV26("test-account-a", null, false))
    }

    @Test fun oldCallbackCannotBeAppliedAfterLogoutAndReloginAsAnotherUser() {
        assertFalse(accountCallbackValidV26("test-account-a", null, false))
        assertFalse(accountCallbackValidV26("test-account-a", "test-account-b", true))
        assertTrue(accountCallbackValidV26("test-account-b", "test-account-b", true))
    }

    @Test fun emptySessionIdentityCannotAuthorizeAnyResult() {
        assertFalse(accountCallbackValidV26(null, "test-account-a", true))
        assertFalse(accountCallbackValidV26("", "test-account-a", true))
        assertFalse(accountCallbackValidV26("   ", "test-account-a", true))
    }

    @Test fun loggedOutStateCannotApplyEvenWithMatchingStoredId() {
        assertFalse(accountCallbackValidV26("test-account-a", "test-account-a", false))
    }

    @Test fun accountIdsAreExactNotPrefixOrCaseInsensitive() {
        assertFalse(accountCallbackValidV26("test-account-a", "test-account-a-1", true))
        assertFalse(accountCallbackValidV26("test-account-a", "TEST-ACCOUNT-A", true))
    }
}
