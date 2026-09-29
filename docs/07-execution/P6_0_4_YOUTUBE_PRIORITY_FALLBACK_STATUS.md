# P6.0.4 — Priority-Aware YouTube Fallback Status

Date: 2026-09-16

Status: **ENGINEERING COMPLETE / HOSTED WORKER ACTIVE / HOSTED 5-MINUTE PROOF PASSED / FULL CI GREEN / ANDROID CANARY GREEN**

## Goal

Keep FrameByNavin-critical official YouTube sources on a dependable five-minute authoritative discovery safety net even when WebSub appears healthy, while preserving a lower-cost fifteen-minute cadence for normal-priority sources and a thirty-minute backoff during provider failures.

WebSub remains an accelerator. The uploads-playlist poller remains the authoritative gap detector and recovery path.

## Policy

`YouTubeDiscoveryPriority` now supports:

- `HIGH` — healthy authoritative discovery every 5 minutes;
- `NORMAL` — healthy authoritative discovery every 15 minutes.

Existing health overrides remain intact:

- `WEBSUB_MISSED_DELIVERY` or `FALLBACK_WINDOW_GAP` => 5 minutes;
- provider failure / quota protection path => 30 minutes regardless of priority.

Unspecified priority remains backward-compatible with `NORMAL`.

## Hosted source configuration

The four currently enrolled official YouTube sources are configured with:

```json
{"discoveryPriority":"HIGH"}
```

Sources:

- Geetha Arts (`@geethaarts`);
- Haarika & Hassine Creations (`@haarikahassine`);
- Mythri Movie Makers (`@mythrimoviemakers`);
- Sithara Entertainments (`@sitharaentertainments`).

The priority is stored in `source_identities.connector_config`; no schema migration was required.

## Worker wiring

`youtube-fallback-worker` now:

- reads `connector_config` for due active source identities;
- normalizes priority to `HIGH` or `NORMAL`;
- passes priority through every next-check decision;
- preserves 30-minute provider-failure backoff;
- records the priority in YouTube quota-request metadata;
- reports `highPrioritySources` in the worker response.

## Tests

YouTube planning/discovery canaries increased from 15 to 17 and prove:

1. NORMAL healthy cadence = 15 minutes;
2. HIGH healthy cadence = 5 minutes;
3. unspecified priority remains NORMAL;
4. a proven WebSub miss still forces 5 minutes;
5. provider failure overrides HIGH and backs off to 30 minutes.

Result: **17/17 passed**.

## CI proof

Implementation code head:

- `cf0f0562c05a468ab9a33c73c737fd22b2fdc971`.

CineRelay CI:

- run `35122122762` / #379;
- web-console: SUCCESS;
- intelligence-and-connectors: SUCCESS;
- database-migrations: SUCCESS;
- edge-functions: SUCCESS;
- `youtube-fallback-worker` strict type-check: SUCCESS;
- deployment-native Edge bundle: SUCCESS.

Android Canary CI:

- run `35122122763` / #45;
- mobile-apis: SUCCESS;
- Android privileged-secret scan: SUCCESS;
- V0.2 Gradle assemble: SUCCESS;
- APK/package verification: SUCCESS;
- APK upload: SUCCESS.

Deployment artifact used for promotion:

- artifact: `cinerelay-edge-deploy-bundle`;
- artifact id: `10457507435`;
- archive digest: `sha256:b3a6b267e16ba7e042334d78f1427280df0792330058e5658b639145672d0ba3`;
- exact bundled `youtube-fallback-worker/index.js` SHA-256: `77835ccfc5dd497dacc60c9b1076f75f4c006221f469911cfdb70c9072e4ff34`.

## Hosted deployment

`youtube-fallback-worker`:

- function id: `06ec532a-d9c3-4e7b-976f-6ba69cb222d6`;
- hosted version: `10`;
- status: `ACTIVE`;
- hosted runtime SHA-256: `9832f8c83a5f50eb5c025c671761b5a7e19b59d68a9417f559a53b86e689802c`;
- custom internal-key authorization remains in the function body; gateway JWT verification remains disabled consistently with the existing internal-worker contract.

The deployed worker came from the CI-built deployment-native bundle, not an ad-hoc source build.

## Hosted cadence proof

The four HIGH-priority sources were made due and the normal secured scheduler-dispatch path was invoked.

After the hosted v10 worker completed, every source had:

- `last_fallback_check_at = 2026-09-16 16:31:04.671+00`;
- `next_fallback_check_at = 2026-09-16 16:36:04.671+00`;
- scheduled interval = exactly **5.00 minutes**.

This included healthy Mythri Movie Makers and Sithara Entertainments, proving the five-minute interval came from priority policy rather than only from `WEBSUB_MISSED_DELIVERY` degradation.

The `cinerelay-youtube-fallback` cron already runs every five minutes, so dispatcher frequency does not weaken the source-level policy. YouTube enrichment continues every minute.

## WebSub health finding discovered during P6.0.4

All four current WebSub subscriptions had previously verified successfully, but `last_websub_at` remained null for every source.

Authoritative polling has already proven missed deliveries for:

- Geetha Arts;
- Haarika & Hassine Creations.

Those sources correctly carry `WEBSUB_MISSED_DELIVERY` health degradation. Mythri and Sithara remain healthy only because no post-subscription upload has yet proven a miss.

A forced non-disruptive renewal exercise then exposed intermittent Google hub HTTP `503` responses. Existing ACTIVE generations remain intact while replacement generations are attempted.

## Next slice

P6.0.5 should harden and re-prove WebSub without weakening callback security:

1. bounded retry/backoff for transient hub 429/5xx responses;
2. preserve the existing ACTIVE generation during failed renewal attempts;
3. re-run renewal through the maintenance path;
4. verify replacement generations activate;
5. continue ingress telemetry and prove the first real provider POST when a channel changes;
6. retain the five-minute HIGH-priority uploads-playlist safety net regardless of WebSub health.
