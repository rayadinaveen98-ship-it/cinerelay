# Phase 3 Status — Internal Web Intelligence Console

Date: 2026-09-15

## Overall state

**Phase 3: ACTIVE / P3.1–P3.5 IMPLEMENTED + HOSTED / P3.6 CODE HARDENING COMPLETE / EXTERNAL OPERATOR + CLOUDFLARE QA REMAINS**

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
- Tailwind internal-console UI;
- Supabase magic-link authentication;
- `operator_users` allowlist;
- browser receives only Supabase URL + publishable key;
- service-role and connector secrets remain server-side;
- `cinerelay-console-api` validates `auth.getUser()` and the active operator allowlist before privileged reads;
- overview and source-health metrics;
- web build/type coverage in CI.

Hosted negative security proof includes:

- request `3024`: no Authorization -> `401 authentication_required`;
- request `3015`: invalid bearer -> `401 invalid_session`;
- after the P3.6 v5 deployment, request `3634`: no Authorization -> `401 authentication_required`;
- after the P3.6 v5 deployment, request `3635`: invalid bearer -> `401 invalid_session`.

As of the current checkpoint, hosted Auth still has `0` users and `operator_users` has `0` active operators. Therefore the real authenticated canaries remain external P3.6 gates:

1. authenticated non-operator -> `403 operator_access_required`;
2. allowlisted operator -> `200` with real console data.

No synthetic personal credential is fabricated to bypass those gates.

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

Hosted scheduler proof continues to show all four recurring jobs active with successful latest runs:

- `cinerelay-youtube-enrichment` — every minute;
- `cinerelay-process-raw-item` — every minute;
- `cinerelay-youtube-fallback` — every 5 minutes;
- `cinerelay-youtube-maintenance` — every 10 minutes.

Request `3080` proved the operations surface rejects unauthenticated access with `401 authentication_required`.

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
- `anon` and ordinary `authenticated` have no direct override-table access and no correction-RPC execute privilege.

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

After two test-only corrections during development, **CI #168 / run `34965690108` passed all four jobs**:

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
- direct role checks confirm `anon` and ordinary `authenticated` cannot select override rows or execute correction RPCs; `service_role` retains the required execution privilege;
- production active override rows remain `0`;
- production ADMIN audit actions remain `0`;
- no production intelligence decision was changed during rollout.

The two harmless hosted verification-history entries are now reconciled into Git exactly as:

- `supabase/migrations/20260915115543_noop_verify_operator_review_workflow.sql`;
- `supabase/migrations/20260915115553_operator_review_workflow_verify_cleanup.sql`.

They change no product data or behavior; their purpose is migration-ledger parity between Git/local CI and hosted production.

## P3.6 — QA + hosted internal console

### Code/security hardening completed

P3.6 now includes:

- Overview `Unresolved` metric switched from historical `entity_resolution_results` to latest-only `current_entity_resolution_results`;
- Cloudflare Pages SPA fallback retained through `apps/web/public/_redirects`;
- Cloudflare static security headers added through `apps/web/public/_headers`;
- hashed static assets configured for immutable caching while the HTML/auth shell remains no-store;
- strict browser security policy/CSP for the static console;
- CI browser-bundle scan rejects privileged credential markers such as service-role, internal admin, WebSub master, and YouTube API secret names;
- CI uploads a static console `dist` artifact after build/security checks.

### Final hardening CI baseline

**CI #174 / run `34966684998`: PASS across all four jobs.**

Passed gates:

- intelligence/connectors: PASS;
- web-console build: PASS;
- static-host contract + forbidden-secret scan: PASS;
- all ten Edge Functions: PASS;
- PostgreSQL migrations + 53 pgTAP tests + DB lint: PASS.

Exact head:

`77f26c4cadab919e3aeb871872577a9f5fc8802e`

Artifacts:

- Edge deploy bundle `10395063082`, digest `sha256:7e6ed7926071f075fba6782b67766280f1194b93c9a89c684b15983889103356`;
- static console build `10395149789`, digest `sha256:dd4ff547bf472475ff9a37705525075a5d21dac82550e5e27b38881c3826f0ea`;
- verified Edge source bundle `10395153015`, digest `sha256:0366ae4f8c1cf7a60ff1b9fcf5ef516f68511c5906e071ac0724acd804e1935f`.

The static `dist` artifact proves the build and static-host contract. The eventual Cloudflare production build still must inject only the public build-time values `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; no privileged key belongs in the browser.

### Hosted v5 proof

`cinerelay-console-api` was deployed from the exact CI #174 deployment artifact only:

- `cinerelay-console-api` -> **v5 ACTIVE**;
- request `3634` -> `401 authentication_required`;
- request `3635` -> `401 invalid_session`;
- all four recurring CineRelay scheduler jobs remained active and latest status `succeeded` after deployment.

Production state at this checkpoint:

- Auth users: `0`;
- active operators: `0`;
- active operator resolution overrides: `0`;
- ADMIN audit actions: `0`;
- current unresolved queue: `18`.

The increase in unresolved work reflects real new ingestion, not a historical-count bug; the v5 Overview uses the latest-resolution view.

### Remaining truthful external gates

1. first genuine Supabase Auth user through the normal login flow;
2. authenticated non-operator -> `403 operator_access_required` proof;
3. add the intended user to `operator_users` and prove allowlisted operator -> `200`;
4. signed-in browser QA for overview/feed/event detail/operations/review queue;
5. perform a real review mutation only when an operator has adequate evidence and intends the correction — do not alter production merely to satisfy QA;
6. deploy the static React application to the locked production host, Cloudflare Pages, with the public Supabase build-time values;
7. verify Cloudflare deep links, auth callback, refresh persistence, CSP/security headers and browser-secret absence;
8. final PR readiness decision after those real-account/browser gates are complete.

Cloudflare Pages remains the production target. The current ChatGPT session has no direct Cloudflare deployment connector. A plugin-directory search also found no dedicated Cloudflare connector, so the production-host action cannot be truthfully executed here without an external authenticated browser/account step. Vercel remains optional preview-only and is not adopted as a required dependency.

## Non-goals

Do not expand Phase 3 into public accounts, Android UI, mass source onboarding, Instagram/X ingestion, broad scraping, community features, or paid infrastructure.

## Exit criteria

Phase 3 is complete only when an authenticated operator can use the hosted console to inspect ingestion, trace evidence, review unresolved work, inspect operations health, perform supported audited corrections safely, reload persistent backend state, and do so without service-role material in the browser or required recurring infrastructure cost.

_Last updated: 2026-09-15_
