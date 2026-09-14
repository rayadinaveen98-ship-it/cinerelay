# Phase 2 Status — YouTube Production Connector

Date: 2026-09-14

## Overall state

**Phase 2: IMPLEMENTATION COMPLETE / HOSTED PILOT ACTIVE / FINAL LIVE-UPLOAD + RENEWAL EVIDENCE PENDING**

The production YouTube connector is complete at repository, database, CI, Edge Function and hosted-scheduler layers. A dedicated CineRelay Supabase environment is running, four Tier-A official YouTube sources are subscribed, a real official-video canary has produced a canonical CineRelay event, and the recurring worker path now runs unattended.

Phase 2 is **not yet production-complete** because two naturally time-dependent observations remain:

1. one genuinely new post-subscription upload must arrive through signed WebSub and traverse the full automatic pipeline;
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

### P2.2 WebSub security + callback — COMPLETE

- public callback-token routing;
- callback tokens stored as hashes;
- generation-specific credentials derived from the WebSub master secret;
- HMAC validation;
- challenge/topic/channel validation;
- bounded payload size;
- idempotent receipt ledger;
- enrichment job enqueue.

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

This proves the hosted path:

`official source -> fallback/replay discovery -> videos.list -> raw item -> revision -> processing queue -> scoped resolution -> deterministic classification -> canonical event -> primary evidence`.

### P2.6 Uploads-playlist fallback — COMPLETE + HOSTED VERIFIED

- latest-50 bounded `playlistItems.list` checks;
- baseline without historical flood;
- missing uploads recovered oldest-first;
- gap detection + `fallback_gap_count`;
- health degradation/recovery;
- adaptive per-source fallback cadence;
- quota accounting.

All four pilot baselines succeeded. A later hosted fallback smoke test checked all four sources with:

- recovered uploads: `0`;
- baseline sources: `0`;
- gap sources: `0`.

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

Security advisor after scheduler work shows only expected INFO-level `RLS enabled/no policy` notices for server-only tables.

### P2.9 Maintenance worker — COMPLETE / HOSTED RENEWAL OBSERVATION PENDING

- due-renewal selection;
- in-flight renewal suppression;
- timeout -> `ERROR`;
- expired lease -> `EXPIRED`;
- source-health visibility;
- renewals delegated to the same subscription-admin contract.

Hosted maintenance smoke test returned HTTP `200` with no renewal due yet and no failures.

### P2.10 CI / test hardening — COMPLETE

Current merge gate includes:

- strict TypeScript compilation;
- event-contract alignment;
- **13/13 intelligence benchmark cases**;
- **13/13 YouTube connector canaries**;
- **8/8 YouTube planning/enrichment/fallback canaries**;
- Deno type-checks for all **eight** Edge Functions;
- deployment-native Edge bundle generation;
- clean PostgreSQL-17 migration startup;
- **34 pgTAP assertions**, including Vault-backed scheduler authentication;
- `db lint --level error`;
- regression coverage for the hosted `upsert_raw_item_revision` ambiguity found during canary testing.

Current branch head was verified fully green in **CI run #105** across intelligence/connectors, Edge functions, and database migrations/tests/lint.

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

- database/Vault -> `pg_net` -> dispatcher -> raw worker returned HTTP `200`;
- automatic enrichment and raw-processing cron runs succeeded at multiple consecutive minute ticks (`12:06`, `12:07`, `12:08` UTC observed);
- dispatcher responses returned HTTP `200`;
- maintenance smoke dispatch returned HTTP `200`;
- fallback smoke dispatch returned HTTP `200` and checked all four pilot channels with no gaps.

**Manual PowerShell is no longer required for normal operation.**

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

Eight active Edge Functions:

- `youtube-websub`
- `youtube-source-admin`
- `youtube-subscription-admin`
- `youtube-enrichment-worker`
- `process-raw-item-worker`
- `youtube-fallback-worker`
- `youtube-maintenance-worker`
- `cinerelay-scheduler-dispatch`

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
- hosted bug discovery/fix/regression test;
- Vault-backed recurring scheduler;
- repeated unattended minute-worker execution;
- maintenance/fallback scheduler smoke tests.

Still required before Phase 2 is fully complete:

1. one naturally occurring signed WebSub notification from a new post-subscription upload;
2. that upload must flow automatically through enrichment/intelligence without manual replay;
3. real push-path latency must be recorded;
4. one real renewal generation must verify zero-gap supersession.

## Merge rule

PR #2 remains **draft** and must not merge until both natural hosted exit gates pass.

Do not begin broad Phase-3 product work, mass channel onboarding, Android UI, X/Instagram ingestion, or broad scraping before that evidence is recorded.

See `PHASE2_HOSTED_PILOT_WATCH.md` for the exact watch/query pack.

_Last updated: 2026-09-14_
