# Phase 5.2 Design — Device Registration + Push Delivery Infrastructure

Date: 2026-09-16

State: **IMPLEMENTATION IN REVIEW / NO PRODUCTION CRON**

Parent checkpoint:

`phase-5/alerts-creator-intelligence` @ `6e580603d0f71415e437dd96dc0e67083332dfd7`

## Goal

Deliver P5.1's provider-neutral `alert_deliveries` through Firebase Cloud Messaging without allowing provider availability, device churn, retries or credentials to alter canonical CineRelay event/evidence correctness.

## Locked architecture

The durable chain is:

`canonical event -> user alert outbox -> per-device delivery target -> provider worker`

A single user alert may fan out to multiple active devices. Delivery/retry state is tracked independently for each device so one failed device cannot cause a duplicate send to another device that already succeeded.

## Device registration boundary

`push_device_registrations` is service-owned and RLS-protected.

Raw provider targets are never directly selectable by normal authenticated clients. Browser/mobile clients use `cinerelay-device-registration-api`, which:

- independently validates the Supabase Auth bearer session with `auth.getUser()`;
- binds registration/unregistration to the verified `user.id`;
- never accepts a caller-supplied user id;
- never returns the raw FCM target in responses;
- supports registration, unregistration and sanitized inventory listing;
- records provider target freshness on every registration upload;
- preserves rotated registrations as inactive history.

The database schema reserves `TOKEN` and `FID` target kinds so the storage model can survive Firebase's registration-model transition. The first live sender and registration API intentionally accept only `TOKEN` until the FID request-target contract is implemented and integration-tested end-to-end.

## Firebase provider contract

The first provider adapter uses FCM HTTP v1.

Official reference checked 2026-09-16:

- https://firebase.google.com/docs/cloud-messaging/send/v1-api
- https://firebase.google.com/docs/cloud-messaging/manage-tokens
- https://firebase.google.com/docs/cloud-messaging/error-codes
- https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send

The worker:

- stores the Firebase service account only in the hosted secret `CINERELAY_FCM_SERVICE_ACCOUNT`;
- mints a short-lived OAuth 2.0 token with scope `https://www.googleapis.com/auth/firebase.messaging`;
- sends to `POST https://fcm.googleapis.com/v1/projects/{project_id}/messages:send`;
- targets the currently implemented registration `message.token`;
- never exposes the service-account JSON or raw device target to browser code.

## Durable per-device delivery

`push_delivery_targets` is a child ledger beneath `alert_deliveries`.

Each `(alert_delivery_id, device_registration_id)` pair is unique.

States:

- `PENDING`
- `LEASED`
- `RETRY`
- `SENT`
- `PERMANENT_FAILURE`

Workers lease rows with `FOR UPDATE SKIP LOCKED` and an expiring random lease token. Concurrent workers therefore cannot intentionally claim the same due child target. Expired leases become eligible for recovery.

A strict database invariant requires both lease fields to be present only while status is `LEASED`, and both to be null for every other state.

## Retry policy

Provider failures are translated into CineRelay delivery outcomes:

- success -> `SENT`;
- explicit FCM `UNREGISTERED` -> `INVALID_REGISTRATION`, child permanent failure and provider target deactivation;
- HTTP 429 or provider `QUOTA_EXCEEDED` -> transient retry;
- HTTP 5xx / `UNAVAILABLE` / `INTERNAL` -> transient retry;
- network/timeout failure -> transient retry;
- `INVALID_ARGUMENT` and other non-retryable 4xx -> permanent child failure but **do not deactivate the registration** unless FCM explicitly says `UNREGISTERED`.

Retries are bounded to five leased attempts. Base retry schedule:

1. 60 seconds;
2. 300 seconds;
3. 1800 seconds;
4. 7200 seconds;
5. terminal permanent failure.

`Retry-After`, when returned by the provider, is honored as a minimum bounded delay.

## Parent alert aggregation

The parent `alert_deliveries` row remains provider-neutral.

When all materialized device children are terminal:

- if any child is `SENT`, parent becomes `SENT`;
- if every child is `PERMANENT_FAILURE`, parent becomes `FAILED` with `ALL_DEVICE_TARGETS_FAILED`.

A later newly registered healthy device can materialize a new child for a previously failed parent alert. Once any child succeeds and all children are terminal, the parent recovers to `SENT`.

A parent already `SENT` never fans out to devices registered later; the user alert has already been delivered successfully on at least one device.

## Provider-isolation rule

FCM authentication is completed **before** durable work is leased. Missing/invalid provider credentials therefore cannot create fresh leases that wait unnecessarily for expiry.

After leasing, every provider result is written back through `complete_push_delivery_target(...)`. If the completion write itself fails, the lease-expiry path remains the recovery mechanism.

Canonical event processing never calls the push worker and never waits for FCM.

## Scheduler policy

`cinerelay-scheduler-dispatch` recognizes the `push-delivery` action, but P5.2 does **not** create a production pg_cron job yet.

Cron activation is gated on:

1. real Firebase project/service-account configuration;
2. one real authenticated device registration;
3. one controlled alert delivered to that device;
4. duplicate-free repeat/materialization proof;
5. transient retry proof;
6. invalid-registration/deactivation proof;
7. hosted security/advisor verification.

## CI and security gates

CI must prove:

- fresh migration application;
- pgTAP device/delivery state contracts;
- existing P5.1 canonical-event tests remain green;
- Edge type-check for device API and push worker;
- deployment-native Edge bundles include both functions;
- browser artifact contains no `CINERELAY_FCM_SERVICE_ACCOUNT` marker;
- database function lint remains green.

No P5.2 migration or Edge function is promoted to hosted Supabase until all four CI jobs are green.
