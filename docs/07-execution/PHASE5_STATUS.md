# Phase 5 Status — Alert & Creator Intelligence

Date: 2026-09-16

State: **ENGINEERING SCOPE COMPLETE / HOSTED FOUNDATIONS DEPLOYED / PHASE EXIT GATE BLOCKED ONLY BY REAL FIREBASE + DEVICE DELIVERY PROOF**

Authoritative branch checkpoint:

`phase-5/evidence-backed-summaries`

Latest repository-complete P5.5 head before this status document:

`049ec13642dbd6e8ba644a189d8d5d135cec3117`

Documentation-complete CI for that head:

- CineRelay CI #333
- run `35097413390`
- intelligence/connectors PASS
- web console PASS
- Edge Functions PASS
- fresh migrations + full pgTAP + DB lint PASS

## Roadmap contract

Phase 5 exists to turn CineRelay's verified canonical event feed into a reliable creator workflow.

Locked Phase-5 build requirements:

- entity follows;
- event-type preferences;
- instant/high-priority alerts;
- quiet hours;
- digest modes;
- FCM delivery;
- alert dedupe;
- Creator Radar scoring;
- optional concise evidence-based summary;
- content-opportunity labels separated from factual verification.

All of those requirements now have implemented and CI-proven engineering foundations. The only unmet Phase-5 exit condition is real provider/device delivery proof for FCM.

## P5.1 — Alert & Follow Foundation

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED**

PR: `#11 — Phase 5.1: alert and follow foundation`

Delivered:

- user/entity follows;
- global and per-event alert preferences;
- quiet hours and digest scheduling;
- provider-neutral durable alert outbox;
- canonical-event-boundary alert planning;
- stable per-user/event/kind dedupe;
- rumor/developing controls;
- RLS ownership and service-only planner boundary;
- operator suppression/review semantics preserved.

Canonical hosted migrations:

- `20260916103904_alert_creator_foundation`
- `20260916103923_alert_creator_foundation_contract_fix`
- `20260916104832_alert_creator_foundation_index_hardening`

Documentation-complete CI: #304 / run `35087324843`.

## P5.2 — Device Delivery Infrastructure

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / REAL FIREBASE + DEVICE CANARY PENDING**

PR: `#12 — Phase 5.2: device delivery infrastructure`

Delivered:

- user-bound device registration API;
- service-owned device inventory;
- per-device delivery ledger;
- idempotent fan-out;
- delivery leasing + expired-lease recovery;
- bounded retry/backoff;
- FCM HTTP v1 worker;
- explicit `UNREGISTERED` deactivation;
- provider failure isolation from canonical event processing;
- scheduler action prepared with no production push cron.

Canonical hosted migrations:

- `20260916110813_push_delivery_foundation`
- `20260916110823_push_delivery_lease_invariant`
- `20260916111150_push_delivery_index_hardening`

Canonical runtime CI: #309 / run `35090401513`.

Remaining external gate:

1. configure a controlled Firebase service-account credential server-side;
2. register one authenticated real device;
3. prove one alert delivers exactly once;
4. prove transient retry/recovery;
5. prove explicit `UNREGISTERED` deactivation;
6. rerun hosted security/advisor verification;
7. only then enable unattended push delivery if operationally desired.

No Firebase credential, real device target or push cron has been added by engineering rollout.

## P5.3 — Digest Composition

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / UNATTENDED DIGEST CRON DELIBERATELY DISABLED**

PR: `#13 — Phase 5.3: digest composition`

Delivered:

- durable digest batches/items;
- bounded composition;
- `BUILDING -> READY` lifecycle;
- deterministic ordering and factual payloads;
- digest/PUSH isolation;
- idempotent repeat behavior;
- authenticated own-row reads only;
- internal worker + scheduler action.

Canonical hosted migration:

`20260916114913_digest_composition_foundation`

Canonical CI: #313 / run `35092445078`.

Hosted rollback canary proved bounded two-pass composition, READY transition and duplicate-free repeat.

## P5.4 — Creator Radar

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / UNATTENDED RADAR CRON DELIBERATELY DISABLED**

PR: `#14 — Phase 5.4: Creator Radar foundation`

Delivered:

- separate service-owned creator intelligence projection;
- deterministic 0–100 creator score;
- labels:
  - `SHORT_OPPORTUNITY`
  - `BREAKING_EXPLAINER`
  - `TRAILER_ANALYSIS`
  - `FOLLOW_UP_NEEDED`
  - `NO_ACTION`
- reason codes + factual input snapshot;
- bounded refresh;
- same-transaction stale detection;
- no mutation of event verification/priority/classification;
- internal worker + scheduler action.

Canonical hosted migration:

`20260916121143_creator_radar_foundation`

Canonical CI: #323 / run `35094571102`.

Hosted rollback canary proved deterministic scoring, content-opportunity labels, stale rescore and repeat idempotency.

## P5.5 — Evidence-Backed Concise Summaries

State: **ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / UNATTENDED SUMMARY CRON DELIBERATELY DISABLED**

PR: `#15 — Phase 5.5: evidence-backed concise summaries`

Delivered:

- separate summary projection per canonical event;
- `READY | WITHHELD` lifecycle;
- READY requires linked evidence;
- explicit provenance rows;
- deterministic conservative V1 wording;
- conflicting evidence surfaced rather than hidden;
- bounded refresh + same-transaction stale detection;
- no external model/provider dependency;
- no writes back to canonical `events.summary` or factual fields;
- internal worker + scheduler action.

Canonical hosted migration:

`20260916123420_evidence_backed_summaries`

Canonical hosted-ledger head:

`488f976c5512ed73459694b1b3e62808a04ba992`

Canonical CI: #330 / run `35096783409`.

Exact deployment artifact:

- artifact id `10445923788`
- digest `sha256:4be347048f8757aebbcb2fa5b33da10e5e9da50d269a613b1c33bc4749e2de52`

Hosted runtimes:

- `evidence-summary-worker` ACTIVE v1;
- `cinerelay-scheduler-dispatch` ACTIVE v9.

Hosted rollback canary proved READY/WITHHELD behavior, source/evidence ordering, conflict surfacing, same-transaction headline/evidence stale refresh, canonical-fact isolation and repeat refresh `0`.

Final repository-complete CI: #333 / run `35097413390`.

## Phase-5 security / reliability boundaries

These rules remain locked:

1. alerts originate from canonical events, not raw social posts;
2. delivery provider outages cannot corrupt canonical ingestion/event/evidence processing;
3. Creator Radar and content-opportunity labels are editorial assistance only and cannot change factual verification;
4. summaries are derived presentation and cannot become READY without evidence;
5. conflicting evidence must remain visible;
6. service-owned internal tables/RPCs are not directly exposed to normal authenticated clients;
7. unattended push/digest/Radar/summary scheduling is not enabled merely because engineering foundations exist;
8. real external/provider release gates are not replaced by synthetic tests.

## Phase-5 exit gate

Roadmap exit condition:

> The user can follow projects and reliably receive one useful alert for a meaningful event rather than many repost notifications.

Engineering support for that workflow is complete.

The exit gate remains **PENDING** until P5.2 completes a real Firebase + authenticated-device canary proving exactly-once useful delivery and failure/recovery behavior.

Until that external gate passes, Phase 6 Android V1 should not be declared underway as the next released phase. Preparatory analysis may be done, but the dependency quality gate must not be bypassed.

## Current next action

Obtain/configure the controlled Firebase server credential and one authenticated Android test device, then execute the P5.2 real-device release gate. After that proof is recorded and Phase 5 is formally closed, advance to Phase 6 Android V1.
