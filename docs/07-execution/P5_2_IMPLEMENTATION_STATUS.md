# P5.2 Implementation Status — Device Delivery Infrastructure

Date: 2026-09-16

State: **IMPLEMENTATION IN REVIEW / FRESH CI PENDING / NO HOSTED DEPLOYMENT YET**

Branch:

`phase-5/device-delivery-infrastructure`

Parent:

`phase-5/alerts-creator-intelligence` @ `6e580603d0f71415e437dd96dc0e67083332dfd7`

Implemented so far:

- service-owned `push_device_registrations` registry;
- provider target freshness and installation-based token rotation;
- per-device `push_delivery_targets` ledger;
- idempotent parent-alert fan-out;
- concurrent-safe leasing using `FOR UPDATE SKIP LOCKED`;
- expiring lease-token recovery;
- strict lease-field invariant;
- bounded per-device retry/backoff;
- provider `Retry-After` support;
- explicit invalid-registration deactivation;
- permanent vs transient provider failure separation;
- parent alert aggregation/recovery semantics;
- authenticated `cinerelay-device-registration-api` with no raw target exposure;
- internal `push-delivery-worker` using FCM HTTP v1;
- short-lived OAuth access-token minting from server-side Firebase service account;
- scheduler allow-list action `push-delivery` prepared without enabling cron;
- CI type-check/deployment-bundle coverage for both new Edge functions;
- browser secret-leak guard for `CINERELAY_FCM_SERVICE_ACCOUNT`;
- pgTAP failure-path matrix for rotation, fan-out, retry, invalid token, permanent failure and later-device recovery.

Production remains deliberately unchanged until fresh CI passes.

No P5.2 migration, Edge function, Firebase credential or production scheduler is deployed at this checkpoint.

Next gate:

1. open stacked draft PR on P5.1;
2. run full CineRelay CI;
3. fix any migration/pgTAP/type-check issue without weakening contracts;
4. only after all four jobs are green, promote DB foundation to hosted Supabase;
5. reconcile Supabase-assigned migration versions into Git and rerun canonical CI;
6. deploy exact CI-built Edge artifacts;
7. verify hosted RLS/privilege/zero-side-effect state;
8. configure real Firebase credentials/device only for the controlled canary;
9. keep production cron disabled until real-device delivery/retry/deactivation proof completes.

Design:

`docs/07-execution/PHASE5_P5_2_PUSH_DELIVERY_DESIGN.md`
