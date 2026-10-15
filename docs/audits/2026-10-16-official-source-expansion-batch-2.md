# CineRelay official-source expansion — batch 2

**Date:** 2026-10-16 IST. **Scope:** Official film studios / movie channels and first-party studio news websites only. Supabase production project `dnqaejljfzwhsainpdxb`. No APK or schema changes.

## Production additions

| Identity | Platform | Verified identity | Parent source | Outcome |
|---|---|---|---|---|
| Dharma Productions — Official News | WEB / FIRST_PARTY_HTML | https://dharma-production.com/ | Existing Tier-A Dharma Productions | HTTP 200; 10 official news links parsed; baseline success, healthy |
| Yash Raj Films — News and Press Releases | WEB / FIRST_PARTY_HTML | https://www.yashrajfilms.com/news | Existing Tier-A YRF | HTTP 200; 20 news links parsed; baseline success, healthy |
| Anand Audio Entertainment | YOUTUBE / YOUTUBE_WEBSUB | `UCEbupNzwdHMh2oGQZbznROQ` | Existing Tier-A Anand Audio | Active, verified WebSub lease; fallback HTTP 200 and video baseline established |
| Tips Malayalam | YOUTUBE / YOUTUBE_WEBSUB | `UCFrwp1a2HW0EohxF5jrv75A` | Newly registered first-party regional Tips channel | Active, verified WebSub lease; fallback HTTP 200 and video baseline established |
| Tips Kannada | YOUTUBE / YOUTUBE_WEBSUB | `UCNMYmV_EJWUtonmzfWQhtqQ` | Newly registered first-party regional Tips channel | Active, verified WebSub lease; fallback HTTP 200 and video baseline established |

All registrations were protected by source identity uniqueness checks, official Tier-A origin checks or verified direct studio domain checks. `audit_actions` contains `OFFICIAL_SOURCE_BATCH_REGISTRATION` entries. Three linked YouTube discovery candidates are now `PROMOTED` and their officiality proposals resolved.

### Connection implementation

- Dharma website: bounded selectors `div.home-news-swiper div.swiper-slide` + `a[href^="/news-events/"]`; `titleSelector="div.video-name h4"`; `maxItems=15`, `minItems=5`; 6-hour polls.
- YRF website: bounded selectors `div.news_default_pin.listLatest` + `section a[href*="/news/detail/"]`; `titleSelector="section p.font-size-16"`; `maxItems=30`, `minItems=5`; 6-hour polls. Caveat: live newsroom HTML is ~4.42 MB, approaching the connector's 5 MB response cap. Monitor page size for future parser failures.
- Youtube: actual YouTube pages returned canonical `UC...` channel IDs and branded profile descriptions; these links were present in outbound links from the already verified parent Tier-A accounts. The subscription-maintenance worker activated all 3 WebSub leases; the fallback connector ingested initial upload-playlist baselines without retroactive notifications.
- Each new connector uses existing production ingestion / moderation / notification policy. No historical posts were replayed.

## Production post-deployment verification

- Active identities: **183 YouTube**, **7 WEB**, **38 RSS**, **228 total**, net **+5** in this batch.
- All **228/228** identities reported effective health `HEALTHY` on the verification query.
- Page-poll, YouTube fallback and YouTube maintenance scheduled cron jobs had **0 failures in the last hour**.
- YouTube general-read API recorded `3101` units in the current UTC accounting day at last check; reserve protection remains enabled.

## Checked but excluded

1. Tier-A ZEE5 Telugu's linked channel `UCbrfwFuwMVRtxUTtEYJUKKg` resolved to **Zee Keralam** (general television); do not present it as a separate ZEE5 official film-news channel.
2. Sun NXT's linked channel `UCHQUiwOBNCzEXInluX7zRtw` resolved to **Sun Gemini Comedy**, not film announcements.
3. Channels linked in Saregama descriptions with IDs `UCp8FNfUI7mpUFeZlgItfRMA`, `UCETdq2SP0JL7T7enTAk76XQ`, `UCCc28aTqV41ej9nP86Pz9uA` resolved to individual artists or auto-generated Topic channels, not company-owned movie news.
4. Mythri Movie Makers website showed predominantly older movie catalogue entries, not a validated fresh announcement feed. Hombale site showed outdated “releasing soon” content; these websites were not activated.
5. `www.maddockfilms.com` showed catalogue / MHCU static content rather than a proven recurring news feed; left unchanged.
6. Alternate YouTube handles and channel aliases that resolve to already tracked UC identifiers are not additional sources. No speculative identities registered.

## Remaining operational proof

New-source **connection and baseline ingestion** are verified, not yet **first-new-article delta** end-to-end. A later genuine new post from each of the five should demonstrate actual raw-item creation, canonicalization and notification eligibility, without notification flooding. Observe HTML drift and source page size, particularly the YRF 4.42 MB page. Do not mistake WebSub informational accelerator-miss status for a failed fallback connector.

No Android APK change needed. All changes are live source registrations and audited configuration, not app code.
