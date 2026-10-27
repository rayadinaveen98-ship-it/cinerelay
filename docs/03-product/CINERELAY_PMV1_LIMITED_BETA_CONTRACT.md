# CineRelay — PMV1 limited-beta acceptance contract

Status: **DESIGN + READ-ONLY BASELINE ONLY; NOT PUBLIC-BETA APPROVED**  
Date: 2026-10-27  
Owner: CineRelay  
Baseline product: signed Android v0.2.9, current Supabase production, no new subscriptions / advertising.

## One-line testable promise

> Follow films and official cinema sources you care about; receive useful, timely, source-backed updates without repeated noise.

The original CineRelay product charter remains the architecture/source-of-truth. This document adds a **proposed experiment**, not a change to locked product decisions. It is not the unrelated Cinema & Series catalogue project.

## Distinct target groups

1. **Serious film followers (consumer cohort)**: follow 3–5 films/sources; find the latest important development and original publisher quickly.
2. **Cinema creators/researchers (professional cohort)**: monitor changes across publishers; validate evidence; decide what deserves content.

Do not assume both groups need the same Home arrangement, subscription or notification frequency. No paywall in initial pilot.

## Current readiness (read-only snapshot at 2026-10-27)

- Android signed stable v0.2.9 was published on GitHub 2026-10-20; release CI and Android emulator in-place upgrade passed. **Physical device critical paths are not yet comprehensively signed off.**
- 185 active YOUTUBE identities; 38 active RSS and 8 active WEB identities. All 185 active YouTube sources have exactly one active unexpired WebSub lease in a read-only identity-joined check.
- 148/185 active YouTube identities have source-health DEGRADED / WEBSUB_MISSED_DELIVERY; all 185 show successful fallback checks within preceding 24 hours. **Fallback success is not evidence of WebSub timeliness.**
- 233 normalized events; 122 OTT release records; 35 enabled source activity subscriptions; 1 registered push device with historical delivery success. Counts are records, **not active users, accuracy, or retention**.
- 11 active entities match a narrow suspicious-caption pattern (not a reviewed false-positive count). See open issues #61 and #67. Names/evidence must be reviewed individually; no mass mutation.

See `docs/07-execution/CINERELAY_PMV1_READINESS_AUDIT_2026_10_27.md` and `scripts/diagnostics/pmv1_read_only_baseline.sql` for repeatable evidence.

## Go/no-go: reliability and factual trust *before recruitment*

Block invitation of broad consumer testers until:
- [ ] Measure median/p95 official YouTube upload -> CineRelay event latency on representative recent, active channels; compare WebSub vs fallback; identify and classify missing events.
- [ ] Explain and remedy (or accurately expose) WEBSUB_MISSED_DELIVERY on 148 identities. Never clear an error simply to make a dashboard green; keep missed-event evidence.
- [ ] Verify source-level alerts, one-event dedupe, permission, foreground/background push, deep links and opt-outs on physical Android.
- [ ] Review suspected auto-promoted titles and pending title candidates with source citations; prevent unverified promotional captions from becoming authoritative movie/series facts (issues #61, #67). No silent delete/merge.
- [ ] Physical Android: fresh install, first-run onboarding, follow flow, Home cold/warm load, OTT/Today/Radar, search, Back, logout/login account isolation, offline recovery, and in-place upgrade preserving state.
- [ ] No customer or participant data gets exported through diagnostic scripts. No production schema change, feature flag rollout, notification fanout or secrets change in this PR.

## Pilot structure (proposed after quality gate)

- Recruit **30–50 consenting external testers**, with distinct fan and creator groups; include language/source diversity relevant to current verified coverage. Recruit in small batches after first 5 assisted sessions.
- Day 0: record the first-value path: find/follow a film or source -> inspect a meaningful recent update -> open original evidence.
- Days 1–7: track *minimal consented aggregate* usage, opted-in notifications and self-reported usefulness; avoid logging full search queries, film-follow lists linked to an individual, device identifiers, or unredacted evidence URLs in exported pilot reports.
- Day 7: conduct interviews and ascertain which workflow users would miss if CineRelay disappeared.
- Creator monetization: show a **specific hypothetical paid workflow** and ask for a real payment commitment or controlled paid trial only after trust/privacy/fulfillment are ready; `₹99–199/month` is a price hypothesis, not current product pricing.

## Metric definitions + provisional pilot thresholds

| Measure | Denominator and procedure | Provisional decision signal |
| --- | --- | --- |
| Day-7 retained | Consented users who completed first-value action on Day 0 and were eligible on Day 7; returned and performed a meaningful action during Day 7 (24h window) | >=25% directional; report actual counts/cohort composition and uncertainty |
| Onboarding time | Start of first use through first source-backed update opened; observed sessions, not guessed duration | Median <=2 minutes |
| Alert relevance | Delivered, opened and *rated* opted-in alerts only, with sample size and nonresponse reported | >=80% rated relevant; cannot infer from open rate |
| Evidence accuracy | Stratified manual sample of displayed important events: title, claim, authority, date and working original-source link | >=95% correct; severe misinformation blocks launch regardless of percent |
| Timeliness | Source publication timestamp -> first CineRelay visible event, by event class and source type; mark missing/unmeasurable data | Report p50/p95 and missingness; set numeric SLA after observed baseline |
| Creator paid demand | Genuine commitments/purchases for a specific described paid workflow; separated from survey intent | Seek >=3 credible commitments as exploration, not proof of PMF |

Instrument only after privacy review and explicit participant consent. **No analytics SDK, billing, advertising, or behavioral instrumentation is enabled by this document.** Keep reports aggregate, sparse and manually auditable for the first pilot.

## Decisions after pilot

- **Continue:** reliability passes, useful alerts, credible repeat actions in both cohorts, and at least one segment expresses strong need.
- **Narrow to creator/researcher:** professional segment repeatedly uses source/evidence workflow while casual fans do not.
- **Iterate consumer activation:** evidence trustworthy but many participants fail to reach the first useful update; simplify interest selection and default feeds.
- **Stop or reposition:** no repeated value, high editorial error rate, or source coverage cannot safely support promised timeliness.

## Known unresolved obligations

- No mass external user invitation yet, no claim of market validation.
- Not a complete IMDb/JustWatch competitor or generic news app.
- Do not fabricate poster art, source provenance, subscription/revenue evidence.
- This PMV plan is **not** a greenlight for Phase 8 paid X connector or Phase 9 advanced AI.

## Next implementation order

1. Finish WebSub/fallback latency and entity-quality investigations.
2. Close physical Android P5/P6 acceptance gates.
3. Define consent/privacy and implement minimal **opt-in** beta measures with tests.
4. Run assisted 5-person trial, then broader 30–50 person pilot if go-gates pass.
5. Review pilot outcomes, decide which segment deserves growth or pricing experiments.
