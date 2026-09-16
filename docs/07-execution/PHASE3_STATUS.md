# Phase 3 Status — Internal Web Intelligence Console

Date: 2026-09-16

## Overall state

**Phase 3: COMPLETE / HOSTED / BROWSER-VERIFIED / MERGED TO `main`**

Phase 2 is production-verified and merged to `main` through PR #2 at:

`e757afef33b18572c1438462621d98298d388cb5`

Phase 3 merged through PR #3 at:

`41c40c82b3bde93d8772095b15ad4ede7e170537`

The CineRelay internal console is implemented, hosted, authenticated, operator-gated, browser-verified against production data, and now part of `main`.

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

Hosted runtime:

- `cinerelay-console-api` v5 ACTIVE;
- `process-raw-item-worker` v10 ACTIVE;
- `cinerelay-review-api` v1 ACTIVE;
- active production overrides remain `0`;
- production ADMIN audit actions remain `0`.

## P3.6 — Hosting, security and browser verification

Cloudflare Pages is live at:

`https://cinerelay-console.pages.dev`

Configuration used for Phase-3 QA:

- framework: React (Vite);
- root: `apps/web`;
- build: `npm run build`;
- output: `dist`;
- production branch during QA: `phase-3/internal-web-console`;
- browser build values limited to `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and pinned Node version.

Real hosted auth/operator flow was verified:

1. genuine magic-link login succeeded;
2. signed-in non-operator was denied console data before allowlisting;
3. the same Auth user was activated in `operator_users`;
4. browser refresh loaded the real CineRelay console/live feed;
5. `/feed` deep-link and refresh remained authenticated;
6. operator allowlist count became `1`.

The signed-in operator verified:

- Overview;
- Live feed;
- event detail/timeline;
- Sources & ops;
- System health;
- review surfaces;
- session persistence on refresh.

No destructive or corrective production action was performed merely to satisfy QA.

## Final CI proof

CI #185 / run `35058385449` passed on final completion head:

`b9c6cdb35adea213093f244c9f3ec2845214e566`

Passed gates:

- intelligence/connectors;
- web-console;
- all ten Edge Functions;
- fresh database migration startup;
- all 53 pgTAP tests;
- DB lint;
- Cloudflare static-host/browser-config/secret checks.

## Migration parity

Git and hosted production use the same order:

1. `20260915115439_operator_review_workflow`
2. `20260915115543_noop_verify_operator_review_workflow`
3. `20260915115553_operator_review_workflow_verify_cleanup`

## Exit criteria result

Phase 3 exit criteria are satisfied: an authenticated allowlisted operator can use the hosted console to inspect production ingestion and intelligence, trace evidence, review unresolved work, inspect operations health, reload persistent backend state, and access controlled audited correction tools without privileged browser credentials or required recurring infrastructure cost.

## Remaining release bookkeeping

Cloudflare Pages must now switch its production branch from:

`phase-3/internal-web-console`

to:

`main`

Then verify one successful automatic deployment from `main`.

_Last updated: 2026-09-16_
