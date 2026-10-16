# Phase 1 — Active catalogue title integrity audit (operator only)

## Why
Read-only production inspection on 16 Oct 2026 found 98 ACTIVE MOVIE/SERIES entities. A conservative screening query flagged 24 for possible promotional/caption names. Those 24 were linked to 37 ACTIVE events. These are **review hints**, not confirmed data errors. Earlier promotions included such names as `Catch Joel Joseph in Kappi Squad`, `Happy Ending Telugu Movie Scenes`, `Jailer 2 Super Show!`, and `Hot Takes keep getting hotter ...`. Automatic movie/series promotion is now separately protected by PR #68.

## What this adds
- In private **Sources & ops**, the **Active-title quality audit** appears before the PENDING catalogue review. A jump link is available at the top.
- `cinerelay-review-api` exposes authenticated operator-only action `activeCatalogueQualityAudit` returning read-only ACTIVE MOVIE/SERIES review warnings, exact event counts, up to six event summaries, original evidence URLs and the linked PROMOTED discovery candidates.
- The audit sorts potential cases by **number of linked ACTIVE events** rather than misleading model confidence.
- It scans ACTIVE entities in fixed 500-row pages, max 5,000 entities in one run, and surfaces explicit `scanComplete`, `eventCountsComplete`, and `evidenceLinksComplete` metadata. It never reports a silently truncated sample as exhaustive.
- It follows both `event_evidence` and `entity_discovery_evidence` for original source provenance. A missing source is exposed, not fabricated.
- There are **no write endpoints** in this feature. It does not delete, merge, suppress, rename, approve or publish entities, events, or notifications. It does not tamper with jobs or operator evidence submissions.

## Quality controls
- Authentic titles can contain unusual punctuation or words such as `Movie`; this screen therefore uses warnings, not hard assertions.
- Titles such as `#Love`, Telugu-script titles, `Catch Me If You Can` and `Scary Movie` must remain unflagged by the screening unit tests.
- ACTIVE titles with events require editorial review of sources, release dates, aliases and source ownership before a logged correction/suppression.
- All 24/37 figures were a time-of-audit snapshot and may change with normal ingestion; the UI always fetches live data.

## Acceptance
1. CI passes Edge API type-check, standalone pure-helper test, and web console production build.
2. The deployed API rejects missing/invalid bearer tokens (401); an authenticated non-operator must receive 403.
3. Allowlisted operator signs in to actual Cloudflare Pages console, visits **Sources & ops → Active-title quality audit**, opens multiple event/source details, checks suspicious vs genuine source names, and confirms no changes occurred.
4. Compare canonical entity/event counts before and after deployment. An API/UI release alone must not change either.
5. For any verified historical error, propose a separate audited correction plan with original raw evidence, affected events, impact of prior push notifications and potential target canonical identity. **No bulk deletions.**

Project's existing static-host destination remains Cloudflare Pages; GitHub merge and CI artifact do not establish that the updated browser UI has been released.
