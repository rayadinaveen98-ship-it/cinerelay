# P6.0.19 — Firebase Android Canary Readiness

Status: **CI contract complete; real FCM Android config still pending**

## Goal

Make the Android canary build explicitly distinguish between a Firebase-enabled push-capable APK and a safe fallback APK, instead of treating any green Android build as sufficient proof for real-device FCM.

## Root cause audit

The Android client already contains the push runtime path:

- Firebase Messaging dependency is declared;
- `POST_NOTIFICATIONS` permission is declared;
- `CineRelayMessagingService` handles token refresh and foreground messages;
- the Alerts screen requests notification permission on Android 13+;
- `PushManager.registerCurrentDevice()` obtains an FCM token and calls the authenticated device-registration API;
- `cinerelay-device-registration-api` is hosted and ACTIVE;
- `push-delivery-worker` is hosted and ACTIVE.

The missing piece was build configuration. `apps/android/app/build.gradle.kts` intentionally sets `FIREBASE_CONFIGURED` from the presence of `apps/android/app/google-services.json`, and the existing CI workflow never injected that file.

Therefore previously generated CI APKs could not obtain/register a real FCM token even though the runtime code existed.

## P6.0.19 implementation

Android Canary CI now supports optional secret-driven Firebase Android configuration using:

`CINERELAY_FIREBASE_GOOGLE_SERVICES_JSON_B64`

When present, CI:

1. base64-decodes the secret only inside the Android job;
2. validates that the JSON contains Android package `com.cinerelay.app`;
3. requires Firebase project number, mobile SDK app id and Android API key;
4. rejects server/service-account private-key material;
5. builds with the Google Services plugin enabled;
6. verifies generated `BuildConfig.FIREBASE_CONFIGURED=true`;
7. never uploads `google-services.json` as an artifact.

When absent, CI still builds the normal fallback canary and verifies `BuildConfig.FIREBASE_CONFIGURED=false`.

The artifact now includes a small non-secret marker file:

`CineRelay-v0.2.0-canary.firebase-configured.txt`

so an APK artifact can be classified without guessing.

## CI proof

Implementation commit:

`fe63e5f7e1e008022a2c5f1a0f09446f2a1ee5db`

- CineRelay CI #427 / run `35184280727`: **SUCCESS**
- Android Canary #93 / run `35184280725`: **SUCCESS**
- mobile APIs: PASS
- Android build/package verification: PASS
- Firebase build-contract verification: PASS

Final Android job log proves the repository secret is currently absent:

- `FIREBASE_JSON_B64:` empty;
- `Firebase Android config secret is absent; building the safe fallback canary.`;
- `CINERELAY_FIREBASE_CONFIGURED=false`;
- `Fallback CineRelay canary contract verified; FCM is intentionally disabled.`

Fallback APK SHA-256 from the CI job:

`921ec4c5dc24922feca3e14b52b36d91bfc0eb02208989dfe8d4bf7dc6406778`

Android artifact id:

`10481214135`

## Hosted readiness state

At the production check immediately before this slice:

- active FCM devices: 0;
- active device users: 0;
- active entity follows: 0;
- active follow users: 0;
- push outbox rows: 0;
- active canonical DEVELOPING events: 0.

This is not a delivery failure. No real FCM-capable APK/device registration has been established yet.

## Remaining external requirement

Create/register Firebase Android app package `com.cinerelay.app`, obtain its **client-side** `google-services.json`, and provide it to CI as base64 secret `CINERELAY_FIREBASE_GOOGLE_SERVICES_JSON_B64`.

Never place the Firebase service-account private key in the Android config or repository. Server-side FCM credentials remain isolated in hosted secret `CINERELAY_FCM_SERVICE_ACCOUNT`.

## Next proof

After the Android Firebase config is available:

1. run a controlled Firebase-required canary build;
2. install the Firebase-enabled APK on a physical Android device;
3. sign in;
4. open Alerts and choose **Enable real alerts**;
5. grant notification permission;
6. verify Operations moves from 0 to 1 active FCM device;
7. follow one canonical entity;
8. wait for or materialize a naturally eligible canonical DEVELOPING event;
9. verify the trust-aware lock-screen push end-to-end.
