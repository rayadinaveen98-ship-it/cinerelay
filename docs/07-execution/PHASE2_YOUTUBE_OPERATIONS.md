# Phase 2 — YouTube Connector Operations

Status: implementation runbook for the Phase-2 YouTube production connector.

This document describes how the code in `phase-2/youtube-connector` is expected to run once a hosted Supabase project is intentionally provisioned. It does **not** authorize silently creating a paid resource or committing secrets.

## Runtime principle

WebSub is the primary real-time path. The YouTube Data API enriches only targeted channels/videos. The uploads playlist is a sparse safety net, not the primary polling mechanism.

```text
Official YouTube channel
        |
        | WebSub push
        v
youtube-websub
        |
        v
YOUTUBE_ENRICH_VIDEO job
        |
        v
youtube-enrichment-worker
        |
        +--> raw_items + raw_item_revisions
        |
        v
PROCESS_RAW_ITEM job
        |
        v
process-raw-item-worker
        |
        v
resolution -> classification -> canonical event/evidence

Sparse safety path:
youtube-fallback-worker -> uploads playlist -> missing video jobs

Lease health path:
youtube-maintenance-worker -> renew/expire/timeout WebSub leases
```

## Required hosted secrets

Never commit these values.

- `CINERELAY_WEBSUB_MASTER_SECRET`
  - high-entropy server secret;
  - used to derive callback tokens and per-generation WebSub HMAC secrets;
  - derived credentials are reproducible but the master secret is never stored in connector tables.
- `CINERELAY_INTERNAL_ADMIN_SECRET`
  - independent high-entropy secret used by internal admin/worker HTTP endpoints;
  - send only through `x-cinerelay-internal-key`.
- `YOUTUBE_API_KEY`
  - Google API key with YouTube Data API v3 enabled;
  - restrict the key to the YouTube Data API wherever the Google project configuration permits.

Supabase-provided runtime values such as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are consumed server-side only.

## Function exposure contract

All functions explicitly use `verify_jwt = false` in `supabase/config.toml` because they do not use end-user Supabase Auth.

That does **not** mean every endpoint is unprotected.

### Public provider callback

`youtube-websub`

- must be reachable by the YouTube/WebSub hub;
- callback URL contains an unguessable derived token;
- notification body signature is validated with the generation-specific derived HMAC secret;
- wrong token, topic, channel, signature or oversized payload is rejected/ignored according to the connector contract;
- no internal admin secret is accepted as a substitute for WebSub verification.

### Internal-only functions

These require `x-cinerelay-internal-key`:

- `youtube-source-admin`
- `youtube-subscription-admin`
- `youtube-enrichment-worker`
- `process-raw-item-worker`
- `youtube-fallback-worker`
- `youtube-maintenance-worker`

They are service endpoints, not public product APIs.

## Source onboarding flow

Use `youtube-source-admin` rather than manually inserting connector rows.

Registration performs:

1. strict channel-ID validation;
2. targeted `channels.list` verification;
3. transactional source/source-identity registration or reactivation;
4. uploads-playlist capture;
5. source-health initialization;
6. bounded movie/series candidate-scope replacement;
7. optional idempotent WebSub subscription request.

Re-registering a channel updates the same source graph. It must not create a duplicate source parent, identity or unnecessary subscription generation.

## Source candidate scope

A YouTube source is not resolved against the entire future CineRelay catalog.

`source_entity_candidates` defines the active title universe for that source. For example, a production-house channel may currently cover several announced films and series. The raw-item resolver evaluates those candidates and their aliases only.

This is a precision and scale safeguard.

## Worker scheduling

When the hosted pilot begins, use Supabase Cron + `pg_net` or the platform's Edge Function scheduling UI. Project URL and the internal worker secret should be stored as secrets/Vault values rather than embedded in SQL.

Recommended initial schedules:

| Function | Trigger cadence | Internal behavior |
| --- | --- | --- |
| `youtube-enrichment-worker` | every 1 minute | leases a bounded batch of `YOUTUBE_ENRICH_VIDEO` jobs |
| `process-raw-item-worker` | every 1 minute | leases a bounded batch of `PROCESS_RAW_ITEM` jobs |
| `youtube-maintenance-worker` | every 10–15 minutes | renews due leases, expires dead leases, detects verification timeouts |
| `youtube-fallback-worker` | every 15 minutes | checks only source rows whose own `next_fallback_check_at` is due |

The fallback worker currently spaces healthy sources at roughly six hours and stale/degraded sources at roughly thirty minutes. Cron frequency therefore does not equal per-channel polling frequency.

## Quota policy

Current connector policy is versioned in `YOUTUBE_QUOTA_POLICY_V1`.

- ordinary general-read budget baseline: 10,000 units/day;
- `channels.list`: 1 unit/request;
- `videos.list`: 1 unit/request and video IDs are batched;
- `playlistItems.list`: 1 unit/request;
- `search.list` is not used for routine monitoring;
- 500 general-read units are reserved by worker guards rather than consuming the entire daily allowance;
- quota accounting uses the YouTube Pacific-Time reset day.

A quota denial degrades gracefully: work is retried and source health becomes visible rather than silently dropping events.

## WebSub lease lifecycle

Each subscription has a monotonically increasing generation.

- Initial request creates generation 1.
- Renewal creates a new generation while the current active generation remains live.
- Only after the hub verifies the new callback does activation atomically supersede older generations.
- A recent `PENDING`/`RENEWING` generation blocks duplicate renewal attempts.
- Verification requests that remain unconfirmed beyond the maintenance timeout become `ERROR`.
- Active leases that expire before replacement become `EXPIRED` and source health degrades.

This avoids both delivery gaps and renewal storms.

## Upload fallback behavior

The fallback worker reads at most the latest 50 uploads from the channel's uploads playlist.

- No previous baseline: store the newest video as baseline; do not flood CineRelay with historical uploads.
- Previous video found: enqueue any newer missing uploads oldest-first.
- Previous video outside the 50-item window: enqueue the available window, increment `fallback_gap_count`, and mark the source degraded for investigation.

The fallback is a safety mechanism for missed WebSub deliveries, not a replacement for WebSub.

## Revision policy

A YouTube video can change after upload.

`videos.list` projections are fingerprinted from stable structured metadata. `upsert_raw_item_revision`:

- preserves the current raw-item projection;
- adds a revision only when the fingerprint changes;
- clears temporary unavailable state if the item reappears;
- enqueues intelligence processing only for a new or meaningfully changed revision.

## Failure policy

No connector error should disappear silently.

- Jobs use bounded leasing and retry backoff.
- Exhausted jobs become `DEAD_LETTER`.
- Source failures surface through `source_health`.
- Quota exhaustion surfaces as `BUDGET_EXHAUSTED`.
- WebSub staleness, lease expiry and fallback-window gaps surface as explicit health codes.
- Invalid/ambiguous/unresolved entity matches are recorded rather than forced into a movie.

## CI gate before hosted pilot

Every change must pass:

1. strict TypeScript build;
2. Phase-1 intelligence benchmark;
3. YouTube connector canaries;
4. Deno type-check for every Edge Function;
5. clean local Supabase migration rebuild;
6. pgTAP database invariants;
7. Postgres function lint at error level.

## Hosted pilot sequence

Do not start with 50 channels on day one.

1. Provision one intentional free Supabase hosted project when ready.
2. Configure secrets.
3. Apply migrations and deploy functions.
4. Configure worker schedules.
5. Register 3–5 canary official channels with known active title scopes.
6. Confirm WebSub challenge and signed delivery end to end.
7. Observe at least several real upload/revision events and compare against the official channels manually.
8. Measure latency, duplicate rate, entity accuracy, fallback recovery and quota use.
9. Expand to roughly 25–50 high-value official channels only after the canaries are healthy.

## Phase-2 hosted exit evidence

Before Phase 2 is marked fully complete, record:

- successful WebSub lease(s);
- at least one real official upload delivered through WebSub;
- targeted enrichment persisted as a raw item/revision;
- correct title/event mapping with original evidence;
- no duplicate canonical feed event for repeated evidence;
- fallback canary result;
- lease-renewal result;
- source-health screenshot/query evidence;
- measured quota use and observed delivery latency.

Until that hosted evidence exists, Phase 2 may be **implementation-complete / pilot-pending**, but not fully production-verified.

_Last updated: 2026-09-14_
