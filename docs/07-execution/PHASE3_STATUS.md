# Phase 3 Status — Internal Web Intelligence Console

Date: 2026-09-15

## Overall state

**Phase 3: ACTIVE / FOUNDATION STARTED**

Phase 2 is production-verified and merged to `main` through PR #2 at merge commit:

`e757afef33b18572c1438462621d98298d388cb5`

Phase 3 begins from that exact merged baseline on branch:

`phase-3/internal-web-console`

The purpose of Phase 3 is to expose the intelligence system that already exists in production through a secure internal web console. The console is an operator/debug/review surface first, not a public consumer product.

## Product objective

An authenticated operator must be able to answer, from one web interface:

- what official-source items CineRelay discovered recently;
- what intelligence events were produced and why;
- which entity/title each item resolved to, including unresolved/ambiguous cases;
- which evidence supports a canonical event;
- which sources are healthy, degraded, rate-limited, or budget-constrained;
- whether authoritative discovery, WebSub acceleration, enrichment, processing, and cron are operating correctly;
- which items need human review or correction;
- whether duplicate/suppression/reclassification actions are needed.

## Locked Phase-3 scope

1. **Authentication**
   - internal/operator access only;
   - no public write endpoints;
   - server-side privileged data access only where required.

2. **Live feed**
   - newest raw official-source items;
   - source, platform, publish/detection timestamps;
   - ingestion path (`UPLOADS_PLAYLIST_PRIMARY`, WebSub, later connectors);
   - resolution state and canonical event summary when present.

3. **Event + evidence detail**
   - canonical event fields;
   - entity/title;
   - verification state, confidence, priority;
   - structured event data;
   - attached raw-item evidence and source provenance.

4. **Title/entity timeline**
   - ordered canonical events for one movie/series/entity;
   - linked raw evidence and revisions.

5. **Source registry**
   - official source identities;
   - connector type/access mode;
   - active state;
   - channel/playlist operational metadata.

6. **Source-health dashboard**
   - source health state and error ownership;
   - authoritative-discovery timestamps/cadence;
   - `fallback_gap_count` correctness alarm;
   - WebSub accelerator health/ingress telemetry;
   - quota checkpoint and recent worker/cron status.

7. **Review/correction queue**
   - unresolved/ambiguous items;
   - inspect resolver methods/scores;
   - controlled operator correction flow.

8. **Operator actions**
   - merge/suppress/reclassify only through explicit audited server-side commands;
   - no direct browser use of service-role credentials.

9. **Search + filters**
   - source;
   - entity/title;
   - event type;
   - verification/priority;
   - resolution state;
   - time range.

10. **Benchmark/diagnostic view**
    - current intelligence benchmark status;
    - recent ingestion/processing diagnostics useful for regression triage.

## Non-goals for Phase 3

Do not expand Phase 3 into:

- public user accounts;
- Android application UI;
- mass source onboarding;
- Instagram/X ingestion;
- broad web scraping;
- consumer social/community features;
- paid infrastructure without an explicit decision.

## Implementation principles

- preserve the ₹0/month recurring-infrastructure target;
- treat Supabase/Postgres as the source of truth;
- reuse the existing domain/intelligence contracts instead of inventing parallel UI-only semantics;
- keep privileged credentials server-side;
- show truthful unresolved/ambiguous states rather than hiding them;
- make source-health ownership visible instead of flattening every problem into one generic status;
- prioritize operator clarity and evidence traceability over decorative UI.

## Initial execution slices

### P3.1 — Web foundation + secure data boundary

- replace the placeholder `apps/web` README-only state with a working React/TypeScript internal application;
- establish app routing/layout;
- establish authenticated operator boundary;
- add typed server-side data-access layer;
- define shared UI models derived from existing database contracts;
- add CI build/type-check coverage.

### P3.2 — Live intelligence feed

- raw-item feed;
- source + timestamps;
- resolution state;
- linked event summary;
- filters/search baseline.

### P3.3 — Event/evidence + title timeline

- event detail;
- evidence provenance;
- entity/title timeline;
- raw revision visibility where useful.

### P3.4 — Source registry + health operations

- source registry;
- authoritative discovery status;
- WebSub accelerator telemetry;
- quota and scheduler health.

### P3.5 — Review/correction workflow

- unresolved/ambiguous queue;
- safe operator correction commands;
- audit trail;
- merge/suppress/reclassify controls.

### P3.6 — QA + hosted internal console

- permission/security review;
- production-like data checks;
- end-to-end operator flows;
- CI green;
- hosted internal console deployment using the locked free-first stack.

## Exit criteria

Phase 3 is complete only when an authenticated operator can use the hosted console to:

1. inspect recent official-source ingestion;
2. trace an item from source -> raw/revision -> resolution -> canonical event/evidence;
3. inspect unresolved and ambiguous work without database-console access;
4. inspect source/discovery/WebSub/quota/scheduler health;
5. search/filter the intelligence state;
6. perform the explicitly supported correction/review operations safely;
7. reload the hosted application and retain real backend state;
8. complete core workflows without service-role material in the browser;
9. pass automated build/type/security-oriented checks;
10. operate without adding required recurring infrastructure cost.

## Current checkpoint

- Phase 2 PR #2: **MERGED**
- Phase 2 merge commit: `e757afef33b18572c1438462621d98298d388cb5`
- Phase 3 branch: `phase-3/internal-web-console`
- Phase 3 implementation: **starting at P3.1**

_Last updated: 2026-09-15_
