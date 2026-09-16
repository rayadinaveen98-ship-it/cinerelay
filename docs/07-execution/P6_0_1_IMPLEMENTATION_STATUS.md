# P6.0.1 Implementation Status — Android V0.1 Canary

Date: 2026-09-16

State: **ENGINEERING APK COMPLETE / HOSTED MOBILE API DEPLOYED / REAL FIREBASE DEVICE CANARY PENDING**

Branch:

`phase-6/android-v0.1-canary`

Parent:

`phase-5/evidence-backed-summaries` @ `30517d8c5c3605c23d5e1b60f0e82a59f3ddf284`

Draft PR:

`#16 — Phase 6 P6.0.1: Android V0.1 canary`

Engineering checkpoint:

`091a0fa832bc2ea6570a0f48c997fed74b1ad0ee`

## Implemented

### Visible Android product

- standalone native Gradle Android project in `apps/android`;
- package `com.cinerelay.app`;
- stable Android 16 API 36 compile/target baseline, min API 26;
- Kotlin + Jetpack Compose + Material 3;
- dark-first CineRelay signal-room theme;
- authenticated sign-in screen;
- Live feed;
- Following feed;
- Creator Radar feed;
- Alerts history;
- verification badges;
- evidence/source metadata and source links;
- evidence/conflict counts;
- follow/unfollow actions;
- Creator Radar score/opportunity labels;
- session refresh/sign-out;
- visible real-device FCM canary state.

### Mobile backend boundary

- hosted `cinerelay-mobile-api` Edge function;
- independent bearer validation through `auth.getUser()`;
- shaped `bootstrap`, `live`, `following`, `radar`, `alerts`, `setFollow` actions;
- P5.5 READY summary reuse where available;
- P5.4 Radar reuse where available;
- no direct Android access to service-owned internal tables.

### Push bridge

- existing P5.2 device registration API reused;
- Firebase token acquisition when client config exists;
- automatic token re-registration on rotation;
- Android 13+ notification permission requested only when enabling alerts;
- foreground Firebase message handling;
- notification channel configured;
- no fake Firebase success when configuration is absent.

## Green CI proof

### CineRelay CI #344

Run `35104494874` — all four jobs PASS on engineering head `091a0fa832bc2ea6570a0f48c997fed74b1ad0ee`:

- intelligence/connectors;
- database migrations + pgTAP + lint;
- Edge functions;
- web console.

### Android Canary CI #10

Run `35104494966` — all jobs PASS:

- `cinerelay-mobile-api` type-check and deployment bundle;
- JDK 17 / Gradle 9.6 / stable API 36 setup;
- privileged-secret source scan;
- `:app:assembleDebug`;
- APK contract/secret scan;
- APK SHA-256 generation;
- installable APK artifact upload.

## Exact artifacts

Android APK artifact:

- name: `cinerelay-android-v0.1-canary-apk`;
- artifact ID: `10449931862`;
- archive digest: `sha256:fe040aaee90fbda37c549001519e6eeb2be92281dcf0d8c94a328ac390072e06`;
- extracted APK SHA-256: `c16bca0724fe22bce5b242b6e79ffbae994ffb8789c2b72f4a18367839585948`;
- extracted size: `20,649,257` bytes.

Mobile API artifact:

- name: `cinerelay-mobile-api-deploy-bundle`;
- artifact ID: `10449538338`;
- archive digest: `sha256:2405fbdf032e88b95f4a9fec0324bd4aae6e951ff5d172ffeeaac6d998b5b9fa`.

## Hosted mobile API

The exact CI-built deployment-native bundle is live:

- function: `cinerelay-mobile-api`;
- function ID: `c71305b1-b602-4b95-bb29-0914be6ebc80`;
- version: `1`;
- status: `ACTIVE`;
- hosted bundle SHA: `b241078fe866f0c2acbe4df93231e1eb84095046d1b8dfdcc8edcabeaba62dda`;
- `verify_jwt=false` by design, with mandatory in-function `auth.getUser()` bearer validation before user-specific work.

Hosted runtime verification:

- missing bearer -> HTTP `401`, `authentication_required`;
- deliberately invalid bearer -> HTTP `401`, `invalid_session`;
- before/after both probes: `user_entity_follows=0`, `alert_deliveries=0`, `push_device_registrations=0`.

Therefore the tested authentication-failure paths are zero-side-effect.

## Advisor review

No P6.0.1-specific database security/performance regression appeared.

Existing project findings remain the known service-owned RLS/no-policy INFO set, old `record_youtube_websub_delivery` search-path warning, leaked-password-protection setting, old unindexed-FK backlog, and unused-index informational findings.

P6.0.1 adds no database schema or index migration.

## Current Firebase state

The engineering APK intentionally compiles without `google-services.json`.

Normal CineRelay UI is buildable/installable and the hosted mobile API is active, but real push remains gated by external Firebase configuration and a physical device.

Still required before the Phase-5 delivery exit gate can close:

1. Firebase Android client config for package `com.cinerelay.app`;
2. hosted `CINERELAY_FCM_SERVICE_ACCOUNT` secret;
3. physical Android install/sign-in;
4. device token registration;
5. one controlled exactly-once push delivery;
6. transient retry/recovery proof;
7. explicit `UNREGISTERED` token deactivation proof;
8. final security/advisor recheck.

No production push cron is enabled before this gate passes.

## Next product step

With the V0.1 engineering APK and mobile API foundation proven, the next Phase-6 product slices can build on this app rather than scaffolding again: title/timeline detail, search, source pages, offline/cache, richer filters, deep links, launcher/brand polish and preference editing.

Hosted proof:

`docs/07-execution/PHASE6_P6_0_1_HOSTED_ENGINEERING_PROOF_2026-09-16.md`

Design:

`docs/07-execution/PHASE6_P6_0_1_ANDROID_CANARY_DESIGN.md`
