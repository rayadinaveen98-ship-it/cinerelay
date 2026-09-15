# Phase Status

Date: 2026-09-15

## Current status

**Phase 0 — Product Foundation: COMPLETE**  
**Phase 1 — Intelligence Core Skeleton: COMPLETE + merged to `main`**  
**Phase 2 — YouTube Production Connector: COMPLETE / PRODUCTION-VERIFIED / merged to `main`**  
**Phase 3 — Internal Web Intelligence Console: ACTIVE / P3.1–P3.5 HOSTED / P3.6 ENGINEERING COMPLETE / EXTERNAL OPERATOR + CLOUDFLARE QA REMAINS**

Phase 2 merged through PR #2 at:

`e757afef33b18572c1438462621d98298d388cb5`

Phase 3 branch:

`phase-3/internal-web-console`

Draft PR: `#3`.

## Production ingestion baseline

`official uploads playlist -> authoritative discovery -> targeted videos.list enrichment -> raw/revision persistence -> intelligence processing`

WebSub remains a best-effort accelerator, not a correctness dependency.

## Phase 3 implemented surface

P3.1–P3.5 are implemented, hosted and protected by the authenticated operator boundary:

- secure React/TypeScript internal console;
- live canonical intelligence feed;
- event/evidence detail and entity timeline;
- source registry, health, discovery, WebSub, quota, worker and scheduler diagnostics;
- current unresolved/ambiguous review queue;
- durable operator resolution overrides;
- entity binding/missing-entity creation;
- normal reprocessing after correction;
- audited clear/suppress/reclassify/merge actions;
- separate review API;
- direct mutation RPCs restricted to `service_role`.

Hosted P3.5 runtime remains:

- `process-raw-item-worker` v10 ACTIVE;
- `cinerelay-review-api` v1 ACTIVE;
- active production overrides `0`;
- production ADMIN audit actions `0`.

## P3.6 engineering status

Completed:

- Overview unresolved metric uses latest `current_entity_resolution_results`;
- Cloudflare SPA fallback and security/CSP headers;
- immutable asset caching + no-store app shell;
- privileged-secret marker scan for browser bundles;
- environment-bound production-like web build using only the browser-public Supabase URL + publishable key;
- explicit CI failure if Vite public config is unbound;
- exact hosted migration-ledger order reconciled in Git.

### CI #174 issue and correction

CI #174 compiled successfully, but direct inspection found its static artifact had undefined `VITE_SUPABASE_*` values and therefore was not a valid runtime deployment artifact. It was never deployed to Cloudflare.

The workflow now asserts that the real browser-public Supabase configuration is present in emitted JavaScript and that the prior `void 0` pattern is absent.

### Final engineering baseline — CI #181

Head:

`bcb3ca8e21754e9aa37ba22f2938db0105e229d4`

CineRelay CI #181 / run `34990528085`: **PASS across all four jobs**.

- fresh migrations: PASS;
- 53 pgTAP tests: PASS;
- DB lint: PASS;
- intelligence/connectors: PASS;
- all ten Edge Functions: PASS;
- environment-bound web build: PASS;
- static-host/CSP/browser-config/secret checks: PASS.

Artifacts:

- deployable web `10405273418`, digest `sha256:e22653caf259c8e5ab68542ca5bc7c48234bb527365c95d179425e4934de7601`;
- Edge deploy bundle `10405841036`, digest `sha256:a04e527e243e5f032b1f4edeb15cb8018b5f58b392b2d9ffd1c736ad896fd4fc`;
- Edge source bundle `10405676678`, digest `sha256:9c618b6340888f53067fd9c90a96b729d969e4be2b1cb9efa468c5f64d35e5a0`.

Direct inspection of the #181 web ZIP confirmed the public Supabase configuration is embedded, undefined Vite patterns are absent, privileged secret markers are absent, and Cloudflare `_headers` / `_redirects` are present.

Hosted console API remains `cinerelay-console-api` v5 ACTIVE. Console source did not change between #174 and #181, so no redundant redeployment is required.

Hosted negative auth canaries:

- request `3634` -> `401 authentication_required`;
- request `3635` -> `401 invalid_session`.

Latest checked hosted state:

- Auth users `0`;
- active operators `0`;
- active overrides `0`;
- ADMIN audit actions `0`;
- current unresolved queue `18`;
- recurring scheduler jobs healthy.

Migration parity is exact for:

1. `20260915115439_operator_review_workflow`
2. `20260915115543_noop_verify_operator_review_workflow`
3. `20260915115553_operator_review_workflow_verify_cleanup`

## Remaining Phase-3 truth gates

1. first genuine Supabase Auth login;
2. authenticated non-operator -> `403` proof;
3. allowlisted operator -> `200` proof;
4. signed-in browser QA for overview/feed/detail/operations/review queue;
5. Cloudflare Pages production deployment from the environment-bound build;
6. hosted deep-link/auth-callback/refresh/CSP/browser-secret verification;
7. real correction only if evidence and operator intent justify one;
8. mark PR #3 ready only after those genuine account/browser gates.

The current session has no dedicated Cloudflare deployment connector. Do not silently switch production hosting to Vercel merely to close the gate.

## Guardrails

Do not expand Phase 3 into broad Android UI, mass source onboarding, X/Instagram ingestion, broad scraping, public accounts, community features, or paid infrastructure before the internal-console gate is complete.

## Authoritative execution docs

- `docs/07-execution/PHASE3_STATUS.md`
- `docs/07-execution/PHASE2_STATUS.md`
- `docs/07-execution/PHASE2_AUTHORITATIVE_DISCOVERY_PROOF_2026-09-15.md`
- `docs/07-execution/PHASE2_YOUTUBE_OPERATIONS.md`

_Last updated: 2026-09-15_
