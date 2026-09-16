# Phase 4 Status — Free Source Expansion

Date: 2026-09-16

## Overall state

**Phase 4: ACTIVE**

Phase 3 is complete, hosted, browser-verified and merged to `main` through PR #3.

Active branch:

`phase-4/free-source-expansion`

Draft PR:

`#4 — Phase 4: free source expansion / RSS Atom foundation`

## Goal

Increase useful India-first cinema/series coverage without introducing mandatory paid APIs or an unmaintainable scraper farm.

Locked source priority:

1. official RSS/Atom feeds;
2. first-party studio/platform press/news pages;
3. Threads public-profile capabilities where permitted;
4. Instagram Professional-account capabilities where permitted;
5. trusted trade/media feeds/pages;
6. carefully selected additional public pages.

## P4.1 — Generic RSS/Atom connector foundation

**Implementation complete / hosted canary active / one real-new-item exit proof pending.**

### Implemented

- `packages/feed-connector` TypeScript package;
- RSS 2.0 + Atom parsing;
- normalized feed-entry contract and HTML-to-text normalization;
- stable item identity selection;
- first-poll baseline with no historical replay;
- later-poll delta planning;
- visible `FEED_WINDOW_GAP` recovery when the previous stable id falls outside the fetched window;
- conditional request validators (`ETag` / `Last-Modified`);
- adaptive poll intervals for `HOT_5M`, `ACTIVE_15M`, `NORMAL_60M`, `COLD_6H`, `DAILY`;
- exponential failure backoff capped at one day;
- `Retry-After` handling;
- HTTPS-only registration plus private/local-host and redirect revalidation guards;
- RSS + Atom fixtures and connector/delta canaries;
- `feed_source_state` database state;
- `connector_domain_state` per-domain request/rate-limit state;
- RLS on connector-state tables;
- service-role-only `register_feed_source(...)` RPC;
- pgTAP registration/security coverage;
- internal `feed-poll-worker` Edge Function;
- normal `raw_items` / `raw_item_revisions` / `PROCESS_RAW_ITEM` integration;
- connector run history + source health;
- scheduler dispatcher `feed-poll` action;
- hosted five-minute dispatcher wakeup with worker-enforced adaptive cadence;
- CI coverage for feed package, Edge type-checking/bundling and fresh migrations.

## Green engineering baseline

Final hardened pre-rollout CI:

- `CineRelay CI #200`
- run id `35060068842`
- green head `51c8930718c9382b8a2c63e08db7e97d9c60dfae`
- intelligence/connectors PASS;
- web-console PASS;
- all eleven Edge Functions PASS;
- fresh migrations + pgTAP + DB lint PASS;
- deployment-native Edge bundle PASS.

## Hosted production state

Hosted migration ledger:

`20260916053710_generic_feed_connector`

Active Phase-4 runtime:

- `feed-poll-worker` v1 ACTIVE;
- `cinerelay-scheduler-dispatch` v2 ACTIVE.

Hosted feed cron:

- job id `5`;
- name `cinerelay-feed-poll`;
- schedule `*/5 * * * *`.

The cron is only a scheduler heartbeat. External request cadence remains controlled by each source's `next_check_at`, poll class and per-domain spacing/rate limits.

## First official production canary

Source:

**The Walt Disney Company**

- canonical newsroom: `https://thewaltdisneycompany.com/news/`
- official feed: `https://thewaltdisneycompany.com/feed/`
- source identity: `3ac40489-7669-403f-9433-8fbfa8346a63`
- authority tier: `1`
- connector: `RSS_ATOM`
- access mode: `FEED`
- initial poll class: `ACTIVE_15M`

### Baseline poll — PASS

First production request at `2026-09-16 05:50:50 UTC`:

- HTTP `200`;
- 50 existing entries observed;
- newest stable id baselined;
- ETag captured;
- Last-Modified captured;
- raw items created: `0`;
- connector run `SUCCEEDED`;
- source health `HEALTHY`;
- `gap_count = 0`.

This proves a new official feed does not dump its historical backlog into CineRelay.

### Conditional poll — PASS

After the per-domain politeness interval elapsed, a second hosted request at `2026-09-16 05:51:51 UTC` returned:

- HTTP `304 Not Modified`;
- connector run `SUCCEEDED`;
- items seen/new/changed: `0 / 0 / 0`;
- raw item count remained `0`;
- `consecutive_not_modified = 1`;
- source health remained `HEALTHY`;
- `gap_count = 0`.

This proves production conditional polling is working and unchanged feeds are not reprocessed.

Full proof:

`docs/07-execution/PHASE4_P4_1_HOSTED_CANARY_PROOF_2026-09-16.md`

## P4.1 exit gate

Completed:

1. connector/unit/delta canaries PASS;
2. fresh database migration startup + pgTAP + lint PASS;
3. `feed-poll-worker` type-check/bundle PASS;
4. hosted migration + worker rollout complete;
5. genuine official RSS source registered;
6. first-poll anti-backlog behavior proven;
7. ETag/Last-Modified conditional request proven with real HTTP 304;
8. source/domain health and adaptive scheduling observable;
9. no mandatory recurring paid API introduced.

Still pending:

10. a genuinely new official Disney feed entry published after the baseline must be discovered through hosted conditional polling, persisted exactly once as a raw item/revision, enter the normal intelligence pipeline, and remain duplicate-free on a later unchanged poll.

Do **not** merge PR #4 until that real-new-item proof exists.

## Next slices after P4.1

- **P4.2** first-party studio/platform press/news connector framework;
- parser versioning + drift detection for HTML sources;
- source-discovery candidate workflow;
- larger curated India-first source expansion only after reliability is measured.

## Guardrails

- official/direct sources first;
- do not use aggressive scraping;
- respect conditional HTTP, rate limits and source-specific cadence;
- parser failures must become visible health errors rather than silent data loss;
- do not auto-promote discovered identities to trusted authority;
- source count is not a success metric; precision, recall, latency and connector health are.

_Last updated: 2026-09-16_
