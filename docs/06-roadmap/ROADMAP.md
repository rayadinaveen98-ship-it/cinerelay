# CineRelay Roadmap

## Roadmap philosophy

CineRelay is built **inside-out**:

> sources → evidence → intelligence → reliability → web console → alerts → Android → scale

We do not start by building many polished screens around fake/sample data.

Each phase must leave behind something measurable and reusable.

---

# Phase 0 — Product Foundation

## Goal

Freeze the product contract before implementation.

## Deliverables

- product charter;
- locked decisions;
- source strategy/platform constraints;
- architecture;
- engine contracts;
- canonical data model;
- design philosophy;
- free-first stack/cost policy;
- verification/reliability rules;
- test strategy;
- roadmap and definition of done.

## Exit gate

A new engineer/session can read the repository and understand what CineRelay is, what it is not, how it is supposed to work and what gets built first.

**Status: active / foundation package established 2026-09-14.**

---

# Phase 1 — Intelligence Core Skeleton

## Goal

Prove the complete event pipeline with controlled data before broad source acquisition.

## Build

### Repository/tooling
- monorepo folders;
- TypeScript/web workspace;
- Supabase local setup;
- Android placeholder project only if needed for CI contract, not UI build;
- GitHub Actions baseline.

### Database v0
- entities;
- aliases;
- sources/source identities;
- raw items/revisions;
- jobs;
- claims;
- events/evidence;
- source health;
- audit basics.

### Pipeline v0
- raw ingest API/function;
- deterministic normalization;
- basic entity resolver;
- initial event taxonomy/classifier;
- source authority evaluator;
- dedupe;
- timeline projection.

### Fixtures/benchmark v0
- manually curated test cases across trailers, songs, posters, release dates, production updates and irrelevant items.

## Exit gate

A stored fixture can travel end-to-end and produce the expected canonical event idempotently.

---

# Phase 2 — YouTube Production Connector

## Goal

Make CineRelay useful with one genuinely strong real-time source platform.

## Build

- YouTube source registration;
- WebSub subscribe/unsubscribe/renewal;
- webhook challenge/notification handling;
- YouTube Data API targeted enrichment;
- uploads/title/description revision handling;
- livestream/upcoming metadata handling where supported;
- quota accounting;
- channel health;
- retry/fallback checks;
- source fixtures/canaries.

## Starter coverage

Begin with roughly 25–50 high-value official channels across:
- production houses;
- music labels;
- OTT platforms;
- studios/distributors.

Expand only after measured stability.

## Exit gate

For benchmark/live test channels, new meaningful official uploads appear in CineRelay with correct entity/event mapping and no duplicate feed spam.

---

# Phase 3 — Internal Web Intelligence Console

## Goal

Give the first power user a real interface to inspect and correct the engines.

## Build

- auth;
- Live feed;
- event detail/evidence;
- title page/timeline;
- source registry;
- source health dashboard;
- review queue;
- entity correction;
- event merge/suppress/reclassify;
- basic filters/search;
- benchmark diagnostics.

## Design focus

Functionality and trust first. Use real event cards and timelines. Do not spend the phase on decorative poster-heavy pages.

## Exit gate

The user can use the console daily to monitor the YouTube-backed source set and diagnose/correct mistakes without editing the database manually.

---

# Phase 4 — Free Source Expansion

## Goal

Increase useful coverage without introducing mandatory paid APIs.

## Connector priority

1. RSS/Atom official feeds;
2. first-party studio/platform press/news pages;
3. Threads public profile endpoints where permitted;
4. Instagram Professional-account capabilities where permitted;
5. trusted trade/media feeds/pages;
6. carefully selected additional public pages.

## Build

- generic feed connector;
- domain-specific web connector framework;
- conditional HTTP/cache validators;
- parser versioning;
- source discovery candidate workflow;
- adaptive poll classes;
- per-domain rate limits;
- connector-specific benchmark suites.

## Coverage target

Grow toward the curated **200–500 identity** India-first source graph.

## Exit gate

Coverage increases without degrading precision/health visibility or creating an unmaintainable scraper farm.

---

# Phase 5 — Alert & Creator Intelligence

## Goal

Turn the verified feed into a creator workflow.

## Build

- entity follows;
- event-type preferences;
- instant/high-priority alerts;
- quiet hours;
- digest modes;
- FCM delivery;
- alert dedupe;
- Creator Radar scoring;
- optional concise evidence-based summary;
- “content opportunity” labels separated from factual verification.

## Exit gate

The user can follow projects and reliably receive one useful alert for a meaningful event rather than many repost notifications.

---

# Phase 6 — Android V1

## Goal

Deliver the daily-use mobile client.

## Build

- native Kotlin/Compose application;
- auth/session;
- Live;
- Following;
- Title timeline;
- Radar filters;
- Search;
- Alerts;
- source/evidence deep links;
- FCM;
- Room offline cache;
- refresh/reconnect;
- settings.

## APK policy

From this phase onward, Android milestones should produce installable APKs whenever technically possible.

## Exit gate

A tested installable APK can replace routine web/social checking for the monitored source universe.

---

# Phase 7 — Source Discovery & Self-Maintenance

## Goal

Reduce manual source administration.

## Build

- candidate discovery from Tier-A links/mentions;
- source identity matching;
- evidence-backed officiality proposals;
- WebSub auto-renewal dashboards;
- parser drift detection;
- activity-based poll-class tuning;
- stale/dead source detection;
- title/source relationship suggestions.

## Rule

Automation proposes trust changes; it does not silently promote high-authority sources without policy checks.

---

# Phase 8 — Optional X Connector

## Goal

Add X only when it proves enough unique value to justify its pay-per-use cost.

## Preconditions

- free-source product already useful;
- X developer access configured;
- dedicated radar account/source registry mature;
- explicit monthly budget approved;
- hard/soft spend controls implemented;
- cost/event measurement dashboard exists.

## Build

- reverse chronological followed-account timeline;
- targeted search only where justified;
- incremental cursors/time windows;
- spend accounting;
- strict dedupe with existing sources;
- graceful budget exhaustion.

## Exit gate

X produces measurable unique/earlier events at an acceptable cost per useful event.

---

# Phase 9 — Advanced Intelligence

Potential features after strong core reliability:

- transcript/press-meet extraction where lawful/available;
- timestamped key-update detection from official long videos;
- cross-source narrative clustering;
- advanced semantic entity matching;
- structured campaign calendar;
- release-risk/change analytics;
- source performance/first-report analysis;
- richer creator suggestions;
- event APIs/integrations.

No advanced AI feature is prioritized over source reliability.

---

# Phase 10 — Multi-user/Public Product

Only after the personal/creator product is proven.

Possible scope:
- consumer onboarding;
- public title timelines;
- personal watch/follow graph;
- team/newsroom accounts;
- shared collections;
- email/web push;
- subscription/business model;
- API access;
- integration with a broader movie/series knowledge database.

This phase likely requires paid infrastructure and formal legal/privacy/terms work.

---

# Phase dependencies

```text
P0 Foundation
    ↓
P1 Intelligence Core
    ↓
P2 YouTube Connector
    ↓
P3 Internal Web Console
    ↓
P4 Free Source Expansion
    ↓
P5 Alerts / Creator Intelligence
    ↓
P6 Android V1
    ↓
P7 Self-Maintenance
    ↓
P8 Optional X
    ↓
P9 Advanced Intelligence
    ↓
P10 Multi-user Product
```

Some work can overlap after the core contracts are stable, but no phase should bypass its dependency's quality gate.

## What we deliberately postpone

- full historical IMDb-like catalog;
- social/community reviews;
- box-office aggregation unless reliable licensed/public sources are defined;
- storing poster/video libraries;
- iOS;
- expensive AI;
- paid search infrastructure;
- fully autonomous publishing;
- large public launch.

## Immediate next implementation step

After Phase 0 review, begin **Phase 1** by creating:

1. repository/CI skeleton;
2. local Supabase config;
3. first SQL migrations;
4. versioned event taxonomy/contracts;
5. fixture-driven pipeline test before live connectors.

_Last updated: 2026-09-14_
