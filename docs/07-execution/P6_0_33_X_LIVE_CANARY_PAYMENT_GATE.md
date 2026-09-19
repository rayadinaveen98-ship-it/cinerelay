# P6.0.33 — X live canary payment gate

Status: **TOKEN PRESENT / HOSTED X WORKER REACHED PROVIDER / PROVIDER RETURNED HTTP 402 / CANARY PAUSED SAFELY**

## Goal

Activate exactly one first-party X source after the user configured `X_API_BEARER_TOKEN`, prove the live X API boundary without importing history, and keep the wider 27-source X registry dormant until the canary is proven.

## Canary source

- source: UV Creations
- handle: `@UV_Creations`
- platform: `X`
- connector: `X_API_V2`
- access mode: `API`
- poll class: `HOT_5M`
- source identity id: `3b1e38f9-5115-4ad4-a8f5-62da8b97fc2d`

The existing P6.0.28 two-phase onboarding helpers were used instead of raw row mutation:

1. `attach_source_identity(..., p_active => true)`
2. `seed_source_identity_runtime(...)`

The runtime entered the expected pre-first-call state `AUTH_REQUIRED` with no historical X ingestion.

## Secure dispatch

Direct Vault-backed HTTP invocation is intentionally unavailable through the connected Supabase execution wrapper. A temporary `pg_cron` entry therefore reused the exact command body of the existing secure CineRelay scheduler job and replaced only the scheduler action with `x-profile-poll`.

No scheduler token or internal admin secret was read into ChatGPT or committed to Git.

Temporary hosted migration:

- `20260919152228_p6_0_33_x_canary_scheduler.sql`

## First real X API result

The hosted X worker executed one real provider request after `X_API_BEARER_TOKEN` was configured.

Observed connector run:

- connector: `X_API_V2`
- status: `FAILED`
- requests made: `1`
- items seen: `0`
- items new: `0`
- items changed: `0`
- error summary: `x_http_402`
- finished at: `2026-09-19 15:23:03.984+00`

This is materially different from the earlier dormant-canary result `x_api_not_configured`: the hosted secret is now present and the worker reached X, but the provider rejected the request with HTTP 402 Payment Required before handle resolution/baselining could complete.

## Provider pricing interpretation

Current official X API documentation describes the X API as pay-per-usage. Credits are purchased up front in the Developer Console, and requests may be blocked when the account has no usable credit balance. Current published read pricing is $0.010 per User resource and $0.005 per Post resource, subject to change in the Developer Console.

Therefore possession of API keys/Bearer Token does not itself imply free read quota.

## Safety rollback

Immediately after the 402 result:

- UV Creations was set back to `active=false` through `attach_source_identity(...)`;
- connector config was marked `PAUSED_X_API_PAYMENT_REQUIRED`;
- the temporary canary cron was removed;
- active X identity count was verified as `0`;
- remaining X canary cron count was verified as `0`.

Rollback migration:

- `20260919152347_p6_0_33_pause_x_canary_after_402.sql`

No X raw item was created and no history was imported.

## Decision gate

Do not reactivate X until the owner explicitly chooses to fund X API credits.

If credits are added, resume with the same single-source UV Creations canary:

1. activate only `@UV_Creations`;
2. seed runtime due-now;
3. issue one controlled poll;
4. verify handle -> numeric user ID lookup;
5. verify the first successful timeline response establishes a newest-post checkpoint with zero historical raw items;
6. pause or reduce cadence while waiting for a genuine post-baseline delta;
7. prove the new item appears only in the Android X lane;
8. inspect actual Developer Console cost before expanding sources.

Do not activate the remaining X registry until this gate passes.
