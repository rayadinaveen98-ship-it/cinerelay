# P6.0.30 — Official Source Activity Push Scheduler

Status: **HOSTED-PROVEN THROUGH THE FCM CREDENTIAL BOUNDARY**

## Goal

Make official YouTube upload/Short notifications a real recurring delivery path rather than a manually materialized outbox.

## Scheduler contract

Scheduler action added:

`source-activity-push -> source-activity-push-worker`

Hosted cron:

- job name: `cinerelay-source-activity-push`
- cadence: every minute (`* * * * *`)
- dispatch path: `cinerelay-scheduler-dispatch`

Repository migration:

`20260918094200_p6_0_30_source_activity_push_scheduler.sql`

## CI

Final implementation head before proof:

`fe5b5ae0cf5b26185836991288095e3af8fa3bc3`

- CineRelay CI #460: SUCCESS
- Android Canary #126: SUCCESS
- database migrations: PASS
- pgTAP: PASS
- database lint: PASS
- scheduler type-check: PASS
- source-activity worker type-check: PASS
- deployment-native Edge bundle uploaded

CI deployment artifact:

- `cinerelay-edge-deploy-bundle`
- artifact id: `10541008252`
- artifact digest: `sha256:58ccd57ba0db91a6dc16f49b234f714a79bdc807530da8a68d0323730fd8c3ba`

Exact CI-built files deployed:

- source-activity worker index SHA-256: `7923adc62978b8824f1392a66db404155ba4611ce2175cc234d31086620cd84a`
- scheduler index SHA-256: `7846c8e7bbd2b2fb9db5d1ee44af8d7e9331177961103ccb2cdfd1d7d200c4fa`

Hosted functions:

- `source-activity-push-worker` v1 ACTIVE
- `cinerelay-scheduler-dispatch` v11 ACTIVE

## Natural outbox proof

After user opt-in, two real official YouTube items in the live window produced durable source-activity deliveries and device targets:

1. SLV Cinemas — The Paradise interview Short
2. Aditya Music — new official video upload

Both use the `SOURCE_ACTIVITY` notification class and are intended to render as:

`CineRelay • Official Upload`

## FCM boundary proof

Manual invocation through the production scheduler path returned:

- scheduler HTTP: `502`
- upstream worker HTTP: `503`
- sanitized upstream error: `fcm_service_account_missing`

This is the expected remaining server-side Firebase credential gate.

Safety verification after the failed transport attempt:

- both source-activity deliveries remain `PENDING`
- both device targets remain `PENDING`
- `attempt_count = 0`
- no lease token
- no leased-until timestamp

The worker validates FCM credentials before planning/leasing, so a missing service account cannot consume or corrupt queued official-upload notifications.

## Remaining gate

Configure hosted `CINERELAY_FCM_SERVICE_ACCOUNT`, then the recurring cron can drain the two already-pending genuine deliveries to the registered Android device.
