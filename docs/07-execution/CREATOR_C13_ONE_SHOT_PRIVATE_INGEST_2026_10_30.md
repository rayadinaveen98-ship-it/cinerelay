# CineRelay C13 — operator-confirmed, one-shot private YouTube activity ingest

**30 October 2026 · source-only draft · not deployed · monitoring remains OFF**

## What is implemented
- Isolated Edge Function `cinerelay-creator-activity-ingest`, **disabled by default** and not linked to any consumer UI, scheduler, alerts, or existing YouTube cinema-source pipeline.
- A single POST can audit **one explicitly allowlisted official UC channel** only after the active Supabase Auth operator is verified, the operator supplies `x-cinerelay-audit-intent: ONE_SHOT_PUBLIC_ACTIVITY`, the time-limited ID allowlist includes the channel, and all quota settings pass validation.
- The allowlist must be a comma-separated list of at most 20 stable UC IDs in a **server-side secret**, expiring within seven days of invocation. It is not determined by the public request body or old C10 Git snapshots.
- An existing nonexpired channel observation from the prior 24 hours rejects a repeat. This is a best-effort guard, not a fully transaction-serialized per-channel idempotency lock; production rollout also requires a DB-level duplicate/race review.
- The service-only `creator_c13_reserve_public_activity_quota()` Postgres RPC reserves **two public YouTube GENERAL_READ units** atomically, before network access, using the Pacific-day audit ledger and an explicit quota reserve for existing sources. No refunds/retries after errors.
- The provider reads are restricted to **one `channels.list`** request and **one `playlistItems.list`** request (max three public videos). Both cost one unit each per official documentation.
- Parser enforces exact stable channel ID and matching `UU...` uploads playlist, validates public decimal count fields, returns `null` for hidden subscriber counts, validates video IDs and dates, and rejects malformed responses.
- Exactly one private `creator_intelligence_activity_observations` row is upserted with an expiry **28 days after the observation**. C12's service-only RLS, 29-day upper bound, hourly purge and expired-row filtering remain in place. No provider data is committed to Git.
- The endpoint's response includes only success status, channel ID, observation time, expiry time and disabled monitoring/comparison flags. It does not expose raw counter values or any API credential.
- Six mock-driven Node safety tests, database pgTAP reservation tests, strict Deno function type-check and existing full repository CI.

## Server-side configuration — NOT set, do not set yet

All values must be provided only through approved Supabase Edge Function secrets. The **GitHub Actions** `YOUTUBE_API_KEY` used by C2/C11 is not automatically available to Supabase Functions.

| Variable | Gate |
|---|---|
| `CINERELAY_C13_ACTIVITY_INGEST_ENABLED` | `false`/unset by default; `true` only after independent approval |
| `YOUTUBE_API_KEY` | Dedicated restricted server-side YouTube Data API key; never exposed to client |
| `CINERELAY_C13_ALLOWED_CHANNEL_IDS` | Time-limited, reviewed canonical UC IDs; no consumer input is used as allowlist |
| `CINERELAY_C13_ALLOWED_UNTIL` | UTC expiry within the next seven days |
| `CINERELAY_C13_VERIFIED_GENERAL_READ_DAILY_LIMIT` | Actual project-specific verified quota cap, integer 2 to 10,000 |
| `CINERELAY_C13_GENERAL_READ_RESERVE` | At least 1,000 units reserved for existing CineRelay services |

Supabase automatically injects the URL and legacy service-role key in supported deployments; their values remain exclusively server-side. This implementation also requires the active operator allowlist already in the project. Gateway JWT validation is explicitly ON for this new function, and the function independently checks the user session and active operator status.

## Known release blockers

1. **Historical C11 source-controlled API observations still require Git history remediation.** A clean C12/C13 branch is not enough: close/retire old PR #109 safely, verify inaccessible raw blobs and caches/forks, and get GitHub help if necessary. Also evaluate older C2/C10 official channel metadata retention.
2. **C12 migration and Edge operator API are still draft-only**; do not deploy this function before C12 storage, operator read API, 29-day purge and retention backstops are verified in hosted infrastructure. Backups/logs/exports require an explicit retention assessment.
3. **Daily Google Cloud quota has not been independently verified for this new function.** The local ledger is incomplete with respect to external YouTube usage. Set approved headroom/reserve values only after confirmation.
4. **Operator review and scope approval** for each pilot UC ID are pending. Identity verification does not imply channel suitability or permission for monitoring/derived metrics.
5. Per-channel concurrency/idempotency, post-write read-back, audit finalization and multi-region duplicate checks should be strengthened before shipping.
6. **No production deployment, no new API calls, no scheduling, no Android APK.** C6 cross-channel performance comparisons remain permission-locked; existing 185 cinema sources remain unchanged.

## Offline verification
```bash
node tests/youtube-connector/run-creator-c13-one-shot.mjs
npm run test:youtube
```
The standard `phase-1-ci.yml` now type-checks this isolated Deno Edge Function and executes all pgTAP tests against ephemeral CI Postgres.

Official references:
- https://developers.google.com/youtube/data/reference/rest/v3/channels/list
- https://developers.google.com/youtube/data/reference/rest/v3/playlistItems/list
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/guides/functions/secrets
