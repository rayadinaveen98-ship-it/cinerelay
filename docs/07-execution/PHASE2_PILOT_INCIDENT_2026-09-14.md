# Phase 2 Pilot Incident — Repeated WebSub Delivery Misses

Date: 2026-09-14

## Summary

The hosted Phase-2 pilot observed real Geetha Arts uploads published after the Tier-A YouTube WebSub subscriptions became active.

Three post-subscription uploads were not observed through the WebSub receipt path. CineRelay's uploads-playlist fallback recovered all three and the normal enrichment/processing workers completed successfully. This does **not** satisfy Exit Gate A. It is valuable production evidence because it proves the fallback safety path works and exposed two observability/health-semantics issues before merge.

## Source and observed uploads

Source: **Geetha Arts**  
Channel id: `UCiJfiEg1FImWsVuEu0L8X6Q`  
Generation-1 subscription verified: approximately `2026-09-14 11:04:49 UTC`

### Upload 1

- video id: `cYvPtLZSL5I`
- title: `Master Telugu Movie | It's All God's Will | Chiranjeevi, Sakshi Sivanand | Deva| Suresh Krissna`
- published: `2026-09-14 12:30:22 UTC`
- fallback enrichment job created: approximately `2026-09-14 12:45:06 UTC`
- raw item persisted: approximately `2026-09-14 12:46:02 UTC`
- resolution: safely `UNRESOLVED`, score `0`

### Upload 2

- video id: `DCYcSoTobwU`
- title: `#Parugu Movie Scenes | #alluarjun #sheela #sunil #prakashraj #Jayasudha | #shortvideo #ytshorts`
- published: `2026-09-14 13:30:35 UTC`
- fallback enrichment job created: `2026-09-14 13:53:33 UTC`
- enrichment completed: approximately `2026-09-14 13:54:01 UTC`
- processing completed: approximately `2026-09-14 13:54:02 UTC`
- resolution: safely `UNRESOLVED`, score `0`

### Upload 3

- video id: `b98yv5Gu1r4`
- title: `#Parugu Movie Scenes | #alluarjun #sheela #sunil #prakashraj #Jayasudha | #shortvideo #ytshorts`
- published: `2026-09-14 13:45:28 UTC`
- fallback enrichment job created: `2026-09-14 13:53:33 UTC`
- enrichment completed: approximately `2026-09-14 13:54:01 UTC`
- processing completed: approximately `2026-09-14 13:54:02 UTC`
- resolution: safely `UNRESOLVED`, score `0`

No `YOUTUBE_WEBSUB` receipt existed for these uploads when they were recovered.

Uploads 2 and 3 were both published before the diagnostic WebSub callback version 8 was deployed, so they cannot distinguish between:

- the Google hub never POSTing the notification; and
- the hub POSTing but the old callback rejecting it before a diagnostic receipt was persisted.

The next real upload under callback version 8 is therefore the first event that can resolve that ambiguity.

## What worked

- all four generation-1 leases remained active;
- fallback detected post-subscription uploads that push did not surface;
- `YOUTUBE_ENRICH_VIDEO` jobs were enqueued with `discoveredBy = UPLOADS_PLAYLIST_FALLBACK`;
- targeted `videos.list` enrichment succeeded;
- raw items and revisions persisted;
- `PROCESS_RAW_ITEM` completed successfully;
- unresolved content stayed `UNRESOLVED` rather than being force-matched;
- no fallback-window loss occurred (`fallback_gap_count = 0`);
- the scheduler continued running unattended.

The post-deploy version-8 fallback smoke dispatch returned HTTP `200` with:

- `due = 1`;
- `checked = 1`;
- `recoveredUploads = 2`;
- `gapSources = 0`.

This validates the safety objective: a missed push does not silently lose a newly published official upload.

## Issues exposed

### 1. WebSub rejection diagnostics were too quiet

Before this incident, a POST reaching the callback with an invalid/missing HMAC signature returned `202` intentionally but left no persisted diagnostic trace. The hosted watch therefore could not distinguish:

- the hub never POSTed to CineRelay; from
- the hub POSTed but CineRelay rejected the signature.

The callback now records minimal `REJECTED`/`IGNORED` diagnostic receipts after a valid callback token is resolved. It stores only operational metadata such as reason, generation, content type/length, signature presence and payload hash. It does not store the rejected payload or signature value.

### 2. Quiet channels were incorrectly marked `WEBSUB_STALE`

The original fallback worker treated `last_websub_at = null` as stale. That is not valid for an event-driven feed: a channel that publishes nothing may legitimately produce no WebSub delivery for an arbitrary period.

Health semantics are now outcome-based:

- no new upload + no WebSub event => healthy;
- fallback recovers a new upload that WebSub did not deliver => `DEGRADED / WEBSUB_MISSED_DELIVERY`;
- that degradation persists until a later successful WebSub push proves recovery;
- a bounded fallback-window loss remains `FALLBACK_WINDOW_GAP` and takes precedence.

A successful WebSub delivery now clears only WebSub-specific delivery degradation and restores the normal fallback cadence.

## Corrective deployment

Verified branch CI run **#115** passed all three jobs:

- intelligence/connectors;
- all eight Edge Function checks + deployment bundle build;
- clean PostgreSQL-17 migrations + **36 pgTAP assertions** + DB lint.

The exact CI-produced deployment bundle was then deployed to the hosted CineRelay project:

- `youtube-websub` -> **version 8 / ACTIVE**;
- `youtube-fallback-worker` -> **version 8 / ACTIVE**.

The hosted migration `websub_delivery_health_recovery` was applied successfully.

## Hosted state after repair

- **Geetha Arts:** `DEGRADED / WEBSUB_MISSED_DELIVERY` — correct because real post-subscription uploads were recovered only by fallback.
- **Mythri Movie Makers:** `HEALTHY` — quiet/no proven miss.
- **Sithara Entertainments:** `HEALTHY` — quiet/no proven miss.
- **Haarika & Hassine Creations:** `HEALTHY` — quiet/no proven miss.

All four generation-1 leases remain `ACTIVE`.

## Exit-gate consequence

Exit Gate A remains **PENDING**.

A fallback-only discovery is intentionally not accepted as proof of the push path. The next qualifying event must produce either:

1. a valid signed WebSub receipt that continues automatically through enrichment/intelligence; or
2. a persisted version-8 callback diagnostic that precisely identifies why the notification was rejected.

Only case 1 satisfies Exit Gate A.

Exit Gate B (real zero-gap lease renewal) also remains pending.

## Corrective implementation

Repository changes include:

- deterministic fallback-health decision helper + canaries;
- fallback worker health semantics based on proven misses rather than silence;
- persisted callback rejection/ignore diagnostics;
- database recovery behavior that clears `WEBSUB_MISSED_DELIVERY` only after a successful real push;
- hosted data repair converting false `WEBSUB_STALE` states into correct source-specific states;
- pgTAP coverage for successful WebSub health recovery.

The Phase-2 PR must remain draft until the original two production exit gates pass.
