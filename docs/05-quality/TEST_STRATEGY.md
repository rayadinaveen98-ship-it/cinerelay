# Test Strategy

## Purpose

CineRelay is a data/intelligence system. A screen rendering correctly is not enough. We must test whether source activity becomes the **right event, for the right entity, with the right verification state, exactly once in the feed**.

## Test pyramid

### 1. Pure unit tests

Fast tests for:
- URL canonicalization;
- text normalization;
- language hints;
- date/time parsing;
- event pattern rules;
- source authority logic;
- scoring;
- dedupe keys;
- retry/backoff;
- alias normalization;
- deterministic entity matching.

These should run on every commit.

### 2. Connector fixture tests

Every connector ships with stored sanitized fixtures representing:
- normal item;
- edited item;
- deleted/unavailable item where detectable;
- pagination;
- rate limit;
- auth failure;
- malformed response;
- empty response;
- schema variation.

Connector parsing is tested against fixtures without live external calls.

### 3. Database tests

Validate:
- constraints;
- RLS;
- job leasing;
- idempotency;
- event/evidence relationships;
- migration forward compatibility;
- projection updates;
- notification outbox semantics.

### 4. Pipeline integration tests

Feed a raw fixture through:

```text
ingest → normalize → resolve → extract → classify → verify → dedupe → event
```

Assert the final canonical event and all important intermediate records.

### 5. Replay tests

Run old raw fixtures through new engine versions.

Purpose:
- prevent classifier changes from creating regressions;
- measure improvements objectively;
- validate migration of derived records.

### 6. Contract tests

The web and Android clients depend on stable API/event schemas.

CI validates:
- generated schemas are current;
- required fields remain compatible;
- enum/event-type additions are handled safely;
- invalid payloads fail clearly.

### 7. Web UI tests

Use:
- Vitest + Testing Library for components/state;
- Playwright for critical user journeys.

Critical flows:
- sign in;
- scan Live feed;
- filter events;
- open title timeline;
- open original evidence;
- follow/unfollow title;
- configure alert;
- inspect source health/admin review where authorized.

### 8. Android tests

Use:
- JUnit;
- coroutine/Flow tests;
- Room tests;
- repository/view-model tests;
- Compose UI tests;
- API mocks.

Critical flows mirror web behavior but test Android-specific:
- notification deep link;
- offline cached feed;
- refresh/reconnect;
- process death/navigation restoration where practical;
- device token registration.

## Benchmark dataset

This is a first-class test asset.

Create `tests/benchmark/` with real-world-inspired labeled cases from tracked cinema sources.

Each case contains:
- source identity;
- normalized/sanitized source payload;
- expected entity/entities;
- expected event type;
- expected verification state;
- expected structured values;
- expected dedupe cluster;
- whether notification is expected.

## Benchmark categories

Include cases for:
- trailer announced vs trailer released;
- teaser vs glimpse;
- lyrical/song release vs trailer using a song title;
- release date announcement;
- release-date change/postponement;
- OTT platform/date;
- cast announcement;
- shooting start/wrap;
- press meet live/upload;
- pre-release event;
- title working-name alias;
- multiple movies with similar names;
- multilingual/transliterated titles;
- same announcement reposted by many sources;
- conflicting reliable sources;
- rumor mistaken for official update;
- irrelevant channel upload.

## Golden event clusters

For dedupe testing, group multiple raw items that should become one event.

Example:

```text
Official studio poster
Official actor repost
Trade article about same poster
YouTube community mention
```

Expected:
- one canonical `POSTER_RELEASED` event;
- primary evidence = studio;
- other items = corroborating/repeat evidence;
- one feed card;
- at most one eligible instant notification.

## Live smoke tests

CI should not depend heavily on third-party live APIs, because network/quota/policy instability creates flaky builds.

Instead:
- run scheduled/manual smoke checks separately;
- verify auth/connectivity and a tiny known request;
- never consume large quotas in PR CI.

## Source canaries

Maintain a few known stable public sources per connector.

The health system checks whether:
- response schema remains parseable;
- expected identifiers are present;
- subscription renewal works;
- auth remains valid.

Canary failures create operational alerts.

## Migration testing

Every database migration must be:
- committed;
- reproducible on clean local DB;
- tested from current previous schema where practical;
- non-destructive unless explicitly approved;
- accompanied by data backfill logic when required.

Never edit a previously deployed migration to change history; create a new migration.

## Security tests

Include:
- RLS tests for cross-user data leakage;
- service-key absence from client bundles;
- webhook auth/challenge validation;
- URL allowlist/SSRF protections;
- HTML sanitization;
- rate-limit behavior;
- malicious oversized payload handling;
- malformed external URLs.

## Performance tests

Early performance tests focus on realistic hot paths:
- Live feed query;
- title timeline query;
- source-due scheduler query;
- job lease query;
- dedupe candidate lookup;
- alias/entity search.

Use `EXPLAIN ANALYZE` before speculative infrastructure upgrades.

## Quality gates by phase

### Phase 1 prototype
- all migrations apply cleanly;
- core unit tests green;
- YouTube fixtures green;
- end-to-end sample pipeline green;
- no duplicate raw rows on replay.

### Phase 2 intelligence core
- benchmark metrics generated in CI;
- ≥95% precision on core Tier-A benchmark event types;
- ≥95% correct entity assignment for unambiguous benchmark cases;
- zero benchmark false-`OFFICIAL` cases;
- dedupe feed-card duplicate rate <5% on benchmark clusters.

### Phase 3 creator web console
- critical Playwright flows green;
- source health visible;
- manual correction flow audited.

### Phase 4 Android
- unit/UI test suite green;
- installable debug/release-candidate APK generated in CI where signing permits;
- FCM deep-link flow verified on device/emulator.

### Phase 5 broader beta
- connector canary suite healthy;
- latency/recall metrics tracked;
- backup/export/recovery procedure tested;
- operational dashboard reviewed.

## CI workflow target

PR checks eventually include:

```text
format/lint
TypeScript typecheck
web unit tests
function/unit tests
DB migration validation
benchmark pipeline
web build
Android lint/unit tests
```

Heavier Android UI/instrumented and Playwright suites may run on main/release or optimized PR subsets as build time grows.

## Definition of a bug

Examples that count as serious product bugs even if UI looks fine:
- event attached to wrong movie;
- unofficial report labeled official;
- same trailer appears 12 times;
- changed release date overwrites history with no event;
- source connector silently stops working;
- notification points to wrong evidence;
- client shows stale value after correction;
- retry creates duplicate event.

_Last updated: 2026-09-14_
