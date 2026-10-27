# CineRelay P7/PMV1 — Production readiness evidence, 27 October 2026

Status: **READ-ONLY DIAGNOSIS COMPLETED / REPAIR NOT YET PROVEN**  
Product scope: CineRelay, and only repository `rayadinaveen98-ship-it/cinerelay` + Supabase project **CineRelay**.  
Source-of-truth baseline: repo main at `8548ccdc697d9be1abd6d7eedba6046b933561c6` (20 Oct 2026), release v0.2.9.

## Method

Selected aggregate SQL only via linked Supabase project; compared current production rows to repository roadmap, existing source-health state, signed release evidence, and open data-quality issues. No source identities, personal records, URLs, title names, payloads, tokens, or private row-level content are in this report. No mutations, secret reads, external subscription requests, worker invocations, or notification delivery actions.

Repeat the instrumented snapshot with `scripts/diagnostics/pmv1_read_only_baseline.sql`. These are point-in-time counts, not continuing monitoring and not a performance test.

## Measured baseline

### Live inventory
- Active identities: YOUTUBE **185**, RSS **38**, WEB **8**. Dormant identities: X **27**, RSS **2**, WEB **2**.
- `sources` **176** source records; `source_identities` **262** platform identity records (including inactive). These are distinct concepts.
- `raw_items` **32,711**; `events` **233**; `creator_radar_entries` **233**; `ott_releases` **122**; `entities` **123**.
- Last observed `raw_items.created_at`: 2026-10-27 04:01 UTC; latest event creation at 2026-10-26 15:28 UTC. These do not establish topical relevance, dedupe precision or alert timeliness.

### YouTube: existing controls are working, *but reliability is not green*
- 185 distinct active YouTube identities; all **185 each have exactly one unexpired ACTIVE YOUTUBE_WEBSUB lease**. No identity lacks an active lease or has multiple active leases.
- **148** active YouTube identities: `source_health=DEGRADED` and `last_error_code=WEBSUB_MISSED_DELIVERY`.
- **37** active YouTube identities: HEALTHY.
- **All 185** last-success and fallback checks in previous 24h, according to current state; healthy fallback does **not** prove WebSub promptly published each new upload.
- Of 148 degraded: **56** have at least one recorded WebSub callback in last 7 days, **86** never had a recorded WebSub callback, **35** have a historical fallback gap counter > 0.
- Of 37 healthy: **3** had a WebSub callback in last 7 days, **34** never recorded a callback; 3 have historical fallback gaps. Upload volume varies by channel; never-callback alone is not a failure.
- YouTube maintenance is responsible for lease health; fallback worker intentionally regards WebSub as an accelerator and upload-playlist reads as authoritative discovery. Current error can coexist with current successful fallback. Do not 'fix' by blanket-resetting health flags or lowering severity: investigate missed uploads with timed source-publish vs first-ingest evidence.

**Preliminary hypothesis, NOT confirmed:** some sources are missing WebSub delivery while fallback still retrieves new uploads. Additional possibilities include outdated sticky error flags, short-lived publication/edit patterns, clock skew, or unsubscribe/reverification edge cases. Need independent per-event timeline samples before deciding on remediation.

### First seven-day publication-to-raw-receipt latency probe

Verified read-only aggregation for **active YouTube sources only**, selecting records with both `published_at` and `first_seen_at` within the previous seven days:

| Measure | Observed |
| --- | ---: |
| Qualifying raw items | **5,589** |
| p50 published -> first seen | **25.7 minutes** |
| p95 published -> first seen | **53.6 minutes** |
| Items later than 6 hours | **88** |
| Negative duration samples | **1** |
| Maximum positive delay | **1,853.5 minutes** |

This is a **partial, selected-sample discovery-delay proxy**, not evidence that *all* YouTube uploads arrived; missing uploads never appear in the sample. It does not measure canonical-event production, consumer feed availability, or user notification delivery. The timestamp origin is publisher metadata and can be revised, delayed or differ from a user's perceived release time.

The current health-state split has severe sample imbalance: DEGRADED 5,549 items (p50 25.7m, p95 51.0m), HEALTHY 40 items (p50 45.0m, p95 340.6m). **Do not conclude degraded channels are faster or healthy channels are worse:** source activity differences and fallback mechanics are confounders.

**Next measurements required:** stratify by channels that actually published during the window; manually compare recent independent official YouTube uploads to ingested IDs (find missing denominator); track webhook arrival, fallback discovery, enrichment and first feed-visible events for identical uploads. Until then, no near-real-time SLA or advertising claim.

### Catalogue and trust
- 11 ACTIVE movie/series entity names match a deliberately narrow suspicion regexp for caption/promotional text. This is a *triage count*, not a finding that all 11 are invalid.
- Pending discovery proposals: 16 MOVIE, 14 SERIES (30 total). Promotion of unverified titles is a documented issue.
- Open CineRelay issues: **#61** (clip/headline candidate filtering) and **#67** (already promoted caption-like canonical entities). Neither should be closed by aggregations alone; inspect sources and use audited per-record correction.
- No title rename, event deletion, suppression, status promotion, automation update, or data cleanup was performed.

### Alert and device baseline
- 35 enabled source-activity subscriptions (records; may belong to same person).
- One active registered push device with prior success recorded.
- 1,711 source-activity delivery records; 0 general `alert_deliveries` records (distinct channels, not proof that alerts never work).
- Cannot infer notification click-through, relevance, unique beta users or week-1 retention from these counts.

### Android
- GitHub v0.2.9 final release published 2026-10-20 with signed minified APK and passing main release CI / Android 35 emulator upgrade.
- Device-specific release-critical actions not independently proven here: real-device login/account switching, full notification lifecycle and deep links, offline recovery, upgrade without uninstall and data loss, initial-interest setup, precise first-value path.

## Quality gate order — no broad PMV pilot yet

1. **Priority 0: prevent incorrect claims.** Audit suspicious canonical titles and promotion pathways, restore strict source-backed manual-review gate. Follow existing #61/#67.
2. **Priority 0: establish delivery truth.** Select stratified known-recent uploads across source types; compare YouTube published timestamp, webhook/ingest receipt, enrichment, canonical event and push creation. Record p50/p95/missingness. Keep error flags until understood.
3. **Priority 1: verify consented opt-in alerts on a real device.** Per-source subscribe/unsubscribe, shorts default, dedupe, foreground/background notifications, deep links, spam/quiet hours.
4. **Priority 1: physical v0.2.9 Android release acceptance.** Signed update-in-place (without wiping) and UI/core-value path. Keep personal data outside issue reports.
5. **Priority 2: only after the above:** prepare consent/privacy + minimal analytics and assisted five-person pilot; then expand to 30–50 representative external testers.

## Non-action and rollback policy

This document and diagnostic SQL do not authorize schema changes, remediation SQL, disabling/enabling subscriptions, expanding source count, raising YouTube quota, altering billing, or changing production notifications. Any high-impact worker fix must have focused regression tests, CI, traceable deployment and a rollback. The known original 90-source 'final mesh' document is historical; today's 185 source count needs active quota/noise review, not silent further expansion.

## Release decision

**Product learning may proceed in docs and assisted planning; broad consumer PMV beta = NO-GO until P0/P1 trust and device gates pass.** Neither GitHub build success nor existence of a large source registry is product-market validation.
