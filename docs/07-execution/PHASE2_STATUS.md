# Phase 2 Status — YouTube Production Connector

Date: 2026-09-14

## Overall state

**Phase 2: IMPLEMENTATION COMPLETE / HOSTED PILOT PENDING**

The production YouTube connector is complete at the repository, migration, local-database, CI and Edge-Function type-check layers. Phase 2 is **not yet production-verified** because the dedicated hosted CineRelay Supabase environment and real-channel WebSub canary evidence have not yet been provisioned/observed.

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

### P2.3 Subscription generations / zero-gap renewal — COMPLETE

- monotonically increasing generations;
- old active generation remains usable while renewal verifies;
- new verified generation atomically supersedes older generations;
- idempotent subscribe/renew/unsubscribe behavior;
- duplicate in-flight renewal prevention;
- verification timeout detection;
- lease-expiry detection;
- WebSub-specific health recovery after a replacement lease verifies.

### P2.4 Targeted enrichment — COMPLETE

- batched `videos.list` enrichment;
- quota reserve guard;
- quota ledger using the YouTube Pacific-time day;
- unavailable-video handling;
- revision-safe raw-item persistence;
- meaningful-change fingerprinting;
- downstream raw-item job enqueue;
- source-health updates.

### P2.5 Raw item -> canonical intelligence — COMPLETE

- bounded `source_entity_candidates` scope;
- aliases loaded only for relevant candidate titles;
- resolved/ambiguous/unresolved outcomes persisted;
- no forced match when the resolver is uncertain;
- existing theatrical-date context supplied to the classifier;
- canonical event dedupe;
- actual raw-item evidence attachment;
- stronger evidence can promote verification state.

### P2.6 Uploads-playlist safety fallback — COMPLETE

- targeted `playlistItems.list` helper;
- at most latest 50 uploads per check;
- no historical flood when establishing a baseline;
- missed uploads recovered oldest-first;
- fallback window gaps surfaced as source-health degradation;
- WebSub delivery streak reset when fallback proves missed delivery;
- healthy/degraded adaptive next-check intervals;
- quota accounting and reserve protection.

### P2.7 Source administration — COMPLETE

- YouTube channel validated before registration;
- source/source-identity/channel-state/health/title-scope registration is atomic;
- same-channel registration serialized with a Postgres transaction advisory lock;
- re-registration updates the existing graph rather than creating duplicates;
- candidate scope replace operation validates all requested entities;
- source disable path;
- optional idempotent WebSub subscribe after registration;
- primary-key conflict targets avoid PL/pgSQL output-variable ambiguity.

### P2.8 Runtime gateway and database-access policy — COMPLETE

- WebSub callback explicitly permits provider access without a user JWT;
- internal functions explicitly use independent internal-key authentication;
- function gateway behavior is version-controlled in `supabase/config.toml`;
- Phase-2 Data API objects are explicitly available to `service_role`;
- `anon` and `authenticated` receive no Phase-2 internal table/queue-RPC access;
- RLS remains enabled on internal tables;
- local Supabase database target is PostgreSQL 17 to match new hosted-project parity.

### P2.9 Maintenance worker — COMPLETE

- due-renewal selection;
- recent in-flight renewal suppression;
- stale verification timeout -> `ERROR`;
- expired active lease -> `EXPIRED`;
- visible source-health degradation;
- renewal calls delegated through the same idempotent subscription-admin path.

### P2.10 CI / test hardening — COMPLETE

Current merge gate includes:

- strict TypeScript compilation;
- Phase-1 intelligence benchmark retained;
- YouTube connector/planning/fallback canaries;
- Deno type-checks for all seven current Edge Functions;
- clean PostgreSQL 17 Supabase migration startup;
- **25 pgTAP database assertions** covering connector behavior, unresolved resolution, idempotent queueing, canonical-event dedupe/evidence, transactional source registration and server-only Data API privileges;
- Postgres `db lint --level error` gate;
- duplicate branch/PR workflow runs removed.

The hosting-parity hardening run is green across all three CI jobs.

## Current Edge Functions

- `youtube-websub`
- `youtube-source-admin`
- `youtube-subscription-admin`
- `youtube-enrichment-worker`
- `process-raw-item-worker`
- `youtube-fallback-worker`
- `youtube-maintenance-worker`

## Current recurring cost

**₹0/month during repository/local/CI implementation.**

No dedicated hosted CineRelay Supabase project, paid X reads, or other paid ingestion service has been created by Phase 2 so far.

## Hosted pilot — next milestone

The repository implementation gate is complete. The next milestone is a dedicated hosted CineRelay environment followed by a deliberately small 3–5-channel canary pilot.

Pilot sequence is defined in `PHASE2_YOUTUBE_OPERATIONS.md`.

Required evidence before Phase 2 can be marked fully complete:

- WebSub challenge succeeds on a real public callback;
- signed real upload notification received;
- video enrichment persisted;
- raw item produces the correct title/event;
- repeated/duplicate evidence does not spam the feed;
- fallback canary succeeds;
- renewal generation succeeds without a delivery gap;
- source-health states are observable;
- latency and quota usage are measured.

## Hosted prerequisites

Before the pilot can run:

1. provision a dedicated CineRelay Supabase project in the explicitly selected Supabase organization;
2. configure `CINERELAY_WEBSUB_MASTER_SECRET`;
3. configure `CINERELAY_INTERNAL_ADMIN_SECRET`;
4. configure a restricted `YOUTUBE_API_KEY` with YouTube Data API v3 enabled;
5. apply the committed migrations and deploy the seven Edge Functions;
6. configure the bounded worker schedules;
7. seed only the small title/entity scope needed for the canary channels.

No existing Movie Newsroom or FrameByNavin Creator OS project should be repurposed implicitly.

## Do not start yet

Until the hosted canary evidence is complete, do not jump ahead to:

- polished internal web console;
- large 25–50 channel onboarding;
- Android UI;
- Instagram/X ingestion;
- broad web scraping;
- expensive AI enrichment.

_Last updated: 2026-09-14_
