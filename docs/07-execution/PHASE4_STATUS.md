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
- `phase-4/instagram-professional` — draft PR #8 stacked on #7 — P4.5 Instagram Professional / Business Discovery;
- `phase-4/trusted-trade-media` — draft PR #9 stacked on #8 — P4.6 audited trusted media RSS onboarding;
- `phase-4/selected-public-pages` — draft PR #10 stacked on #9 — P4.7 carefully selected public-page onboarding.

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

Hosted API began as `cinerelay-source-discovery-api` v1. P4.6 later advances the same API to v2 while preserving the P4.3 rule that approval alone creates no trusted source and assigns no authority.

Proven with a real Netflix Newsroom candidate:

- candidate/evidence storage and dedupe;
- authenticated operator review;
- audit persistence;
- approval does not create a trusted source;
- approval does not assign authority;
- promotion is a separate later operator action, never an approval side effect.

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

Final documentation-complete P4.5 head `ee5745b80227cf9ca5cd99470f6f07c51275265e` passed CineRelay CI #273 / run `35079201794` with all four jobs green.

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

## P4.6 — Audited trusted trade/media RSS onboarding

**Engineering complete / hosted foundation deployed / rights-compatible real-media canary pending.**

P4.6 adds an explicit second trust decision after P4.3 review. `APPROVED` remains non-promoting. Only an authenticated operator action can invoke the service-role-only promotion path.

First-slice policy:

- only `RSS_ATOM` candidates;
- Tier 3 -> `TRADE_MEDIA`;
- Tier 4 -> `GENERAL_MEDIA`;
- Tier 1/2 rejected;
- `HOT_5M` rejected;
- exact canonical registry duplicates rejected;
- unapproved candidates rejected;
- double promotion rejected;
- public-page candidates rejected by this RSS-only promotion path.

Promotion is atomic across source creation, RSS identity creation, existing generic-feed registration, source health initialization, candidate `PROMOTED` state, and audit persistence.

Canonical hosted migration:

`20260916094320_trusted_media_feed_promotion`

Canonical reconciliation CI:

- head `c614873f634f57568fe973327e75105cfd45d077`;
- CineRelay CI #279 / run `35081067614`;
- all four jobs PASS;
- fresh migrations + pgTAP + DB lint PASS;
- web console PASS;
- source-discovery API type-check + deployment-native bundle PASS.

Hosted runtime:

- `cinerelay-source-discovery-api` v2 ACTIVE;
- promotion RPC exists;
- authenticated direct RPC execution denied;
- media sources created by deployment `0`;
- promoted candidates created by deployment `0`;
- media identities created by deployment `0`.

The exact v2 runtime was deployed from CI #279 artifact `10440103147`, digest `sha256:fc1464343ad8bb36d56bb8c8d07cc77d565d1bb01bf3cb403917dac4d217d1b8`.

Canary rights gate:

The Indian Express entertainment/Telugu RSS feed was researched as a publisher-owned India-focused candidate, but its own RSS directory states RSS consumption is strictly for personal and non-commercial use unless relevant permission/licensing is obtained. It is therefore not enrolled into CineRelay production monitoring as the P4.6 canary.

Remaining production-canary gate: select a publisher-owned/trusted-media RSS source whose stated terms or explicit permission are compatible with CineRelay's intended use, then prove separate approval, explicit Tier-3/4 promotion, zero-history baseline, duplicate-free unchanged repeat, and one genuinely new item through the normal evidence pipeline while preserving lower media authority.

Full proof:

`docs/07-execution/PHASE4_P4_6_HOSTED_ENGINEERING_PROOF_2026-09-16.md`

---

## P4.7 — Carefully selected additional public pages

**Engineering complete / hosted foundation deployed / real selected-page canary pending.**

P4.7 completes the locked Phase-4 source-priority list without adding a new scraper framework. It reuses the production-hardened P4.2 page connector while keeping trust semantics separate from the technical parser-family identifier.

Policy:

- candidate must already be `APPROVED` and kind `PUBLIC_WEB`;
- approval remains non-promoting;
- Tier 3 -> `TRADE_MEDIA`;
- Tier 4 -> `GENERAL_MEDIA`;
- Tier 5 -> `DISCOVERY_ONLY`;
- Tier 1/2 rejected;
- cadence limited to `NORMAL_60M`, `COLD_6H`, or `DAILY`;
- bounded declarative parser profile required;
- exact canonical duplicates rejected;
- double promotion rejected;
- identity metadata records `sourceClass=SELECTED_PUBLIC_PAGE`;
- `FIRST_PARTY_HTML` is reused only as the existing parser/connector family and does not imply first-party authority.

Canonical hosted migration:

`20260916100515_selected_public_page_promotion`

Canonical migration-reconciliation CI:

- head `d1ae419eda4605c690eca7065ef9b6984de202f0`;
- CineRelay CI #288 / run `35084264282`;
- all four jobs PASS;
- fresh canonical migrations + pgTAP + DB lint PASS;
- web console build/static-host checks PASS;
- `cinerelay-public-page-onboarding-api` type-check + deployment-native bundle PASS.

Hosted runtime:

- `cinerelay-public-page-onboarding-api` v1 ACTIVE;
- function id `bb255c7a-a7ab-4b23-ba18-561eebf8dcbf`;
- runtime bundle SHA `7525b4bdf567dc4813fab427116b3296ad37985cfb9b5ac244748fcb181d5c50`;
- exact CI artifact `10440759028`;
- artifact digest `sha256:46397db0829f1caabb2a404676aeb9c4ce2eee90a91ba6b41485e0020194c4bc`.

Hosted no-side-effect verification:

- promotion RPC exists;
- authenticated direct RPC execution denied;
- selected public-page sources `0`;
- selected public-page identities `0`;
- selected public-page page-state rows `0`;
- promoted selected-page candidates `0`.

Supabase advisors show no new P4.7-specific finding.

The P4.7 console controls are implemented and CI-built on the stacked branch. Production Cloudflare Pages UI deployment is not claimed until the ordered branch stack reaches the normal console release path.

Remaining production-canary gate: choose a rights/usage-compatible real public page, validate its parser profile, review it separately, explicitly promote it at Tier 3/4/5, prove zero-history baseline and duplicate-free repeat, prove visible parser-drift failure, and prove one genuinely new page item through the normal evidence pipeline while preserving the source's lower authority.

Full proof:

`docs/07-execution/PHASE4_P4_7_HOSTED_ENGINEERING_PROOF_2026-09-16.md`

---

## Current release chain

1. P4.1 waits for one genuine post-baseline Disney feed item.
2. P4.2 waits for one genuine post-baseline Prime Video page item; parser recovery is already production-proven.
3. P4.3 trust-boundary proof is complete but remains stacked behind its parents.
4. P4.4 hosted foundation is complete and deliberately dormant until real Threads authorization + official-post proof.
5. P4.5 hosted foundation is complete and deliberately dormant until real Instagram Professional authorization + official-media proof.
6. P4.6 hosted trust-promotion foundation is complete; no media source was auto-trusted. It waits for a rights-compatible real media RSS canary and baseline/idempotency/new-item proof.
7. P4.7 hosted selected-page onboarding foundation is complete; no public page was auto-trusted. It waits for a rights/usage-compatible real page and parser/baseline/idempotency/drift/new-item proof.

The hosted P4.1/P4.2 schedulers continue watching their official canaries automatically while later Phase-4 engineering proceeds. P4.4/P4.5 remain dormant rather than generating credential failures before their external authorization gates are satisfied. P4.6/P4.7 remain operationally available to authenticated operators but have zero promoted lower-authority sources until their real-source evidence/rights gates are satisfied.

## Guardrails

- official/direct sources first;
- no aggressive scraper farm;
- use official APIs/feeds when available;
- conditional HTTP and polite source-specific cadence for public pages/feeds;
- provider/parser/auth failures must become visible health errors;
- parsing uncertainty fails closed rather than silently advancing state;
- candidate approval never auto-promotes trust;
- trusted-media promotion cannot assign Tier 1/2;
- selected-public-page promotion cannot assign Tier 1/2 and cannot poll faster than 60 minutes;
- selected-public-page parser profiles are bounded and operator-reviewed;
- public availability does not by itself establish reuse rights;
- synthetic canaries prove transport mechanics only, never official evidence;
- source count is not a success metric; precision, recall, latency, idempotency and connector health are.

_Last updated: 2026-09-16_
