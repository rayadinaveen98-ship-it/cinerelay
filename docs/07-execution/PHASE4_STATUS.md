# Phase 4 Status — Free Source Expansion

Date: 2026-09-16

## Overall state

**Phase 4: ACTIVE**

Phase 3 is complete, hosted, browser-verified and merged to `main` through PR #3.

Phase-4 branches / PRs:

- `phase-4/free-source-expansion` — draft PR #4, P4.1 RSS/Atom foundation;
- `phase-4/first-party-pages` — draft PR #5 stacked on PR #4, P4.2 first-party HTML/newsroom foundation.

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

### Implemented

- generic RSS 2.0 + Atom parsing;
- normalized entry contract and stable identity;
- first-poll baseline with no historical replay;
- delta planning + visible `FEED_WINDOW_GAP` recovery;
- ETag / Last-Modified conditional requests;
- adaptive polling, exponential backoff and `Retry-After`;
- HTTPS-only registration plus private/local-host and redirect guards;
- shared per-domain request/rate-limit state;
- RLS + service-role-only connector state and registration;
- normal `raw_items -> raw_item_revisions -> PROCESS_RAW_ITEM` integration;
- source health + connector-run telemetry;
- five-minute scheduler heartbeat with worker-enforced source cadence;
- processor contract hardening for cross-connector jobs.

### Hosted production

Migration ledger:

`20260916053710_generic_feed_connector`

Runtime:

- `feed-poll-worker` v1 ACTIVE;
- `process-raw-item-worker` v11 ACTIVE;
- scheduler dispatcher is now v3 because P4.2 added the page action; existing feed action remains active.

Feed cron:

- job `5`;
- `cinerelay-feed-poll`;
- `*/5 * * * *`.

### Official canary — The Walt Disney Company

- official feed: `https://thewaltdisneycompany.com/feed/`;
- source identity: `3ac40489-7669-403f-9433-8fbfa8346a63`;
- authority tier `1`;
- poll class `ACTIVE_15M`.

Proven:

- first request HTTP 200, 50 historical entries observed, zero historical import;
- ETag + Last-Modified captured;
- second request HTTP 304 with zero duplicate work;
- later HTTP 200 full-body unchanged responses also produce zero duplicates;
- health remains HEALTHY and `gap_count = 0`;
- scheduler heartbeat succeeds without forcing early source requests;
- hosted synthetic two-version transport canary proved exactly one raw item + one revision + successful truthful processing + duplicate-free repeat;
- synthetic production test data was deleted after proof.

Latest Disney check during P4.2 rollout:

- `2026-09-16 06:45:01 UTC`;
- HTTP 200;
- stable id unchanged;
- raw items `0`;
- health `HEALTHY`;
- gap count `0`.

Still pending before PR #4 merge:

A genuinely new official Disney feed entry published after the baseline must pass the same raw/revision/processing/idempotency path. Synthetic proof does not replace this authority/evidence gate.

Full P4.1 proof:

`docs/07-execution/PHASE4_P4_1_HOSTED_CANARY_PROOF_2026-09-16.md`

---

## P4.2 — First-party studio/platform newsroom pages

**Implementation complete / hosted baseline + idempotency proof complete / one real official-new-item release gate pending.**

P4.2 is intentionally stacked on P4.1 through draft PR #5.

### Implemented

- `packages/web-page-connector`;
- pinned `node-html-parser@7.0.1`;
- declarative parser profiles rather than site-specific scraper code;
- CSS selector profiles plus resilient `@self` anchor discovery;
- canonical URL cleanup + tracking parameter removal;
- URL include/exclude filtering;
- title/summary/date/author extraction;
- stable item identity;
- first-poll anti-backlog baseline;
- later delta planning + page-window gap detection;
- structure fingerprinting;
- `HEALTHY` / `DEGRADED` / `PARSER_BROKEN` drift assessment;
- duplicate image-first anchor regression protection;
- conditional HTTP, adaptive polling, exponential backoff and `Retry-After`;
- HTTPS-only/private-host/redirect safety guards;
- 5 MB page cap and bounded redirects/timeouts;
- shared `connector_domain_state` throttling;
- `page_source_state` service-role-only runtime state;
- `register_page_source(...)` service-role-only RPC;
- normal `raw_items -> raw_item_revisions -> PROCESS_RAW_ITEM` integration;
- `page-poll-worker`;
- scheduler dispatcher `page-poll` action;
- hosted five-minute page scheduler heartbeat definition;
- pgTAP registration/security tests;
- deployment-native CI bundle with HTML parser externalized through its pinned Deno npm import.

### Green engineering baseline

Production-eligible CI:

- `CineRelay CI #229`;
- run id `35066491404`;
- head `38ca4ca383eb62c9718756af253e2fc6ee51cbf2`;
- intelligence/connectors PASS;
- web console PASS;
- all Edge checks PASS;
- `page-poll-worker` type-check PASS;
- deployment-native bundle PASS;
- fresh migrations + pgTAP + DB lint PASS.

#229 artifacts:

- Edge source `10434531734`, digest `sha256:db211cb7ac22019496b53870dc43771a1cc7c549ef5de398d00ef04713bdeef1`;
- Edge deploy `10434178224`, digest `sha256:1a47b6957781d392015d0bf3bd6b6f9aa165014809b5bf792c14ff86e6006bd1`.

### Hosted production

Migration ledger:

`20260916065601_first_party_page_connector`

Git migration history was reconciled to that exact hosted version.

Runtime:

- `page-poll-worker` v1 ACTIVE;
- `cinerelay-scheduler-dispatch` v3 ACTIVE;
- `process-raw-item-worker` v11 ACTIVE.

Page cron:

- job `6`;
- `cinerelay-page-poll`;
- `*/5 * * * *`.

Supabase security/performance advisors found no new blocking P4.2 issue. `page_source_state` has the expected informational RLS-with-no-policy notice because it is intentionally service-role-only with direct `public`, `anon` and `authenticated` access revoked.

### Official India-first canary — About Amazon India / Prime Video

Official page:

`https://www.aboutamazon.in/news/tag/prime-video`

CineRelay identity:

- source id `070f383a-721f-4e07-8f59-2674be453d79`;
- source identity `60e520f8-7840-46b9-b09e-d8a507d3c339`;
- authority tier `1`;
- source role `OTT_PLATFORM`;
- territory `IN`;
- platform `WEB`;
- connector `FIRST_PARTY_HTML`;
- access mode `PUBLIC_WEB`;
- poll class `ACTIVE_15M`.

The parser profile is URL-pattern driven and does not depend on volatile visual card classes.

#### Fail-closed profile proof

The first stored profile accidentally over-escaped the dots in its JavaScript URL regex.

At `2026-09-16 07:09:11 UTC`:

- HTTP 200;
- extracted items `0`;
- configured minimum `5`;
- health became `PARSER_BROKEN`;
- error `PAGE_SELECTOR_UNDER_MINIMUM`;
- connector run FAILED;
- raw items remained `0`;
- baseline remained null.

This proved bad parser configuration fails closed rather than advancing the baseline or ingesting incorrect data.

The profile was corrected and versioned as `about-amazon-india-prime-video-v2`; the failure history was preserved.

#### Corrected baseline — PASS

At `2026-09-16 07:10:18 UTC`:

- HTTP 200;
- `12` official articles parsed;
- newest official article URL baselined;
- structure fingerprint `7352c78a`;
- run SUCCEEDED;
- health HEALTHY;
- gap count `0`;
- raw items `0`;
- revisions `0`.

This proves first-party page onboarding does not replay historical archives.

#### Unchanged full-body repeat — PASS

At `2026-09-16 07:11:04 UTC` About Amazon returned HTTP 200 again.

CineRelay parsed the same 12 items and kept:

- items new `0`;
- raw items `0`;
- revisions `0`;
- processing jobs `0`;
- gap count `0`;
- health HEALTHY.

This proves body-level idempotency even when the provider does not answer 304.

Full P4.2 proof:

`docs/07-execution/PHASE4_P4_2_HOSTED_CANARY_PROOF_2026-09-16.md`

### P4.2 remaining release gate

Before P4.2 can be release-closed, a genuinely new official About Amazon India Prime Video page item must appear after the baseline and prove exactly-once raw/revision/job processing plus duplicate-free repeat. Canonical intelligence must only be created when existing resolution/classification contracts justify it.

PR #5 remains draft while that proof is pending, and it remains stacked on PR #4 until P4.1 is ready to land.

---

## Next Phase-4 work

While P4.1/P4.2 real-new-item gates are being monitored by their hosted schedulers, the next planned expansion slices are:

- curated source-discovery candidate workflow;
- larger India-first official source graph only after reliability measurements;
- additional permitted free source capabilities in locked priority order.

## Guardrails

- official/direct sources first;
- no aggressive scraper farm;
- conditional HTTP and polite source-specific cadence;
- parser/provider failures must become visible health errors;
- parsing uncertainty must fail closed rather than silently advance state;
- do not auto-promote discovered identities to trusted authority;
- synthetic canaries may prove engineering transport but never substitute for official evidence gates;
- source count is not a success metric; precision, recall, latency, idempotency and connector health are.

_Last updated: 2026-09-16_
