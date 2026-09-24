# P6.0.10 — Push Trust Disclosure

Date: 2026-09-16
Status: HOSTED-PROVEN

## Goal

Preserve fast DEVELOPING alerts while making trust state explicit on the lock screen.

CineRelay intentionally allows users to opt into developing signals. The problem was presentation, not eligibility: `plan_event_alerts` can create alerts for `DEVELOPING` events by default when user preferences allow them, while the FCM notification title previously always read only `CineRelay`.

That could make a lower-trust developing report look visually equivalent to an official or confirmed signal outside the app.

## Locked presentation contract

Shared implementation:

`packages/domain/src/push-presentation.ts`

Notification title mapping:

- `OFFICIAL` -> `CineRelay`
- `CONFIRMED` -> `CineRelay`
- `DEVELOPING` -> `CineRelay • Developing`
- `RELIABLE_REPORT` -> `CineRelay • Developing`
- `RUMOR` -> `CineRelay • Rumor`
- unknown / missing -> `CineRelay • Unconfirmed`

The alert headline remains the notification body.

This preserves early intelligence while making verification state visible before a user opens the app.

## Regression contract

Test:

`tests/benchmark/run-push-presentation.mjs`

The pure regression suite covers every mapping above and is mandatory through:

`npm run ci`

The push worker consumes the shared helper rather than duplicating trust-label logic.

Updated worker:

`supabase/functions/push-delivery-worker/index.ts`

## CI proof

Implementation head:

`5c5c34b88fedb2818d1c22605c8232578238d043`

### CineRelay CI #408

Run: `35132777294`

All jobs SUCCESS:

- intelligence/connectors, including push trust-label regression;
- strict Edge type-check, including `push-delivery-worker`;
- deployment-native Edge bundle;
- database migrations + pgTAP;
- web console.

Deployment artifact:

- artifact: `cinerelay-edge-deploy-bundle`
- artifact id: `10462240130`
- artifact digest: `sha256:d4e10a42f4641b1483568f5b042c4e033587b06422cba4dcfb5cf10a8ac72481`
- CI-built `push-delivery-worker/index.js` SHA-256: `9e500f82664a05961cada39636658e0602b344c6388d25b81aef86f593eab4e1`

### Android Canary #74

Run: `35132777226`

All jobs SUCCESS:

- mobile API shared-domain build;
- mobile/evidence/newsroom API type-checks;
- deployment-native mobile API bundle;
- Android V0.2 build;
- APK/package verification;
- APK artifact upload.

Android artifact:

- artifact id: `10461584917`
- archive digest: `sha256:8d8a4a51e36f75d4111cb4e05e09a1341cd6abffdd0c32de6ef90a5a998e5a40`
- extracted APK SHA-256: `f36d023d92a2d02562dc3a9af6126fb951d745709d0778941ff64edf38b74bfa`

## Hosted deployment

Function:

`push-delivery-worker`

Hosted state after correction:

- function id: `2604e986-d01b-435b-a9fb-065bf925fbbd`
- version: `3`
- status: `ACTIVE`
- `verify_jwt`: `false` intentionally; this worker uses its internal `x-cinerelay-internal-key` authorization path
- runtime SHA: `aa90e5a049441abb409243389dad5968bec823dd8052e0f5fe15d9fd0283808b`

Hosted source was fetched back after deployment and verified to contain both:

- the correct Google OAuth JWT-bearer grant string;
- the new trust-aware notification title mapping.

## Deployment-integrity note

A first v2 upload contained a transcription mismatch in the minified OAuth `grant_type` string while passing the CI artifact through the deployment call.

That version was not accepted as proof. It was immediately superseded by v3 using the original CI artifact contents, then the hosted v3 source was fetched back and verified.

Production cron inspection found no scheduled pg_cron job targeting `push-delivery-worker`, and no live push canary was manually fired during this work. The worker also mints provider OAuth before leasing durable delivery targets, so provider-auth failure is designed not to strand newly leased work.

## Why no live push canary

A real push test could contact an actual registered device or consume a real pending alert. CineRelay therefore does not manufacture a user notification merely to prove presentation.

The proof boundary is intentionally:

1. pure trust-title regression tests;
2. strict Edge type-check;
3. exact CI deployment artifact;
4. hosted source verification;
5. normal future alert traffic for real-device observation.

## Product rule

Developing intelligence remains useful and can still be delivered when user preferences allow it, but it must never visually masquerade as official confirmation.

## Next

1. observe the first real post-baseline 123Telugu feed delta and confirm it enters Live as `DEVELOPING`;
2. confirm the first naturally occurring DEVELOPING push displays `CineRelay • Developing` on a real device when normal alert eligibility exists;
3. expose source trust class more explicitly inside Android Live without confusing it with event verification state;
4. continue trade/public source expansion only through proven feed/parser contracts;
5. keep first-party verified authority visually distinct from trade/developing reports.
