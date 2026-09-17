# P6.0.19 — Firebase Android Canary Readiness

Status: **Firebase Android client config provisioned to GitHub Actions; Firebase-enabled canary validation in progress**

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

## Initial CI proof

Implementation commit:

`fe63e5f7e1e008022a2c5f1a0f09446f2a1ee5db`

- CineRelay CI #427 / run `35184280727`: **SUCCESS**
- Android Canary #93 / run `35184280725`: **SUCCESS**
- mobile APIs: PASS
- Android build/package verification: PASS
- Firebase build-contract verification: PASS

That initial Android run occurred before the repository secret was provisioned and therefore correctly produced the fallback build:

- `Firebase Android config secret is absent; building the safe fallback canary.`;
- `CINERELAY_FIREBASE_CONFIGURED=false`;
- `Fallback CineRelay canary contract verified; FCM is intentionally disabled.`

Fallback APK SHA-256:

`921ec4c5dc24922feca3e14b52b36d91bfc0eb02208989dfe8d4bf7dc6406778`

Fallback Android artifact id:

`10481214135`

## Firebase client config provisioned

The operator has now added the validated Android client config to GitHub Actions as repository secret:

`CINERELAY_FIREBASE_GOOGLE_SERVICES_JSON_B64`

The config was validated outside the repository as the Firebase Android client for package `com.cinerelay.app`. The raw JSON is intentionally not committed to this public repository.

A fresh PR-head build is being used to prove that CI now consumes the secret and produces a Firebase-enabled canary with `BuildConfig.FIREBASE_CONFIGURED=true`.

## Hosted readiness state

Before the Firebase-enabled canary is installed on a real device:

- active FCM devices: 0;
- active device users: 0;
- active entity follows: 0;
- active follow users: 0;
- push outbox rows: 0;
- active canonical DEVELOPING events: 0.

This is not a delivery failure. No real FCM-capable APK/device registration has been established yet.

## Security boundary

Never place the Firebase service-account private key in the Android config or repository. Server-side FCM credentials remain isolated in hosted secret `CINERELAY_FCM_SERVICE_ACCOUNT`.

## Next proof

1. prove the fresh Android canary reports `FIREBASE_CONFIGURED=true`;
2. verify the Firebase-enabled APK artifact and hash;
3. install it on a physical Android device;
4. sign in;
5. open Alerts and choose **Enable real alerts**;
6. grant notification permission;
7. verify Operations moves from 0 to 1 active FCM device;
8. follow one canonical entity;
9. wait for or materialize a naturally eligible canonical DEVELOPING event;
10. verify the trust-aware lock-screen push end-to-end.
