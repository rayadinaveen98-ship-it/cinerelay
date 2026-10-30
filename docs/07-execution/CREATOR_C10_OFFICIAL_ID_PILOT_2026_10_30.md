# CineRelay C10 — Official YouTube Creator Pilot Identities
**30 October 2026 | Development only, not deployed**

## Real verification
- [GitHub C2 run #41033581343](https://github.com/rayadinaveen98-ship-it/cinerelay/actions/runs/41033581343) completed successfully after repository owner added the scoped YOUTUBE_API_KEY GitHub Actions secret.
- 20 of 20 official YouTube channels.list forHandle lookups succeeded. 20 API requests, no retries, no API errors.
- Each resolved record includes a stable UC channel ID, title, and correctly matching UU uploads playlist.
- No verified ID duplicates among the 20.
- Read-only SELECT of existing CineRelay YouTube source IDs at 2026-10-30T09:29:03.844Z showed 185 existing active IDs and zero matches to the new 20. This is a *point-in-time* audit and must be repeated at admission.
- Cohort: 14 Telugu, 3 Kannada, 3 Marathi; four nano, six micro, five mid and five large *provisional third-party* size tiers. These tiers are NOT official current subscriber counts.
- The three earlier first-party YouTube channel-page identity matches from C2 are included among the 20 official API identities.

## Source changes
- Added a nonsecret, dated 20-channel API identity snapshot for C10 under apps/web/src/data.
- Added /creators/pilot, a read-only, operator-authenticated Verified Pilot queue with search, segment filters, canonical YouTube channel links, research sources and explicit operator-review pending state.
- Updated the historical three-channel preliminary public-page view to acknowledge their later verified status without changing the historical source evidence.
- Added eight strict tests for identity shape, 20 unique IDs, uploads playlist, review-only state, research snapshot integrity and the three reconciled preliminary matches; wired into existing YouTube CI.

## No production mutation
- No YouTube public view/like/comment snapshots, extra provider API calls, Supabase writes, collector cron, Android APK, notifications, or consumer-facing feature releases.
- All 20 remain operatorApproved=false, monitoringEnabled=false, metricsEnabled=false.
- The production 185 existing cinema YouTube sources have not been changed.
- C6 cross-channel comparisons remain behind separate policy approval.

## Before any admission
1. Human reviewer confirms the correct channel identity, recent public upload activity, channel type, category, and suitable original-content sampling.
2. Refresh production UC-ID deduplication immediately before enrollment. Historical zero collisions do not provide continuous clearance.
3. Verify actual Google project GENERAL_READ and VIDEO_BATCH_STATS quota headroom and safe reserve for the existing CineRelay collector.
4. Confirm YouTube retention and analytics-derived-metrics policy permissions and obtain explicit operator approval.
5. Enable only separately approved channels after these checks. C10 itself has no activation control.

References:
- https://developers.google.com/youtube/data/reference/rest/v3/channels/list
- https://developers.google.com/youtube/terms/developer-policies-guide
- https://developers.google.com/youtube/terms/derived-metrics-policy
