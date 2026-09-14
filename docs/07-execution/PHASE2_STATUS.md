# Phase 2 Status — YouTube Production Connector

Date: 2026-09-14

## Overall state

**Phase 2: IMPLEMENTATION COMPLETE / HOSTED PILOT ACTIVE / FINAL LIVE-UPLOAD + RENEWAL EVIDENCE PENDING**

The production YouTube connector is complete at the repository, migration, hosted-database, CI and Edge-Function layers. The dedicated hosted CineRelay environment exists and the first real end-to-end official YouTube canary has produced a canonical CineRelay event successfully.

Phase 2 is **not yet marked production-complete** because two final hosted-pilot observations are still required: a naturally occurring signed post-subscription WebSub upload notification and a real lease-renewal generation proving zero-gap renewal in production.

## Completed implementation slices

### P2.1 YouTube connector contracts — COMPLETE

- canonical channel/video ID validation;
- WebSub hub/topic/request contracts;
- Atom notification parser;
- channel/video Data API normalization;
- current quota-policy representation;
- livestream/upcoming metadata normalization.

### P2.2 WebSub security and callback — COMPLETE

- public callback-token routing;
- callback tokens stored only as hashes;
- per-generation credentials derived from a server-side master secret;
- HMAC notification validation;
- challenge/topic validation;
- bounded payload size;
- expected-channel validation;
- idempotent receipt ledger;
- enrichment job enqueue.

### P2.3 Subscription generations / zero-gap renewal — IMPLEMENTED / LIVE RENEWAL OBSERVATION PENDING

- monotonically increasing generations;
- old active generation remains usable while renewal verifies;
- new verified generation atomically supersedes older generations;
- idempotent subscribe/renew/unsubscribe behavior;
- duplicate in-flight renewal prevention;
- verification timeout detection;
- lease-expiry detection;
- WebSub-specific health recovery after a replacement lease verifies.

### P2.4 Targeted enrichment — COMPLETE + HOSTED VERIFIED

- batched `videos.list` enrichment;
- quota reserve guard;
- quota ledger using the YouTube Pacific-time day;
- unavailable-video handling;
- revision-safe raw-item persistence;
- meaningful-change fingerprinting;
- downstream raw-item job enqueue;
- source-health updates.

A real Mythri Movie Makers YouTube video was successfully fetched through `videos.list`, persisted into `raw_items` and `raw_item_revisions`, and passed to the raw-item intelligence worker.

### P2.5 Raw item -> canonical intelligence — COMPLETE + HOSTED VERIFIED

- bounded `source_entity_candidates` scope;
- aliases loaded only for relevant candidate titles;
- resolved/ambiguous/unresolved outcomes persisted;
- no forced match when the resolver is uncertain;
- existing theatrical-date context supplied to the classifier;
- canonical event dedupe;
- actual raw-item evidence attachment;
- stronger evidence can promote verification state;
- project-announcement classification supports release windows without inventing exact dates;
- nested structured data uses stable dedupe serialization.

Hosted real-world canary:

- source: **Mythri Movie Makers**;
- YouTube video: `rfP-ArN8nds`;
- canonical entity: **Family Pack**;
- entity resolution: `RESOLVED`, score `0.98`;
- event: `PROJECT_ANNOUNCED`;
- verification: `OFFICIAL`;
- priority: `HIGH`;
- headline: `Family Pack project announced`;
- structured release window: `FESTIVAL / Sankranthi / 2027`;
- classifier: `deterministic-domain-v1.1`;
- evidence role: `PRIMARY`;
- canonical event count for this entity/type after replay: exactly `1`.

This proves the real hosted path:

`official YouTube source -> fallback baseline -> targeted videos.list enrichment -> raw item -> revision -> processing queue -> bounded entity resolution -> deterministic classification -> canonical event -> primary evidence`.

### P2.6 Uploads-playlist safety fallback — COMPLETE + HOSTED VERIFIED

- targeted `playlistItems.list` helper;
- at most latest 50 uploads per check;
- no historical flood when establishing a baseline;
- missed uploads recovered oldest-first;
- fallback window gaps surfaced as source-health degradation;
- WebSub delivery streak reset when fallback proves missed delivery;
- healthy/degraded adaptive next-check intervals;
- quota accounting and reserve protection.

Hosted baseline succeeded for all four pilot channels with `fallback_gap_count = 0`.

### P2.7 Source administration — COMPLETE + HOSTED VERIFIED

- YouTube channel validated before registration;
- source/source-identity/channel-state/health/title-scope registration is atomic;
- same-channel registration serialized with a Postgres transaction advisory lock;
- re-registration updates the existing graph rather than creating duplicates;
- candidate scope replace operation validates all requested entities;
- source disable path;
- optional idempotent WebSub subscribe after registration;
- primary-key conflict targets avoid PL/pgSQL output-variable ambiguity.

Four Tier-A official pilot channels are registered:

1. Mythri Movie Makers
2. Sithara Entertainments
3. Haarika & Hassine Creations
4. Geetha Arts

All four source registrations are active and their WebSub challenge/lease setup succeeded.

### P2.8 Runtime gateway and database-access policy — COMPLETE + HOSTED VERIFIED

- WebSub callback explicitly permits provider access without a user JWT;
- internal functions explicitly use independent internal-key authentication;
- function gateway behavior is version-controlled in `supabase/config.toml`;
- Phase-2 Data API objects are explicitly available to `service_role`;
- `anon` and `authenticated` receive no Phase-2 internal table/queue-RPC access;
- RLS remains enabled on internal tables;
- hosted and local database target PostgreSQL 17;
- function `search_path` hardened;
- `pg_trgm` moved out of `public` into `extensions`;
- default privileges hardened for future tables/functions/sequences.

### P2.9 Maintenance worker — COMPLETE / HOSTED RENEWAL OBSERVATION PENDING

- due-renewal selection;
- recent in-flight renewal suppression;
- stale verification timeout -> `ERROR`;
- expired active lease -> `EXPIRED`;
- visible source-health degradation;
- renewal calls delegated through the same idempotent subscription-admin path.

### P2.10 CI / test hardening — COMPLETE

Current merge gate includes:

- strict TypeScript compilation;
- event-contract alignment across taxonomy/domain/migration;
- **13/13 intelligence benchmark cases** passing, including the real-world project-announcement/release-window pattern and exact-date precedence;
- **13/13 YouTube connector canaries** passing;
- **8/8 YouTube planning/enrichment/fallback canaries** passing;
- Deno type-checks for all seven current Edge Functions;
- deployment-native Edge bundle generation;
- clean PostgreSQL 17 Supabase migration startup;
- **27 pgTAP database assertions** passing;
- Postgres `db lint --level error` gate;
- regression coverage for the real `upsert_raw_item_revision` PL/pgSQL ambiguity found by the hosted pilot.

CI run **#94** is green across all three jobs.

## Current hosted environment

Dedicated project:

- name: `CineRelay`
- ref: `dnqaejljfzwhsainpdxb`
- region: `ap-south-1`
- PostgreSQL: 17.6.x
- current recurring cost: **₹0/month**

Configured runtime secrets:

- `CINERELAY_WEBSUB_MASTER_SECRET`
- `CINERELAY_INTERNAL_ADMIN_SECRET`
- `YOUTUBE_API_KEY`

All seven Edge Functions are deployed and active:

- `youtube-websub`
- `youtube-source-admin`
- `youtube-subscription-admin`
- `youtube-enrichment-worker`
- `process-raw-item-worker`
- `youtube-fallback-worker`
- `youtube-maintenance-worker`

`process-raw-item-worker` is deployed with classifier `deterministic-domain-v1.1` from the CI-produced deployment bundle.

## Hosted pilot evidence captured

Completed:

- dedicated hosted CineRelay project provisioned;
- committed migrations applied;
- security hardening applied;
- custom runtime secrets configured outside GitHub;
- all seven Edge Functions deployed;
- four official Telugu-film pilot channels registered;
- WebSub challenge/lease verification succeeded for all four;
- `channels.list` calls succeeded;
- fallback `playlistItems.list` baseline succeeded for all four;
- targeted `videos.list` enrichment succeeded;
- raw item + revision persistence succeeded;
- real entity resolution succeeded at 0.98 confidence;
- real canonical event created with correct verification, priority, structured release window and primary evidence;
- replay did not create duplicate canonical event spam;
- quota ledger remained low-cost and observable;
- hosted persistence bug discovered by the canary, fixed, regression-tested and kept green in CI.

Still required before Phase 2 can be marked fully complete:

1. naturally occurring signed WebSub notification from a new post-subscription upload;
2. verify that notification flows into enrichment without manual replay;
3. observe one real renewal generation in hosted production and confirm zero-gap supersession;
4. complete bounded recurring worker scheduling so hosted operation does not depend on manual PowerShell triggers;
5. record latency from provider notification availability to canonical event for the real push path.

## Do not start yet

Until the remaining hosted canary evidence is complete, do not jump ahead to:

- polished internal web console;
- large 25–50 channel onboarding;
- Android UI;
- Instagram/X ingestion;
- broad web scraping;
- expensive AI enrichment.

_Last updated: 2026-09-14_
