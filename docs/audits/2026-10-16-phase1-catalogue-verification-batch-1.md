# CineRelay — Phase 1, Catalogue & Title Verification, Batch 1

**Date:** 2026-10-16 IST
**Environment:** Production Supabase `dnqaejljfzwhsainpdxb`; GitHub `rayadinaveen98-ship-it/cinerelay`.
**Status:** Verified editorial metadata and promotion-safety hardening deployed. **No candidate promoted, no canonical entity created, and no old news back-published.**

## Catalogue matching result

No ACTIVE `entities` record matched the exact normalized titles `aspirants`, `storm`, or `the diplomat`, as checked in the live catalogue and `find_entity_candidates_for_title`. All three `SERIES` candidates remain `PENDING`, have exactly one registered source identity, and are blocked by the two-independent-source-owner rule. Storm is also below the 0.85 confidence gate.

### Verified source facts and deliberate unknowns

**Aspirants** — pending candidate `51476ba7-6a59-4baa-9134-ff1bf27b3f43`
- Official first party https://www.aboutamazon.in/news/entertainment/aspirants-season-3-prime-video
- Series, Indian, **Hindi**, Season 3, The Viral Fever production. The first-party article supports the title and format; no new release notification warranted for this archival intake.
- Candidate metadata: `primary_language='hi'`, `country_code='IN'`; confidence 0.86; 1 source identity, 1 first-party source identity.
- Needs a genuinely separate source owner's corroboration before catalogue promotion; do not make up a YouTube/raw item.

**Storm** — pending candidate `5007d5cc-2a6a-4cc4-9e23-fcf6228f8052`
- Official first party https://www.aboutamazon.in/news/entertainment/hrithik-roshan-prime-video-thriller-series
- Indian Original thriller `SERIES`, produced under HRX Films, set in Mumbai, upcoming at time of source article. **Primary language and premiere date not confirmed.**
- Candidate metadata: `country_code='IN'`, `primary_language=NULL`; confidence **0.83**, 1 first-party source identity.
- Needs corroboration and improved confidence from actual evidence, not arbitrary score changes.

**The Diplomat** — pending candidate `6046c8e3-120f-42b6-bf0a-1550016d3807`
- Netflix official https://www.netflix.com/tudum/articles/the-diplomat-season-4-release-date-photos-news
- Political drama `SERIES`; Season 4 confirmed in Netflix newsroom. Now a global / secondary editorial priority for the India-first catalogue. `country_code=NULL`, `primary_language=NULL` pending explicit project-origin evidence.
- Separate `Netflix India` official YouTube trailer is already ingested, but **a Netflix YouTube identity and Netflix website from the same owner must NOT count as two independent owners**. No independent source falsely created.
- The Netflix source page is updated in place; raw first seen / source publication must not be conflated with actual season premiere timestamp.

## Production writes and audit

Guarded, transactional evidence-only annotation of the three `PENDING` candidates:
- Set confirmed `hi/IN` for Aspirants; `IN` without language for Storm; left The Diplomat country/language null.
- Added `metadata.editorialVerification` with official original URL, editorial review notes, priority and explicit no-publication.
- Recorded **3** `CATALOGUE_EDITORIAL_EVIDENCE_REVIEW` SYSTEM actions.
- Left candidate statuses, evidence counts, confidence scores, real release-date columns, canonical events, push alerts and user follow data unchanged.
- Live check: **0** event evidence links for these 3 original website articles.

## Fixes

**PR #53** https://github.com/rayadinaveen98-ship-it/cinerelay/pull/53, merged as `72a41cc0182a10282dd55cd94b85158b84c0c822`.
- Migration `20261016090000_phase1_catalogue_owner_country_safety.sql`.
- `operator_review_entity_candidate` and `operator_promote_entity_candidate` now additionally require **two independent logical parent `sources.id` owners**, not merely different website/YouTube connectors.
- `operator_promote_entity_candidate` no longer silently sets `country_code='IN'` when candidate country is unknown.
- `submit_entity_discovery_candidate` now defaults an omitted country to NULL.
- Regression pgtap test creates two separate identities with one parent and proves approval is denied; then adds an independent corroborating source and verifies country NULL survives promotion and no immediate event is generated.
- Database migration suite and review CI passed; production SQL applied and verified. Functions remain execute-only by `service_role` (anon/authenticated execute disabled).

**PR #54** https://github.com/rayadinaveen98-ship-it/cinerelay/pull/54, merged as `48d32c44f9adb638c346dc733666aa5ab38de9e8`.
- Private Sources & ops / Movie & series article review UI shows recorded source-verified catalogue facts, languages/country only if known, pending nature, connector-identity count, confidence and corroboration requirements.
- The original raw-item resolution action is labelled separately from formal candidate approval/promotion; does not auto-approve.
- Cloudflare/web build and Edge checks passed after repairing an unknown-to-ReactNode JSX typecheck.
- `cinerelay-review-api` production **v5 ACTIVE**, unauthenticated POST `officialArticleReviewQueue` returned **401 authentication_required**.
- The real signed-in operator UI acceptance test is still outstanding. No user account credentials were synthesized or bypassed.

## Operational health

Post-deployment active source identities: **184 YouTube, 8 WEB, 38 RSS = 230/230 HEALTHY**. Three candidates remain PENDING; zero promotions; no new events from reviewed source articles. No Android code changes or new APK needed for Phase 1 Batch 1.

## Next Phase 1 acceptance

1. Obtain and verify truly independent source-owner evidence for Aspirants and Storm, only if it exists; use official TVF and HRX Films provenance if available, not fan uploads or sibling channels.
2. Keep the global `The Diplomat` at secondary priority in the India-first catalogue; its existing Netflix YouTube and Tudum identities must count as one owner.
3. Only after evidence suffices, use authenticated operator approval, canonical entity promotion, exact source-bound reprocessing with the existing 48-hour/unknown-publication safety gate, and verify **zero spurious breaking alerts**.
4. Test the updated private console while signed in. Avoid claiming end-to-end operator acceptance until done.
