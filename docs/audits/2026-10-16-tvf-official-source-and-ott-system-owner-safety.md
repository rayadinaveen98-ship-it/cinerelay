# CineRelay — Phase 1 TVF first-party source + automated OTT ownership safety

**Date:** 2026-10-16 IST. Production Supabase `dnqaejljfzwhsainpdxb`.

## Genuine new studio coverage

Registered first-party PRODUCTION_HOUSE source **The Viral Fever (TVF)**:
- Producer verified at official https://www.theviralfever.com/ (lists Aspirants among its shows).
- YouTube alias https://www.youtube.com/@TheViralFever canonically verified live HTTP 200 to stable channel `UCNJcSUSzUeFm8W9P7UUlSeQ`; `og:title=The Viral Fever`.
- Parent source `5a775b1d-6f60-40b3-b1f6-81c0b0238fed`, identity `79159c09-6dbb-4368-a5cd-2dfef67c6f9a`, uploads playlist `UUNJcSUSzUeFm8W9P7UUlSeQ`, YouTube WebSub push.
- WebSub bootstrap scheduler action HTTP 200, `eligible:1, requested:1, failures:0`; subscription now ACTIVE, verified 2026-10-16 06:42:48Z.
- Live fallback HTTP 200, `latest_known_video_id=4L294TyJuww`, `last_fallback_check_at=2026-10-16 06:48:46Z`; source HEALTHY.
- **Historical upload was not backfilled**. Genuine original producer video: https://www.youtube.com/watch?v=ViOutJ0kuJY, title `TVF's Aspirants | Official Trailer | All Episodes Now Streaming`, TVF's own channel, publication **calendar date** 2021-04-06. This supports *the series identity*, **not** Aspirants Season 3 specifically and not a new announcement. Evidence added only to candidate metadata `producerOfficialYouTubeSource` and an audit record, `rawEvidenceIngested=false`, `countsTowardApprovalGate=false`.
- New total **231 active source identities, 231 effectively HEALTHY**: 185 YouTube, 8 WEB, 38 RSS. No duplicate YouTube stable channel ID existed before registration.

## Safety issue found and patched in existing automated OTT release pathway

The earlier independent corporate owner mapping protects `operator_review_entity_candidate` and `operator_promote_entity_candidate`, but the separate system function `system_promote_verified_ott_candidate_two_source` still counted distinct source *identities* from `OTT_RELEASE` signals. That permitted an About Amazon website + Prime Video YouTube identity to masquerade as independent owners for **automatic movie promotion** (does not apply to pending SERIES candidates). Both system OTT paths also defaulted unknown country to `IN`.

- **PR #60** https://github.com/rayadinaveen98-ship-it/cinerelay/pull/60, merged `6a4742115a8375e2f5b660691bc7039381e90658`, migration `20261016153000_phase1_ott_system_corporate_owner_gate.sql`.
- The two-source auto-promoter additionally counts distinct verified corporate-owner IDs scoped **only** to matching deterministic OTT release evidence; distinct logical Amazon entries count as one.
- The verified two-source and confirmed single-first-party system OTT promotions now preserve `country_code=NULL` rather than inventing India.
- DB pgTAP regression verifies two same-company logical sources do not system promote; an additional genuine independent source can; unknown country remains unknown. Database and edge/web/consumer CI passed. Function execute permissions remain service_role-only; no anon/authenticated access.
- Production migration applied successfully and function-body check confirmed corporate gate and removed India fallback on both system functions.
- Source additions and system patch generated no new historical canonical events or alerts.

## Remaining phase-one acceptance

- The original archived 2021 TVF trailer is **not** a new post and must not be replayed as breaking news. A dedicated archive-only, no-event ingestion route with honest date precision is needed before it can become an `entity_discovery_evidence` record.
- *Aspirants*, *Storm*, and *The Diplomat* are still PENDING, 1 independent evidence owner each; no promoted entity or linked canonical events.
- An actual signed-in operator still needs to test producer-lead submission for the authentic HRX Films original `Storm` post. TVF company profile alone is not a valid direct post URL.
- First-ever naturally arriving new producer update through TVF WebSub is pending observation. Current verified WebSub + fallback baseline tests alone do not prove new-post delivery.
- No new Android APK required.
