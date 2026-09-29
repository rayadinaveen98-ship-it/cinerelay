# Phase 5.1 Hosted Engineering Proof — Alert Foundation

Date: 2026-09-16

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED**

## Scope

P5.1 establishes the durable user-alert planning boundary without coupling canonical event processing to Firebase Cloud Messaging or any other external delivery provider.

Alerts are planned from canonical CineRelay events, not raw posts. Canonical event processing writes only an idempotent outbox; provider delivery is intentionally deferred to P5.2.

## Canonical hosted migrations

- `20260916103904_alert_creator_foundation`
- `20260916103923_alert_creator_foundation_contract_fix`
- `20260916104832_alert_creator_foundation_index_hardening`

The Git migration filenames were reconciled to the exact hosted Supabase ledger versions before final canonical CI.

## Data model

Hosted P5.1 introduces:

- `user_entity_follows`;
- `user_alert_preferences`;
- `user_alert_event_preferences`;
- `alert_deliveries`.

The outbox uses a stable per-user/event/delivery-kind dedupe key so repeated evidence for the same canonical event cannot create repost-style alert spam.

## Alert behavior

The hosted planner supports:

- default HIGH-priority instant alerts;
- CRITICAL/HIGH/NORMAL/LOW minimum-priority filtering;
- developing-event opt-in/out;
- rumors disabled by default;
- explicit rumor opt-in;
- per-event-type enable/disable and mode overrides;
- INSTANT, DIGEST, BOTH and MUTED modes;
- IANA timezone validation;
- quiet-hours deferral;
- optional CRITICAL quiet-hours bypass;
- local digest-hour scheduling;
- no historical alert backfill for follows created after an event.

## Canonical event safety

During implementation CI caught a regression risk caused by replacing the canonical upsert with an older semantic shape. P5.1 fixes this with an ordered contract migration that preserves the latest operator-review guarantees before adding alert planning.

The final hosted `upsert_canonical_event_with_evidence(...)` therefore preserves:

- operator-suppressed events as `SUPPRESSED`;
- suppressed priority as `SUPPRESSED` during deterministic reprocessing;
- `operator-review-v1` classifier ownership;
- canonical event dedupe and verification-state strengthening;
- evidence repeat behavior;
- alert planning as the final idempotent step.

## Security boundary

Hosted verification proves:

- all four P5.1 tables have RLS enabled;
- user follows/preferences are owned by `auth.uid()`;
- UPDATE policies include both `USING` and `WITH CHECK` ownership predicates;
- authenticated users can read only their own alert outbox;
- authenticated users cannot insert/update/delete outbox rows;
- authenticated users cannot execute `plan_event_alerts(uuid)`;
- planner execution is reserved for the service role/internal event pipeline;
- relevant functions have explicit `search_path` configuration.

Hosted zero-side-effect state immediately after deployment:

- follow rows: `0`;
- global alert-preference rows: `0`;
- per-event preference rows: `0`;
- alert-delivery rows: `0`.

Deployment therefore created no synthetic user state and sent no notifications.

## CI proof

Pre-hosted functional gate:

- CineRelay CI #294 / run `35085925242` — PASS across all four jobs after contract/test fixes.

Final hosted-ledger canonical gate:

- head `21d8950e9bc95e14bff4ce194c49d06d32cd4fa9`;
- CineRelay CI #302 / run `35087024713`;
- intelligence-and-connectors: PASS;
- web-console: PASS;
- edge-functions: PASS;
- database-migrations: PASS;
- fresh migration application: PASS;
- pgTAP: PASS;
- database function lint: PASS.

The P5.1 pgTAP suite contains 24 assertions covering RLS boundaries, default eligibility, muted users, canonical dedupe, priority filtering, digest overrides, rumor filtering/opt-in, quiet hours, invalid timezone rejection, planner privilege denial, no historical backfill, suppression behavior, cross-user outbox isolation, and canonical evidence regression protection.

## Advisor proof

After the first hosted deployment, Supabase performance advisors identified one P5.1-specific unindexed foreign key on `user_alert_event_preferences.event_type`.

P5.1 added the covering index:

`user_alert_event_preferences_event_type_idx (event_type, user_id)`

After deployment, the unindexed-FK count decreased and the P5.1 finding disappeared. The new P5.1 indexes are currently reported as unused because the hosted P5.1 tables contain zero user data, which is expected at this stage.

Security advisors show no new P5.1-specific warning. Existing unrelated project findings remain outside this slice.

## Release boundary

P5.1 does **not** send push notifications. No FCM credentials, device tokens, sender cron, delivery worker or external provider call is introduced here.

That separation is intentional: ingestion/evidence persistence must remain correct even when the future push provider is unavailable.

## Next milestone

P5.2 will add:

1. authenticated device-token registration with ownership/RLS boundaries;
2. provider-neutral delivery leasing;
3. FCM sender isolation;
4. bounded retries/backoff;
5. terminal/dead-letter behavior;
6. invalid-token deactivation;
7. observability and scheduler integration;
8. tests proving provider failures cannot corrupt canonical event state.
