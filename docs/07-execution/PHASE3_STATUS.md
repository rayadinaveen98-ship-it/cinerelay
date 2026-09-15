# Phase 3 Status — Internal Web Intelligence Console

Date: 2026-09-15

## Overall state

**Phase 3: ACTIVE / P3.1–P3.5 IMPLEMENTED + HOSTED / P3.6 ENGINEERING COMPLETE / GENUINE OPERATOR + CLOUDFLARE BROWSER QA REMAINS**

Phase 2 is production-verified and merged to `main` through PR #2 at:

`e757afef33b18572c1438462621d98298d388cb5`

Phase 3 remains on:

`phase-3/internal-web-console`

Draft PR: `#3`.

The console is a private operator/debug/review surface over CineRelay's production intelligence system. It is not a public consumer product.

## Production ingestion baseline

Authoritative ingestion remains:

`official uploads playlist -> authoritative discovery -> targeted enrichment -> raw/revision -> intelligence`

WebSub remains a best-effort low-latency accelerator rather than a correctness dependency.

## P3.1 — Secure web foundation

Implemented:

- React + TypeScript + Vite internal console;
- TanStack Router + Query;
- Tailwind UI;
- Supabase magic-link Auth;
- `operator_users` server-side allowlist;
- browser receives only Supabase URL + publishable key;
- service-role and connector secrets remain server-side;
- `cinerelay-console-api` validates `auth.getUser()` and the active allowlist before privileged reads;
- overview and health metrics;
- web/Edge/database CI coverage.

Hosted negative auth proof:

- request `3024` -> `401 authentication_required`;
- request `3015` -> `401 invalid_session`;
- latest v5 request `3634` -> `401 authentication_required`;
- latest v5 request `3635` -> `401 invalid_session`.

Hosted Auth currently has `0` real users and `operator_users` has `0` active operators. Therefore authenticated `403` and allowlisted `200` canaries require a genuine user login and are deliberately not fabricated.

## P3.2 — Live intelligence feed

Implemented and hosted:

- canonical event feed from real production data;
- entity/title, event type, verification, priority, status and timestamps;
- source provenance and official evidence link;
- automatic refresh.

Real production proof includes the Family Pack canonical event backed by Mythri Movie Makers official YouTube evidence.

## P3.3 — Event/evidence detail + entity timeline

Implemented and hosted:

- canonical event detail;
- full evidence provenance;
- original raw text/metadata;
- raw revision history;
- claim context where present;
- source provenance;
- entity/title event timeline.

CI #151 passed all four jobs and `cinerelay-console-api` v3 was hosted from its exact green artifact.

## P3.4 — Source registry + operations

Implemented and hosted:

- official source registry;
- source health and owned error state;
- authoritative discovery cadence and `fallback_gap_count`;
- WebSub subscription/receipt telemetry;
- YouTube quota usage;
- recent worker jobs;
- secret-free scheduler health RPC.

CI #156 passed all four jobs and `cinerelay-console-api` v4 was hosted from its exact green artifact. Request `3080` proved unauthenticated operations access remains `401`.

All four production scheduler jobs remain active:

- `cinerelay-youtube-enrichment` — every minute;
- `cinerelay-process-raw-item` — every minute;
- `cinerelay-youtube-fallback` — every 5 minutes;
- `cinerelay-youtube-maintenance` — every 10 minutes.

## P3.5 — Audited review/correction workflow

### Database + worker contract

Implemented:

- `operator_resolution_overrides` stores durable operator-reviewed raw-item -> entity decisions;
- `current_entity_resolution_results` exposes the latest resolution per raw item;
- operator can bind an existing MOVIE/SERIES/SEASON or create a missing entity;
- reviewed resolution teaches `source_entity_candidates` with `OPERATOR_REVIEW` provenance;
- correction enqueues the normal `PROCESS_RAW_ITEM` path rather than manufacturing events;
- clear override returns the item to automatic resolution;
- audited event suppress/reclassify/same-entity merge;
- suppression survives later deterministic upserts;
- all mutations require a human reason and write before/after `audit_actions` context;
- `process-raw-item-worker` consumes an active override before automatic source-scope resolution;
- an override records `RESOLVED / 1.0`, method `OPERATOR_OVERRIDE`, engine `operator-override-v1`;
- normal deterministic classification remains in use after resolution.

### Security boundary

- mutations are isolated in `cinerelay-review-api`;
- API validates a real Supabase Auth session plus active `operator_users` allowlist;
- mutation tables/RPCs are `service_role` only;
- `anon` and ordinary `authenticated` cannot directly read overrides or execute correction RPCs.

### Web workflow

- current unresolved/ambiguous queue;
- evidence/source context;
- entity search;
- missing-entity creation;
- mandatory audit reason;
- resolve/reprocess and clear override;
- event suppress/reclassify/merge controls;
- recent audit history.

### Automated + hosted proof

CI #168 / run `34965690108` passed all four jobs after test-only fixture/plan corrections:

- 53 pgTAP tests PASS;
- DB lint PASS;
- web PASS;
- all ten Edge Functions PASS;
- intelligence/connectors PASS.

Hosted from its exact green artifact:

- `process-raw-item-worker` v10 ACTIVE;
- `cinerelay-review-api` v1 ACTIVE;
- request `3127` -> `401 authentication_required`;
- scheduler request `3128` reached processor v10 -> HTTP 200;
- production active overrides remain `0`;
- production ADMIN audit actions remain `0`;
- no live intelligence decision was mutated to satisfy QA.

## P3.6 — Engineering hardening

Implemented:

- Overview `Unresolved` metric now uses `current_entity_resolution_results`, not historical resolution rows;
- Cloudflare Pages SPA fallback in `apps/web/public/_redirects`;
- Cloudflare security/CSP contract in `apps/web/public/_headers`;
- immutable caching for hashed assets and no-store app shell;
- CI browser-bundle scan blocks privileged credential markers;
- CI uploads the static `dist` artifact;
- CI validates that the real browser-public Supabase URL and modern publishable key are bound into the emitted JavaScript;
- CI explicitly fails on unbound `VITE_SUPABASE_URL:void 0` or `VITE_SUPABASE_PUBLISHABLE_KEY:void 0` output.

### Important #174 artifact defect caught before hosting

CI #174 was green for compilation/security-marker checks, but direct inspection of its web artifact found that Vite runtime configuration had not been supplied. The emitted JavaScript contained undefined `VITE_SUPABASE_*` values, so that artifact would have failed at startup.

No Cloudflare deployment was made from that artifact.

The build workflow was repaired to bind only browser-safe public Supabase configuration and to assert the values exist in the emitted JavaScript. Privileged credentials remain forbidden.

### Migration-ledger reconciliation

Hosted P3.5 migration history was created by the Supabase migration tool with these real versions:

1. `20260915115439_operator_review_workflow`
2. `20260915115543_noop_verify_operator_review_workflow`
3. `20260915115553_operator_review_workflow_verify_cleanup`

Git now uses that exact version order. The operator-review migration content was moved from its former later timestamp without SQL changes; its Git blob SHA remained identical (`308755b5c464deabdd6fb430e19831854fead87a`).

Production ledger was rechecked and matches the same three versions/names exactly.

### Final engineering baseline — CI #181

**CineRelay CI #181 / run `34990528085`: PASS across all four jobs.**

Exact head:

`bcb3ca8e21754e9aa37ba22f2938db0105e229d4`

Proven in the same run:

- fresh PostgreSQL migration startup: PASS;
- all 53 pgTAP tests: PASS;
- DB lint: PASS;
- intelligence/connectors: PASS;
- all ten Edge Functions: PASS;
- environment-bound web build: PASS;
- Cloudflare static-host contract: PASS;
- browser public-config assertions: PASS;
- forbidden privileged-secret marker scan: PASS.

Artifacts:

- deployable web artifact `10405273418`, digest `sha256:e22653caf259c8e5ab68542ca5bc7c48234bb527365c95d179425e4934de7601`;
- Edge deploy bundle `10405841036`, digest `sha256:a04e527e243e5f032b1f4edeb15cb8018b5f58b392b2d9ffd1c736ad896fd4fc`;
- verified Edge source bundle `10405676678`, digest `sha256:9c618b6340888f53067fd9c90a96b729d969e4be2b1cb9efa468c5f64d35e5a0`.

Direct inspection of the exact #181 web artifact additionally confirmed:

- production Supabase project URL embedded;
- modern publishable key embedded;
- no undefined Vite config pattern;
- no privileged secret markers;
- `_redirects` present with SPA fallback;
- `_headers` present with the expected CSP/connect-src for the CineRelay Supabase project.

A local Chromium CLI smoke attempt could not complete in this container because the browser process itself did not function correctly in the headless/DBus environment. That is not counted as browser QA. Real browser QA remains a hosted P3.6 gate.

### Hosted console API baseline

`cinerelay-console-api` v5 remains ACTIVE. It was deployed from the exact #174 Edge artifact after the current-resolution metric change; no console source changed between #174 and #181, so no redundant Edge redeployment is required.

Latest hosted proof:

- request `3634` -> `401 authentication_required`;
- request `3635` -> `401 invalid_session`;
- scheduler jobs remained healthy after v5 deployment;
- Auth users: `0`;
- active operators: `0`;
- active operator overrides: `0`;
- ADMIN audit actions: `0`;
- last checked current unresolved queue: `18`.

## Remaining truthful external gates

1. first genuine Supabase Auth user through the normal login flow;
2. authenticated non-operator -> `403 operator_access_required`;
3. add the intended user to `operator_users` and prove allowlisted operator -> `200`;
4. signed-in browser QA for overview/feed/event detail/operations/review queue;
5. perform a real review mutation only when an operator has adequate evidence and actually intends the correction;
6. deploy the #181-equivalent environment-bound React build to Cloudflare Pages;
7. verify Cloudflare deep links, auth callback, refresh persistence, CSP/security headers and browser-secret absence;
8. make PR #3 ready only after those genuine account/browser gates are complete.

Cloudflare Pages remains the locked production host. This ChatGPT session has no dedicated Cloudflare deployment connector; do not silently substitute Vercel merely to close the gate.

## Non-goals

Do not expand Phase 3 into public accounts, Android UI, mass source onboarding, Instagram/X ingestion, broad scraping, community features, or paid infrastructure.

## Exit criteria

Phase 3 is complete only when an authenticated operator can use the hosted console to inspect ingestion, trace evidence, review unresolved work, inspect operations health, perform supported audited corrections safely, reload persistent backend state, and do so without service-role material in the browser or required recurring infrastructure cost.

_Last updated: 2026-09-15_
