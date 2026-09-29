# Phase 6 P6.0.1 Hosted Engineering Proof — Android V0.1 Canary

Date: 2026-09-16

State: **ENGINEERING APK COMPLETE / HOSTED MOBILE API DEPLOYED / REAL FIREBASE DEVICE CANARY PENDING**

## Source checkpoint

- Branch: `phase-6/android-v0.1-canary`
- Engineering head: `091a0fa832bc2ea6570a0f48c997fed74b1ad0ee`
- Parent: `phase-5/evidence-backed-summaries` @ `30517d8c5c3605c23d5e1b60f0e82a59f3ddf284`
- Draft PR: `#16 — Phase 6 P6.0.1: Android V0.1 canary`

## CI proof

### CineRelay CI #344

Run: `35104494874`

All mature jobs passed on the same engineering head:

- `intelligence-and-connectors` — PASS
- `database-migrations` — PASS
- `edge-functions` — PASS
- `web-console` — PASS

### CineRelay Android Canary CI #10

Run: `35104494966`

Both jobs passed:

- `mobile-api` — PASS
- `android-canary` — PASS

Android proof includes:

- JDK 17 setup;
- stable Android 16 / API 36 SDK setup;
- Gradle 9.6 build;
- privileged-server-secret source scan;
- `:app:assembleDebug` success;
- APK existence/non-empty contract check;
- privileged-server-secret APK scan;
- APK SHA-256 generation;
- installable APK artifact upload.

## Exact CI artifacts

### Android APK

- Artifact: `cinerelay-android-v0.1-canary-apk`
- Artifact ID: `10449931862`
- Artifact archive digest: `sha256:fe040aaee90fbda37c549001519e6eeb2be92281dcf0d8c94a328ac390072e06`
- Extracted APK: `app-debug.apk`
- Extracted APK SHA-256: `c16bca0724fe22bce5b242b6e79ffbae994ffb8789c2b72f4a18367839585948`
- APK size: `20,649,257` bytes
- CI checksum sidecar matched the independently recomputed APK checksum exactly.

### Mobile API deployment bundle

- Artifact: `cinerelay-mobile-api-deploy-bundle`
- Artifact ID: `10449538338`
- Artifact archive digest: `sha256:2405fbdf032e88b95f4a9fec0324bd4aae6e951ff5d172ffeeaac6d998b5b9fa`
- `index.js` SHA-256: `24872e23b1fa176940979ec3c5b6f3d5b28a9bdbb04b9726868b1ecf172f0000`
- The downloaded artifact archive digest matched GitHub's recorded digest before deployment.

## Hosted mobile API deployment

The exact CI-built deployment-native bundle was deployed, not a hand-copied source build.

- Function: `cinerelay-mobile-api`
- Supabase project: `dnqaejljfzwhsainpdxb`
- Function ID: `c71305b1-b602-4b95-bb29-0914be6ebc80`
- Version: `1`
- Status: `ACTIVE`
- `verify_jwt`: `false`
- Import map: enabled
- Hosted bundle SHA: `b241078fe866f0c2acbe4df93231e1eb84095046d1b8dfdcc8edcabeaba62dda`

`verify_jwt=false` is intentional for this endpoint because the function itself validates the supplied user bearer token with `auth.getUser()` before any user-specific read or follow mutation. This matches CineRelay's existing CORS-friendly authenticated Edge API pattern.

## Hosted runtime auth proof

Runtime probes were executed against the live hosted function through `pg_net` using the public project key only.

### Missing bearer token

Request body: `{"action":"bootstrap"}`

Result:

- HTTP `401`
- response: `{"error":"authentication_required"}`
- no timeout / transport error

### Invalid bearer token

Request body: `{"action":"bootstrap"}` with a deliberately invalid bearer value.

Result:

- HTTP `401`
- response: `{"error":"invalid_session"}`
- no timeout / transport error

### Zero-side-effect proof

Before runtime probes:

- `user_entity_follows`: `0`
- `alert_deliveries`: `0`
- `push_device_registrations`: `0`

After both auth-failure probes:

- `user_entity_follows`: `0`
- `alert_deliveries`: `0`
- `push_device_registrations`: `0`

The authentication-failure paths produced no user/follow/alert/device mutation.

## Advisor review

No P6.0.1-specific database security or performance regression was introduced by the Android/mobile API milestone.

Existing security findings remain:

- service-owned/internal RLS tables with no authenticated policies (`INFO`) — intentional where direct client access is revoked and access is mediated server-side;
- existing `public.record_youtube_websub_delivery` mutable search-path warning;
- project-level leaked-password-protection warning.

Existing performance backlog remains the previously known unindexed-foreign-key set plus unused-index informational findings. P6.0.1 added no schema or index migration.

Reference remediation links:

- RLS/no-policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- function search path: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
- leaked password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- unindexed foreign keys: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

## Android platform contract

- Package: `com.cinerelay.app`
- `minSdk = 26`
- `compileSdk = 36`
- `targetSdk = 36`
- Android 16/API 36 stable baseline
- Android 17/API 37 preview is intentionally not required by V0.1.

## Firebase boundary

The engineering APK intentionally does **not** claim the real Firebase canary is complete.

Still required:

1. Firebase Android app/client configuration for `com.cinerelay.app` (`google-services.json`);
2. hosted `CINERELAY_FCM_SERVICE_ACCOUNT` configured server-side only;
3. physical Android device installation and authenticated sign-in;
4. device FCM token registration;
5. one controlled exactly-once delivery;
6. transient retry/recovery proof;
7. explicit `UNREGISTERED` deactivation proof;
8. final hosted security/advisor recheck after that canary.

No production push cron is enabled before this gate passes.

## Milestone conclusion

P6.0.1 has crossed its engineering/hosted foundation gate:

**first installable CineRelay Android APK built green + exact mobile API CI artifact deployed and runtime-auth verified.**

The remaining boundary is external Firebase configuration plus a real physical-device push canary; it is not an Android-source or hosted-mobile-API engineering blocker.
