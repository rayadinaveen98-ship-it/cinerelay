# CineRelay P7 — Legacy catalogue trust gate / audit baseline

Observed: **2026-10-27**, production Supabase project `dnqaejljfzwhsainpdxb`  
Action: **READ-ONLY AUDIT + TEST EXPANSION; NO DATA CHANGES**  
Related: title-candidate issue [#61](https://github.com/rayadinaveen98-ship-it/cinerelay/issues/61); active canonical title incident [#67](https://github.com/rayadinaveen98-ship-it/cinerelay/issues/67); PMV1 pilot [#92](https://github.com/rayadinaveen98-ship-it/cinerelay/pull/92).

## What has been proven

Current active catalogue has **122** MOVIE/SERIES identities.

Of those, **24 active titles** (20 MOVIE / 4 SERIES) do **not pass the existing automated OTT title-quality gate**, and they are associated with **37 active events**. All 24 have associated PROMOTED candidate records. This is materially broader than the earlier narrow regexp that found 11 suspicious names.

These are **hints**, not adjudications. Some are clearly clip/caption strings; others are genuine movie names with descriptors such as "Telugu Movie" appended. Never silently delete, merge, rename, suppress events or rewrite published alerts based only on this screen.

**Newly created after quality-guard installation:** *zero* of the 24 were created after `2026-10-17T00:00:00Z`. This suggests that the current guard is catching known patterns on new automatic OTT promotions, but is not proof that all other ingestion paths are perfect.

The PENDING candidate queue contains 16 MOVIE and 14 SERIES suggestions, of which **10 MOVIE + 10 SERIES = 20** fail this textual gate. Valid-looking candidates still require corporate-owner and independent evidence checks.

## Priority order (by active event associations)

| Current ACTIVE candidate name (review hint, not ground truth) | Type | Active events |
|---|---|---:|
| Jailer 2 Super Show! | MOVIE | **5** |
| Karmakhya Telugu Movie | MOVIE | **3** |
| Month Of Madhu Telugu Movie | MOVIE | **3** |
| 60-ல் இருந்து 20 வரை ❤️ #HotstarSpecials #LoveAlways streaming | SERIES | 2 |
| Amma Dheenamma... Maa BB Fan Pages ... #Varam streaming | SERIES | 2 |
| From 60 to 20, love always! ❤️ Hotstar Specials #LoveAlways streaming | SERIES | 2 |
| Hot Takes keep getting hotter 🔥😎 #Awarapan2OnPrime | MOVIE | 2 |
| Love & Cute Romance \| Stand Up Rahul Movie Scenes | MOVIE | 2 |

The other **16** flagged names each have one active event. The full ordered current report can be reproduced with:
`scripts/diagnostics/p7_active_catalogue_legacy_title_audit.sql`.

## Release gate and user impact

1. Operator opens existing authenticated `cinerelay-review-api` action `activeCatalogueQualityAudit`. Its output includes evidence links and source counts; the review helper explicitly refuses implicit data changes.
2. Review each record with independent official first-party film/series evidence. Distinguish valid title + appended packaging from genuinely invented title/caption.
3. For a confirmed error, create an impact-safe correction with event, event-evidence, OTT, follow, notification and deep-link analysis *before* applying. No batch SQL edits. Keep original receipts and audit trace.
4. Compare remaining ACTIVE/PENDING warning counts after each reviewed correction and verify no newly promoted failures of the current auto gate.
5. Pilot release quality gate is blocked while known high-impact false canonical claims are still being displayed without appropriate review/qualification.

## Implementation in this PR

- Added **14 newly observed edge cases** to `supabase/tests/unit/active-catalogue-audit.test.ts`, bringing the total hardcoded historical flagged examples to **24**. Includes Unicode Tamil/Telugu-related and emoji caption forms.
- Added read-only SQL covering aggregate historical impact, per-entry prioritized output, pending suggestions and post-guard surveillance.
- **No** source feed reprocessing, event suppression, title mutation, migration, CI config, app binary or production worker changes.

## Status / next acceptance

- [x] Enumerate current full ACTIVE title gate failures instead of narrow matching.
- [x] Correlate affected active events and source candidate promotion associations.
- [x] Confirm no currently flagged entries created after the quality guard's Oct 16 installation.
- [ ] Run full GitHub CI and unit test; pass without new regressions.
- [ ] Produce **human-verified** verdicts per record and apply existing audit-safe correction only where independently proven.
- [ ] Re-run read-only SQL and verify user-facing event/newsroom display after authorized corrections.
- [ ] Finish independent YouTube published-ID completeness and physical Android pilot before external beta.

This report does **not** claim that 24 entries are false, that 37 events are wrong, or that a safety guard can correct historical data automatically.
