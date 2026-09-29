# P6.0.16 — Review Trust Context

Status: **CI PROVEN**

Implementation head: `0bfd923080b6d54a328e42663894e5d780bb5e0e`

## Goal

Make lower-authority unresolved signals visibly different from established canonical intelligence before an operator binds or creates an entity.

No canonicalization, entity-resolution, verification, alert, or newsroom trust logic changed in this slice.

## Review UI changes

`apps/web/src/pages/ReviewWorkflow.tsx` now exposes, on every unresolved review card:

- explicit `Raw / unresolved signal` status;
- authority tier;
- source role;
- platform;
- source-published timestamp;
- CineRelay first-seen timestamp;
- source handle when present;
- connector type;
- access mode;
- warning that canonical identity and event trust are not established yet.

Existing audited actions remain unchanged:

- bind to existing entity;
- create reviewed MOVIE / SERIES / SEASON entity;
- mandatory audit reason;
- Resolve & reprocess;
- clear override;
- canonical event suppress/reclassify/merge controls.

## Real hosted grounding

The first natural trade-media delta, `Spirit: A crazy theater sequence featuring Prabhas is going to be wild?`, currently appears in the hosted resolution queue with:

- resolution: `UNRESOLVED`;
- score: 0;
- source: `123Telugu — Movie News`;
- authority tier: 3;
- source role: `TRADE_MEDIA`;
- platform: `RSS`;
- connector: `RSS_ATOM`;
- access mode: `FEED`;
- source published: `2026-09-16 18:30:53+00`;
- CineRelay first seen: `2026-09-16 18:40:01.94+00`.

These are the exact production fields now surfaced to an operator before any resolution action.

## CI proof

CineRelay CI #422 / run `35139264772`: **all green**.

- web console build: success;
- static-host contract: success;
- deployable web artifact: success;
- intelligence/connectors: success;
- strict Edge type-check/build/bundle: success;
- database migrations + pgTAP: success.

Android Canary #88 / run `35139264745`: **all green**.

- mobile APIs: success;
- Android build: success;
- APK/package verification: success;
- APK upload: success.

Artifacts:

- APK artifact `10464516745`, archive digest `sha256:1947145b802a6f2c462d21474cbe9840f66199626084f78774549fe13b7c0f88`;
- extracted APK SHA-256 `f0ffadaa7e773143757d2371eb872ded1f5e0ee898719cfd1b8e3be56d1aa424`;
- mobile API bundle `10463833494`, digest `sha256:9feac1373e007677958eb561343a590f2e554817747be531cf431480e784cb33`.

## Trust boundary retained

The operator review workflow remains the only safe path for creating/binding a missing canonical entity from an unresolved signal. `process-raw-item-worker` still does not invent entities, and the `Spirit` entity has not been manually inserted.

Alerts remain canonical-event-only per the locked Phase 5 contract; this review UI improvement does not make raw feed items eligible for push delivery.
