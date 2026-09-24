# P6.0.5 — YouTube WebSub Resilience Hosted Proof

Date: 2026-09-16
Status: HOSTED-PROVEN FOR FAILURE SAFETY; PROVIDER DELIVERY STILL DEGRADED

## Goal

Make YouTube WebSub renewal safe under transient Google hub failures without sacrificing CineRelay newsroom freshness.

WebSub remains the acceleration path. The authoritative uploads-playlist fallback from P6.0.4 remains the freshness safety net.

## Final implementation

`youtube-subscription-admin` now:

- retries transient hub HTTP responses `429`, `500`, `502`, `503`, and `504`;
- retries transport exceptions with the same bounded retry clock;
- uses at most 3 hub attempts per renewal generation;
- uses 10-second per-attempt transport timeouts plus 250 ms / 750 ms retry delays;
- therefore stays inside the outer scheduler's 45-second request envelope;
- closes a failed replacement generation as `ERROR` instead of leaving it stuck in `RENEWING`;
- preserves the existing `ACTIVE` generation throughout replacement attempts;
- defers the next renewal attempt by 30 minutes after final replacement failure;
- never weakens callback-token or HMAC signature validation.

## CI proof

Final timeout-budget head:

- commit: `b486c90b91c60eb6e0ebba5739ba1c3663714f35`;
- CineRelay CI #391 / run `35124688408`: SUCCESS;
- Android Canary CI #57 / run `35124688414`: SUCCESS;
- CI deployment artifact: `cinerelay-edge-deploy-bundle` artifact `10458169672`;
- artifact digest: `sha256:5023a4a809844cabc02ac8a588e8aed23942d848f89e037432e1cb58d731c7aa`.

Connector/renewal tests cover:

- transient HTTP 503 retry;
- transport-exception retry;
- permanent client errors not retried;
- 30-minute failed-renewal deferral;
- existing P6.0.4 priority-aware fallback behavior.

## Hosted deployment

Function: `youtube-subscription-admin`

- version: `10` ACTIVE;
- runtime SHA: `753c979c86fc262e58e13163c5fed54cd455a056813293a7cfc127c30ac6cec9`;
- custom internal authentication remains enabled in-function;
- Supabase gateway JWT verification remains disabled intentionally for this internal/webhook-style function, matching the existing contract.

## Controlled hosted renewal proof

A single source was made due at a time and dispatched through the normal secured `cinerelay-scheduler-dispatch -> youtube-maintenance-worker -> youtube-subscription-admin` path.

### Mythri Movie Makers

- replacement generation 6 attempted under v10;
- scheduler request completed with HTTP 200 inside its 45-second envelope;
- replacement settled to `ERROR` with `hub transport failure after 3 attempt(s)`;
- original generation 1 remained `ACTIVE`;
- original renewal clock moved to approximately 30 minutes later.

### Sithara Entertainments

- replacement generation 4 attempted under v10;
- scheduler request completed with HTTP 200;
- replacement settled to `ERROR` with `hub transport failure after 3 attempt(s)`;
- original generation 1 remained `ACTIVE`;
- renewal clock deferred by approximately 30 minutes.

### Haarika & Hassine Creations

- replacement generation 3 attempted under v10;
- scheduler request completed with HTTP 200;
- replacement settled to `ERROR` with `hub transport failure after 3 attempt(s)`;
- original generation 1 remained `ACTIVE`;
- renewal clock deferred by approximately 30 minutes.

### Geetha Arts

- replacement generation 5 attempted under v10;
- scheduler request completed with HTTP 200;
- replacement settled to `ERROR` with `hub transport failure after 3 attempt(s)`;
- original generation 2 remained `ACTIVE`;
- renewal clock deferred by approximately 30 minutes.

## Current production state after proof

All four official YouTube source identities remain:

- active;
- `discoveryPriority = HIGH`;
- backed by a verified `ACTIVE` WebSub lease that has not been replaced or destroyed by the failed renewal canaries;
- protected by the P6.0.4 5-minute authoritative uploads-playlist fallback.

The fallback worker continues scheduling these HIGH sources at five-minute intervals under healthy provider conditions.

## What this proves

P6.0.5 proves renewal **failure safety and bounded orchestration**. It does not prove that Google WebSub provider delivery has recovered.

At the time of this proof, the Google hub continued to fail replacement requests through transport failures / earlier HTTP 503s. Therefore CineRelay must not claim WebSub delivery is restored merely because the local callback and renewal state machine are correct.

## Product behavior while provider delivery is degraded

The newsroom remains protected by the P6.0.4 contract:

1. HIGH-priority official YouTube sources are authoritatively checked every 5 minutes.
2. Raw useful source activity can surface immediately through the fast newsroom projection without waiting for canonical entity resolution.
3. WebSub remains an optional accelerator and may recover independently.
4. Failed WebSub renewal attempts do not suppress or delay authoritative fallback ingestion.

## Next

1. keep WebSub callback telemetry and delivery health visible without repeatedly hammering the provider;
2. preserve 5-minute HIGH-priority fallback until real push delivery is observed;
3. expand official Telugu cinema YouTube coverage using the same HIGH-priority newsroom contract;
4. add trusted official OTT/music/trailer sources where they materially improve FrameByNavin coverage;
5. keep provider/source provenance visible in every newsroom signal.
