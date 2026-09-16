# Phase 4 P4.2 — Hosted First-Party Page Canary Proof

Date: 2026-09-16

## Result

P4.2 first-party HTML/newsroom connector foundation is implemented and hosted.

Engineering proof completed so far:

- declarative first-party HTML parser profiles;
- fail-closed parser drift detection;
- first-poll anti-backlog baseline;
- body-level duplicate suppression;
- shared per-domain throttling/backoff;
- hosted service-role-only page state;
- hosted `page-poll-worker` and scheduler dispatch;
- one India-first official production canary.

A genuine post-baseline official page item is still required before P4.2 can be release-closed. The hosted baseline and unchanged-repeat proofs do not substitute for that real new-item gate.

## Green engineering baseline

Production-eligible CI:

- workflow: `CineRelay CI`
- run: `#229`
- run id: `35066491404`
- head: `38ca4ca383eb62c9718756af253e2fc6ee51cbf2`
- intelligence/connectors: PASS
- web console: PASS
- Edge Functions: PASS
- `page-poll-worker` Deno type-check: PASS
- deployment-native Edge bundle: PASS
- fresh migrations + pgTAP + DB lint: PASS

Artifacts:

- Edge source artifact `10434531734`
  - digest `sha256:db211cb7ac22019496b53870dc43771a1cc7c549ef5de398d00ef04713bdeef1`
- deployment-native Edge artifact `10434178224`
  - digest `sha256:1a47b6957781d392015d0bf3bd6b6f9aa165014809b5bf792c14ff86e6006bd1`

The deployment bundle keeps `node-html-parser` external and resolves the pinned `npm:node-html-parser@7.0.1` through the function import map, reducing the deployment artifact substantially without changing tested behavior.

## Hosted schema/runtime rollout

Hosted Supabase project:

`dnqaejljfzwhsainpdxb`

Applied hosted migration ledger entry:

`20260916065601_first_party_page_connector`

Git was reconciled to that exact hosted version after application.

Active runtime:

- `page-poll-worker` v1 ACTIVE
- `cinerelay-scheduler-dispatch` v3 ACTIVE
- `process-raw-item-worker` v11 ACTIVE

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

The profile is deliberately URL-pattern driven instead of depending on brittle visual card class names. It scans anchors and accepts only first-party `aboutamazon.in` entertainment/company-news article URLs.

## Fail-closed profile validation proof

The initial stored profile accidentally over-escaped the dots in the JavaScript URL regex.

First hosted request at `2026-09-16 07:09:11 UTC`:

- HTTP `200`
- extracted items `0`
- configured minimum `5`
- worker result `drifted = 1`
- source health `PARSER_BROKEN`
- error `PAGE_SELECTOR_UNDER_MINIMUM`
- connector run `FAILED`
- raw items remained `0`
- baseline id remained `null`

This was a configuration error, not a provider failure. Importantly, CineRelay failed closed rather than accepting an empty/incorrect parse and advancing the baseline.

The stored profile was corrected and versioned as:

`about-amazon-india-prime-video-v2`

The drift/failure history was intentionally preserved for auditability.

## Corrected baseline poll — PASS

Corrected hosted baseline at `2026-09-16 07:10:18 UTC`:

- HTTP `200`
- official page items parsed: `12`
- newest official item baselined:
  `https://www.aboutamazon.in/news/entertainment/prime-videos-the-revolutionaries-starring-bhuvan-bam-rohit-saraf-to-release-worldwide-on-september-11`
- parser profile `about-amazon-india-prime-video-v2`
- structure fingerprint `7352c78a`
- connector run `SUCCEEDED`
- source health `HEALTHY`
- `gap_count = 0`
- historical raw items created: `0`
- historical revisions created: `0`

This proves the first-party page anti-backlog rule: onboarding a page with an existing archive establishes only a baseline and does not import its historical listing.

## Unchanged full-body repeat — PASS

After the mandatory domain spacing window elapsed, only the source due time was advanced for the verification request.

Hosted repeat at `2026-09-16 07:11:04 UTC`:

- HTTP `200`
- parsed items `12`
- newest stable id unchanged
- connector run `SUCCEEDED`
- items new `0`
- raw items `0`
- revisions `0`
- page processing jobs `0`
- `gap_count = 0`
- source health `HEALTHY`

About Amazon resent the page body rather than responding 304. CineRelay still produced no duplicate work, proving body-level idempotency independently of provider cache-validator behavior.

## Security/advisor verification

After the hosted page-state migration, Supabase advisors showed no new blocking P4.2 finding.

`page_source_state` appears under the expected informational `RLS enabled, no policy` notice because it is intentionally service-role-only and direct `public`, `anon` and `authenticated` access is revoked.

The new due index initially appears unused because no long-running production polling history exists yet. Other advisor warnings are pre-existing project-wide findings and were not silently scope-expanded into this connector slice.

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

PR #5 remains draft while this real official-new-item proof is pending. It is also intentionally stacked on PR #4 until the P4.1 release gate is satisfied.
