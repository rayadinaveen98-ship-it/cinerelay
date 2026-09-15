# Phase 2 — YouTube Connector Operations

Status: **production-verified runbook** for CineRelay official YouTube ingestion.

The dedicated CineRelay Supabase project is provisioned and running unattended. This document describes the live operating model. It is not permission to commit secrets, widen source scope, or add paid dependencies without an explicit product decision.

## Runtime principle

The official YouTube uploads playlist is the **authoritative discovery path** for ingestion correctness. WebSub remains enabled as a best-effort low-latency accelerator. The YouTube Data API enriches only targeted channels/videos.

```text
Official YouTube channel
        |
        +------------------------------+
        |                              |
        | authoritative uploads list   | optional signed WebSub acceleration
        v                              v
youtube-fallback-worker*          youtube-websub
        |                              |
        +----------+-------------------+
                   |
                   v
          YOUTUBE_ENRICH_VIDEO job
                   |
                   | cron every minute
                   v
          youtube-enrichment-worker
                   |
                   +--> raw_items + raw_item_revisions
                   |
                   v
          PROCESS_RAW_ITEM job
                   |
                   | cron every minute
                   v
          process-raw-item-worker
                   |
                   v
     resolution -> classification -> canonical event/evidence

* legacy function slug retained for compatibility; operational role is
  authoritative uploads-playlist discovery.

Lease health path:
youtube-maintenance-worker -> renew/expire/timeout WebSub leases

Hosted scheduling path:
pg_cron -> pg_net -> cinerelay-scheduler-dispatch -> internal worker
```

A WebSub miss is an accelerator-health issue. It is not an ingestion correctness failure while authoritative discovery remains inside its bounded 50-upload window.

## Hosted project

- project name: `CineRelay`
- project ref: `dnqaejljfzwhsainpdxb`
- region: `ap-south-1`
- PostgreSQL: 17.6.x
- current recurring cost: `₹0/month`

## Required hosted secrets

Never commit or paste these values into issue/PR text:

- `CINERELAY_WEBSUB_MASTER_SECRET`
- `CINERELAY_INTERNAL_ADMIN_SECRET`
- `YOUTUBE_API_KEY`

Supabase-provided service-role material remains server-side only.

Scheduler material is separate:

- a scheduler dispatch token is generated inside Postgres;
- its encrypted value is stored only in Supabase Vault;
- only a SHA-256 hash is stored in `public.scheduler_credentials`;
- the hosted project URL is stored in Vault for cron dispatch;
- the scheduler token value is never committed.

## Function exposure contract

The connector functions use `verify_jwt = false` because they are provider/service endpoints rather than end-user Supabase Auth APIs. Each endpoint has independent authentication or webhook verification.

### Public provider callback

`youtube-websub`

- reachable by the WebSub hub;
- callback URL contains a derived unguessable token;
- notification body HMAC is verified with the generation-specific derived secret;
- wrong topic/channel/signature and oversized bodies are rejected/ignored according to connector rules;
- v9 records coarse ingress telemetry before token resolution so missing/unknown-token POSTs are observable;
- ingress telemetry never stores callback-token values, HMAC signature values, or rejected request bodies.

### Internal admin/worker endpoints

These require `x-cinerelay-internal-key`:

- `youtube-source-admin`
- `youtube-subscription-admin`
- `youtube-enrichment-worker`
- `process-raw-item-worker`
- `youtube-fallback-worker`
- `youtube-maintenance-worker`

### Scheduler dispatcher

`cinerelay-scheduler-dispatch`

- accepts the database-generated scheduler token, not the normal admin secret;
- accepts only a fixed allow-list of worker actions;
- cannot accept arbitrary upstream URLs or arbitrary request bodies;
- forwards only to expected internal workers using the internal admin secret.

## Active hosted schedules

| Cron job | Cadence | Target behavior |
| --- | --- | --- |
| `cinerelay-youtube-enrichment` | every 1 minute | lease bounded `YOUTUBE_ENRICH_VIDEO` jobs |
| `cinerelay-process-raw-item` | every 1 minute | lease bounded `PROCESS_RAW_ITEM` jobs |
| `cinerelay-youtube-maintenance` | every 10 minutes | renew due WebSub leases; detect timeout/expiry |
| `cinerelay-youtube-fallback` | every 5 minutes | dispatch authoritative discovery; worker checks only due channel rows |

Per-source authoritative discovery cadence:

- normal: **15 minutes**
- `WEBSUB_MISSED_DELIVERY` or bounded-window-risk source: **5 minutes**
- provider/API/quota failure: **30 minutes** backoff

The 5-minute cron cadence does not mean every healthy channel is polled every five minutes. `next_fallback_check_at` remains the per-source due gate; the field name is retained for schema compatibility.

Manual PowerShell is not part of normal operation.

## Source onboarding flow

Use `youtube-source-admin`; do not manually insert the source graph.

Registration performs:

1. channel-ID validation;
2. targeted `channels.list` verification;
3. atomic source/source-identity registration or reactivation;
4. uploads-playlist capture;
5. source-health initialization;
6. bounded entity-candidate scope replacement;
7. optional idempotent WebSub subscription.

Current Tier-A pilot sources:

1. Mythri Movie Makers
2. Sithara Entertainments
3. Haarika & Hassine Creations
4. Geetha Arts

## Source candidate scope

A source is not resolved against the entire CineRelay catalog. `source_entity_candidates` defines the active movie/series/season universe for that source. This protects precision and scale.

The Family Pack canary demonstrated the intended resolved behavior: one scoped title candidate, alias match, resolution score `0.98`, deterministic `PROJECT_ANNOUNCED`, and `Sankranthi 2027` represented as a release window rather than a fabricated exact date.

The Haarika production discovery canary `C6R0LkeURFo` demonstrated the opposite but equally important behavior: ingestion and processing succeeded while current source scope returned `UNRESOLVED / 0`; no entity or event was invented.

## Quota policy

Current policy is versioned in `YOUTUBE_QUOTA_POLICY_V1`.

- general-read planning baseline: 10,000 units/day;
- `channels.list`: 1 unit/request;
- `videos.list`: 1 unit/request and IDs are batched;
- `playlistItems.list`: 1 unit/request;
- `search.list` is not the routine monitoring backbone;
- 500 units remain reserved by worker guards;
- quota denial degrades visibly rather than silently dropping work.

Production evidence after the 2026-09-15 migration canary remained tiny: 14 playlist reads and 4 video reads recorded for the day at that checkpoint.

## Authoritative uploads discovery behavior

The discovery worker reads at most the latest 50 items from a channel's uploads playlist.

- no baseline: store newest video only; do not flood historical uploads;
- previous video found: enqueue newer uploads oldest-first;
- previous video outside the 50-item window: enqueue the available window, increment `fallback_gap_count`, and mark the source degraded;
- new jobs use `discoveredBy = UPLOADS_PLAYLIST_PRIMARY`;
- request accounting is tagged `role = AUTHORITATIVE_DISCOVERY`.

`fallback_gap_count` is the critical correctness alarm. It must remain zero during normal operation.

## WebSub accelerator behavior

WebSub remains useful when the upstream publisher/hub delivers reliably because it can reduce latency below the polling cadence.

A successful WebSub delivery:

- is HMAC-verified;
- creates an idempotent receipt;
- queues the same targeted enrichment pipeline;
- updates WebSub delivery health;
- may clear `WEBSUB_MISSED_DELIVERY`.

A missed WebSub delivery does not block ingestion. Authoritative discovery detects the upload and marks the source `DEGRADED / WEBSUB_MISSED_DELIVERY` so accelerator reliability remains visible.

### v9 ingress telemetry

Before token resolution, POST ingress is bucketed into:

- `MATCHED`
- `UNKNOWN`
- `MISSING`
- `TOO_LONG`

This telemetry is stored under provider `YOUTUBE_WEBSUB_INGRESS` with coarse request metadata only.

Controlled production request `2971` proved a missing-token POST is now visible while still returning `404`.

## WebSub lease lifecycle

Each source uses monotonically increasing generations.

- initial request -> generation 1;
- renewal creates a new generation while the current active generation remains usable;
- only a verified replacement becomes active;
- activation supersedes older generations atomically;
- recent `PENDING`/`RENEWING` rows block duplicate renewal storms;
- timed-out verification becomes `ERROR`;
- an active lease expiring without replacement becomes `EXPIRED` and degrades accelerator health.

Gate B was production-proven on 2026-09-14: Geetha generation 2 verified through the real Google hub while generation 1 remained usable until replacement activation.

## Revision policy

`videos.list` projections use a meaningful-content fingerprint. `upsert_raw_item_revision`:

- keeps the current raw-item projection;
- appends a revision only when the fingerprint changes;
- clears temporary unavailable state if an item reappears;
- queues intelligence only for a new or meaningfully changed revision.

The hosted pilot found and fixed a PL/pgSQL `ON CONFLICT` ambiguity in this path; regression tests protect it.

## Source-health ownership

Shared source health is subsystem-aware.

- enrichment success clears only enrichment-owned failures;
- WebSub/discovery/subscription errors cannot be erased by unrelated worker success;
- authoritative discovery may continue to ingest correctly while WebSub health remains degraded;
- a real WebSub success remains the recovery signal for `WEBSUB_MISSED_DELIVERY`.

## Failure policy

No connector error should disappear silently.

- jobs use bounded leases and retry backoff;
- exhausted work becomes `DEAD_LETTER`;
- failures surface through `source_health`;
- quota guard -> `BUDGET_EXHAUSTED`;
- API failures -> visible discovery/enrichment errors;
- bounded-window failure -> `FALLBACK_WINDOW_GAP` plus counter increment;
- ambiguous/unresolved entity results are persisted rather than force-matched.

## Production verification

CineRelay CI `#132` / run `34959975534` passed all three jobs at implementation head `58854a4413f35ceb8e7fbca2452b23513f6d8e07`.

Deployment artifact:

- `cinerelay-edge-deploy-bundle`
- id `10393330447`
- digest `sha256:9d8f75d6ab50763056b7e92a9c0235b1b954f512cd4b9366f724ab04aa5b7a17`

Production versions from that artifact:

- `youtube-websub` v9
- `youtube-fallback-worker` v9

Production scheduler request `2975` checked all four pilot sources, discovered one real Haarika upload, reported `gapSources = 0`, and completed the resulting enrichment and processing automatically.

See `PHASE2_AUTHORITATIVE_DISCOVERY_PROOF_2026-09-15.md`.

## CI merge gate

Every connector change must pass:

1. strict TypeScript compilation;
2. contract alignment;
3. intelligence benchmark;
4. YouTube connector/planning/discovery canaries;
5. Deno checks for all eight Edge Functions;
6. deployment-native Edge bundle generation;
7. clean PostgreSQL-17 migration startup;
8. pgTAP invariants;
9. `db lint --level error`.

## Phase-2 completion

Phase 2 is **COMPLETE / PRODUCTION-VERIFIED**.

Natural WebSub delivery is now an operational accelerator metric rather than an exit gate. Correctness is guaranteed by the authoritative uploads-playlist discovery path plus bounded-window detection, quota controls, and downstream idempotency.

PR #2 may merge after the final documentation-consistent CI pass.

_Last updated: 2026-09-15_
