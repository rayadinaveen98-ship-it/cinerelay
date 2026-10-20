# CineRelay V2.4 — Startup, YouTube hero, fresh-start audit

Stacked on V2.3 PR #85. Radar, Today and OTT visual interfaces unchanged.

## Home startup
- Restore account-scoped HomeCache (disk read on IO) before network refresh, not only write it.
- Returning users: cache previously server-confirmed personalization and notification setup and revalidate asynchronously. New account never bypasses first onboarding.
- Fetch YouTube and Web concurrently but publish the YouTube result first; Web is not a blocking dependency of initial Home presentation. Record sanitized `CineRelayHomePerf` timing logs: cache_read_ms, youtube_first_ms, both_feeds_ms.
- Preserve source-honest YouTube hero: up to ten distinct uploads within recent 24h, original fallback artwork, title only. Web remains available to other Home discovery rails.
- Keep original background feed architecture / auth gates; do not mark the database inherently slow without request timing evidence.

## Fresh install
- V2.4 one-time local reset clears session token/installation ID, old HomeCache, completed personalization and notification setup caches, and welcome version preference.
- Fresh account still registers through standard Auth and completes personalization/notification onboarding.
- Wiping device preferences alone does NOT delete Supabase Auth users or old database rows; server reset must be separately verified.
- Preserve shared source catalogue, ingestion history, OTT, radar, operator access, and all nonuser system data.

## Acceptance
1. Canary Android build and six CI checks green; signed APK artifact verified.
2. Samsung A54: cold/warm launch and first Home image with network, weak network, and offline cache; verify no stale other-account content.
3. Verify YouTube-only hero with mixed Web/YT feed; up to ten recent distinct items and no old/future items; Web discovery rail still present.
4. First install shows complete first-run onboarding. Returning account startup uses cached completed preferences then revalidates; settings changes are reflected after refresh.
5. Fresh-start server data audit, protected operator identity, and verified removal of end-user auth/personalization/notifications without touching shared cinema tables.
6. Check push registrations, duplicate requests, Home scroll/back smoothness, and reset state restoration.
