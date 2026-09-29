# P5.2 Implementation Status — Device Delivery Infrastructure

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / REAL FIREBASE + DEVICE CANARY PENDING**

Branch:

`phase-5/device-delivery-infrastructure`

Parent:

`phase-5/alerts-creator-intelligence` @ `6e580603d0f71415e437dd96dc0e67083332dfd7`

Draft PR:

`#12 — Phase 5.2: device delivery infrastructure`

## Implemented

- service-owned `push_device_registrations` registry;
- provider target freshness and installation-based token rotation;
- per-device `push_delivery_targets` ledger;
- idempotent parent-alert fan-out;
- concurrent-safe leasing using `FOR UPDATE SKIP LOCKED`;
- expiring lease-token recovery;
- strict lease-field invariant;
- bounded per-device retry/backoff;
- provider `Retry-After` support;
- explicit `UNREGISTERED` invalid-registration deactivation;
- permanent vs transient provider failure separation;
- parent alert aggregation/recovery semantics;
- authenticated `cinerelay-device-registration-api` with no raw target exposure;
- internal `push-delivery-worker` using FCM HTTP v1;
- short-lived OAuth access-token minting from server-side Firebase service-account JSON;
- scheduler allow-list action `push-delivery` prepared without enabling cron;
- CI type-check/deployment-bundle coverage for both new Edge functions and the updated scheduler;
- browser secret-leak guard for `CINERELAY_FCM_SERVICE_ACCOUNT`;
- 27 pgTAP assertions for rotation, fan-out, retry, invalid token, permanent failure and later-device recovery;
- covering index for `push_delivery_targets.device_registration_id` after hosted advisor review.

## Canonical hosted migrations

- `20260916110813_push_delivery_foundation`
- `20260916110823_push_delivery_lease_invariant`
- `20260916111150_push_delivery_index_hardening`

## Canonical CI

Canonical ledger head:

`f21dd08a9225cf4820031688303381643670e983`

CineRelay CI #309 / run `35090401513` passed all four jobs:

- intelligence/connectors PASS;
- web console PASS;
- Edge type-check + deployment-native bundle PASS;
- fresh migrations + 27 P5.2 pgTAP assertions + DB lint PASS.

Earlier engineering gates also passed CI #306 and advisor-hardening CI #308.

## Exact deployment artifact

`cinerelay-edge-deploy-bundle`

- artifact id: `10444330354`
- digest: `sha256:886cdbe06fb69e7e2290efec5098759fa53dc9e0cc201d57cfc5fbc2aa40f6e3`

The three P5.2 runtime changes were deployed from this exact CI #309 artifact.

Hosted Edge functions:

- `cinerelay-device-registration-api` — ACTIVE v1 — id `55ee59e5-937d-40c2-918f-01662ee81d5b` — runtime SHA `9c97d53f1fd1b05895fc4bc211712bb2b1239d20ce8f2556b917b27f0c106c24`;
- `push-delivery-worker` — ACTIVE v1 — id `2604e986-d01b-435b-a9fb-065bf925fbbd` — runtime SHA `1eea629dcfeaa5fa5aef3ff64904775400acca2370caa10d69e5c88735a12c4f`;
- `cinerelay-scheduler-dispatch` — ACTIVE v6 — id `1cb7a761-1c78-4b33-bf20-3e499cdc7cca` — runtime SHA `8490ce4fedaa139fe9df0f496b21de7b1256be9617a9ed6a29c35f0a476daf75`.

The scheduler deployment required explicitly resetting `import_map_path` to the bundled `deno.json` because Supabase initially attempted to reuse the previous version's temporary absolute import-map path. No runtime source changed during that recovery.

## Hosted verification

After migration + Edge deployment:

- `push_device_registrations` RLS enabled;
- `push_delivery_targets` RLS enabled;
- authenticated direct SELECT on both internal tables denied;
- authenticated direct execute on registration, lease and completion RPCs denied;
- P5.2 device registrations: `0`;
- P5.2 delivery targets: `0`;
- push-delivery cron jobs: `0`;
- covering FK index exists;
- all internal P5.2 database functions have explicit `search_path` configuration.

Supabase performance advisor confirms the P5.2 missing-FK-index finding is resolved. The new index is reported unused because hosted P5.2 intentionally still has zero delivery rows.

Security advisor has no new P5.2 function/search-path warning. The two P5.2 tables appear in the project-wide `RLS enabled, no policy` informational list intentionally: these tables are service-owned and direct authenticated table privileges are revoked. Existing project warnings such as the older YouTube function search-path notice and leaked-password-protection setting predate P5.2.

No Firebase credential was added by this deployment, no real device was registered, no push delivery was attempted, and no production push scheduler was enabled.

## Remaining production gate

1. configure a controlled Firebase project/service-account credential server-side;
2. register one real authenticated device through `cinerelay-device-registration-api`;
3. create one controlled eligible P5.1 alert and deliver it to that device;
4. prove repeat materialization/send does not duplicate the successful target;
5. prove transient provider failure enters bounded retry and later succeeds;
6. prove explicit FCM `UNREGISTERED` deactivates only that registration;
7. confirm advisor/security state remains clean;
8. only then enable a production `push-delivery` scheduler cadence.

Hosted proof:

`docs/07-execution/PHASE5_P5_2_HOSTED_ENGINEERING_PROOF_2026-09-16.md`

Design:

`docs/07-execution/PHASE5_P5_2_PUSH_DELIVERY_DESIGN.md`
