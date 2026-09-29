# CineRelay Phase Status

Date: 2026-09-29

## Current status

**Phase 0 — Product Foundation: COMPLETE**  
**Phase 1 — Intelligence Core Skeleton: COMPLETE**  
**Phase 2 — YouTube Production Connector: COMPLETE / PRODUCTION-VERIFIED**  
**Phase 3 — Internal Web Intelligence Console: COMPLETE / HOSTED / BROWSER-VERIFIED**  
**Phase 4 — Free Source Expansion: COMPLETE / INTEGRATED**  
**Phase 5 — Alert & Creator Intelligence: COMPLETE / INTEGRATED**  
**Phase 6 — Android V1: STABLE PROMOTION — CineRelay v0.2.1**  
**Phase 7 — Source Discovery & Self-Maintenance: NEXT**

The active Phase 6 release PR promotes the Android consumer-intelligence line to CineRelay `v0.2.1` with a dedicated signed stable-release pipeline, Firebase-required publication, immutable GitHub release creation and versionCode `210001`.

## Stable Android baseline

The v0.2.1 product baseline includes:

- native Kotlin/Compose Android client;
- auth/session and personalization onboarding;
- language-first setup with five recommended official channels plus full source directory;
- evidence-first Home feed with single-story hero and evolving-story grouping;
- canonical Story Intelligence with `What Changed Now` and evidence timeline;
- Radar v2.1 with freshness, authority, verification, corroboration and WHY NOW scoring;
- consumer-first OTT intelligence: This Weekend, Today and Next 30 Days;
- Today in Cinema / On This Day;
- Universal Search and Intelligence Search;
- source-level notification preferences and global notification master;
- Firebase push delivery;
- notification detail, Sources Directory, Control Room and Settings;
- permanent Android signer and monotonic update-safe versioning.

## Reliability baseline

- Raw-first ingestion and revision persistence remain the source of truth.
- Canonical events preserve evidence and source traceability.
- YouTube authoritative discovery remains the correctness path; WebSub is an accelerator, not a dependency.
- Official/direct sources remain preferred over secondary sources.
- Source/platform isolation is maintained.
- X remains deliberately dormant after the provider `HTTP 402 Payment Required` gate; no active X identities or X cron jobs should exist until Phase 8 preconditions are explicitly met.
- High-authority trust changes remain policy-gated and must never be silently promoted by automation.

## Phase 7 — immediate next work

### P7.1 Source health and drift detection

- parser-version health and drift signals;
- stale/dead source detection;
- expected-vs-observed activity baselines;
- source outage vs genuine silence classification;
- operator-visible health reasons and recovery state.

### P7.2 Candidate discovery and identity matching

- discover candidates from Tier-A links/mentions and first-party relationships;
- normalize and match candidate identities against the existing source graph;
- dedupe aliases before proposing new identities;
- retain evidence for every officiality proposal.

### P7.3 Safe self-maintenance

- WebSub lease visibility and automatic renewal/self-heal;
- activity-based poll-class tuning;
- retry/backoff tuning from observed source behavior;
- stale registration cleanup proposals;
- title/source relationship suggestions.

### P7.4 Trust proposal workflow

- automation may propose trust/authority changes;
- evidence and reason must be visible;
- high-authority promotion remains policy/operator gated;
- every accepted/rejected proposal is auditable.

### P7.5 Android maintenance surface

Expose Phase 7 value inside the app without turning CineRelay into an admin console:

- source-health warnings only when relevant to user confidence;
- clear freshness/coverage indicators;
- graceful degraded-source states;
- developer/operator diagnostics kept behind Control Room.

## Parallel v0.2.x patch line

Real-device visual QA continues as normal maintenance after v0.2.1. UI defects, layout polish, accessibility issues and device-specific problems should ship as `v0.2.2+` patches rather than mutating the immutable v0.2.1 release.

## Later roadmap

**Phase 8 — Optional X Connector:** only after budget approval, spend controls and proof that X adds unique/earlier useful events.  
**Phase 9 — Advanced Intelligence:** transcript/press-meet extraction where lawful, cross-source clustering, semantic entity matching, campaign calendar, source-performance analysis and richer creator suggestions.  
**Phase 10 — Multi-user/Public Product:** public onboarding, team/newsroom accounts, shared collections, subscriptions/business model, API access and broader knowledge-database integration.

The frozen ordering remains:

`sources → evidence → intelligence → reliability → web console → alerts → Android → self-maintenance → optional X → advanced intelligence → multi-user scale`
