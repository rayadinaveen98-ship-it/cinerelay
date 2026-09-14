# Definition of Done

A CineRelay milestone is not done because code compiles or a screen looks good.

## Universal definition of done

Every milestone must satisfy all relevant items below.

### Product contract

- implementation matches locked product/architecture decisions;
- any intentional deviation is documented first;
- no hidden paid dependency was introduced;
- unsupported coverage is stated rather than disguised.

### Data correctness

- migrations are committed and reproducible;
- important new records have provenance;
- idempotency is tested;
- retry/replay does not create duplicate canonical events;
- historical evidence is not silently destroyed.

### Testing

- applicable unit/integration/contract tests exist;
- tests pass in CI;
- representative fixtures cover success and failure paths;
- regressions are added to fixtures/benchmark before/with the fix.

### Reliability

- errors are observable;
- retries/backoff are bounded;
- auth/quota/parser failures have defined states;
- no connector can fail indefinitely without health visibility;
- jobs cannot remain permanently leased after worker death.

### Security

- no secrets committed;
- no service-role key in clients;
- RLS/access rules tested where applicable;
- external content is sanitized/validated;
- webhook/public endpoints validate inputs.

### Cost

- expected request/invocation/quota use is understood;
- free-tier budget remains safe or an upgrade decision is explicitly documented;
- paid connectors remain opt-in with caps.

### Documentation

- architecture/schema/connector docs updated;
- new event types/source rules are documented;
- setup/recovery steps are current;
- next phase status is clear in GitHub.

### User experience

- empty/loading/error/degraded states exist;
- evidence/source is reachable;
- accessibility basics are respected;
- no fake/sample data is presented as real in production builds.

---

# Phase-specific done gates

## Phase 0 — Foundation

Done when:
- product charter exists;
- locked decisions exist;
- platform/source strategy exists;
- system architecture and engine boundaries exist;
- data model exists;
- stack/cost policy exists;
- design philosophy exists;
- verification/reliability contract exists;
- test strategy exists;
- roadmap exists;
- this definition of done exists;
- `START_HERE.md` points to the package.

## Phase 1 — Intelligence Core Skeleton

Done when:
- local Supabase starts from repo config;
- clean DB can apply all migrations;
- base source/entity/raw/event/job schema exists;
- fixture ingestion is idempotent;
- deterministic normalization works;
- entity resolution can return resolved/ambiguous/unresolved;
- event classifier handles initial taxonomy;
- verification state is evidence-driven;
- dedupe merges benchmark duplicates;
- timeline projection can be rebuilt;
- CI runs the pipeline benchmark.

## Phase 2 — YouTube Connector

Done when:
- channel registration supports stable YouTube channel IDs;
- WebSub subscribe/challenge/notification flow works;
- subscription renewal is automatic/observable;
- targeted Data API enrichment works within budget;
- revisions are recorded;
- live connector fixtures/canaries exist;
- failures/rate limits are visible;
- a curated live source set produces correct events;
- benchmark and latency metrics are recorded.

## Phase 3 — Internal Web Console

Done when:
- authenticated user can view Live feed;
- title timelines work;
- original evidence opens reliably;
- filters/search are usable;
- source registry/health visible;
- ambiguous review/correction workflow exists;
- corrections create audit history;
- critical Playwright flows pass;
- deployed static web build works against backend.

## Phase 4 — Free Source Expansion

Each connector is done only when:
- access method is documented and permitted;
- parser/normalizer has fixtures;
- pagination/change handling is tested;
- rate limits/backoff exist;
- source health is implemented;
- dedupe with existing connectors is tested;
- benchmark shows acceptable precision;
- connector can be disabled without breaking the system.

## Phase 5 — Alerts / Creator Intelligence

Done when:
- follows/preferences persist;
- notification eligibility is deterministic/tested;
- one real-world event cannot spam duplicate alerts;
- quiet hours/digest behavior works;
- FCM delivery and deep links work;
- delivery failures retry independently;
- creator suggestions are visibly separate from factual verification.

## Phase 6 — Android V1

Done when:
- installable APK produced;
- core screens operate on real backend data;
- auth/session works;
- offline cache has clear staleness behavior;
- FCM deep link works;
- key Compose UI tests pass;
- no secret/service key ships in APK;
- crash/error states are handled;
- APK/version details recorded in release notes.

## Phase 7 — Self-maintenance

Done when:
- candidate source discovery records evidence;
- trust promotion requires policy/review;
- stale/broken sources are detected;
- poll adaptation does not exceed quotas;
- parser/subscription maintenance alerts exist.

## Phase 8 — X connector

Done only when:
- explicit budget approved;
- API credits configured intentionally;
- cost accounting verified;
- spend cap/degradation tested;
- incremental ingestion avoids rereading excessive posts;
- unique value vs free sources measured;
- connector can be disabled instantly.

---

# Release severity policy

Block release for:
- false `OFFICIAL` labeling in known benchmark case;
- wrong-entity high-priority alert;
- secret leakage;
- RLS/user-data exposure;
- migrations that lose event/evidence history unintentionally;
- uncontrolled paid API usage;
- runaway duplicate notifications;
- silent connector-wide failure.

May release with documented limitation for:
- unsupported Instagram consumer/Story coverage;
- disabled paid X connector;
- low-priority source temporarily degraded;
- minor visual inconsistency that does not affect trust/usability.

## Final rule

> **Reliable partial coverage is releasable. False claims of complete coverage are not.**

_Last updated: 2026-09-14_
