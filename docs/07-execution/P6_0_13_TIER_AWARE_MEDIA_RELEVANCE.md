# P6.0.13 — Tier-Aware Media Relevance

Status: **IMPLEMENTED / CI-PROVEN / HOSTED V5 ACTIVE / ANDROID-PROVEN**

Date: 2026-09-16

## Goal

Keep CineRelay's new lower-trust media feeds useful for FrameByNavin by suppressing hosted-proven celebrity lifestyle/gossip noise without weakening first-party source coverage.

## Hosted evidence

The dedicated TeluguCinema News feed demonstrated the mixed editorial reality that motivated this rule.

Useful cinema intelligence in the same feed included:

- `M.S. Subbulakshmi Biopic: Kamal Haasan claps on Rashmika Mandanna’s first shot`;
- `The Paradise plans South India promotional tour from tomorrow`;
- `Aasmaan teaser: Meghamsh Srihari promises an intriguing ride`;
- G2 release-date reporting;
- Vishwambhara release-date reporting.

The feed also contained lifestyle/gossip items such as:

- `Samantha reveals her pregnancy food cravings`;
- `Suriya and Jyotika renew wedding vows after 20 years`;
- `Ambika advises Trisha to be cautious about public appearances with Vijay`.

The rule is therefore source-context aware rather than a global keyword filter.

## Implementation

Shared filter:

`packages/domain/src/newsroom-filter.ts`

New filter reason:

`celebrity_lifestyle`

The narrow lifestyle patterns currently cover hosted-proven examples involving:

- pregnancy / food cravings;
- wedding-vow renewal / wedding anniversary;
- advice about celebrity public appearances;
- relationship/dating rumor or speculation wording.

### Critical boundary

The lifestyle gate applies **only** when the source role is:

- `TRADE_MEDIA`, or
- `GENERAL_MEDIA`.

First-party/official roles such as `PRODUCTION_HOUSE` are not subjected to this filter.

Current-news intent continues to win first. A title that contains explicit release/trailer/teaser/launch/announcement/OTT/shoot/wrap/press/muhurtham/pooja/date intent is preserved before the lifestyle check.

## Regression contract

`tests/newsroom/run-newsroom-filter.mjs` expanded from 7 to 13 mandatory cases.

The six new checks prove:

1. tier-3 pregnancy/food-craving editorial is filtered;
2. tier-3 wedding-vow editorial is filtered;
3. tier-3 public-appearance relationship advice is filtered;
4. the lifestyle gate does not apply to a first-party source role;
5. current-news intent still overrides lifestyle words;
6. hosted-proven film intelligence from the same trade feed survives, including biopic first-shot, promotional-tour and teaser examples.

CI output:

`Newsroom filter regressions: 13/13 passed.`

P6.0.12's trust-state contract also remained green:

`Newsroom trust-state contract: 11/11 passed.`

## API wiring

`cinerelay-newsroom-api` now calls the shared filter with the actual source role:

`newsroomNoiseReason(raw, { sourceRole: source.source_role ?? null })`

Filter telemetry now exposes:

- `empty_content`;
- `archive_or_library_clip`;
- `celebrity_lifestyle`;
- `duplicate_title`.

## Proven implementation head

`5ec7afc71fe4b2b0bc0dbeb6fd814dd1923a9017`

### CineRelay CI #416

Run: `35135049991`

Result: **all green**

- repository hygiene;
- contract benchmark;
- 13/13 newsroom relevance regressions;
- 11/11 newsroom trust-state regressions;
- push-presentation contract;
- connector canaries;
- DB + pgTAP;
- strict Edge type-check/build/bundle;
- web console.

### Android Canary #82

Run: `35135049981`

Result: **all green**

- shared-domain build;
- mobile/evidence/newsroom API type-checks;
- deployment-native mobile API artifact;
- Android build;
- APK/package verification;
- APK artifact upload.

## Artifacts

Mobile API deployment artifact:

- id: `10462317807`;
- digest: `sha256:5e5c743d73653117c29a4cef6bd902df678aec6e815cdb55517a55d67acb366d`;
- CI-built newsroom `index.js` SHA-256: `cf08350b8da0562e4948295b4c242e02786fa4a74b5ce5911876ad3fa63ac631`.

Android APK artifact:

- id: `10462978520`;
- archive digest: `sha256:7abf9d6204a009cd09ddcf5eaf0cf20edd861b350699b3545d8a6387671889ac`;
- extracted APK SHA-256: `405d2a6e55e7b62d1f484e5d48e039ebe4aaf3c1fb9f88940112d69c9baf3e58`.

## Hosted deployment

`cinerelay-newsroom-api` is now:

- version `5` ACTIVE;
- function id `9fecda75-b7e4-4cef-bb68-b81f3b4a69ec`;
- runtime SHA `aed2ba8c1df10edb6f57321887841b5d683cc6cf3e339affe77884b04c8873f0`;
- `verify_jwt=false` remains intentional because Live is guest-readable and supplied bearer tokens are validated in function code.

Production deployment used the exact CI-built mobile API artifact.

Hosted source was fetched back after deployment and contains the tier-aware media gate and `celebrity_lifestyle` telemetry.

## Hosted regression sample after v5

Guest newsroom request:

- HTTP 200;
- scanned: 20;
- filtered: 16;
- surfaced: 4;
- empty: 0;
- archive/library: 15;
- celebrity_lifestyle: 0;
- duplicate-title/family: 1.

The existing official-source output remained unchanged after rollout.

`celebrity_lifestyle` is correctly zero in this hosted sample because neither tier-3 feed has produced a genuine post-baseline raw item yet. CineRelay does not insert synthetic production items merely to manufacture filter telemetry.

## Newly discovered cadence issue

During the hosted observation window, a separate feed-scheduling problem was proven:

- feed cron job #5 runs every 5 minutes at approximately `:00` seconds;
- 123Telugu had `next_check_at = 18:35:01.913Z`;
- cron run `7628` started at `18:35:00.062Z` and succeeded;
- the feed-poll result processed one other due feed but skipped 123Telugu because it was still ~1.85 seconds early;
- at `18:36:25Z`, 123Telugu and TeluguCinema were both overdue and had not been checked.

This can stretch an intended 15-minute feed cadence to the next 5-minute scheduler slot. P6.0.14 will address this with schedule-boundary-safe next-check planning rather than broadening trust/relevance logic.

## Next

1. Fix feed next-check alignment against the fixed 5-minute scheduler grid.
2. Add regression coverage for HOT_5M and ACTIVE_15M schedule-boundary behavior.
3. Hosted-prove that scheduled checks no longer slip an extra 5 minutes.
4. Continue waiting for the first genuine tier-3 raw item and prove `DEVELOPING` plus relevance behavior on real production data.
