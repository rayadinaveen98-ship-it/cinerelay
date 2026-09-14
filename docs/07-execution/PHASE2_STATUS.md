# Phase 2 Status — YouTube Production Connector

Date: 2026-09-14

## Overall state

**Phase 2: IMPLEMENTATION COMPLETE / HOSTED PILOT ACTIVE / FINAL LIVE-UPLOAD + RENEWAL EVIDENCE PENDING**

The production YouTube connector is complete at repository, database, CI, Edge Function and hosted-scheduler layers. A dedicated CineRelay Supabase environment is running, four Tier-A official YouTube sources are subscribed, a real official-video canary has produced a canonical CineRelay event, and the recurring worker path runs unattended.

The live pilot has now also proven the safety path under a real delivery miss: three post-subscription Geetha Arts uploads were recovered through the uploads-playlist fallback and processed successfully, while no WebSub receipt was observed for them. That incident exposed and fixed callback-observability and source-health semantics before merge. See `PHASE2_PILOT_INCIDENT_2026-09-14.md`.

Phase 2 is **not yet production-complete** because two naturally time-dependent observations remain:

1. one genuinely new post-subscription upload must arrive through valid signed WebSub and traverse the full automatic pipeline;
2. one real hosted WebSub lease renewal must prove zero-gap generation supersession.

The exact watch conditions and queries are in `PHASE2_HOSTED_PILOT_WATCH.md`.

## Completed implementation

### P2.1 YouTube contracts — COMPLETE

- canonical channel/video validation;
- WebSub hub/topic/request contracts;
- Atom notification parser;
- channel/video API normalization;
- quota policy;
- livestream/upcoming metadata normalization.

### P2.2 WebSub security + callback — COMPLETE / LIVE PUSH PROOF PENDING

- public callback-token routing;
- callback tokens stored as hashes;
- generation-specific credentials derived from the WebSub master secret;
- HMAC validation;
- challenge/topic/channel validation;
- bounded payload size;
- idempotent receipt ledger;
- enrichment job enqueue;
- minimal persisted `REJECTED` / `IGNORED` callback diagnostics after a valid callback token resolves;
- rejected payloads and signature values are not stored.

The callback is deployed as hosted **version 8**. The next real post-deployment upload will distinguish a missing hub POST from a callback-level rejection if the push path still fails.

### P2.3 Subscription generations — IMPLEMENTED / LIVE RENEWAL OBSERVATION PENDING

- monotonically increasing generations;
- old active generation remains usable during renewal;
- verified replacement atomically supersedes older generations;
- duplicate in-flight renewal suppression;
- verification timeout detection;
- lease-expiry detection;
- source-health degradation/recovery.

All four current generation-1 leases are `ACTIVE`.

Observed hosted timing:

- `renew_after`: approximately **2026-09-22 11:04 UTC**;
- `expires_at`: approximately **2026-09-24 11:04 UTC**.

### P2.4 Targeted enrichment — COMPLETE + HOSTED VERIFIED

- batched `videos.list` enrichment;
- quota reserve guard + quota ledger;
- unavailable-video handling;
- raw-item/revision persistence;
- meaningful-change fingerprinting;
- downstream processing queue;
- source-health updates.

A real Mythri Movie Makers video was fetched through `videos.list`, persisted to `raw_items` + `raw_item_revisions`, and passed into intelligence processing.

The live Geetha Arts fallback incident also produced three real enrichment jobs successfully, including two later uploads that were automatically enriched and handed to raw-item processing on the next minute cadence.

### P2.5 Raw item -> canonical intelligence — COMPLETE + HOSTED VERIFIED

- bounded `source_entity_candidates` resolution scope;
- aliases loaded only for relevant titles;
- `RESOLVED` / `AMBIGUOUS` / `UNRESOLVED` persisted;
- no forced entity match;
- theatrical-date precondition support;
- deterministic classification;
- canonical-event dedupe;
- real evidence attachment;
- stronger evidence can promote verification;
- project-announcement release-window support;
- recursive stable structured-data serialization for dedupe.

Hosted real-world canary:

- source: **Mythri Movie Makers**;
- video: `rfP-ArN8nds`;
- entity: **Family Pack**;
- resolution: `RESOLVED` at `0.98`;
- event: `PROJECT_ANNOUNCED`;
- verification: `OFFICIAL`;
- priority: `HIGH`;
- headline: `Family Pack project announced`;
- release window: `FESTIVAL / Sankranthi / 2027`;
- classifier: `deterministic-domain-v1.1`;
- evidence: `PRIMARY`;
- duplicate event count after replay: exactly `1` canonical event.

This proves the hosted intelligence path:

`official source -> discovery -> videos.list -> raw item -> revision -> processing queue -> scoped resolution -> deterministic classification -> canonical event -> primary evidence`.

The three Geetha Arts fallback-recovered items all processed successfully and remained safely `UNRESOLVED` at score `0` because their current source candidate scope did not justify a title match. No false canonical event was invented.

### P2.6 Uploads-playlist fallback — COMPLETE + HOSTED VERIFIED UNDER REAL MISS

- latest-50 bounded `playlistItems.list` checks;
- baseline without historical flood;
- missing uploads recovered oldest-first;
- gap detection + `fallback_gap_count`;
- health degradation/recovery;
- adaptive per-source fallback cadence;
- quota accounting;
- health now degrades on a **proven missed WebSub delivery**, not merely on a quiet channel with no WebSub events.

Initial baselines succeeded for all four pilot channels.

The first real hosted miss was then observed on Geetha Arts. Three post-subscription uploads were recovered only through fallback:

- `cYvPtLZSL5I` — published `12:30:22 UTC`;
- `DCYcSoTobwU` — published `13:30:35 UTC`;
- `b98yv5Gu1r4` — published `13:45:28 UTC`.

A post-deploy controlled fallback dispatch through the same Vault-protected scheduler path returned HTTP `200` with:

- `due = 1`;
- `checked = 1`;
- `recoveredUploads = 2`;
- `gapSources = 0`.

The two resulting enrichment jobs and both downstream processing jobs completed successfully on the regular minute cron. `fallback_gap_count` remains `0`.

Current health semantics:

- quiet source with no proven miss -> `HEALTHY`;
- fallback-recovers-new-upload -> `DEGRADED / WEBSUB_MISSED_DELIVERY`;
- successful later WebSub push clears that WebSub-specific degradation;
- bounded-window loss -> `FALLBACK_WINDOW_GAP`.

`youtube-fallback-worker` is deployed as hosted **version 8**.

### P2.7 Source administration — COMPLETE + HOSTED VERIFIED

- targeted channel validation before registration;
- atomic source/source-identity/channel-state/health/scope registration;
- advisory locking for same-channel registration;
- idempotent re-registration;
- validated candidate-scope replacement;
- source disable path;
- optional WebSub subscribe;
- named conflict targets to avoid PL/pgSQL ambiguity.

Current Tier-A pilot sources:

1. Mythri Movie Makers
2. Sithara Entertainments
3. Haarika & Hassine Creations
4. Geetha Arts

### P2.8 Security and database access — COMPLETE + HOSTED VERIFIED

- public WebSub callback protected by derived callback token + HMAC;
- internal worker/admin endpoints protected by independent internal key;
- service-role-only Phase-2 Data API access;
- no anon/authenticated access to internal tables/queue RPCs;
- RLS enabled on internal tables;
- PostgreSQL 17 hosted/local parity;
- hardened function `search_path`;
- `pg_trgm` moved to `extensions`;
- hardened future default privileges.

Diagnostic callback receipts store operational metadata and payload hashes only; rejected payload bodies and signature values are not persisted.

### P2.9 Maintenance worker — COMPLETE / HOSTED RENEWAL OBSERVATION PENDING

- due-renewal selection;
- in-flight renewal suppression;
- timeout -> `ERROR`;
- expired lease -> `EXPIRED`;
- source-health visibility;
- renewals delegated to the same subscription-admin contract.

Hosted maintenance runs continue to return HTTP `200`; no renewal is due yet.

### P2.10 CI / test hardening — COMPLETE

Current merge gate includes:

- strict TypeScript compilation;
- event-contract alignment;
- **13/13 intelligence benchmark cases**;
- **13/13 YouTube connector canaries**;
- **12/12 YouTube planning/enrichment/fallback canaries**;
- Deno type-checks for all **eight** Edge Functions;
- deployment-native Edge bundle generation;
- clean PostgreSQL-17 migration startup;
- **36 pgTAP assertions**, including Vault-backed scheduler authentication and WebSub missed-delivery health recovery;
- `db lint --level error`;
- regression coverage for the hosted `upsert_raw_item_revision` ambiguity found during canary testing.

CI run **#115** passed all three jobs on the incident-hardening branch state. The exact deployment-native artifact from that green run was used to deploy the hosted callback/fallback version-8 functions.

### P2.11 Recurring hosted scheduling — COMPLETE + HOSTED VERIFIED

Scheduling uses:

`pg_cron -> pg_net -> cinerelay-scheduler-dispatch -> internal worker`

Security properties:

- scheduler token generated inside Postgres;
- encrypted value stored in Supabase Vault;
- only SHA-256 token hash stored in application schema;
- token value never committed or exposed in chat;
- dispatcher has a four-action allow-list;
- arbitrary URLs/bodies are not accepted;
- dispatcher forwards using the existing internal admin secret;
- anon/authenticated cannot use the scheduler verification RPC.

Hosted schedules:

- enrichment: every minute;
- raw processing: every minute;
- maintenance: every 10 minutes;
- fallback: every 15 minutes.

Hosted proof:

- database/Vault -> `pg_net` -> dispatcher -> workers return HTTP `200`;
- automatic enrichment/raw-processing cron jobs continue succeeding on consecutive minute ticks;
- maintenance dispatch returns HTTP `200`;
- fallback scheduling and controlled post-deploy fallback dispatch return HTTP `200`;
- the two newly recovered Geetha uploads automatically completed enrichment and processing on the minute workers.

**Manual PowerShell is not required for normal operation.**

## Current hosted environment

- project: `CineRelay`
- ref: `dnqaejljfzwhsainpdxb`
- region: `ap-south-1`
- PostgreSQL: 17.6.x
- recurring cost: **₹0/month**

Configured runtime secrets:

- `CINERELAY_WEBSUB_MASTER_SECRET`
- `CINERELAY_INTERNAL_ADMIN_SECRET`
- `YOUTUBE_API_KEY`

Vault scheduler material:

- `cinerelay_scheduler_dispatch_token`
- `cinerelay_project_url`

Eight active Edge Functions remain deployed. Current incident-relevant versions:

- `youtube-websub`: **v8**;
- `youtube-fallback-worker`: **v8**.

## Hosted pilot evidence captured

Completed:

- dedicated hosted project;
- migrations + security hardening;
- runtime secrets;
- all eight Edge Functions;
- four official pilot sources;
- real WebSub lease challenge verification for all four;
- `channels.list` validation;
- fallback baseline;
- targeted `videos.list` enrichment;
- raw item + revision persistence;
- real resolution at 0.98;
- real canonical event + primary evidence;
- replay dedupe proof;
- quota visibility;
- source-health visibility;
- hosted bug discovery/fix/regression tests;
- Vault-backed recurring scheduler;
- repeated unattended worker execution;
- first real post-subscription WebSub misses observed and recovered by fallback;
- callback diagnostics hardened for the next natural push;
- quiet-source health semantics corrected;
- version-8 callback and fallback worker deployed from the green CI artifact.

Current source health:

- Geetha Arts: `DEGRADED / WEBSUB_MISSED_DELIVERY`;
- Mythri Movie Makers: `HEALTHY`;
- Sithara Entertainments: `HEALTHY`;
- Haarika & Hassine Creations: `HEALTHY`.

Still required before Phase 2 is fully complete:

1. one naturally occurring valid signed WebSub notification from a new post-version-8 upload;
2. that upload must flow automatically through enrichment/intelligence without fallback being its first discovery path;
3. real push-path latency must be recorded;
4. one real renewal generation must verify zero-gap supersession.

If the next upload is rejected instead of accepted, the new persisted diagnostic must be used to identify and fix the exact push failure before the gate can pass.

## Merge rule

PR #2 remains **draft** and must not merge until both natural hosted exit gates pass.

Do not begin broad Phase-3 product work, mass channel onboarding, Android UI, X/Instagram ingestion, or broad scraping before that evidence is recorded.

See `PHASE2_HOSTED_PILOT_WATCH.md` and `PHASE2_PILOT_INCIDENT_2026-09-14.md` for the exact evidence/query pack.

_Last updated: 2026-09-14_
