# CineRelay — v0.2.7 Production Reliability and Android Code Audit

Audit window: 2026-10-15 IST. Production Supabase `dnqaejljfzwhsainpdxb`.
Scope: production database (read-only checks other than targeted ZEE5 refresh and maintenance run), scheduled job history, deployed Edge functions, GitHub Android source and CI. **No emulator/device UI session was run.** User independently confirmed real Android notifications open the intended content.

## Summary
| Area | Finding | Status |
|---|---|---|
| Push: source notifications | Starvation fixed, stale backlog suppressed with original rows preserved; real device delivery/open verified by user | CLOSED |
| Source ingestion | 219 active identities, 19,581 total raw items and 1,417 ingested in previous 24 h; no recent failed scheduled cron jobs | HEALTHY |
| Canonical news | 174 canonical events: 157 active official, 11 active reliable reports, 2 developing; others suppressed/retracted | ACTIVE; strict review policy |
| OTT | 95 release records. ZEE5 Agadha + Pooja Meri Jaan worker v2 returned 200; both `NO_EXPLICIT_PREMIERE_DATE`, 0 errors, healthy | VERIFIED; no speculative dates |
| YouTube effective source health | 178/178 effectively healthy despite 140 stored `DEGRADED` for WebSub accelerator misses. RSS 38/38 healthy. | HEALTHY |
| Schedule warnings | 15 false positives from legacy `source_health.next_due_at`; fresh fallback schedules have 0 overdue checks among these 15 | FIX IN PR #46 |
| WebSub accelerator warnings | 140 INFO findings; fallback fetches working. Do not label as 140 source outages. | INFORMATIONAL |
| Poll class suggestions | 15 INFO findings; advisory rather than auto-mutate trusted polling | REVIEW AS NEEDED |
| Source discovery | 311 pending candidates; do not auto-promote unverified identities | REVIEW BACKLOG |
| Workers | 38 Edge functions active; last-hour cron failure count 0; 35,532 queued process jobs in SUCCEEDED state | HEALTHY |
| Operator overview | Dashboard formerly counted raw WebSub DEGRADED statuses. Updated to effective state with service-only source data | FIX IN PR #46 |

## Android code path review
| Feature | Code paths | Evidence | Remaining validation |
|---|---|---|---|
| App launch, navigation, first-run flow | `MainActivity.kt`, `CineRelayWelcomeV058.kt`, `FirstRunAuthV050.kt` | Route wiring inspected; Android CI | Cold start and reinstall |
| Home / newsroom | `CineRelayHomeV058.kt`, `CineRelayViewModel.kt`, `BackendClient.kt` | Live ingestion verified; app code path reviewed | Offline / empty state / pagination UI |
| Notifications | `CineRelayMessagingService.kt`, `PushManager.kt`, `NotificationDetailV055.kt` | Live sends + user's notification tap-through | Different device / expired tokens |
| Universal search | `UniversalSearchV056.kt` / ViewModel | Code present; CI checks | Manual search results |
| OTT calendars | `OttReleasesV054.kt` / ViewModel | 95 OTT records, ZEE5 worker verified | Date filtering UI and country/language |
| Sources / personalization | `SourcesDirectoryV039.kt`, `PersonalizationOnboardingV055.kt` | 219 active source identities | Follow/unfollow and saved state |
| Radar | `RadarV058.kt` and creator radar scheduled worker | Cron successful | Render scores & card links |
| Archive, On This Day | `ArchiveV058.kt`, `OnThisDayV057.kt` | Route code and data-client presence | Date and archive UI |
| Settings / Auth | `SettingsV055.kt`, session store, backend auth | Code reviewed | Password/session-expiry scenarios |

## What PR #46 changes
- Source health and maintenance findings use authoritative YouTube fallback schedules instead of obsolete legacy due timestamps.
- Operator overview counts **effective** health rather than displaying healthy fallbacks as failed sources.
- Adds pgTAP fixtures for healthy YouTube fallback versus genuinely inconsistent fallback schedule; no notification, OTT, or Android behavior changes.

## Release gates
1. GitHub CI pgTAP / db lint and Edge type-check success; review source-health SQL changes.
2. Apply migration to production and align its filename with recorded Supabase migration version before merging.
3. Refresh maintenance ledger and verify `SCHEDULE_DRIFT` drops from 15 to 0 while `WEBSUB_ACCELERATOR_MISS` stays informational.
4. Deploy only `cinerelay-console-api` with its local dependencies; no Android APK release needed.
5. Run phone UI smoke test for non-push flows before claiming all screens fully verified.

Do not reclassify `WEBSUB_ACCELERATOR_MISS` as an ingestion failure, guess OTT release dates, or auto-promote 311 discovery candidates.
