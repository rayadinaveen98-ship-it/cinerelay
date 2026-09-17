# P6.0.18 — Push Readiness Operations

## Goal
Expose the real-device push proof blockers to CineRelay operators without changing alert planning or delivery semantics.

## Scope
- Add read-only server-side push readiness metrics to the existing operator-authenticated `cinerelay-console-api`.
- Show those metrics in the Operations console.
- Keep raw newsroom signals excluded from the alert outbox; P6.0.17 remains the safety boundary.

## Metrics
- active FCM device registrations
- distinct users with active FCM registrations
- active entity follow rows
- distinct users with active follows
- users that have both an active FCM registration and an active follow
- active canonical `DEVELOPING` events
- high/critical active canonical `DEVELOPING` events
- device users following an entity that currently has an active canonical `DEVELOPING` event
- PUSH outbox counts by `PENDING`, `DEFERRED`, `SENT`, `FAILED`, and `SUPPRESSED`

## Safety
- No database migration.
- No new public RPC.
- No service-role material reaches the browser.
- Metrics are computed inside the existing operator-authenticated Edge API using its existing service-role client.
- No push is generated, planned, leased, or sent by this slice.

## Hosted proof
Pending CI, deployment of the exact CI-built `cinerelay-console-api` bundle, and hosted Operations response verification.
