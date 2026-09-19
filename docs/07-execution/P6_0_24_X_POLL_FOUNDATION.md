# P6.0.24 — Dormant X Poll Foundation

Status: **IMPLEMENTED AND CI-COVERED; HOSTED ACTIVATION BLOCKED ON X API CREDENTIALS**

## Goal

Make the X source registry activation-ready without turning on unverified or potentially billable ingestion.

## Database foundation

Hosted migration: `20260918090745_p6_0_24_x_poll_foundation`

Repository migration: `supabase/migrations/20260918090745_p6_0_24_x_poll_foundation.sql`

Adds service-role-only `x_profile_source_state` with durable username/user-id/checkpoint, health cadence, failure and gap state. `register_x_profile_source(uuid,text,text)` validates that the source identity is active X / `X_API_V2` / API before creating state.

## Worker

`supabase/functions/x-profile-poll-worker`

The worker:

- requires the internal CineRelay key;
- returns `x_api_not_configured` when `X_API_BEARER_TOKEN` is absent;
- resolves official handles to numeric X user IDs;
- polls original user posts using `since_id`;
- excludes replies and reposts;
- performs a baseline without historical raw-item flooding;
- normalizes new posts through `upsert_raw_item_revision`;
- enqueues the ordinary `PROCESS_RAW_ITEM` pipeline;
- records connector runs/source health;
- honors `Retry-After` and `x-rate-limit-reset`;
- reports a gap/degraded state rather than pretending completeness when more than one unseen timeline page is pending.

## Scheduler / CI

Scheduler dispatch contains dormant action `x-profile-poll` -> `x-profile-poll-worker`.

CI type-checks and bundles the X worker and the root connector canaries. Browser secret scanning also rejects `X_API_BEARER_TOKEN` markers.

## Activation gate

No X source may become active and no X cron may be installed until a real X API credential succeeds in a hosted canary, baseline behavior is verified, and usage/rate-limit behavior is acceptable.
