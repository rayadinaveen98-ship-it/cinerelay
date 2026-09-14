# Phase 2 Pilot Incident — WebSub Delivery Miss + Recovery Hardening

Date: 2026-09-14

## Summary

The hosted Phase-2 pilot observed three genuinely new Geetha Arts uploads after its WebSub lease was active. None appeared through the accepted WebSub receipt path; CineRelay recovered all three through the uploads-playlist fallback and processed them successfully.

The incident did **not** satisfy the natural push gate, but it proved the fallback safety path and exposed three production issues before merge:

1. rejected/ignored callback attempts had insufficient persisted diagnostics;
2. quiet channels were incorrectly treated as WebSub-stale;
3. successful enrichment could overwrite a WebSub delivery failure in the shared source-health row.

All three issues are now hardened.

## Affected source and uploads

Source: **Geetha Arts**  
Channel: `UCiJfiEg1FImWsVuEu0L8X6Q`

Post-subscription uploads recovered by fallback:

- `cYvPtLZSL5I` — published `2026-09-14 12:30:22 UTC`
- `DCYcSoTobwU` — published `2026-09-14 13:30:35 UTC`
- `b98yv5Gu1r4` — published `2026-09-14 13:45:28 UTC`

All three were enriched successfully. The latter two were processed automatically by the normal minute workers after a controlled fallback dispatch. No bounded latest-50 gap occurred.

The resolver safely left the recovered items `UNRESOLVED` at score `0` rather than inventing a title match.

## Issue 1 — callback rejection observability

Before hardening, a POST with an invalid or missing HMAC could return `202` without a persisted diagnostic trace. That made these two cases indistinguishable:

- Google never delivered the callback;
- Google delivered it but CineRelay rejected it.

The hosted callback now persists minimal `REJECTED` / `IGNORED` diagnostic receipts after a valid callback token resolves.

Stored diagnostic material is limited to operational metadata and payload hashes. Rejected payload bodies and signature values are not persisted.

Hosted `youtube-websub`: **v8**.

## Issue 2 — quiet source falsely marked stale

The original fallback health logic treated `last_websub_at = null` as a stale push path. That is incorrect for an event-driven source: a quiet channel may legitimately send no event for an arbitrary period.

Current health rules:

- quiet/no proven miss -> `HEALTHY`;
- fallback recovers a new upload first -> `DEGRADED / WEBSUB_MISSED_DELIVERY`;
- a later accepted WebSub delivery clears that WebSub-specific degradation;
- bounded fallback-window loss -> `FALLBACK_WINDOW_GAP`.

Hosted `youtube-fallback-worker`: **v8**.

## Issue 3 — enrichment erased another subsystem's health

After fallback correctly set Geetha Arts to `DEGRADED / WEBSUB_MISSED_DELIVERY`, successful targeted enrichment later reset the shared source health to `HEALTHY`.

Root cause: enrichment success treated a successful `videos.list` call as permission to clear the current source-health error regardless of which subsystem owned that error.

Repair:

- new atomic database RPC `record_youtube_enrichment_success(...)`;
- enrichment success clears only enrichment-owned failure codes;
- WebSub, fallback and subscription errors remain authoritative;
- `WEBSUB_MISSED_DELIVERY` remains until a real successful WebSub delivery clears it.

Hosted verification:

1. Geetha was repaired back to `DEGRADED / WEBSUB_MISSED_DELIVERY`;
2. a successful enrichment-health canary was recorded;
3. Geetha remained degraded with the same WebSub error afterward.

Hosted `youtube-enrichment-worker`: **v8**.

## Incident-driven subscription refresh

Because generation 1 had missed three uploads, Geetha Arts was intentionally made renewal-due and the normal production maintenance path was used to refresh its live hub subscription.

Result:

- scheduler request id `283`;
- maintenance HTTP `200`;
- renewal due `1`;
- renewed `1`;
- renewal failures `0`;
- generation 2 requested `2026-09-14 14:13:03.525049 UTC`;
- generation 2 verified `2026-09-14 14:13:05.490 UTC`;
- generation 2 became `ACTIVE`;
- generation 1 became `SUPERSEDED` only after replacement verification.

This proved the zero-gap lease replacement property in production and advanced Phase-2 Gate B to **PASS**. Full evidence is in `PHASE2_GATE_B_RENEWAL_PROOF_2026-09-14.md`.

Importantly, the successful lease renewal did **not** clear Geetha's separate `WEBSUB_MISSED_DELIVERY` state. Lease verification and notification delivery are tracked as distinct facts.

## Current state after incident hardening

Geetha Arts:

- active lease: generation 2
- health: `DEGRADED`
- error: `WEBSUB_MISSED_DELIVERY`
- `last_websub_at = null`
- `consecutive_websub_events = 0`

Other pilot sources remain healthy unless a real connector failure is observed.

## CI evidence

Health-ownership repair branch head:

`2eb955f4071743e6d3477739715e234255f8a2dc`

CineRelay CI `#122`: PASS.

Relevant checks:

- all three CI jobs passed;
- all 8 Edge Functions type-check;
- fresh PostgreSQL-17 migration startup passed;
- **40 pgTAP tests passed**;
- DB lint reported no schema errors.

The hosted enrichment v8 deployment came from the exact CI-produced deployment artifact.

## Phase consequence

Gate B is complete.

Gate A remains the only Phase-2 blocker:

> A genuinely new upload must produce an accepted WebSub receipt through the hardened callback and automatically traverse CineRelay before fallback becomes its first discovery path.

If the next upload is rejected or ignored, the v8 diagnostics must identify the exact callback failure before Gate A can pass.
