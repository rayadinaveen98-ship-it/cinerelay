# Phase 5.2 Hosted Engineering Proof — Device Delivery Infrastructure

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / REAL FIREBASE + DEVICE CANARY PENDING**

## Scope

This proof covers the P5.2 provider-isolated push foundation only. It proves the durable device/delivery state machine, hosted schema/security boundaries, exact CI-artifact Edge deployment and zero-side-effect rollout. It does **not** claim a real Firebase notification has been sent.

## Branch and PR

- branch: `phase-5/device-delivery-infrastructure`
- parent: `phase-5/alerts-creator-intelligence`
- draft PR: `#12`

## Canonical hosted migrations

Supabase project: `dnqaejljfzwhsainpdxb`

Canonical migration ledger:

1. `20260916110813_push_delivery_foundation`
2. `20260916110823_push_delivery_lease_invariant`
3. `20260916111150_push_delivery_index_hardening`

The first two establish the P5.2 state machine and lease invariant. The third was added after the hosted performance advisor identified the device-registration foreign key as lacking a covering index.

## Database behavior proof

The P5.2 pgTAP suite contains 27 assertions and proves:

- both P5.2 tables use RLS;
- authenticated clients cannot directly read either service-owned table;
- authenticated clients cannot directly invoke service registration/materialization/lease/completion RPCs;
- first registration creates one active device;
- token rotation preserves the old registration as inactive history;
- one due alert materializes exactly one active device target;
- repeat materialization is idempotent;
- leasing increments per-device attempt count;
- transient failure moves the child to `RETRY` and schedules the next attempt;
- retry leases the same child rather than duplicating it;
- explicit invalid registration deactivates only the affected provider target;
- invalid registration becomes terminal child failure;
- parent alert becomes failed only after all materialized children are terminal failures;
- a later healthy device can materialize a new target for a previously failed parent;
- permanent-failure targets are never re-leased;
- a successful later target recovers the parent alert to `SENT`;
- a `SENT` parent never fans out to future devices.

## CI proof

Canonical Git head:

`f21dd08a9225cf4820031688303381643670e983`

CineRelay CI:

- run number: `#309`
- run id: `35090401513`
- result: PASS

All four jobs passed:

- intelligence/connectors;
- web console;
- Edge functions;
- database migrations/tests/lint.

The database job applied the complete canonical migration ledger from scratch, ran the full pgTAP suite including all 27 P5.2 assertions, and passed database function lint.

## Exact deployment artifact

Deployment-native artifact:

- name: `cinerelay-edge-deploy-bundle`
- artifact id: `10444330354`
- digest: `sha256:886cdbe06fb69e7e2290efec5098759fa53dc9e0cc201d57cfc5fbc2aa40f6e3`

Bundled P5.2 source hashes before deployment:

- `cinerelay-device-registration-api/index.js`: `8941e658a291e8802300a4c5fd122815c9fc3468a70e9c09de59555155c6cf21`
- `push-delivery-worker/index.js`: `a1651a807d7999063611f3e6aa11dd4d375ecf56819fce738039e7d2671c39d9`
- `cinerelay-scheduler-dispatch/index.js`: `78cc2ac888b2f500a210cdccfe1a52c7353e286bc072afc357474d7cebb0ba01`

No source from an unverified working tree was deployed.

## Hosted Edge runtime

`cinerelay-device-registration-api`

- status: ACTIVE
- version: 1
- function id: `55ee59e5-937d-40c2-918f-01662ee81d5b`
- verify_jwt: false by design; function independently validates Supabase Auth with `auth.getUser()`
- runtime SHA: `9c97d53f1fd1b05895fc4bc211712bb2b1239d20ce8f2556b917b27f0c106c24`

`push-delivery-worker`

- status: ACTIVE
- version: 1
- function id: `2604e986-d01b-435b-a9fb-065bf925fbbd`
- verify_jwt: false by design; function requires the independent internal worker secret
- runtime SHA: `1eea629dcfeaa5fa5aef3ff64904775400acca2370caa10d69e5c88735a12c4f`

`cinerelay-scheduler-dispatch`

- status: ACTIVE
- version: 6
- function id: `1cb7a761-1c78-4b33-bf20-3e499cdc7cca`
- verify_jwt: false by design; function validates the database scheduler token
- runtime SHA: `8490ce4fedaa139fe9df0f496b21de7b1256be9617a9ed6a29c35f0a476daf75`
- P5.2 action: `push-delivery` -> `push-delivery-worker` with bounded batch size

The scheduler's first update attempt was rejected because Supabase tried to reuse the previous version's absolute temporary import-map path. The same CI artifact was redeployed with `import_map_path=deno.json`, after which v6 became ACTIVE. No runtime logic was changed during this recovery.

## Hosted zero-side-effect proof

After all P5.2 migrations and Edge deployments:

- `push_device_registrations` rows: `0`;
- `push_delivery_targets` rows: `0`;
- push-delivery-related pg_cron jobs: `0`;
- `push_device_registrations` RLS: enabled;
- `push_delivery_targets` RLS: enabled;
- authenticated direct SELECT on device registrations: denied;
- authenticated direct SELECT on push targets: denied;
- authenticated direct execute on `upsert_push_device_registration(...)`: denied;
- authenticated direct execute on `lease_push_delivery_targets(...)`: denied;
- authenticated direct execute on `complete_push_delivery_target(...)`: denied;
- `push_delivery_targets_device_registration_idx`: present.

This proves hosted deployment itself did not register a device, materialize a target or schedule a push loop.

## Advisor review

Performance advisor:

- the P5.2 `push_delivery_targets.device_registration_id` unindexed-FK finding is resolved;
- the new covering index is currently reported unused, which is expected while hosted P5.2 contains zero device/delivery rows;
- remaining unindexed-FK findings belong to older project tables and are outside this slice.

Security advisor:

- no new P5.2 function search-path warning exists;
- both P5.2 service-owned tables appear in the informational `RLS enabled, no policy` list intentionally because direct client table privileges are revoked and access is mediated by authenticated/internal Edge functions;
- the existing `record_youtube_websub_delivery` mutable-search-path warning predates P5.2;
- the project-level leaked-password-protection warning predates P5.2.

## Verification limitation

The execution container used for this checkpoint could not resolve the hosted Supabase function hostname for an external HTTP smoke request. Therefore this proof does not claim a direct unauthenticated HTTP request was executed from that container. The deployed functions are nevertheless the exact CI #309 bytes, the hosted runtime reports them ACTIVE, and database privilege/zero-side-effect boundaries were verified directly in hosted Supabase.

## Firebase / production gate

No Firebase service-account credential was added by this rollout, no real device registration was created, no real FCM send was attempted, and no push cron was enabled.

Before enabling unattended push delivery, complete a controlled real-device canary:

1. configure the Firebase service-account credential server-side;
2. register one authenticated device through the device-registration API;
3. create one controlled eligible alert;
4. prove one successful FCM delivery;
5. repeat without duplicate materialization/delivery;
6. prove transient retry and recovery;
7. prove explicit `UNREGISTERED` deactivates only the invalid registration;
8. rerun hosted security/performance verification;
9. enable production `push-delivery` cron only after all prior gates pass.

Until that canary is complete, P5.2 should be described as **hosted engineering foundation complete**, not production push delivery complete.
