# Phase 2 Status — YouTube Production Connector

Date: 2026-09-14

## Overall state

**Phase 2: IMPLEMENTATION ACTIVE**

The production connector code path is substantially implemented locally/CI-first. Phase 2 is **not yet production-verified** because the hosted WebSub canary pilot has not been provisioned or observed.

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
- lease-expiry detection.

### P2.4 Targeted enrichment — COMPLETE

- batched `videos.list` enrichment;
- quota reserve guard;
- quota ledger;
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
- healthy/degraded adaptive next-check intervals;
- quota accounting and reserve protection.

### P2.7 Source administration — COMPLETE

- YouTube channel validated before registration;
- source/source-identity/channel-state/health/title-scope registration is atomic;
- same-channel registration serialized with a Postgres transaction advisory lock;
- re-registration updates the existing graph rather than creating duplicates;
- candidate scope replace operation validates all requested entities;
- source disable path;
- optional idempotent WebSub subscribe after registration.

### P2.8 Runtime gateway policy — COMPLETE

- WebSub callback explicitly permits provider access without a user JWT;
- internal functions explicitly use independent internal-key authentication;
- function gateway behavior is version-controlled in `supabase/config.toml`.

### P2.9 Maintenance worker — COMPLETE

- due-renewal selection;
- recent in-flight renewal suppression;
- stale verification timeout -> `ERROR`;
- expired active lease -> `EXPIRED`;
- visible source-health degradation;
- renewal calls delegated through the same idempotent subscription-admin path.

### P2.10 CI / test hardening — ACTIVE

Implemented:
- strict TypeScript compilation;
- Phase-1 intelligence benchmark retained;
- YouTube connector/planning/fallback canaries;
- Deno type-checks for every current Edge Function;
- clean local Supabase rebuild;
- pgTAP connector invariants;
- pgTAP source-registration idempotency tests;
- Postgres `db lint --level error` gate;
- duplicate branch/PR workflow runs removed.

The latest-head CI must be green before the implementation slice is considered merge-ready.

## Current Edge Functions

- `youtube-websub`
- `youtube-source-admin`
- `youtube-subscription-admin`
- `youtube-enrichment-worker`
- `process-raw-item-worker`
- `youtube-fallback-worker`
- `youtube-maintenance-worker`

## Current recurring cost

**₹0/month during local/CI development.**

No paid X reads, hosted CineRelay Supabase project, or other paid ingestion service has been introduced by this phase implementation.

## Hosted pilot — still required

A hosted project is intentionally deferred until the code/CI implementation gate is green.

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

## Do not start yet

Until the Phase-2 code gate and hosted canary evidence are complete, do not jump ahead to:

- polished internal web console;
- large 25–50 channel onboarding;
- Android UI;
- Instagram/X ingestion;
- broad web scraping;
- expensive AI enrichment.

_Last updated: 2026-09-14_
