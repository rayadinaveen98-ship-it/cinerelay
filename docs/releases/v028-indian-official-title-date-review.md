# Conservative title and date suggestions for official Indian film announcements

Phase after PR #47: Title suggestions now include **explicitly announced films** (only quoted title beside "film"/"movie"), **numbered series from official trailer headlines**, and **explicitly named upcoming/new series** from trusted official `WEB_ARTICLE` feeds.

Real observed input examples from the source inventory: Prime Video's "Watch the trailer of Aspirants Season 3 streaming now on Prime Video" (SERIES: Aspirants), and "Hrithik Roshan’s HRX Films teams up with Prime Video for a new thriller series Storm" (SERIES: Storm). Netflix `The Diplomat Season 4` remains supported.

No content of these headlines proves a premiere date, language, country, verified catalogue entity or notification eligibility. A date suggestion appears **only if an explicit release/premiere/streaming verb is followed by a full month/day/four-digit year**. It is stored as `proposedReleaseDate` in **PENDING review evidence**, flagged `releaseDateIsUnverified=true`. Never write release dates into events or `ott_releases` from this extractor. No year inference and no partial dates.

Title fragments, biography subjects, roundups, catalogue promotions, ambiguous titles and unquoted films remain manual review in the operator-only queue. No automatic promotion or pushing.

## Verification gates
- Deno regression tests for real official India headlines, misleading cases, real and invalid leap dates, source authority gates.
- Edge typecheck + GitHub CI + Android canary.
- Production worker update pinned to immutable merge commit without changing internal-key auth, database schema, review API or Android code.
- Optional backfill: selected exact Prime Video unresolved items -> pending candidates only, not event publishing or notification.
- Monitor when new official movie/series articles are processed; operator approval still required.
