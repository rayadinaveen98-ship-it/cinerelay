# Phase 3 Status — Internal Web Intelligence Console

Date: 2026-09-15

## Overall state

**Phase 3: ACTIVE / P3.1–P3.5 IMPLEMENTED / P3.6 HOSTED OPERATOR QA REMAINS**

Phase 2 is production-verified and merged to `main` through PR #2 at:

`e757afef33b18572c1438462621d98298d388cb5`

Phase 3 remains on:

`phase-3/internal-web-console`

Draft PR: `#3`.

The console is a private operator/debug/review surface over CineRelay's real production intelligence system. It is not a public consumer product.

## Production ingestion baseline

Authoritative ingestion remains:

`official uploads playlist -> authoritative discovery -> targeted enrichment -> raw/revision -> intelligence`

WebSub remains a best-effort low-latency accelerator rather than a correctness dependency.

## P3.1 — Web foundation + secure boundary

Implemented:

- React + TypeScript + Vite web app in `apps/web`;
- TanStack Router + Query;
- Tailwind internal console UI;
- Supabase magic-link authentication;
- `operator_users` allowlist;
- browser receives only Supabase URL + publishable key;
- service-role and connector secrets remain server-side;
- `cinerelay-console-api` validates `auth.getUser()` and the active operator allowlist before privileged reads;
- overview and source-health metrics;
- web build/type coverage in CI.

Hosted negative security proof:

- request `3024`: no Authorization -> `401 authentication_required`;
- request `3015`: invalid bearer -> `401 invalid_session`.

The project still has no genuine Supabase Auth operator user. Therefore the real authenticated canaries remain for P3.6:

1. authenticated non-operator -> `403 operator_access_required`;
2. allowlisted operator -> `200` with real console data.

No synthetic personal credential was fabricated to bypass that gate.

## P3.2 — Live intelligence feed

Implemented and hosted:

- authenticated canonical event feed;
- entity/title, event type, verification, priority, status and timestamps;
- source provenance;
- raw source title and official evidence URL;
- automatic refresh.

Real production proof uses the Family Pack canonical event from Mythri Movie Makers official YouTube evidence.

`cinerelay-console-api` v2 introduced this surface after CI #146 passed.

## P3.3 — Event/evidence detail + entity timeline

Implemented and hosted:

- canonical event detail;
- full attached evidence;
- original raw text/metadata;
- raw-item revision history;
- extracted claim context when present;
- source provenance;
- entity/title event timeline.

Production schema validation caught and corrected legitimate nullable fields before deployment, including `verification_confidence`.

CI #151 passed all four jobs. `cinerelay-console-api` v3 was deployed from its exact green artifact. Request `3060` proved unauthenticated event-detail access remains `401`.

## P3.4 — Source registry + health operations

Implemented and hosted:

- official source registry;
- source-health state and owned error details;
- authoritative YouTube discovery cadence and `fallback_gap_count`;
- WebSub lease/receipt telemetry;
- YouTube quota use;
- recent worker jobs;
- secret-free scheduler health RPC.

CI #156 passed all four jobs. `cinerelay-console-api` v4 was deployed from the exact green artifact.

Hosted scheduler proof showed all four recurring jobs active with successful latest runs:

- `cinerelay-youtube-enrichment` — every minute;
- `cinerelay-process-raw-item` — every minute;
- `cinerelay-youtube-fallback` — every 5 minutes;
- `cinerelay-youtube-maintenance` — every 10 minutes.

Request `3080` proved the operations surface still rejects unauthenticated access with `401 authentication_required`.

## P3.5 — Review/correction workflow

### Implemented

P3.5 adds an audited human-review layer without replacing the normal deterministic pipeline.

Database contract:

- `operator_resolution_overrides` stores durable operator-reviewed raw-item -> entity decisions;
- `current_entity_resolution_results` exposes only the latest resolution state per raw item so historical unresolved rows do not pollute the current review queue;
- operator resolution can bind an existing movie/series/season or create a missing entity;
- a resolution teaches `source_entity_candidates` with `OPERATOR_REVIEW` provenance;
- correction actions enqueue the normal `PROCESS_RAW_ITEM` worker rather than manufacturing events directly;
- clear-override returns the item to automatic resolution;
- canonical-event actions support audited suppress, reclassify and same-entity merge;
- operator suppression survives later deterministic event upserts;
- every mutation writes `audit_actions` before/after context and a required human reason.

Worker contract:

- `process-raw-item-worker` checks an active operator override before automatic source-scope resolution;
- override resolution is recorded as `RESOLVED / 1.0` with method `OPERATOR_OVERRIDE` and engine `operator-override-v1`;
- classification then continues through the same deterministic `processSingle` intelligence engine;
- without an override, Phase-2 automatic resolution behavior is unchanged.

Security boundary:

- P3.5 mutations live in a separate `cinerelay-review-api` Edge Function;
- it independently validates the Supabase Auth bearer token and active `operator_users` allowlist;
- raw RPC/table access is service-role only;
- `anon` and `authenticated` have no direct override-table access and no correction-RPC execute privilege.

Web workflow:

- current UNRESOLVED/AMBIGUOUS queue;
- evidence title/text and source context;
- existing-entity search;
- create-missing MOVIE/SERIES/SEASON flow;
- mandatory audit reason;
- resolve + normal reprocess;
- clear override;
- event suppress/reclassify/merge controls;
- recent operator audit history.

### Automated proof

CI #166 exposed only a synthetic fixture error (`poll_class = HOT`). The actual schema allows `PUSH`, `HOT_5M`, `ACTIVE_15M`, `NORMAL_60M`, `COLD_6H`, `DAILY`, or `MANUAL`.

CI #167 then reached every P3.5 behavior assertion: all behavior tests passed, but the test file declared 12 tests while running 13.

After correcting the pgTAP plan, **CI #168 / run `34965690108` passed all four jobs**:

- intelligence/connectors: PASS;
- web-console: PASS;
- all ten Edge Functions, including the review API and modified processor: PASS;
- PostgreSQL migrations + **53 pgTAP tests** + DB lint: PASS.

Green artifact:

- head: `3fbd4dac6db167e8f35791ee7c3e54dd540fdf33`;
- artifact id: `10394872074`;
- digest: `sha256:1f4c33d90db40230d97049907ea88909bfaf4022279a984d4ae96b063eaccbcd`.

### Hosted proof

Hosted migration `operator_review_workflow` applied successfully.

Exact CI #168 artifact deployments:

- `process-raw-item-worker` -> **v10 ACTIVE**;
- `cinerelay-review-api` -> **v1 ACTIVE**.

Post-deploy evidence:

- request `3127` to review API without Authorization -> `401 authentication_required`;
- scheduler request `3128` reached `process-raw-item-worker` v10 successfully -> HTTP 200, no queued work;
- production operator override rows: `0`;
- production ADMIN audit actions: `0`;
- current unresolved items: `12`;
- no production intelligence decision was changed during rollout;
- direct role checks confirm `anon` and ordinary `authenticated` cannot select override rows or execute correction RPCs; `service_role` retains the required execution privilege.

Two harmless hosted `DO` verification entries (`noop_verify_operator_review_workflow` and `operator_review_workflow_verify_cleanup`) were registered while checking migration state. They changed no data or product behavior and are recorded here so the hosted ledger is not mistaken for an untracked product migration.

## P3.6 — QA + hosted internal console

Remaining gates:

1. create the first genuine Supabase Auth operator account through the normal login flow;
2. prove authenticated non-operator -> 403;
3. add the intended operator to `operator_users` and prove -> 200;
4. exercise read-only overview/feed/detail/operations through the real signed-in browser;
5. exercise a deliberately selected review action only when there is sufficient human evidence and intent — do not mutate live intelligence merely to satisfy a test;
6. deploy the static React application to the locked free-first production host, Cloudflare Pages;
7. verify SPA deep links, auth callback, refresh persistence and browser-secret absence;
8. final security/CI/documentation pass and make PR #3 ready only after those gates are truthful.

Cloudflare Pages remains the production target. Vercel is not adopted as a required production dependency.

A small correctness polish remains before final close: switch the Overview `Unresolved` metric from historical `entity_resolution_results` rows to `current_entity_resolution_results`. At the current checkpoint both counts are 12, so there is no present display discrepancy, but the change is required before operator corrections begin.

## Non-goals

Do not expand Phase 3 into public accounts, Android UI, mass source onboarding, Instagram/X ingestion, broad scraping, community features, or paid infrastructure.

## Exit criteria

Phase 3 is complete only when an authenticated operator can use the hosted console to inspect ingestion, trace evidence, review unresolved work, inspect operations health, perform supported audited corrections safely, reload persistent backend state, and do so without service-role material in the browser or required recurring infrastructure cost.

_Last updated: 2026-09-15_
