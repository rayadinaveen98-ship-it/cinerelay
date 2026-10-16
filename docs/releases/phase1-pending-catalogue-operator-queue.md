# Phase 1: Pending catalogue review queue — operator-only

This adds a **read-only** combined view of pending MOVIE and SERIES discovery candidates across YouTube, RSS and official WEB sources. Previously, the official article panel only covered WEB_ARTICLE records, hiding most of the 10 suspect movie names from operators.

## Workflow

1. Sign in to the private CineRelay intelligence console as an active allowlisted operator.
2. Open **Sources & ops**. The **Pending movie & series catalogue** panel is placed near the top, above the lengthy source registry, with a jump link in the operations header.
3. The default **All pending** filter shows all available PENDING titles. **Possible title cleanup** shows marketing-copy/embedded hashtag candidates. **Evidence review** shows those without a known text-pattern warning.
4. Expand **Inspect retained source evidence** to see original YouTube/RSS/WEB titles, source names, first-party indicators, and source links.
5. Use the existing **Official article & producer leads** review workflow to submit verified producer-post leads. Submissions do **not** credit independent sources or publish anything.

## Guardrails

- The new API action `pendingCatalogueReviewQueue` is available only after `requireOperator()` validates a signed-in Supabase user AND an active `operator_users` membership. It queries using the existing private service-role client only on the server.
- The queue returns up to 100 PENDING movie/series candidates and their provenance. It is read-only: no candidate status update, no dedupe/merge, no catalogue promotion, no ingestion replay, no news event, and no alert.
- The displayed title-quality hint is **not** a canonical-title verifier and never makes approval decisions. The production DB has a separate enforced automatic OTT title-quality gate.
- The counts labelled **source identities** do not assert independent corporate owners. Confidence is a machine score, not editorial proof.
- The existing WEB_ARTICLE review/producer evidence form remains unchanged.
- The original evidence URLs should be opened by the operator; no source scraping or fabricated producer evidence is used.

## Acceptance requirements

- Private API must return HTTP 401 without authentication and 403 without operator allowlist; no anonymous candidate or evidence leaks.
- A signed-in operator should see the current 18 PENDING candidates (15 MOVIE, 3 SERIES), with 10 known promotional movie-name hints and remaining 8 needing corroboration. Counts may change as live ingestion continues.
- Multilingual Unicode, short film names, and valid leading hashtag titles (`#Love`) must not be incorrectly labelled promotional.
- The console must build, TypeScript-check, and pass Deno helper tests. A browser smoke test against a live deployed console is needed before fully accepting Phase 1.
- New API deployment and static web console hosting must both be checked separately; a GitHub merge alone does not update an already hosted static web site.
