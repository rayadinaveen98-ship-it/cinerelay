# P6.0.14 — Feed Scheduler Alignment Status

Status: **HOSTED PROVEN**

Implementation head: `351a73d203d3845725fe0963ed333cb7079b2fd2`

## Problem proven in production

CineRelay feed polling runs from the 5-minute scheduler. Before P6.0.14, healthy `next_check_at` values were calculated from the exact worker start timestamp. A source checked at `18:20:01.913Z` therefore became due at `18:35:01.913Z`.

The scheduler itself fired at `18:35:00.062405Z`, before that due timestamp, so the source was skipped and would not be eligible again until the next 5-minute cron slot. This could turn an intended 15-minute cadence into roughly 20 minutes.

Hosted proof included 123Telugu and TeluguCinema feed state plus `cron.job_run_details` and scheduler-dispatch responses.

## Fix

`packages/feed-connector/src/index.ts` now aligns healthy successful scheduling to the current 5-minute scheduler boundary when execution begins within 90 seconds after that boundary.

This changes healthy success / HTTP 304 scheduling only.

Safety preserved:

- Retry-After remains exact.
- provider failures retain exact exponential backoff timing.
- rate-limit timing remains exact.
- parser/fetch failures are not pulled earlier onto the scheduler grid.

Regression coverage reproduces the hosted seconds-drift case and requires healthy `ACTIVE_15M` scheduling to return the exact scheduler-aligned target.

## CI proof

CineRelay CI #419 / run `35135975604`: **all green**.

- intelligence/connectors: success;
- feed connector regression suite: success;
- strict `feed-poll-worker` type-check: success;
- deployment-native Edge bundle: success;
- DB migrations + pgTAP: success;
- web console: success.

Android Canary #85 / run `35135975623`: **all green**.

- mobile APIs: success;
- Android build: success;
- APK/package verification: success;
- APK artifact upload: success.

Artifacts:

- Edge deploy bundle `10463315476`, digest `sha256:f56c3afe21e0395aeeb5a31004d0cc3473b265264417e4204c1dd38be9e5ac33`;
- CI-built `feed-poll-worker/index.js` SHA-256 `aea97392c56ff24757b1fbe09de79ea23ef85a3261a7eaad7d3589d940c25588`;
- Android APK artifact `10462114869`, archive digest `sha256:6dc5f53d4d40f0ae5bef9e3a1738b1fb9865fd2030541497c446253d25ad56e7`;
- extracted APK SHA-256 `47fb221b4272a1c24290eb168b3a92ae7391eba9fb130e079d6714884980fe51`.

## Hosted deployment

`feed-poll-worker` version **2 ACTIVE**.

- function id `caf81b50-a364-45da-86d4-3fd1a2d341b4`;
- deployment runtime SHA `c9746e6ed8e7f584e36b09fafeb3721f46616591bc7a5a6a3004789ba16158f7`;
- deployed from the exact CI-built deployment bundle;
- custom internal-key auth contract preserved (`verify_jwt=false`).

## Hosted canary

A controlled real-feed canary made only `123Telugu — Movie News` due before the normal 19:05 scheduler. No synthetic content was inserted.

Normal cron:

- cron start: `2026-09-16 19:05:00.062392+00`;
- scheduler feed-poll response: HTTP 200;
- due 1 / checked 1 / notModified 1;
- failed 0 / rateLimited 0 / gaps 0.

Worker result:

- actual feed check: `2026-09-16 19:05:03.253+00`;
- HTTP 304;
- source health HEALTHY;
- next `ACTIVE_15M` check: **`2026-09-16 19:20:00+00` exactly**;
- health `next_due_at`: **`2026-09-16 19:20:00+00` exactly**.

This proves that healthy polling no longer inherits worker execution seconds and can no longer miss the intended 5-minute scheduler slot for the previously observed reason.
