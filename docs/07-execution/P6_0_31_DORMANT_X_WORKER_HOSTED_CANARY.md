# P6.0.31 — Dormant X Worker Hosted Canary

Status: **DEPLOYED / HOSTED CANARY PASSED; LIVE X INGESTION REMAINS OFF**

## Goal

Prove the CI-covered X worker can be safely hosted before any X developer credential, recurring cron, or source activation exists.

## Deployment

Worker:

`x-profile-poll-worker`

Hosted version:

- version: `1`
- status: `ACTIVE`
- `verify_jwt=false` because the worker uses CineRelay's internal-key authentication contract
- runtime bundle SHA: `5b588c7f99bf4bc3245baa90e056d8345cc8bcc44ce2db6481e9f37aef025c83`

The deployed source came from the CI deployment artifact generated on implementation head `fe5b5ae0cf5b26185836991288095e3af8fa3bc3`.

CI artifact:

- `cinerelay-edge-deploy-bundle`
- artifact id: `10541008252`
- artifact digest: `sha256:58ccd57ba0db91a6dc16f49b234f714a79bdc807530da8a68d0323730fd8c3ba`

Exact CI-built X worker files:

- `index.js` SHA-256: `a95a0163622395301980465acca10744312ada5e7836b73fed84df2d9633449c`
- `deno.json` SHA-256: `7546015061833799e902e913afc164779ed579015ac657d3fb66b1201f5f0415`

## Production canary

A single manual call was sent through the normal production scheduler dispatch path:

`x-profile-poll`

Request id:

`14084`

Result:

- scheduler HTTP: `502`
- upstream X worker HTTP: `503`
- sanitized upstream error: `x_api_not_configured`
- timed out: `false`

This is the expected hard gate while `X_API_BEARER_TOKEN` is absent.

## No-activation proof

Immediately after the canary:

- registered X identities: **27**
- active X identities: **0**
- X cron jobs: **0**
- X connector runs: **0**

The only existing `x_profile_source_state` row is the previously seeded dormant UV Creations proof row. It remains:

- `x_user_id = NULL`
- `last_checked_at = NULL`
- `last_successful_fetch_at = NULL`
- `next_check_at = NULL`
- `last_post_id = NULL`
- `consecutive_failures = 0`
- `gap_count = 0`

Therefore the hosted worker can exist without causing X network activity, polling, billing, source mutation, or historical ingestion.

## Activation boundary remains locked

Do **not**:

- install an X cron;
- set any X identity `active=true`;
- seed due polling state for the remaining registry;
- claim X ingestion is live.

Activation still requires a real X developer bearer token, confirmation that the required lookup/timeline endpoints are available under the current X API access model, a controlled handle-resolution canary, a no-history baseline, rate-limit/usage observation, and then a genuine post-baseline delta.
