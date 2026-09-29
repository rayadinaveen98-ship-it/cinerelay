# P6.0.19 — Firebase Android Canary Readiness

Status: **COMPLETE — Firebase-enabled Android canary proven**

## Goal

Make the Android canary build explicitly distinguish between a Firebase-enabled push-capable APK and a safe fallback APK, instead of treating any green Android build as sufficient proof for real-device FCM.

## Root cause audit

The Android client already contained the push runtime path:

- Firebase Messaging dependency;
- Android notification permission;
- `CineRelayMessagingService` token refresh handling;
- authenticated `PushManager.registerCurrentDevice()`;
- Alerts UI permission request + **Enable real alerts** action;
- hosted `cinerelay-device-registration-api`;
- hosted `push-delivery-worker`.

The missing piece was the Android Firebase client config. Previous CI APKs intentionally built without `google-services.json`, which meant `BuildConfig.FIREBASE_CONFIGURED=false` and no real FCM token could be obtained.

## P6.0.19 implementation

Android Canary CI supports secret-driven Firebase Android configuration using:

`CINERELAY_FIREBASE_GOOGLE_SERVICES_JSON_B64`

When present, CI:

1. decodes the secret only inside the Android job;
2. validates package `com.cinerelay.app`;
3. requires Firebase project number, mobile SDK app id and Android API key;
4. rejects service-account/private-key material;
5. enables the Google Services build path;
6. verifies generated `BuildConfig.FIREBASE_CONFIGURED=true`;
7. never uploads raw `google-services.json`.

When absent, CI safely builds the fallback canary and verifies `FIREBASE_CONFIGURED=false`.

The APK artifact also contains a non-secret marker file:

`CineRelay-v0.2.0-canary.firebase-configured.txt`

## Initial fallback proof

Implementation commit:

`fe63e5f7e1e008022a2c5f1a0f09446f2a1ee5db`

Initial CI before secret provisioning:

- CineRelay CI #427 / run `35184280727`: SUCCESS;
- Android Canary #93 / run `35184280725`: SUCCESS;
- fallback contract verified;
- `CINERELAY_FIREBASE_CONFIGURED=false`;
- fallback APK SHA-256 `921ec4c5dc24922feca3e14b52b36d91bfc0eb02208989dfe8d4bf7dc6406778`;
- artifact id `10481214135`.

## Firebase-enabled proof

After the validated Firebase Android client config was provisioned as repository secret, validation commit:

`2d8084bf1df0a19921bf0c8e5d87ebd9fde0c202`

completed with:

- CineRelay CI #429 / run `35202353692`: **SUCCESS**;
- Android Canary #95 / run `35202353673`: **SUCCESS**;
- Firebase config validation for package `com.cinerelay.app`: PASS;
- `CINERELAY_FIREBASE_CONFIGURED=true`;
- Google Services processing executed;
- Firebase build contract: PASS;
- APK/package/secret scan: PASS;
- Firebase-enabled canary contract verified.

Firebase-enabled APK:

- artifact id `10488646398`;
- APK SHA-256 `8b5ed0620355422114cb1514907b8c49563cb7d95ea6652b097b91afc9f8b3f0`;
- artifact ZIP digest `577399153db96168e019bc766d8b2d3814ad360e3e8e3f0c536b8c158e2d215d`.

## Security boundary

The Firebase Android client JSON is not committed to this public repository. The workflow rejects server/service-account private-key material. Server-side FCM credentials remain isolated in hosted secret `CINERELAY_FCM_SERVICE_ACCOUNT`.

## Hosted readiness state before physical-device registration

- active FCM devices: 0;
- active device users: 0;
- active entity follows: 0;
- active follow users: 0;
- push outbox rows: 0;
- active canonical DEVELOPING events: 0.

This is expected until the Firebase-enabled APK is installed and the real Alerts opt-in flow is completed on a physical Android device.

## Next — P6.0.20 real-device FCM registration

1. install the verified Firebase-enabled APK on a physical Android device;
2. create/sign into a CineRelay account;
3. open Alerts;
4. choose **Enable real alerts**;
5. grant notification permission;
6. verify Operations moves to one active FCM device;
7. establish one active entity follow;
8. prove a naturally eligible canonical DEVELOPING notification end-to-end on the lock screen.
