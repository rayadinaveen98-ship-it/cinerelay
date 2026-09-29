# P6.0.32 — Dual YouTube/X lanes + update-safe Android

Status: **IMPLEMENTED / HOSTED NEWSROOM DEPLOYED / X ACTIVATION CREDENTIAL-GATED / PERMANENT SIGNING BOOTSTRAP CREATED**

## Goal

Add X as a first-class CineRelay source alongside YouTube without mixing the two platforms in the Android Home newsroom, while permanently fixing the APK update-signing problem.

## Android newsroom design

The Live Newsroom now uses an explicit platform lane selector:

- YouTube
- X

The lanes are mutually exclusive. Selecting a lane causes Android to request only that platform from the newsroom API. YouTube and X activity are never interleaved in the same Home list.

Canonical enrichment remains platform-agnostic underneath the raw-source layer. A YouTube upload or X post may both resolve to the same canonical movie/series event, but the raw activity stays in its own source lane.

## Server-side isolation

`cinerelay-newsroom-api` now accepts `platform` with allowed values:

- `YOUTUBE`
- `X`

If omitted, the API defaults to `YOUTUBE` for backwards-safe behavior.

The API first selects active source identities for the requested platform, then reads raw items only for those identity IDs. This prevents a busy YouTube stream from starving X results and guarantees platform isolation before pagination/filtering.

Hosted deployment:

- function: `cinerelay-newsroom-api`
- hosted version: `6`
- status: `ACTIVE`
- `verify_jwt=false` because the API intentionally supports guest newsroom reads and performs optional session validation itself
- deployment source: CI-built Android mobile API bundle from head `d4ac71e2598dc49e865627d9e14db0492f46afaa`
- CI artifact: `cinerelay-mobile-apis-v0.2-deploy-bundle`
- artifact id: `10585705852`
- artifact digest: `sha256:351180ae444674004b4ef7460d4967d686737bdd9a29003d6d8c800744563fe9`
- bundled newsroom `index.js` SHA-256: `4b1355852a17661eeab9eb9b2115384af96d60c582648db4410adb2a3fd141e7`

## Hosted pre-activation source state

Production database snapshot after deployment:

- YouTube: 119 active identities, 112 active raw items
- X: 0 active identities, 27 inactive identities, 0 active X raw items

Therefore the X lane is structurally available but intentionally empty before activation; it cannot leak YouTube rows.

## X connector state

Existing `x-profile-poll-worker` remains hosted and safe.

The connector already supports:

- username normalization
- handle -> numeric X user ID resolution
- original-post-only timeline filtering
- `since_id` incremental polling
- no-history baseline behavior
- rate-limit/retry handling
- durable connector runs and source health
- raw-item upsert + downstream processing queue

Live X activation is blocked only by the hosted secret:

`X_API_BEARER_TOKEN`

No X cron is installed and all 27 X identities remain inactive.

### Activation sequence

Do not enable all X identities at once.

1. Add `X_API_BEARER_TOKEN` to CineRelay Edge Function secrets.
2. Activate one controlled official X identity only.
3. Resolve the handle to numeric X user ID.
4. Establish a no-history baseline by recording the newest post checkpoint without importing old posts.
5. Observe endpoint availability, rate-limit headers and provider usage.
6. Wait for and ingest the first genuine post-baseline original post.
7. Confirm the new item appears only in the X Home lane.
8. Only then expand X coverage.

## Android update failure root cause

Previous CineRelay canary APKs were built as debug APKs on fresh GitHub runners without a persistent signing key. Android treats signer identity as part of the app identity, so a later APK signed by a different generated debug certificate cannot replace the installed app even when the package name matches.

The former fixed `versionCode = 3` was also unsuitable for repeatable in-place upgrades.

## Permanent update contract

P6.0.32 changes Android delivery to:

- monotonically increasing CI version codes;
- stable private signing credentials supplied only through GitHub Actions secrets;
- no installable APK artifact when stable signing credentials are absent;
- APK signer verification with `apksigner`;
- a pinned public SHA-256 signing certificate fingerprint committed to Git;
- rejection of any APK whose signer differs from the permanent CineRelay certificate.

Pinned certificate fingerprint:

`17728AEDEE7361B8C7126C3317BD396FEE4DDED3AB8790594FDE5BD7E0123617`

The matching private keystore was generated and preserved outside the public repository. It must never be committed.

Required GitHub Actions repository secrets:

- `CINERELAY_ANDROID_KEYSTORE_B64`
- `CINERELAY_ANDROID_KEYSTORE_PASSWORD`
- `CINERELAY_ANDROID_KEY_ALIAS`
- `CINERELAY_ANDROID_KEY_PASSWORD`

## One-time signing transition

The currently installed canary on the physical Android device was signed by an ephemeral CI debug certificate. The private key for that signer is not available, so Android cannot accept a permanent-signed build as an in-place update.

Exactly one final uninstall/install is required when moving to the permanent CineRelay signer.

After that transition, future APKs will update normally as long as:

1. package remains `com.cinerelay.app`;
2. APK is signed by the permanent CineRelay key;
3. `versionCode` is higher than the installed build.

## CI proof

Before the final permanent-keystore fingerprint correction, both repository gates passed on implementation head `d4ac71e2598dc49e865627d9e14db0492f46afaa`:

- CineRelay CI #471 — success
- CineRelay Android Canary CI #137 — success

The signer-pin correction is a public-fingerprint-only change and triggers a fresh CI verification run.

## Next milestone

P6.0.33 should be **controlled live X activation + permanent-signed Android transition**:

- configure Android signing secrets;
- build first permanent-signed APK;
- perform one final clean install;
- prove next APK updates in place;
- configure `X_API_BEARER_TOKEN`;
- activate one official X source;
- prove baseline + first real X delta + X-lane presentation;
- then widen X and YouTube source coverage together.
