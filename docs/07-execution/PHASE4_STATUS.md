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

**Implementation complete / hosted engineering proof complete / one real official-new-item release gate pending.**

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
- hosted two-version synthetic transport fixtures retained as regression fixtures;
- `feed_source_state` database state;
- `connector_domain_state` per-domain request/rate-limit state;
- RLS on connector-state tables;
- service-role-only `register_feed_source(...)` RPC;
- pgTAP registration/security coverage;
- internal `feed-poll-worker` Edge Function;
- normal `raw_items` / `raw_item_revisions` / `PROCESS_RAW_ITEM` integration;
- processor backward compatibility for minimal `{ rawItemId }` jobs while validating conflicting source IDs;
- connector run history + source health;
- scheduler dispatcher `feed-poll` action;
- hosted five-minute dispatcher wakeup with worker-enforced adaptive cadence;
- CI coverage for feed package, feed/processor contract, Edge type-checking/bundling and fresh migrations.

## Green engineering baselines

Initial hosted rollout:

- `CineRelay CI #200`
- run id `35060068842`
- head `51c8930718c9382b8a2c63e08db7e97d9c60dfae`
- all jobs PASS.

Processor-contract hardening after hosted synthetic proof exposed an integration mismatch:

- `CineRelay CI #210`
- run id `35062375532`
- head `9bf373b0e7f67f1c813875360e0e49de4e19d229`
- intelligence/connectors + processing-contract regression canary PASS;
- web-console PASS;
- all eleven Edge Functions PASS;
- fresh migrations + pgTAP + DB lint PASS;
- deployment-native Edge bundle PASS.

#210 deployment artifacts:

- edge source artifact `10433440612`, digest `sha256:f6956e10f554ecd09fcadc4431bbeed23b7c71bdd4086458bfea683dad1c858d`;
- deployment-native artifact `10433251440`, digest `sha256:11ec636a31e670e0d27d6251d9fbf57d396b80d5e218568eb0bc52415dbffaae`.

## Hosted production state

Hosted migration ledger:

`20260916053710_generic_feed_connector`

Active relevant runtime:

- `feed-poll-worker` v1 ACTIVE;
- `cinerelay-scheduler-dispatch` v2 ACTIVE;
- `process-raw-item-worker` v11 ACTIVE, deployed from the green #210 deployment-native artifact.

Hosted feed cron:

- job id `5`;
- name `cinerelay-feed-poll`;
- schedule `*/5 * * * *`.

The cron is only a scheduler heartbeat. External request cadence remains controlled by each source's `next_check_at`, poll class and per-domain spacing/rate limits.

## Official production canary — The Walt Disney Company

- canonical newsroom: `https://thewaltdisneycompany.com/news/`
- official feed: `https://thewaltdisneycompany.com/feed/`
- source identity: `3ac40489-7669-403f-9433-8fbfa8346a63`
- authority tier: `1`
- connector: `RSS_ATOM`
- access mode: `FEED`
- initial poll class: `ACTIVE_15M`.

### Baseline poll — PASS

At `2026-09-16 05:50:50 UTC`:

- HTTP `200`;
- 50 existing entries observed;
- newest stable id baselined;
- ETag + Last-Modified captured;
- raw items created: `0`;
- connector run `SUCCEEDED`;
- health `HEALTHY`;
- `gap_count = 0`.

### Conditional poll — PASS

At `2026-09-16 05:51:51 UTC`:

- HTTP `304 Not Modified`;
- connector run `SUCCEEDED`;
- items seen/new/changed `0 / 0 / 0`;
- raw items remained `0`;
- `consecutive_not_modified = 1`;
- health remained `HEALTHY`;
- `gap_count = 0`.

### Natural unchanged full-body repeat — PASS

At `2026-09-16 06:10:01 UTC`, Disney returned HTTP `200` instead of 304 but the newest stable id was unchanged. CineRelay still created `0` raw items, kept `gap_count = 0`, and health remained `HEALTHY`.

This proves both conditional-fetch efficiency and body-level duplicate suppression.

## Hosted scheduler proof — PASS

Cron job 5 first fired automatically at `2026-09-16 05:55:00 UTC` with status `succeeded`. Because Disney was not due, the worker made no early provider request. This proves the five-minute cron is a safe heartbeat rather than a forced five-minute source request.

## Hosted synthetic end-to-end transport proof — PASS

A temporary Tier-5 `TEST_CANARY` source was used only to verify transport behavior without fabricating official evidence.

V1 established a baseline with zero historical import. V2 introduced one synthetic delta item.

V2 produced:

- exactly `1` raw item;
- exactly `1` initial revision;
- `gap_count = 0`;
- health `HEALTHY`.

That first processing job exposed a real payload-contract mismatch: the feed producer supplied only `rawItemId`, while the processor required `rawItemId + sourceIdentityId`.

The branch was hardened so:

1. new feed jobs supply both IDs;
2. the processor can derive the source identity from the authoritative raw row for an older/minimal job;
3. a conflicting caller-supplied source identity is still rejected.

After CI #210 passed, `process-raw-item-worker` v11 was deployed. The parked synthetic retry then completed:

- state `SUCCEEDED`;
- attempt `5 / 5`;
- `last_error = null`;
- latest resolution `UNRESOLVED`;
- revision count remained `1`;
- event evidence `0`.

An unchanged repeat then returned HTTP `304` and left counts at exactly:

- raw items `1`;
- revisions `1`;
- processing jobs `1`;
- event evidence `0`.

The temporary hosted synthetic source/job/raw data was then fully removed. Repository fixture files remain as regression canaries.

Full hosted proof:

`docs/07-execution/PHASE4_P4_1_HOSTED_CANARY_PROOF_2026-09-16.md`

## P4.1 exit gate

Completed:

1. connector/unit/delta canaries PASS;
2. fresh database migration startup + pgTAP + lint PASS;
3. Edge type-check/bundle PASS;
4. hosted migration + worker rollout complete;
5. genuine official RSS source registered;
6. first-poll anti-backlog behavior proven;
7. ETag/Last-Modified conditional request proven with real HTTP 304;
8. unchanged full-body response proven duplicate-free;
9. source/domain health and adaptive scheduling observable;
10. hosted new-item raw/revision/processing/idempotency path proven with a non-authoritative synthetic transport canary;
11. processor cross-connector contract hardened and production-verified;
12. no mandatory recurring paid API introduced.

Still pending before release-close / merge:

13. a **genuinely new official Disney feed entry** published after the official baseline must be discovered through hosted polling and pass the same raw/revision/processing/idempotency path. Synthetic proof deliberately does not substitute for this authority/evidence gate.

Do **not** merge PR #4 until that real official-new-item proof exists.

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
