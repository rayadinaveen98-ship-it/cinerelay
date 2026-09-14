# Phase 2 Pilot Incident — First Proven WebSub Miss

Date: 2026-09-14

## Summary

The hosted Phase-2 pilot observed the first genuinely new upload published after the four Tier-A YouTube WebSub subscriptions became active.

The upload was **not** observed through WebSub. CineRelay's uploads-playlist fallback recovered it successfully and completed enrichment/processing. This does **not** satisfy Exit Gate A, but it is valuable production evidence because it proves the fallback safety path works and exposed two observability/health-semantics issues before merge.

## Source and upload

- source: **Geetha Arts**
- channel id: `UCiJfiEg1FImWsVuEu0L8X6Q`
- video id: `cYvPtLZSL5I`
- title: `Master Telugu Movie | It's All God's Will | Chiranjeevi, Sakshi Sivanand | Deva| Suresh Krissna`
- published: `2026-09-14 12:30:22 UTC`
- generation-1 subscription verified: approximately `2026-09-14 11:04:49 UTC`
- fallback enrichment job created: approximately `2026-09-14 12:45:06 UTC`
- raw item persisted: approximately `2026-09-14 12:46:02 UTC`
- no `YOUTUBE_WEBSUB` receipt existed when the fallback recovery was observed

The upload therefore occurred after the lease was active and was recovered about 15 minutes later by the scheduled fallback path.

## What worked

- active WebSub lease remained intact;
- scheduled fallback detected the new upload;
- `YOUTUBE_ENRICH_VIDEO` was enqueued with `discoveredBy = UPLOADS_PLAYLIST_FALLBACK`;
- targeted `videos.list` enrichment succeeded;
- raw item persistence succeeded;
- `PROCESS_RAW_ITEM` completed successfully;
- no fallback-window gap occurred (`fallback_gap_count = 0`).

This validates the safety objective: a missed push does not silently lose a newly published official upload.

## Issues exposed

### 1. WebSub rejection diagnostics were too quiet

Before this incident, a POST reaching the callback with an invalid/missing HMAC signature returned `202` intentionally but left no persisted diagnostic trace. That meant the hosted watch could not distinguish:

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

## Hosted state after repair

- **Geetha Arts:** `DEGRADED / WEBSUB_MISSED_DELIVERY` — correct, because a real post-subscription upload was recovered only by fallback.
- **Mythri Movie Makers:** `HEALTHY` — quiet/no proven miss.
- **Sithara Entertainments:** `HEALTHY` — quiet/no proven miss.
- **Haarika & Hassine Creations:** `HEALTHY` — quiet/no proven miss.

All four generation-1 leases remain `ACTIVE`.

## Exit-gate consequence

Exit Gate A remains **PENDING**.

A fallback-only discovery is intentionally not accepted as proof of the push path. The next qualifying event must produce a real signed WebSub receipt and continue automatically through enrichment, raw/revision persistence, intelligence processing and canonical evidence.

Exit Gate B (real zero-gap lease renewal) also remains pending.

## Corrective implementation

Repository changes include:

- deterministic fallback-health decision helper + canaries;
- fallback worker health semantics based on proven misses rather than silence;
- persisted callback rejection/ignore diagnostics;
- database recovery behavior that clears `WEBSUB_MISSED_DELIVERY` only after a successful real push;
- hosted data repair converting the false `WEBSUB_STALE` states into the correct source-specific states;
- pgTAP coverage for successful WebSub health recovery.

The Phase-2 PR must remain draft until the original two production exit gates pass.
