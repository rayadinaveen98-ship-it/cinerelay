# Phase 2 — YouTube Connector Operations

Status: **hosted production-pilot runbook** for the Phase-2 YouTube connector.

The dedicated CineRelay Supabase project is now provisioned and running. This document describes the live operating model. It must not be interpreted as permission to commit secrets, widen source scope, or add paid dependencies without an explicit product decision.

## Runtime principle

WebSub is the primary real-time path. The YouTube Data API enriches only targeted channels/videos. The uploads playlist is a sparse safety net, not the primary polling mechanism.

```text
Official YouTube channel
        |
        | signed WebSub push
        v
youtube-websub
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

Sparse safety path:
youtube-fallback-worker -> uploads playlist -> missing video jobs

Lease health path:
youtube-maintenance-worker -> renew/expire/timeout WebSub leases

Hosted scheduling path:
pg_cron -> pg_net -> cinerelay-scheduler-dispatch -> internal worker
```

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

Supabase-provided values such as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` remain server-side only.

Scheduler material is separate:

- a scheduler dispatch token is generated inside Postgres;
- its encrypted value is stored only in Supabase Vault;
- only a SHA-256 hash is stored in `public.scheduler_credentials`;
- the hosted project URL is stored in Vault for cron dispatch;
- the scheduler token value is never committed or exposed to ChatGPT.

## Function exposure contract

All current functions use `verify_jwt = false` because these are provider/service endpoints rather than end-user Supabase Auth APIs. Each endpoint still has its own protection contract.

### Public provider callback

`youtube-websub`

- reachable by the WebSub hub;
- callback URL contains an unguessable derived token;
- notification body HMAC is verified with the generation-specific derived secret;
- wrong token/topic/channel/signature and oversized bodies are rejected/ignored according to connector rules.

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
- accepts only a fixed allow-list of four actions;
- cannot accept arbitrary upstream URLs or arbitrary request bodies;
- forwards only to the four expected internal workers using the existing internal admin secret.

## Active hosted schedules

| Cron job | Cadence | Target behavior |
| --- | --- | --- |
| `cinerelay-youtube-enrichment` | every 1 minute | lease bounded `YOUTUBE_ENRICH_VIDEO` jobs |
| `cinerelay-process-raw-item` | every 1 minute | lease bounded `PROCESS_RAW_ITEM` jobs |
| `cinerelay-youtube-maintenance` | every 10 minutes | renew due leases; detect timeout/expiry |
| `cinerelay-youtube-fallback` | every 15 minutes | inspect only channel rows whose own fallback time is due |

The fallback worker internally spaces healthy channels at roughly six hours and degraded/stale channels at roughly thirty minutes. The 15-minute cron cadence does not mean each channel is polled every 15 minutes.

Hosted proof already captured:

- database/Vault -> `pg_net` -> dispatcher -> raw worker returned HTTP 200;
- automatic enrichment and raw-processing jobs succeeded repeatedly across multiple minute ticks;
- maintenance dispatch returned HTTP 200;
- fallback dispatch checked all four pilot channels successfully with zero recovered gaps.

Manual PowerShell is no longer part of normal operation.

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

The current Tier-A pilot sources are:

1. Mythri Movie Makers
2. Sithara Entertainments
3. Haarika & Hassine Creations
4. Geetha Arts

Do not expand to a large channel set until the final hosted exit gates pass.

## Source candidate scope

A source is not resolved against the entire CineRelay catalog. `source_entity_candidates` defines the active movie/series/season universe for that source. This is a precision and scale safeguard.

The Family Pack canary demonstrated the intended behavior: one scoped title candidate, alias match, resolution score `0.98`, and a deterministic `PROJECT_ANNOUNCED` event with `Sankranthi 2027` represented as a release window rather than a fabricated exact date.

## Quota policy

Current policy is versioned in `YOUTUBE_QUOTA_POLICY_V1`.

- general-read baseline: 10,000 units/day;
- `channels.list`: 1 unit/request;
- `videos.list`: 1 unit/request and IDs are batched;
- `playlistItems.list`: 1 unit/request;
- `search.list` is not the routine monitoring backbone;
- 500 units remain reserved by worker guards;
- accounting follows the YouTube Pacific-time reset day.

Quota denial must degrade visibly rather than silently dropping work.

## WebSub lease lifecycle

Each source uses monotonically increasing generations.

- initial request -> generation 1;
- renewal creates a new generation while the current active generation remains usable;
- only a verified replacement becomes active;
- activation supersedes older generations atomically;
- recent `PENDING`/`RENEWING` rows block duplicate renewal storms;
- timed-out verification becomes `ERROR`;
- an active lease expiring without replacement becomes `EXPIRED` and degrades source health.

Current generation-1 pilot leases were verified on 2026-09-14. Their hosted `renew_after` values are around **2026-09-22 11:04 UTC** and their `expires_at` values are around **2026-09-24 11:04 UTC**.

## Upload fallback behavior

The fallback worker reads at most the latest 50 uploads from a channel's uploads playlist.

- no baseline: store newest video only; do not flood historical uploads;
- previous video found: recover newer missing uploads oldest-first;
- previous video outside the 50-item window: enqueue the available window, increment `fallback_gap_count`, and mark the source degraded.

Fallback is safety recovery. A fallback-only upload does **not** satisfy the final natural WebSub push exit gate.

## Revision policy

`videos.list` projections use a meaningful-content fingerprint. `upsert_raw_item_revision`:

- keeps the current raw-item projection;
- appends a revision only when the fingerprint changes;
- clears temporary unavailable state if an item reappears;
- queues intelligence only for a new or meaningfully changed revision.

The hosted pilot found a PL/pgSQL `ON CONFLICT` ambiguity in this path. It was fixed using a named constraint target and protected by regression tests.

## Failure policy

No connector error should disappear silently.

- jobs use bounded leases and retry backoff;
- exhausted work becomes `DEAD_LETTER`;
- failures surface through `source_health`;
- quota guard -> `BUDGET_EXHAUSTED`;
- lease/fallback problems surface with explicit health codes;
- ambiguous/unresolved entity results are persisted rather than force-matched.

## CI merge gate

Every change must pass:

1. strict TypeScript compilation;
2. contract alignment;
3. intelligence benchmark;
4. YouTube connector/planning/fallback canaries;
5. Deno checks for all eight Edge Functions;
6. deployment-native Edge bundle generation;
7. clean PostgreSQL-17 migration startup;
8. pgTAP invariants;
9. `db lint --level error`.

Current branch head was verified green in CI run **#105** across all three jobs.

## Hosted pilot exit gates

Most hosted evidence is complete: source registration, WebSub challenge, fallback baseline, targeted enrichment, raw/revision persistence, entity resolution, canonical event creation, dedupe, evidence, source health, quota visibility, and unattended recurring scheduling.

Two naturally time-dependent gates remain.

### Gate A — natural signed WebSub upload

Observe one genuinely new post-subscription upload arriving through signed WebSub and flowing automatically through enrichment + intelligence without manual replay. Record real push latency and verify no duplicate event spam.

### Gate B — real zero-gap renewal

Observe generation 2 being requested, verified and activated while generation 1 remains usable until superseded.

The exact monitoring queries and pass/fail conditions live in:

`docs/07-execution/PHASE2_HOSTED_PILOT_WATCH.md`

Until both gates pass, the correct Phase-2 state is:

**IMPLEMENTATION COMPLETE / HOSTED PILOT ACTIVE / FINAL LIVE-UPLOAD + RENEWAL EVIDENCE PENDING**

Do not merge PR #2 or begin broad Phase-3 product work before these gates are captured.

_Last updated: 2026-09-14_
