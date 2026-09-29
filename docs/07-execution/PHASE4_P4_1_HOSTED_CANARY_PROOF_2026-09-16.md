# Phase 4 P4.1 — Hosted RSS/Atom Canary Proof

Date: 2026-09-16

## Result

P4.1 hosted rollout is active. Conditional fetch, anti-backlog behavior, scheduler cadence, raw/revision persistence, processor compatibility and duplicate suppression have all been proven in hosted production.

One release-closing condition intentionally remains: a genuinely new **official** feed entry must arrive after the official baseline and pass the same path. Synthetic transport proof does not satisfy that authority/evidence gate.

## Green engineering baselines

Initial hardened rollout baseline:

- workflow: `CineRelay CI`
- run: `#200`
- run id: `35060068842`
- head: `51c8930718c9382b8a2c63e08db7e97d9c60dfae`
- intelligence/connectors: PASS
- web-console: PASS
- all eleven Edge Functions: PASS
- fresh migrations + pgTAP + DB lint: PASS
- deployment-native Edge bundle: PASS

Processor-contract hardening baseline after hosted synthetic discovery exposed a payload mismatch:

- workflow: `CineRelay CI`
- run: `#210`
- run id: `35062375532`
- head: `9bf373b0e7f67f1c813875360e0e49de4e19d229`
- intelligence/connectors + feed/processing contract canary: PASS
- web-console: PASS
- all eleven Edge Functions: PASS
- fresh migrations + pgTAP + DB lint: PASS
- deployment-native Edge bundle: PASS
- `cinerelay-edge-bundle` artifact id `10433440612`, digest `sha256:f6956e10f554ecd09fcadc4431bbeed23b7c71bdd4086458bfea683dad1c858d`
- `cinerelay-edge-deploy-bundle` artifact id `10433251440`, digest `sha256:11ec636a31e670e0d27d6251d9fbf57d396b80d5e218568eb0bc52415dbffaae`

## Hosted schema/runtime rollout

Hosted Supabase project:

`dnqaejljfzwhsainpdxb`

Applied hosted migration ledger entry:

`20260916053710_generic_feed_connector`

The committed migration is reconciled to that exact hosted version so Git and production migration history remain aligned.

Active Phase-4 runtime includes:

- `feed-poll-worker` v1 ACTIVE
- `cinerelay-scheduler-dispatch` v2 ACTIVE
- `process-raw-item-worker` v11 ACTIVE, deployed from the green #210 deployment-native bundle

`verify_jwt=false` remains intentional for these internal worker paths because they enforce CineRelay's independent internal/scheduler secrets.

The feed worker provides:

- RSS 2.0 + Atom parsing;
- stable entry identity;
- first-poll baseline with no historical replay;
- later-poll delta planning;
- visible `FEED_WINDOW_GAP` recovery when the previous stable id falls outside the fetched window;
- conditional HTTP via `ETag` / `Last-Modified`;
- `Retry-After` and exponential failure backoff;
- per-domain spacing/rate-limit state;
- HTTPS-only source registration;
- private/local host rejection and redirect revalidation;
- source health + connector run observability;
- normal raw/revision/processing integration;
- RLS + service-role-only connector-state access.

## Official production canary — The Walt Disney Company

Canonical newsroom:

`https://thewaltdisneycompany.com/news/`

Official feed:

`https://thewaltdisneycompany.com/feed/`

CineRelay source identity:

`3ac40489-7669-403f-9433-8fbfa8346a63`

Registration posture:

- authority tier: `1`
- source role: `PRODUCTION_HOUSE`
- platform: `RSS`
- connector: `RSS_ATOM`
- access mode: `FEED`
- initial poll class: `ACTIVE_15M`
- parser version: `feed-parser-v1`

### Baseline poll — PASS

Before the first request:

- `last_entry_id = null`
- raw items = `0`
- connector runs = `0`
- source health = `HEALTHY`

First production poll at `2026-09-16 05:50:50 UTC`:

- HTTP `200`
- feed entries observed: `50`
- new raw items: `0`
- changed raw items: `0`
- connector run: `SUCCEEDED`
- health: `HEALTHY`
- `gap_count = 0`

Baseline marker:

`https://thewaltdisneycompany.com/?p=53240&#038;post_type=news`

Validators captured:

- ETag: `"d9d9e7e76f4b874da06c51ba8eb41b4f-gzip"`
- Last-Modified: `Tue, 15 Sep 2026 19:18:09 GMT`

This proves an existing official feed can be onboarded without replaying its historical archive.

### Conditional request — PASS

Second production poll at `2026-09-16 05:51:51 UTC`:

- HTTP `304 Not Modified`
- connector run: `SUCCEEDED`
- items seen/new/changed: `0 / 0 / 0`
- raw items remained `0`
- `consecutive_not_modified = 1`
- health: `HEALTHY`
- `gap_count = 0`

This proves hosted conditional validators are sent and honored when the publisher returns 304.

### Natural scheduler repeat — PASS

A later automatic Disney poll at `2026-09-16 06:10:01 UTC` returned HTTP `200` rather than 304, but the stable id was unchanged. CineRelay created **0 raw items**, kept `gap_count = 0`, and source health remained `HEALTHY`.

This separately proves duplicate suppression is correct even when a publisher ignores/does not satisfy a conditional validator and resends the full feed body.

## Production scheduler — PASS

Hosted cron job:

- job id: `5`
- name: `cinerelay-feed-poll`
- schedule: `*/5 * * * *`

The first automatic heartbeat at `2026-09-16 05:55:00 UTC` completed with pg_cron status `succeeded`. It did not make an early Disney network request because Disney was not due; the worker correctly left the prior `last_checked_at` and connector-run count unchanged.

The five-minute cron is therefore only a dispatcher heartbeat. Source cadence remains governed by `feed_source_state.next_check_at` and per-domain limits.

## Hosted synthetic transport canary — PASS, not an authority gate

To prove the new-item transport path without fabricating or altering an official publisher's evidence, a temporary Tier-5 `TEST_CANARY` source used two repository-hosted RSS fixtures:

- V1 baseline stable id: `cinerelay-hosted-canary-a`
- V2 new stable id: `cinerelay-hosted-canary-b`

The fixture content was explicitly synthetic and non-cinema. It cannot satisfy the official-source exit gate.

### V1 baseline

- HTTP `200`
- ETag captured
- baseline id set to `cinerelay-hosted-canary-a`
- raw items: `0`
- health: `HEALTHY`

### V2 delta discovery

After the per-domain spacing interval, V2 was polled:

- newest id advanced to `cinerelay-hosted-canary-b`
- exactly `1` raw item created
- exactly `1` initial raw-item revision created
- `gap_count = 0`
- health remained `HEALTHY`

The resulting `PROCESS_RAW_ITEM` job initially entered `RETRY_WAIT` with `invalid_job_payload`. This exposed a real cross-connector contract mismatch: the existing YouTube producer supplied `{ rawItemId, sourceIdentityId }`, while the first feed implementation supplied only `{ rawItemId }`; the processor required both.

## Processor contract fix — PASS

The fix is defensive on both sides:

1. new feed jobs now enqueue `{ rawItemId, sourceIdentityId }`;
2. `process-raw-item-worker` accepts an older/minimal job containing `rawItemId` only and derives the authoritative source identity from `raw_items.source_identity_id`;
3. if a caller supplies a conflicting `sourceIdentityId`, the processor still rejects it with `source_identity_mismatch`.

A regression canary was added to CI and #210 passed fully.

`process-raw-item-worker` v11 was then deployed from the exact #210 deployment-native artifact. The parked synthetic job was released for its final attempt and completed successfully:

- job state: `SUCCEEDED`
- attempt: `5 / 5`
- `last_error = null`
- one resolution row
- resolution state: `UNRESOLVED`
- revision count remained `1`
- event evidence count: `0`

This is the desired truthful behavior for non-cinema synthetic text: transport succeeds, resolution remains unresolved, and no canonical event is fabricated.

### Duplicate repeat after successful processing

The same V2 feed was polled again unchanged:

- HTTP `304`
- stable id remained `cinerelay-hosted-canary-b`
- raw items remained `1`
- revisions remained `1`
- processing jobs remained `1`
- event evidence remained `0`
- `gap_count = 0`
- health remained `HEALTHY`

This proves hosted idempotency across fetch, persistence, job enqueue and event creation.

The temporary synthetic production source is removed after proof; repository fixtures remain as regression fixtures.

## Remaining P4.1 release gate

Do not mark P4.1 release-complete or merge PR #4 yet.

A genuinely new official Disney feed entry published after the established official baseline must be discovered by hosted polling and must prove:

1. the new stable id is detected after the previous baseline id;
2. exactly one `raw_items` record is created;
3. exactly one initial `raw_item_revisions` record is attached;
4. `PROCESS_RAW_ITEM` succeeds under the hardened processor contract;
5. resolution/classification remains truthful, including `UNRESOLVED` when appropriate;
6. canonical intelligence is created only when evidence/classification justifies it;
7. a later unchanged poll creates no duplicate raw item/revision/event;
8. source/domain health remains observable and healthy unless a real provider/parser failure occurs.

Until that real official item arrives, PR #4 remains draft and unmerged.
