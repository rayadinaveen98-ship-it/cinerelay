# Phase 4 Status — Free Source Expansion

Date: 2026-09-16

## Overall state

**Phase 4: ACTIVE**

Phase 3 is complete, hosted, browser-verified and merged to `main` through PR #3.

Phase-4 branches / PRs:

- `phase-4/free-source-expansion` — draft PR #4, P4.1 RSS/Atom foundation;
- `phase-4/first-party-pages` — draft PR #5 stacked on PR #4, P4.2 first-party HTML/newsroom foundation;
- `phase-4/source-discovery-candidates` — draft PR #6 stacked on PR #5, P4.3 curated candidate workflow;
- `phase-4/threads-public-profiles` — draft PR #7 stacked on PR #6, P4.4 official Threads public-profile API foundation.

## Goal

Increase useful India-first cinema/series coverage without introducing mandatory paid APIs or an unmaintainable scraper farm.

Locked source priority:

1. official RSS/Atom feeds;
2. first-party studio/platform press/news pages;
3. Threads public-profile capabilities where permitted;
4. Instagram Professional-account capabilities where permitted;
5. trusted trade/media feeds/pages;
6. carefully selected additional public pages.

---

## P4.1 — Generic RSS/Atom connector foundation

**Implementation complete / hosted engineering proof complete / one real official-new-item release gate pending.**

Implemented and hosted:

- generic RSS 2.0 + Atom parsing;
- first-poll anti-backlog baseline;
- stable identity + delta planning;
- `FEED_WINDOW_GAP` detection;
- ETag / Last-Modified conditional requests;
- adaptive polling, backoff and `Retry-After`;
- HTTPS/private-host/redirect guards;
- shared per-domain throttling;
- service-role-only runtime state/registration;
- normal `raw_items -> raw_item_revisions -> PROCESS_RAW_ITEM` integration;
- source health + connector-run telemetry;
- five-minute scheduler heartbeat with worker-enforced cadence.

Hosted migration:

`20260916053710_generic_feed_connector`

Hosted runtime:

- `feed-poll-worker` ACTIVE;
- `process-raw-item-worker` v11 ACTIVE;
- `cinerelay-feed-poll` cron job `5`, `*/5 * * * *`.

Official canary: The Walt Disney Company

- feed: `https://thewaltdisneycompany.com/feed/`;
- source identity: `3ac40489-7669-403f-9433-8fbfa8346a63`;
- authority tier `1`;
- poll class `ACTIVE_15M`.

Proven:

- 50 historical entries baselined with zero historical import;
- conditional `304` handling;
- unchanged `200` handling without duplicates;
- hosted synthetic exactly-once transport proof;
- healthy scheduler dispatch;
- gap count remains `0`.

Latest verified state on 2026-09-16:

- HTTP `304`;
- health `HEALTHY`;
- gap count `0`;
- raw items `0`.

Remaining gate:

A genuinely new official Disney feed entry published after the baseline must traverse the normal raw/revision/job path exactly once and repeat without duplicate work.

Full proof:

`docs/07-execution/PHASE4_P4_1_HOSTED_CANARY_PROOF_2026-09-16.md`

---

## P4.2 — First-party studio/platform newsroom pages

**Implementation complete / hosted baseline + idempotency + parser-drift recovery proven / one real official-new-item release gate pending.**

P4.2 is intentionally stacked on P4.1 through draft PR #5.

### Core implementation

- generic `packages/web-page-connector`;
- pinned `node-html-parser@7.0.1`;
- declarative parser profiles;
- CSS selector profiles plus resilient `@self` anchor discovery;
- accessible-title fallback from `aria-label` / `title` when visible text is absent;
- canonical URL cleanup + tracking removal;
- stable item identity;
- first-poll anti-backlog baseline;
- page-window gap detection;
- structure fingerprints + fail-closed parser drift assessment;
- conditional HTTP;
- adaptive polling/backoff;
- HTTPS/private-host/redirect guards;
- 5 MB cap + bounded redirects/timeouts;
- shared domain throttling;
- service-role-only `page_source_state` + registration RPC;
- normal raw/revision/job transport;
- `page-poll-worker` + `page-poll` scheduler action;
- pgTAP registration/security coverage.

Hosted migration:

`20260916065601_first_party_page_connector`

Hosted cron:

- job `6`;
- `cinerelay-page-poll`;
- `*/5 * * * *`.

### Official India-first canary — About Amazon India / Prime Video

Page:

`https://www.aboutamazon.in/news/tag/prime-video`

Source identity:

`60e520f8-7840-46b9-b09e-d8a507d3c339`

- authority tier `1`;
- source role `OTT_PLATFORM`;
- territory `IN`;
- connector `FIRST_PARTY_HTML`;
- access mode `PUBLIC_WEB`;
- poll class `ACTIVE_15M`;
- profile `about-amazon-india-prime-video-v2`.

Corrected baseline at `07:10:18 UTC`:

- HTTP `200`;
- 12 official items parsed;
- newest item baselined;
- structure fingerprint `7352c78a`;
- raw items/revisions `0 / 0`;
- health `HEALTHY`;
- gap count `0`.

Unchanged body repeat at `07:11:04 UTC` remained duplicate-free.

### Parser-drift incident and recovery — RESOLVED

At `07:50:01 UTC` the source failed closed:

- HTTP `200`;
- accepted items `0`;
- health `PARSER_BROKEN`;
- error `PAGE_SELECTOR_UNDER_MINIMUM`;
- baseline preserved;
- raw items/revisions/jobs remained `0 / 0 / 0`;
- gap count stayed `0`.

A controlled `08:00:51 UTC` retry reproduced the issue.

Investigation from the hosted Supabase region proved Amazon still returned the full server-rendered page with 229 total results and 12 first-page article cards. The root cause was generic title extraction against image-first accessible anchors: the usable article title could be carried by `aria-label` rather than visible text. An earlier manually pinned older worker version also made duplicate image-first anchors more fragile.

The generic parser was hardened to `first-party-html-v2` with title fallback through visible text, `aria-label`, and `title`, while preserving the rule that a stable URL is only marked seen after a usable title is established.

Regression coverage includes accessible image-first anchors and duplicate stable URLs.

Green P4.2 parent-branch CI:

- CineRelay CI `#253`;
- run `35072587450`;
- implementation head `fad8b209b405d9663945e99b65359e6b4b48c5bc`;
- all four jobs PASS;
- page worker type-check and deployment bundle PASS;
- fresh migrations + pgTAP + DB lint PASS.

Production recovery on `page-poll-worker` v4:

Controlled recovery at `08:11:07 UTC`:

- `SUCCEEDED`;
- items seen `12`;
- items new/changed `0 / 0`;
- health `HEALTHY`;
- parser `first-party-html-v2`;
- gap count `0`;
- raw/revision/job counts `0 / 0 / 0`.

Unattended automatic repeat:

- pg_cron job `6`, run id `5951`;
- cron started `08:15:00.042542 UTC`;
- cron status `succeeded`;
- page run started `08:15:01.973 UTC`;
- page run `SUCCEEDED`;
- items seen `12`;
- items new/changed `0 / 0`;
- health remained `HEALTHY`;
- gap count remained `0`;
- raw/revision/job counts remained `0 / 0 / 0`.

The historical drift count remains visible instead of being reset.

Incident proof:

`docs/07-execution/PHASE4_P4_2_PARSER_INCIDENT_2026-09-16.md`

Full P4.2 canary proof:

`docs/07-execution/PHASE4_P4_2_HOSTED_CANARY_PROOF_2026-09-16.md`

Remaining gate:

A genuinely new official About Amazon India Prime Video article published after the baseline must prove exactly-once raw/revision/job transport and duplicate-free repeat. The parser incident is resolved and does not change that authority/evidence gate.

---

## P4.3 — Curated source-discovery candidates

**Implementation complete / hosted trust-boundary proof complete / stacked UI rollout pending parent merges.**

P4.3 lives on `phase-4/source-discovery-candidates` through draft PR #6 and remains intentionally stacked on P4.2.

Implemented:

- service-role-only candidate/evidence registry;
- normalized URL + evidence dedupe;
- discovery provenance, proposed role, territory/languages and confidence metadata;
- `PENDING`, `REVIEWING`, `APPROVED`, `REJECTED`, `DUPLICATE`, reserved future `PROMOTED` states;
- audited operator review RPC;
- dedicated operator-authenticated source-discovery API;
- manual submit, queue, evidence and review UI under Sources & ops;
- explicit `Approve does not promote` boundary;
- no promotion API action;
- approval creates no trusted source or authority assignment.

Hosted migration:

`20260916075220_source_discovery_candidates`

Hosted API:

`cinerelay-source-discovery-api` v1 ACTIVE

Real hosted proof — Netflix Newsroom:

- candidate `https://about.netflix.com/en/newsroom`;
- official evidence attached;
- reviewed `APPROVED`;
- RPC returned `sourceCreated=false`;
- RPC returned `authorityAssigned=false`;
- trusted source count stayed `6`;
- trusted identity count stayed `6`;
- Netflix trusted identity count stayed `0`;
- one audit action persisted.

Full proof:

`docs/07-execution/PHASE4_P4_3_SOURCE_DISCOVERY_PROOF_2026-09-16.md`

PR #6 stays draft and stacked; it must not bypass P4.1/P4.2.

---

## P4.4 — Official Threads public-profile connector

**Engineering complete / hosted foundation deployed / real Meta credential + official-post release gate pending.**

P4.4 lives on `phase-4/threads-public-profiles` through draft PR #7 and remains intentionally stacked on P4.3.

Implemented:

- official Meta Threads API path only; no browser-session or public-page scraping;
- exact curated username normalization + registry-handle mismatch guard;
- first-poll anti-backlog baseline;
- bounded top-50 post delta with visible `THREADS_WINDOW_GAP` recovery signal;
- deterministic fixtures and connector canaries;
- service-role-only `threads_profile_source_state`;
- `register_threads_profile_source(...)` with strict `THREADS / THREADS_PROFILE_API / API` contract checks;
- RLS plus direct public/anon/authenticated privilege revocation;
- `threads-profile-poll-worker` with normal raw/revision/job transport;
- adaptive cadence/backoff and explicit `AUTH_REQUIRED`, `RATE_LIMITED`, `PARSER_BROKEN`, `DEGRADED`, `HEALTHY` state ownership;
- scheduler dispatcher action prepared;
- Meta token remains server-side and is CI-guarded against browser-bundle leakage.

Compatibility proof:

Fresh-db CI caught the first proposed `OFFICIAL_API` access-mode value because the frozen CineRelay contract already represents official programmatic access with `API`. P4.4 was corrected to reuse `API` instead of expanding the core enum.

Hosted migration:

`20260916085300_threads_public_profile_connector`

Hosted runtime:

- `threads-profile-poll-worker` v1 ACTIVE;
- `cinerelay-scheduler-dispatch` v4 ACTIVE;
- Threads identities `0`;
- Threads state rows `0`;
- Threads cron jobs `0`.

Hosted security verification:

- state-table RLS enabled;
- authenticated direct SELECT denied;
- authenticated registration-RPC execute denied.

Canonical reconciliation CI:

- head `1178a95263e42417246f306f84144ad6c2d5dc40`;
- CineRelay CI `#264` / run `35076303251`;
- all four jobs PASS.

Remaining gate:

P4.4 is not production-verified until a Meta Threads token with `threads_profile_discovery` is configured, one curated official cinema/OTT/studio profile baselines with zero historical replay, one genuine post-baseline official post travels exactly once through raw/revision/processing, an unchanged repeat produces no duplicate work, and invalid/expired auth is visibly represented as `AUTH_REQUIRED`.

No Threads pg_cron heartbeat is activated before that authorization gate.

Full proof:

`docs/07-execution/PHASE4_P4_4_HOSTED_ENGINEERING_PROOF_2026-09-16.md`

---

## Current release chain

1. P4.1 waits for one genuine post-baseline Disney feed item.
2. P4.2 waits for one genuine post-baseline Prime Video page item; parser-drift recovery is already resolved and production-proven.
3. P4.3 backend/trust-boundary proof is complete but remains stacked behind its parents.
4. P4.4 engineering + hosted foundation are complete; it waits on real Meta `threads_profile_discovery` authorization and a genuine post-baseline official Threads item before any cron activation or production-verification claim.

The hosted P4.1/P4.2 schedulers continue watching their official canaries automatically while further Phase-4 work proceeds. P4.4 remains deliberately dormant until its external authorization gate is met.

## Guardrails

- official/direct sources first;
- no aggressive scraper farm;
- conditional HTTP and polite source-specific cadence;
- parser/provider failures must become visible health errors;
- parsing uncertainty fails closed rather than silently advancing state;
- do not auto-promote discovered identities to trusted authority;
- synthetic canaries prove transport only, never official evidence;
- source count is not a success metric; precision, recall, latency, idempotency and connector health are.

_Last updated: 2026-09-16_
