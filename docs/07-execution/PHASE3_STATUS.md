# Phase 3 Status — Internal Web Intelligence Console

Date: 2026-09-16

## Overall state

**Phase 3: COMPLETE / BROWSER-VERIFIED / READY TO MERGE**

Phase 2 is production-verified and merged to `main` through PR #2 at:

`e757afef33b18572c1438462621d98298d388cb5`

Phase 3 branch:

`phase-3/internal-web-console`

PR: `#3`.

The CineRelay internal console is now implemented, hosted, authenticated, operator-gated, and verified in a real browser against production data.

## Production ingestion baseline

Authoritative ingestion remains:

`official uploads playlist -> authoritative discovery -> targeted enrichment -> raw/revision -> intelligence`

WebSub remains a best-effort low-latency accelerator rather than a correctness dependency.

## Implemented Phase-3 surface

### P3.1 — Secure web foundation

- React + TypeScript + Vite internal console;
- TanStack Router + Query;
- Supabase magic-link Auth;
- `operator_users` server-side allowlist;
- browser receives only Supabase URL + publishable key;
- service-role and connector secrets remain server-side;
- console API validates a genuine Supabase session plus active operator allowlist;
- overview and health metrics;
- web/Edge/database CI coverage.

### P3.2 — Live intelligence feed

- real canonical event feed;
- entity/title, event type, verification, priority and status;
- source provenance and official evidence links;
- automatic refresh.

### P3.3 — Event/evidence detail + entity timeline

- canonical event detail;
- full evidence provenance;
- original raw metadata/text;
- raw revision history;
- claim context where present;
- entity/title event timeline.

### P3.4 — Source registry + operations

- official source registry;
- source health and owned error state;
- authoritative discovery cadence and `fallback_gap_count`;
- WebSub lease/receipt telemetry;
- YouTube quota usage;
- recent worker jobs;
- secret-free scheduler health RPC.

### P3.5 — Audited review/correction workflow

- latest unresolved/ambiguous review queue;
- durable operator raw-item -> entity overrides;
- existing-entity binding or missing MOVIE/SERIES/SEASON creation;
- source candidate-scope learning with `OPERATOR_REVIEW` provenance;
- normal `PROCESS_RAW_ITEM` reprocessing after correction;
- audited clear override;
- audited event suppress/reclassify/same-entity merge;
- suppression persistence across deterministic re-upserts;
- mutation tables/RPCs restricted to `service_role`;
- separate authenticated `cinerelay-review-api`.

Hosted P3.5 runtime:

- `process-raw-item-worker` v10 ACTIVE;
- `cinerelay-review-api` v1 ACTIVE;
- production active overrides remain `0`;
- production ADMIN audit actions remain `0`;
- no production correction was fabricated for QA.

## P3.6 — Hosting, security and browser verification

### Engineering baseline

CI #181 / run `34990528085` passed all four jobs on the deployable environment-bound build:

- fresh database migration startup PASS;
- all 53 pgTAP tests PASS;
- DB lint PASS;
- intelligence/connectors PASS;
- all ten Edge Functions PASS;
- environment-bound web build PASS;
- Cloudflare static-host/browser-config/secret checks PASS.

Deployable web artifact:

- artifact `10405273418`;
- digest `sha256:e22653caf259c8e5ab68542ca5bc7c48234bb527365c95d179425e4934de7601`.

The documentation-consistent head `3c8e6f690d1f889f4a58afa5ec94cca3e576a52d` then passed CI #183 / run `34991225255` across all four jobs.

### Cloudflare Pages

Cloudflare Pages is live at:

`https://cinerelay-console.pages.dev`

Configuration:

- framework: React (Vite);
- root: `apps/web`;
- build: `npm run build`;
- output: `dist`;
- production branch during Phase-3 QA: `phase-3/internal-web-console`;
- build-time browser values limited to `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and pinned Node version.

Cloudflare's GitHub integration also reported the deployment successful on PR #3.

### Genuine auth/operator proof

A real hosted Supabase user completed the normal magic-link flow from the Cloudflare site.

Observed sequence:

1. genuine magic-link login succeeded;
2. signed-in user was correctly denied console data before allowlisting;
3. the same Auth user was inserted into `operator_users` with `active = true`;
4. browser refresh immediately loaded the real CineRelay console/live feed;
5. `/feed` deep-link and refresh remained authenticated;
6. operator allowlist count is now `1`.

Existing negative API canaries remain valid:

- request `3634` -> `401 authentication_required`;
- request `3635` -> `401 invalid_session`.

Post-allowlist hosted state:

- active operators: `1`;
- active operator resolution overrides: `0`;
- ADMIN audit actions: `0`;
- current review queue: `18` at the last check.

### Browser QA

The signed-in operator verified the live Cloudflare console in a real desktop browser:

- Overview loads correctly;
- Live feed loads production intelligence;
- event detail/timeline works;
- Sources & ops loads source/health/review information;
- System health loads;
- `/feed` refresh preserves the authenticated session.

No destructive or corrective production action was performed merely to satisfy QA.

## Migration parity

Git and hosted production use the same order:

1. `20260915115439_operator_review_workflow`
2. `20260915115543_noop_verify_operator_review_workflow`
3. `20260915115553_operator_review_workflow_verify_cleanup`

## Exit criteria result

Phase 3 exit criteria are satisfied: an authenticated allowlisted operator can use the hosted console to inspect production ingestion and intelligence, trace evidence, review unresolved work, inspect operations health, reload persistent backend state, and access controlled audited correction tools without privileged browser credentials or required recurring infrastructure cost.

## Post-merge action

After PR #3 merges to `main`, change Cloudflare Pages production branch from:

`phase-3/internal-web-console`

to:

`main`

Then verify one automatic production deployment from `main`.

_Last updated: 2026-09-16_
