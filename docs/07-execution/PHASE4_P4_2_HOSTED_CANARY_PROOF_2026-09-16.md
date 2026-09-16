# Phase 4 P4.2 — Hosted First-Party Page Canary Proof

Date: 2026-09-16

## Result

P4.2 first-party HTML/newsroom connector foundation is implemented and hosted.

Engineering proof completed:

- declarative first-party HTML parser profiles;
- fail-closed parser drift detection;
- accessible-title extraction from visible text, `aria-label`, and `title`;
- first-poll anti-backlog baseline;
- conditional/full-body duplicate suppression;
- shared per-domain throttling/backoff;
- hosted service-role-only page state;
- hosted `page-poll-worker` and scheduler dispatch;
- automatic hosted cron heartbeat;
- hosted two-version synthetic new-item transport proof;
- one India-first official production canary;
- real parser-drift incident detection and production recovery.

A genuine post-baseline official page item is still required before P4.2 can be release-closed. Synthetic transport proof deliberately does not substitute for that authority/evidence gate.

## Current green engineering baseline

Actual P4.2 parent branch:

- workflow: `CineRelay CI`
- run: `#253`
- run id: `35072587450`
- implementation head: `fad8b209b405d9663945e99b65359e6b4b48c5bc`
- intelligence/connectors: PASS
- web console: PASS
- Edge Functions: PASS
- `page-poll-worker` Deno type-check: PASS
- deployment-native Edge bundle: PASS
- fresh migrations + pgTAP + DB lint: PASS

The generic parser version is now `first-party-html-v2`.

## Hosted schema/runtime rollout

Hosted Supabase project:

`dnqaejljfzwhsainpdxb`

Applied hosted migration ledger entry:

`20260916065601_first_party_page_connector`

Git was reconciled to that exact hosted version after application.

Active page runtime after recovery:

- `page-poll-worker` v4 ACTIVE
- parser telemetry `first-party-html-v2`
- scheduler dispatch remains active
- `process-raw-item-worker` remains active

`verify_jwt=false` remains intentional for the page worker and scheduler dispatcher because both use CineRelay's independent internal/scheduler-secret authentication boundary.

Hosted page cron:

- job id `6`
- name `cinerelay-page-poll`
- schedule `*/5 * * * *`

The five-minute job is only a scheduler heartbeat. External page requests remain gated by `page_source_state.next_check_at`, the source poll class, shared domain spacing and provider backoff.

## Official India-first production canary

Source:

**About Amazon India — Prime Video**

Official page:

`https://www.aboutamazon.in/news/tag/prime-video`

CineRelay source:

- source id `070f383a-721f-4e07-8f59-2674be453d79`
- source identity `60e520f8-7840-46b9-b09e-d8a507d3c339`
- authority tier `1`
- source role `OTT_PLATFORM`
- territory `IN`
- platform `WEB`
- connector `FIRST_PARTY_HTML`
- access mode `PUBLIC_WEB`
- poll class `ACTIVE_15M`
- parser profile `about-amazon-india-prime-video-v2`

The profile is deliberately URL-pattern driven instead of depending on brittle visual card class names. It scans anchors and accepts only first-party `aboutamazon.in` entertainment/company-news article URLs.

## Fail-closed profile validation proof

The initial stored profile accidentally over-escaped the dots in the JavaScript URL regex.

First hosted request at `2026-09-16 07:09:11 UTC`:

- HTTP `200`
- extracted items `0`
- configured minimum `5`
- source health `PARSER_BROKEN`
- error `PAGE_SELECTOR_UNDER_MINIMUM`
- connector run `FAILED`
- raw items remained `0`
- baseline id remained `null`

This proved a bad profile fails closed rather than accepting an empty parse and advancing the baseline.

The profile was corrected and versioned as:

`about-amazon-india-prime-video-v2`

The failure history was preserved for auditability.

## Corrected official baseline poll — PASS

At `2026-09-16 07:10:18 UTC`:

- HTTP `200`
- official page items parsed `12`
- newest official item baselined:
  `https://www.aboutamazon.in/news/entertainment/prime-videos-the-revolutionaries-starring-bhuvan-bam-rohit-saraf-to-release-worldwide-on-september-11`
- structure fingerprint `7352c78a`
- connector run `SUCCEEDED`
- source health `HEALTHY`
- gap count `0`
- historical raw items `0`
- historical revisions `0`

This proves the anti-backlog rule: onboarding a page establishes a baseline without replaying its archive.

## Official unchanged full-body repeat — PASS

At `2026-09-16 07:11:04 UTC` About Amazon returned HTTP `200` with the same 12-item window.

CineRelay kept:

- items new `0`
- raw items `0`
- revisions `0`
- processing jobs `0`
- gap count `0`
- source health `HEALTHY`

This proves body-level idempotency independently of provider cache-validator behavior.

## Hosted synthetic end-to-end page transport proof — PASS

A temporary Tier-5 `TEST_CANARY` source used two immutable HTML fixtures committed to the repository. It existed only to prove engineering transport and never counted as official evidence.

### V1 baseline

At `2026-09-16 07:14:57 UTC`:

- HTTP `200`
- one fixture article parsed
- baseline stable id `cinerelay-page-canary-a`
- raw items `0`
- revisions `0`
- run `SUCCEEDED`
- health `HEALTHY`
- gap/drift counts `0 / 0`

### V2 one-new-item delta

At `2026-09-16 07:16:10 UTC` V2 exposed baseline item A plus new item B:

- `itemsNew = 1`
- raw items exactly `1`
- initial revisions exactly `1`
- processing jobs exactly `1`
- gap/drift `0 / 0`
- source health `HEALTHY`

The normal `PROCESS_RAW_ITEM` worker completed at `07:16:37 UTC`:

- state `SUCCEEDED`
- attempt count `1`
- `last_error = null`
- revision count remained `1`
- resolution `UNRESOLVED`
- event evidence `0`

This is truthful for a Tier-5 synthetic item with no registered title scope: transport succeeds, resolution stays unresolved, and no canonical intelligence is fabricated.

### V2 unchanged repeat

The repeat returned HTTP `304` and remained exactly:

- raw items `1`
- revisions `1`
- processing jobs `1`
- event evidence `0`
- no new or changed item
- health `HEALTHY`
- gap/drift `0 / 0`

The temporary production source, identity, page state, raw item and processing job were then deleted. Only regression fixtures remain in Git.

## Production parser incident and recovery — PASS

At `07:50:01 UTC`, after earlier healthy polling, the official Prime Video canary returned HTTP `200` but the generic parser accepted zero items. CineRelay failed closed:

- health `PARSER_BROKEN`
- error `PAGE_SELECTOR_UNDER_MINIMUM`
- baseline unchanged
- gap count `0`
- raw items `0`
- revisions `0`
- processing jobs `0`

A controlled `08:00:51 UTC` retry reproduced the failure.

A direct request from the hosted Supabase region proved the provider still returned the complete server-rendered Next.js page with 229 results and the expected 12 first-page cards. The stored URL regex also matched the official URL correctly.

Root cause: current page cards can put the usable article title on image-first anchors through `aria-label`; visible inner text is not guaranteed on the first canonical anchor. An earlier manual runtime pin to an older parser also exposed a duplicate image-anchor weakness.

The generic parser was hardened rather than introducing Amazon-specific logic:

- parser version `first-party-html-v2`;
- visible title text first;
- then `aria-label`;
- then HTML `title`;
- stable URL only enters the duplicate set after a usable title exists;
- regression coverage added for accessible image-first anchors and duplicate URLs.

Production `page-poll-worker` v4 recovered at `08:11:07 UTC`:

- run `SUCCEEDED`
- items seen `12`
- items new/changed `0 / 0`
- health `HEALTHY`
- parser `first-party-html-v2`
- same baseline retained
- gap count `0`
- raw/revision/job counts `0 / 0 / 0`

The source was then marked due without manually dispatching the worker. Normal cron job `6`, run id `5951`, fired at `08:15:00.042542 UTC` and succeeded. The resulting page run at `08:15:01.973 UTC` also succeeded with 12 items and zero delta.

Post-automatic-repeat state:

- health `HEALTHY`
- parser `first-party-html-v2`
- profile `about-amazon-india-prime-video-v2`
- item count `12`
- same newest stable URL
- gap count `0`
- raw items `0`
- revisions `0`
- processing jobs `0`
- historical drift count retained for auditability.

Dedicated incident proof:

`docs/07-execution/PHASE4_P4_2_PARSER_INCIDENT_2026-09-16.md`

## Security/advisor verification

Supabase advisors introduced no new blocking P4.2 finding. `page_source_state` intentionally has RLS enabled without public policies because it is service-role-only and direct `public`, `anon` and `authenticated` access is revoked.

## Remaining P4.2 release proof

Do not release-close P4.2 yet.

A genuinely new article must appear on the official About Amazon India Prime Video page after the established baseline and prove:

1. the new official stable URL is detected;
2. exactly one new `raw_items` row is created;
3. exactly one initial `raw_item_revisions` row is created;
4. one `PROCESS_RAW_ITEM` job is enqueued and succeeds;
5. resolution/classification remains truthful, including `UNRESOLVED` when no title scope is known;
6. canonical intelligence is created only when existing evidence/classification contracts justify it;
7. a later unchanged page produces no duplicate raw item/revision/job/event;
8. source/domain health remains observable;
9. structural drift continues to fail closed rather than silently advancing the baseline.

Transport/idempotency and parser-recovery behavior are already production-proven. The remaining gate is specifically a genuinely new official item.

PR #5 remains draft while this gate is pending and remains intentionally stacked on PR #4 until P4.1 is ready to land.
