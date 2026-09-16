# Phase 4 P4.1 — Hosted RSS/Atom Canary Proof

Date: 2026-09-16

## Result

P4.1 hosted rollout is active and the conditional-fetch / anti-backlog portion of the production gate is proven.

One exit condition remains before P4.1 can be release-closed: a genuinely new official feed entry must arrive after the baseline and flow through `raw_items -> raw_item_revisions -> PROCESS_RAW_ITEM` without duplicate spam.

## Green engineering baseline

Final hardened pre-rollout CI:

- workflow: `CineRelay CI`
- run: `#200`
- run id: `35060068842`
- green head: `51c8930718c9382b8a2c63e08db7e97d9c60dfae`
- intelligence/connectors: PASS
- web-console: PASS
- all eleven Edge Functions: PASS
- fresh migrations + pgTAP + DB lint: PASS
- deployment-native Edge bundle: PASS

Artifacts from that run:

- `cinerelay-edge-bundle`
  - artifact id `10432426039`
  - digest `sha256:023aa6141c33d64f0b9fa691552685150b3633da47a5d435789a64f2d372898a`
- `cinerelay-edge-deploy-bundle`
  - artifact id `10431639810`
  - digest `sha256:3053adba54daafe8bb8bd94670bd9ee3192a99f2bbd0310e82e51a2d1a58c9c5`

## Hosted schema/runtime rollout

Hosted Supabase project:

`dnqaejljfzwhsainpdxb`

Applied hosted migration ledger entry:

`20260916053710_generic_feed_connector`

The committed migration was reconciled to that exact hosted version after application so Git and production migration history remain aligned.

Active Phase-4 runtime:

- `feed-poll-worker` v1 ACTIVE
- `cinerelay-scheduler-dispatch` v2 ACTIVE
- `verify_jwt=false` remains intentional for both internal worker paths because they enforce CineRelay's independent internal/scheduler secrets.

The worker includes:

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

## First official production canary

Source:

**The Walt Disney Company**

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

## Baseline poll proof

Before the first request:

- `last_entry_id = null`
- raw items = `0`
- connector runs = `0`
- source health = `HEALTHY`

First production poll:

- checked at `2026-09-16 05:50:50 UTC`
- HTTP status `200`
- feed entries observed: `50`
- new raw items: `0`
- changed raw items: `0`
- connector run: `SUCCEEDED`
- source health remained `HEALTHY`
- `gap_count = 0`

Baseline marker selected:

`https://thewaltdisneycompany.com/?p=53240&#038;post_type=news`

Conditional validators captured:

- ETag: `"d9d9e7e76f4b874da06c51ba8eb41b4f-gzip"`
- Last-Modified: `Tue, 15 Sep 2026 19:18:09 GMT`

This proves the anti-backlog rule: an existing official feed can be onboarded without flooding CineRelay with its historical archive.

## Conditional-fetch proof

After the mandatory per-domain politeness interval elapsed, only the canary's scheduler due time was advanced for the verification request.

Second production poll:

- checked at `2026-09-16 05:51:51 UTC`
- HTTP status `304 Not Modified`
- connector run: `SUCCEEDED`
- items seen: `0`
- items new: `0`
- items changed: `0`
- raw item count remained `0`
- `consecutive_not_modified` advanced to `1`
- source health remained `HEALTHY`
- source health HTTP status became `304`
- `gap_count = 0`

This proves the hosted worker is actually sending and honoring conditional validators instead of redownloading/reprocessing the unchanged feed.

## Production scheduler

Hosted cron job:

- job id: `5`
- name: `cinerelay-feed-poll`
- schedule: `*/5 * * * *`

The five-minute cron is a dispatcher wakeup only. The worker itself enforces each source's adaptive cadence through `feed_source_state.next_check_at` plus per-domain limits, so a five-minute cron does not imply a five-minute external request per source.

## Remaining P4.1 exit proof

Do not mark P4.1 complete yet.

A genuinely new Disney feed entry published after the established baseline must be discovered by hosted conditional polling and must prove:

1. the new stable id is detected after the previous baseline id;
2. exactly one `raw_items` record is created;
3. exactly one initial `raw_item_revisions` record is attached;
4. a `PROCESS_RAW_ITEM` job is enqueued and succeeds;
5. resolution/classification remains truthful (including `UNRESOLVED` when appropriate);
6. a supported meaningful event creates canonical intelligence only when evidence/classification justifies it;
7. a later unchanged poll creates no duplicate raw item/revision/event;
8. source/domain health remains observable and healthy unless a real provider/parser failure occurs.

Until that real item arrives, PR #4 must remain draft and unmerged.
