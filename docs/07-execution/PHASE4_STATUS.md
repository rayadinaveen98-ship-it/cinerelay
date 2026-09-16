# Phase 4 Status — Free Source Expansion

Date: 2026-09-16

## Overall state

**Phase 4: ACTIVE**

Phase 3 is complete, hosted, browser-verified and merged to `main` through PR #3.

Phase-4 stack:

- `phase-4/free-source-expansion` — draft PR #4 — P4.1 RSS/Atom;
- `phase-4/first-party-pages` — draft PR #5 stacked on #4 — P4.2 first-party HTML/newsrooms;
- `phase-4/source-discovery-candidates` — draft PR #6 stacked on #5 — P4.3 curated candidate workflow;
- `phase-4/threads-public-profiles` — draft PR #7 stacked on #6 — P4.4 official Threads public-profile API;
- `phase-4/instagram-professional` — draft PR #8 stacked on #7 — P4.5 Instagram Professional / Business Discovery.

The stack must remain ordered. Child PRs must not bypass their parents to `main`.

## Goal

Increase useful India-first cinema/series coverage without mandatory paid APIs or an unmaintainable scraper farm.

Locked source priority:

1. official RSS/Atom feeds;
2. first-party studio/platform press/news pages;
3. Threads public-profile capabilities where permitted;
4. Instagram Professional-account capabilities where permitted;
5. trusted trade/media feeds/pages;
6. carefully selected additional public pages.

---

## P4.1 — Generic RSS/Atom connector

**Implementation complete / hosted engineering proof complete / genuine official-new-item gate pending.**

Hosted migration:

`20260916053710_generic_feed_connector`

Hosted runtime includes `feed-poll-worker`, `process-raw-item-worker` v11 and cron `cinerelay-feed-poll` every five minutes, with source-specific due times enforced by the worker.

Official canary: The Walt Disney Company feed.

Proven:

- first-poll anti-backlog baseline;
- conditional HTTP / 304 handling;
- unchanged 200 idempotency;
- hosted synthetic exactly-once transport;
- adaptive scheduling/backoff and source health;
- gap count remains zero.

Remaining release gate: one genuinely new Disney feed item published after baseline must traverse raw/revision/processing exactly once and repeat without duplicate work.

Full proof:

`docs/07-execution/PHASE4_P4_1_HOSTED_CANARY_PROOF_2026-09-16.md`

---

## P4.2 — First-party studio/platform pages

**Implementation complete / hosted baseline + idempotency + parser-drift recovery proven / genuine official-new-item gate pending.**

Hosted migration:

`20260916065601_first_party_page_connector`

Hosted runtime includes `page-poll-worker` v4 and cron `cinerelay-page-poll` every five minutes, with page-specific due times enforced by the worker.

Official India-first canary: About Amazon India / Prime Video.

Proven:

- first-poll anti-backlog baseline;
- conditional HTTP and adaptive polling;
- parser drift fails closed;
- accessible image-first anchor incident reproduced, diagnosed and fixed generically in `first-party-html-v2`;
- controlled recovery and unattended cron repeat remained duplicate-free;
- normal raw/revision/job path preserved.

Remaining release gate: one genuinely new About Amazon India Prime Video article after baseline must traverse raw/revision/processing exactly once and repeat without duplicate work.

Proof:

- `docs/07-execution/PHASE4_P4_2_PARSER_INCIDENT_2026-09-16.md`
- `docs/07-execution/PHASE4_P4_2_HOSTED_CANARY_PROOF_2026-09-16.md`

---

## P4.3 — Curated source-discovery candidates

**Implementation complete / hosted trust-boundary proof complete / stacked rollout pending parent merges.**

Hosted migration:

`20260916075220_source_discovery_candidates`

Hosted API:

`cinerelay-source-discovery-api` v1 ACTIVE

Proven with a real Netflix Newsroom candidate:

- candidate/evidence storage and dedupe;
- authenticated operator review;
- audit persistence;
- approval does not create a trusted source;
- approval does not assign authority;
- there is no automatic promotion API action.

Full proof:

`docs/07-execution/PHASE4_P4_3_SOURCE_DISCOVERY_PROOF_2026-09-16.md`

---

## P4.4 — Official Threads public-profile connector

**Engineering complete / hosted foundation deployed / real Meta credential + official-post gate pending.**

Hosted migration:

`20260916085300_threads_public_profile_connector`

Hosted runtime:

- `threads-profile-poll-worker` v1 ACTIVE;
- scheduler dispatcher subsequently advanced by P4.5;
- Threads identities `0`;
- Threads state rows `0`;
- Threads cron jobs `0`.

Proven:

- official Meta API path only;
- curated username mismatch guard;
- first-poll anti-backlog baseline;
- bounded post delta + visible `THREADS_WINDOW_GAP`;
- service-role-only state/RPC boundary;
- normal raw/revision/processing transport;
- auth/rate-limit/parser/fetch health ownership;
- browser secret-leak guard;
- hosted RLS and authenticated privilege denial.

Canonical P4.4 reconciliation CI: #264 / run `35076303251`, all four jobs PASS.

Remaining production gate: real Meta `threads_profile_discovery` authorization, one curated official profile baseline, one genuine post-baseline official item exactly once, duplicate-free repeat, and visible `AUTH_REQUIRED` behavior for invalid/expired authorization. No Threads cron is enabled before this gate.

Full proof:

`docs/07-execution/PHASE4_P4_4_HOSTED_ENGINEERING_PROOF_2026-09-16.md`

---

## P4.5 — Instagram Professional / Business Discovery

**Engineering complete / hosted foundation deployed / real Meta credential + official-media gate pending.**

P4.5 uses Meta's official Instagram API with Facebook Login / Business Discovery for curated external Instagram Professional Business/Creator accounts. It does not use browser-session scraping, private mobile APIs, consumer-account scraping or home-feed emulation.

Implemented:

- exact curated username normalization + mismatch guard;
- explicit server-configured Graph API version;
- Business Discovery request/parser contract;
- first-poll anti-backlog baseline;
- bounded media delta + visible `INSTAGRAM_WINDOW_GAP`;
- deterministic connector fixtures/canaries;
- service-role-only `instagram_business_source_state` and registration RPC;
- RLS plus direct public/anon/authenticated privilege revocation;
- `instagram-business-poll-worker` with normal raw/revision/processing transport;
- adaptive polling/backoff and explicit auth/rate-limit/parser/fetch/gap health states;
- Meta credentials remain server-side and are CI-guarded against browser-bundle leakage;
- scheduler dispatcher action prepared without enabling a production cron.

Canonical hosted migration:

`20260916091834_instagram_business_discovery_connector`

Hosted runtime:

- `instagram-business-poll-worker` v1 ACTIVE;
- `cinerelay-scheduler-dispatch` v5 ACTIVE;
- Instagram Business Discovery identities `0`;
- Instagram state rows `0`;
- Instagram cron jobs `0`.

Hosted security verification:

- state-table RLS enabled;
- authenticated direct SELECT denied;
- authenticated registration-RPC execute denied;
- deployment did not create or trust any Instagram source.

Canonical migration-reconciliation CI:

- head `a30e0011270d52aa6f61a7c001249a9d021408a5`;
- CineRelay CI #270 / run `35078724368`;
- all four jobs PASS;
- fresh migrations + pgTAP + DB lint PASS;
- Instagram connector and Edge deployment-native bundle PASS.

Remaining production gate:

1. authorize a Professional Instagram account linked to a Facebook Page;
2. configure valid server-side Facebook Login/Page API credentials and managed IG user ID;
3. register one curated official cinema/OTT/studio Business or Creator target;
4. baseline with zero historical replay;
5. ingest one genuinely new post-baseline official media item exactly once;
6. prove an unchanged repeat creates no duplicate work;
7. prove invalid/expired authorization becomes `AUTH_REQUIRED`.

No Instagram pg_cron heartbeat is enabled before this gate.

Full proof:

`docs/07-execution/PHASE4_P4_5_HOSTED_ENGINEERING_PROOF_2026-09-16.md`

---

## Current release chain

1. P4.1 waits for one genuine post-baseline Disney feed item.
2. P4.2 waits for one genuine post-baseline Prime Video page item; parser recovery is already production-proven.
3. P4.3 trust-boundary proof is complete but remains stacked behind its parents.
4. P4.4 hosted foundation is complete and deliberately dormant until real Threads authorization + official-post proof.
5. P4.5 hosted foundation is complete and deliberately dormant until real Instagram Professional authorization + official-media proof.

The hosted P4.1/P4.2 schedulers continue watching their official canaries automatically while later Phase-4 engineering proceeds. P4.4/P4.5 remain dormant rather than generating credential failures before their external authorization gates are satisfied.

## Guardrails

- official/direct sources first;
- no aggressive scraper farm;
- use official APIs/feeds when available;
- conditional HTTP and polite source-specific cadence for public pages/feeds;
- provider/parser/auth failures must become visible health errors;
- parsing uncertainty fails closed rather than silently advancing state;
- do not auto-promote discovered identities to trusted authority;
- synthetic canaries prove transport mechanics only, never official evidence;
- source count is not a success metric; precision, recall, latency, idempotency and connector health are.

_Last updated: 2026-09-16_
