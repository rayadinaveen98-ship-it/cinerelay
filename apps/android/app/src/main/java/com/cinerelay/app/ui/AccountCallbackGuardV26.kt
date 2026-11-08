package com.cinerelay.app.ui

/**
 * Pure owner check for asynchronous callbacks that may finish after sign-out,
 * session expiry, or account switch.
 *
 * A matching tab does not establish account identity: both users can have
 * LIVE or RADAR selected. Callers must capture the authenticated account ID
 * before dispatch and re-check this predicate before applying any result.
 *
 * No token, email, password or other private data is needed.
 */
internal fun accountCallbackValidV26(
    expectedAccountId: String?,
    currentAccountId: String?,
    authenticated: Boolean,
): Boolean =
    authenticated &&
        !expectedAccountId.isNullOrBlank() &&
        expectedAccountId == currentAccountId
