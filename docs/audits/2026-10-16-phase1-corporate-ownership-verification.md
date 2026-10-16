# CineRelay — Phase 1 corporate publisher evidence ownership

**Date:** 2026-10-16 IST
**Production:** Supabase `dnqaejljfzwhsainpdxb`
**PR:** https://github.com/rayadinaveen98-ship-it/cinerelay/pull/57
**Issue:** https://github.com/rayadinaveen98-ship-it/cinerelay/issues/56
**Merged SHA:** `f545d26fe8499fb857dece9f7292fc9ecae82820`

## Underlying bug

The previous operator approval and catalogue promotion counted distinct parent `public.sources.id` values. Production had distinct logical source records for `About Amazon India — Prime Video` and `Prime Video India` despite common Amazon corporate publishing ownership. YouTube + website could therefore be falsely treated as two independent publishers if ingested for the same title. The separate Netflix India / Netflix India South group has the same class of duplicate-corporate risk.

## Mitigation now deployed

- Internal explicit `source_corporate_owners` registry and `source_corporate_owner_memberships` exact-source join.
- Records are mapped only with reviewed, first-party corporate sources, never with fuzzy name matching. Unmapped source IDs stay distinct pending human ownership review.
- Shared `catalogue_independent_owner_count(candidate_id)` returns distinct verified corporate groups, or distinct source UUIDs for unmapped sources. Prefixes `corp:` and `source:` avoid key-namespace collision.
- Both existing `operator_review_entity_candidate(..., 'APPROVED', ...)` and `operator_promote_entity_candidate` use this corporate owner count, preserving preexisting confidence, first-party authority, duplicate, item evidence, operator audit and status checks.
- Two groups seeded:
  - `amazon-prime-video`: `About Amazon India — Prime Video` (UUID `070f383a-721f-4e07-8f59-2674be453d79`) and `Prime Video India` (UUID `858b0eca-fef8-4dfb-948c-8e3393e2d4c1`). Official proof: https://www.aboutamazon.com/news/entertainment/what-you-need-to-know-about-prime-video
  - `netflix`: `Netflix India` (UUID `38364bc9-4381-4c9c-bbbc-1bda7b2463e9`) and `Netflix India South` (UUID `1e78e30b-c0a6-4f80-8ea6-5248e60ab215`). Official proof: https://about.netflix.com/en/news/netflix-brings-fans-its-biggest-south-indian-slate-this-year
- Four `CORPORATE_SOURCE_OWNERSHIP_VERIFIED` audit entries stored.
- RLS enabled with no public policies and no anon/authenticated grants. Helper and operator approval/promote RPCs executable by service role only. This is deliberate deny-by-default.
- Production applied through Supabase migration `phase1_corporate_source_owner_gate`. Versioned GitHub SQL `20261016114500_phase1_corporate_source_owner_gate.sql`.

## Automated test findings

Clean CI initially failed because production-only source UUIDs did not exist in the fresh fixture DB. The migration now skips nonexistent source records **only when the UUID is absent**, and still throws if the UUID exists but its expected display name differs. The corrected CI migration and pgTAP tests passed.

Regression covers: two separate logical sources belonging to one corporate owner cannot approve a candidate; truly independent source lets approval pass; previously unknown country remains NULL; candidate promotion does not immediately create a news event; direct table access prohibited to anon/authenticated.

All PR check suites completed successfully, including Android canary, web-console, Edge, database, intelligence, consumer and notification services. All main post-merge checks also passed.

## Production verification

- **4 exact source-name/UUID matches** verified before migration; no prior corporate membership table existed.
- After migration: **2 corporate owner groups, 4 mapped source rows**.
- Amazon website + Prime Video India channel: **2 logical source IDs = 1 independent publishing owner**.
- Review and promotion function bodies invoke the corporate-count helper; `anon_execute=false`, `authenticated_execute=false`, `service_execute=true`.
- New tables have RLS enabled; public `SELECT=false`; `service_role SELECT=true`.
- Aspirants: `PENDING`, confidence 0.86, 1 independent owner, promoted_entity_id NULL, linked event count 0.
- Storm: `PENDING`, confidence 0.83, 1 independent owner, promoted_entity_id NULL, linked event count 0. Working title caveat remains.
- The Diplomat: `PENDING`, confidence 0.87, 1 independent owner, promoted_entity_id NULL, linked event count 0.
- **230/230 active source identities healthy**: 184 YouTube, 8 WEB, 38 RSS.
- Post-deploy security adviser notes **rls_enabled_no_policy** on both new internal tables. This is expected and intentional for denied public access. Supabase explanation: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy . An unrelated existing Auth leaked-password-protection warning was also present; not changed by this migration.

## Remaining Phase 1 tasks

1. An approved method for original producer evidence intake into traceable `raw_items` and `entity_discovery_evidence` without fabricating item timestamps or pretending a LinkedIn page is ingestible by existing HTML/WebSub pipelines.
2. Aspirants: obtain The Viral Fever's *direct original company-post URL*, not just employee reshares. Storm: HRX Films authentic company post is identified, but the title is explicitly a working title and confidence remains below 0.85.
3. Verify new evidence's actual **corporate ownership group** before permitting operator approval. Other publishers with multiple group-owned channels (e.g., Tips) need separately reviewed mappings—not name-based auto-merges.
4. Human signed-in review acceptance and controlled catalogue promotion with zero false breaking alerts.
5. No Android APK is needed for this backend-only correction.
