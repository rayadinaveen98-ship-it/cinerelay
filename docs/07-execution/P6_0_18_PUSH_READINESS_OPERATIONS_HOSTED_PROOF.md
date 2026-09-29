# P6.0.18 — Push Readiness Operations Hosted Proof

Status: **implemented, CI-green, preview-deployed, and Edge-hosted**.

## Goal

Make push readiness visible to operators without changing alert planning or delivery semantics.

P6.0.17 remains the safety boundary: raw items cannot create alert outbox rows. P6.0.18 is observability only.

## Implementation

The operator-only `cinerelay-console-api` Operations response now includes `pushReadiness` with:

- active FCM device count
- distinct users with an active device
- active entity follow count
- distinct users with an active follow
- users who currently have both an active device and an active follow (`pushReadyUsers`)
- active canonical `DEVELOPING` event count
- HIGH/CRITICAL canonical `DEVELOPING` event count
- device users following an entity that currently has a canonical `DEVELOPING` event (`developingTargetUsers`)
- PUSH outbox counts for `PENDING`, `DEFERRED`, `SENT`, `FAILED`, and `SUPPRESSED`

The web Operations page displays these metrics in a dedicated **Push readiness** panel and explains that raw newsroom signals remain intentionally excluded from push planning until canonicalized.

No alert planner, push-delivery worker, entity resolver, newsroom trust mapping, or device-registration behavior changed in this slice.

## Security contract

`cinerelay-console-api` still performs its existing bearer-session validation plus active `operator_users` authorization before returning Operations data. `verify_jwt=false` is preserved intentionally because authentication is implemented inside the function body, matching the prior production deployment contract.

No service-role credential is exposed to the browser bundle.

## CI proof

Implementation head: `61fdca154425bbe6d0364158a36040882c5536db`

CineRelay CI #425 (`35182335197`) is fully green:

- `npm run ci` — PASS
- web console build — PASS
- static-host/browser security verification — PASS
- strict Deno type-check for `cinerelay-console-api` — PASS
- all other Edge type-checks — PASS
- deployment-native Edge bundle build — PASS
- database migrations/pgTAP/lint — PASS

Android Canary #91 (`35182335186`) is fully green:

- mobile API type-check/bundle — PASS
- Android secret scan — PASS
- APK build — PASS
- package verification — PASS
- APK artifact upload — PASS

## CI artifacts

- Edge deploy artifact: `cinerelay-edge-deploy-bundle`, artifact `10480742597`, artifact digest `sha256:36f50d2bf4e11651a50601caedc77dc6b6f4100e25975ffb4b92fdf653f083c0`
- CI-built `cinerelay-console-api/index.js` SHA-256: `0300d631719bdb21eb9758aa4877bb1a52b2a26fe23f20e204bf43cae1912355`
- Web artifact: `cinerelay-web-console-dist`, artifact `10480253157`, digest `sha256:666b1cede0dafacd9bb565e5df7a2c00c44d938a80867289ffcce693c09a7e42`
- Android artifact: `cinerelay-android-v0.2.0-canary-apk`, artifact `10481375128`, artifact digest `sha256:d7d6873f077426e1cb9e2364aea23b9f60de345b21fd7276470f721c7691cd63`
- Extracted APK SHA-256: `cc80ec4e199499d227028dd2eda2c0da7a819b817adb79835c87500f46763ebc`

## Hosted deployment proof

The exact CI-built console API artifact was deployed without source reconstruction.

Hosted function after rollout:

- function: `cinerelay-console-api`
- version: **6**
- status: **ACTIVE**
- `verify_jwt`: `false` (existing custom-auth contract)
- runtime SHA: `0d0f5e7de7c234faf12699f51b30be6f3c9c3832f895f17b725c19567f4b425f`

A post-deployment source read confirmed that hosted v6 contains the `pushReadiness` metric logic and the existing operator authentication gate.

## Web preview proof

Cloudflare Pages check passed for the implementation head.

- status: **Deployed successfully**
- commit: `61fdca1`
- preview: `https://b96a74f8.cinerelay-console.pages.dev`
- branch preview: `https://phase-6-android-v0-2-premium.cinerelay-console.pages.dev`

## Honest limitation

This execution environment does not hold the user's authenticated operator browser session/bearer token, so an authenticated `operations` response or screenshot was not fabricated here.

The last hosted production readiness observation before this slice had zero active FCM devices, zero active follows, and zero alert rows. P6.0.18 now makes the current live values directly visible to an authenticated operator in Operations.

A true lock-screen DEVELOPING notification remains pending until production has a real registered FCM device, an active entity follow, and an eligible canonical event. Raw trade-media signals remain intentionally ineligible for push.
