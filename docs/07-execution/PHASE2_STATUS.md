# Phase 2 Status — YouTube Production Connector

Date: 2026-09-14

## Overall state

**Phase 2: IMPLEMENTATION COMPLETE / HOSTED PILOT ACTIVE / ONE FINAL LIVE PUSH GATE PENDING**

The YouTube production connector is implemented and running in the hosted CineRelay Supabase project. Repository, database, Edge Functions, scheduler, fallback recovery, quota controls, intelligence processing, source health, and zero-gap subscription renewal have all been exercised in production.

Phase 2 now has exactly **one** remaining merge blocker:

> A genuinely new upload must arrive through an accepted WebSub callback and automatically traverse CineRelay before fallback becomes its first discovery path.

Gate B — zero-gap subscription renewal — passed on 2026-09-14 through an incident-driven early production renewal canary. See `PHASE2_GATE_B_RENEWAL_PROOF_2026-09-14.md`.

## Hosted project

- project: `CineRelay`
- ref: `dnqaejljfzwhsainpdxb`
- region: `ap-south-1`
- PostgreSQL: 17.6.x
- recurring infrastructure cost: **₹0/month**

Hosted workers are scheduled through:

`pg_cron -> pg_net -> cinerelay-scheduler-dispatch -> internal worker`

Current cadence:

- enrichment: every minute
- raw processing: every minute
- maintenance: every 10 minutes
- fallback: every 15 minutes

Manual PowerShell is not required for normal operation.

## Pilot sources

1. Mythri Movie Makers
2. Sithara Entertainments
3. Haarika & Hassine Creations
4. Geetha Arts

All four have a usable active WebSub lease. Geetha Arts is now on generation 2 after the production renewal canary; the other three remain on generation 1.

## Gate A — natural WebSub delivery

**Status: PENDING**

The live pilot observed three Geetha Arts uploads after its generation-1 subscription was verified:

- `cYvPtLZSL5I` — `2026-09-14 12:30:22 UTC`
- `DCYcSoTobwU` — `2026-09-14 13:30:35 UTC`
- `b98yv5Gu1r4` — `2026-09-14 13:45:28 UTC`

None produced an accepted `YOUTUBE_WEBSUB` receipt. All three were recovered by the uploads-playlist fallback, enriched successfully, processed successfully, and safely remained `UNRESOLVED` rather than receiving invented entity matches.

This proved the safety path but did not satisfy the push gate.

The callback was hardened after the incident so the next real post now distinguishes:

- hub never called CineRelay; from
- hub called CineRelay but the callback rejected/ignored the request.

Minimal rejected/ignored callback diagnostics persist operational metadata and payload hashes only; rejected payload bodies and signature values are not stored.

Google's current official documentation still describes the same YouTube PubSubHubbub/WebSub channel-feed contract, so no upstream contract migration has been identified.

## Gate B — zero-gap lease renewal

**Status: PASS**

During incident recovery, Geetha Arts generation 1 was intentionally made renewal-due and the normal production maintenance path was dispatched.

Observed production result:

- scheduler request id: `283`
- HTTP status: `200`
- renewal due: `1`
- renewed: `1`
- renewal failures: `0`
- verification timeouts: `0`
- expired leases: `0`

Generation evidence:

- gen 1 verified: `2026-09-14 11:04:49.709 UTC`
- gen 2 requested: `2026-09-14 14:13:03.525049 UTC`
- gen 2 verified: `2026-09-14 14:13:05.490 UTC`
- gen 2 state: `ACTIVE`
- gen 1 state after gen-2 verification: `SUPERSEDED`
- gen 2 renew-after: `2026-09-22 14:13:05.490 UTC`
- gen 2 expiry: `2026-09-24 14:13:05.490 UTC`

The real Google hub verified generation 2 in roughly two seconds. Generation 1 remained usable until the replacement was verified, proving the zero-gap generation contract.

This was an incident-driven early renewal rather than the naturally scheduled September 22 tick. The natural timing can still be observed later as long-horizon operational evidence, but the zero-gap replacement property itself is now production-proven.

See `PHASE2_GATE_B_RENEWAL_PROOF_2026-09-14.md`.

## Production intelligence proof

A real Mythri Movie Makers canary already proved the canonical intelligence path:

- video: `rfP-ArN8nds`
- entity: `Family Pack`
- resolution confidence: `0.98`
- canonical event: `PROJECT_ANNOUNCED`
- verification: `OFFICIAL`
- priority: `HIGH`
- release window: `FESTIVAL / Sankranthi / 2027`
- classifier: `deterministic-domain-v1.1`
- evidence: `PRIMARY`
- replay dedupe: exactly one canonical event

This proves:

`official source -> discovery -> videos.list -> raw item -> revision -> processing -> scoped resolution -> deterministic classification -> canonical event -> evidence`

## Fallback proof

The Geetha Arts incident proved the bounded fallback safety path under real missed pushes.

A controlled post-deploy fallback dispatch returned HTTP `200` with:

- `due = 1`
- `checked = 1`
- `recoveredUploads = 2`
- `gapSources = 0`

Both resulting enrichment jobs and downstream processing jobs completed on the normal minute workers. `fallback_gap_count` remained `0`.

## Source-health ownership repair

A second production bug was found during the same incident: after fallback correctly marked Geetha Arts `DEGRADED / WEBSUB_MISSED_DELIVERY`, successful enrichment incorrectly reset the shared source health to `HEALTHY`.

Root cause: the enrichment worker treated `videos.list` success as permission to clear health owned by other connector subsystems.

Repair:

- new atomic RPC: `record_youtube_enrichment_success(...)`
- successful enrichment clears only enrichment-owned failures
- WebSub/fallback/subscription errors remain authoritative
- a successful WebSub delivery remains the only path that clears `WEBSUB_MISSED_DELIVERY`

Hosted verification after repair:

1. Geetha was restored to `DEGRADED / WEBSUB_MISSED_DELIVERY`;
2. a successful enrichment-health canary was recorded;
3. Geetha remained `DEGRADED / WEBSUB_MISSED_DELIVERY` afterward;
4. generation-2 lease activation also correctly preserved the unrelated missed-delivery degradation.

Current Geetha state:

- health: `DEGRADED`
- error: `WEBSUB_MISSED_DELIVERY`
- `last_websub_at = null`
- `consecutive_websub_events = 0`

## Current hosted function versions relevant to the incident

- `youtube-websub`: v8
- `youtube-fallback-worker`: v8
- `youtube-enrichment-worker`: v8

## CI baseline

Health-ownership repair head:

`2eb955f4071743e6d3477739715e234255f8a2dc`

CineRelay CI **#122: PASS** across all three jobs.

Current automated gates include:

- 13/13 intelligence benchmark cases
- 13/13 YouTube connector canaries
- 12/12 YouTube planning/enrichment/fallback canaries
- all 8 Edge Function Deno checks
- deployment-native Edge bundle generation
- fresh PostgreSQL-17 migration startup
- **40 pgTAP tests / PASS**
- DB lint with no schema errors

The hosted enrichment-worker v8 deployment came from the exact CI-produced deployment artifact of this green baseline.

## Current merge rule

PR #2 remains **draft**.

Do not merge until Gate A passes:

1. a genuinely new post-v8/post-renewal upload produces an accepted WebSub receipt;
2. the notification creates the enrichment job automatically;
3. raw item/revision persistence succeeds;
4. downstream processing succeeds;
5. entity resolution remains truthful (`RESOLVED`, `AMBIGUOUS`, or `UNRESOLVED`);
6. a meaningful supported event produces exactly one canonical event with evidence;
7. provider-receipt-to-canonical latency is recorded;
8. fallback is not the first discovery path for that qualifying upload.

Do not start broad Phase-3 UI work, mass source onboarding, X/Instagram ingestion, or broad scraping before this final gate is recorded.

## Authoritative evidence

- `PHASE2_HOSTED_PILOT_WATCH.md`
- `PHASE2_PILOT_INCIDENT_2026-09-14.md`
- `PHASE2_GATE_B_RENEWAL_PROOF_2026-09-14.md`
- `PHASE2_YOUTUBE_OPERATIONS.md`

_Last updated: 2026-09-14_
