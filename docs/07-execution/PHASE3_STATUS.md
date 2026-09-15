# Phase 3 Status — Internal Web Intelligence Console

Date: 2026-09-15

## Overall state

**Phase 3: ACTIVE / P3.1 BACKEND PROVEN / P3.2 LIVE FEED IMPLEMENTED**

Phase 2 is production-verified and merged to `main` through PR #2 at merge commit:

`e757afef33b18572c1438462621d98298d388cb5`

Active branch:

`phase-3/internal-web-console`

Draft PR:

`#3`

Phase 3 exposes CineRelay's real production intelligence system through a secure internal operator console. It is an operator/debug/review surface first, not a public consumer product.

## Production baseline carried into Phase 3

Authoritative ingestion remains:

`official uploads playlist -> authoritative discovery -> targeted enrichment -> raw/revision -> intelligence`

WebSub remains a best-effort low-latency accelerator rather than a correctness dependency.

## P3.1 — Web foundation + secure data boundary

### Implemented

- React + TypeScript + Vite application in `apps/web`;
- TanStack Router application shell;
- TanStack Query server-state layer;
- Tailwind internal-console UI;
- Supabase magic-link authentication client;
- `public.operator_users` allowlist table with RLS and no browser-readable policy;
- `cinerelay-console-api` privileged server-side data boundary;
- browser receives only Supabase URL + publishable key;
- service-role material remains server-side;
- real production overview counts and aggregate source health;
- discovery-gap correctness metric;
- web build/type-check job added to GitHub Actions;
- console API added as the ninth Edge Function in type/bundle CI.

### CI and hosted proof

First implementation CI #139 found one isolated Deno return-type issue in the new console API. The web build and existing backend remained green.

The type contract was repaired at commit:

`4a9113093b2d9150a76fd0c7a38c76ee94382379`

CineRelay CI #140 then passed all four jobs:

- intelligence/connectors: PASS;
- web-console: PASS;
- all nine Edge Functions: PASS;
- PostgreSQL migrations + pgTAP + DB lint: PASS.

Hosted deployment from the exact CI #140 artifact:

- `operator_users` migration: applied successfully;
- `cinerelay-console-api`: v1 / ACTIVE;
- deployment artifact id: `10392928373`;
- artifact digest: `sha256:5af7da62870eaf8399ef6d0dffe586385418643bc87e055fbb2ef5f4b0a5c8e3`.

### Security canaries already proven

Hosted request `3024`:

- no Authorization header;
- response: HTTP `401`;
- body: `authentication_required`.

Hosted request `3015`:

- invalid bearer token;
- response: HTTP `401`;
- body: `invalid_session`.

Hosted Auth currently has zero real users. Therefore the remaining operator-boundary canaries require the first genuine operator account:

1. authenticated but not allowlisted -> HTTP `403`;
2. allowlisted operator -> HTTP `200` with real overview data.

A disposable credential-generating canary was intentionally not forced after platform safety checks blocked that approach.

### Hosting state

Cloudflare Pages remains the locked production static host. There is currently no connected Cloudflare deployment capability in this environment, so no production hosting decision has been silently changed.

Vercel is connected and available only as an optional temporary preview surface; it is not being adopted as CineRelay's required production host.

## P3.2 — Live intelligence feed

### Implemented on branch

The console API now supports an authenticated `feed` action backed by the normalized production schema:

- `events`;
- `entities`;
- `event_evidence`;
- `raw_items`;
- `source_identities`;
- `sources`.

The API returns canonical event context plus provenance:

- entity/title;
- event type;
- verification state;
- priority band;
- headline + summary;
- event status and timestamps;
- structured event data;
- evidence role/weight;
- official source name and platform;
- raw source title;
- platform item id;
- canonical evidence URL;
- publication timestamp.

The React console now has a `/feed` route with:

- newest canonical events;
- verification and priority context;
- entity/title;
- source provenance;
- official evidence links;
- automatic 30-second refresh.

Current P3.2 head:

`6d289a068dddbbfad60f7378d981a7108e4a16ee`

CI #143 is the verification run for this exact feed implementation.

## Remaining locked Phase-3 scope

### P3.3 — Event/evidence + title timeline

- event detail;
- full evidence provenance;
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

- first genuine operator account + allowlist proof;
- permission/security review;
- production-like data checks;
- end-to-end operator flows;
- hosted static deployment using the locked free-first stack;
- final CI green.

## Non-goals

Do not expand Phase 3 into:

- public user accounts;
- Android application UI;
- mass source onboarding;
- Instagram/X ingestion;
- broad web scraping;
- consumer social/community features;
- paid infrastructure without an explicit decision.

## Exit criteria

Phase 3 is complete only when an authenticated operator can use the hosted console to:

1. inspect recent official-source ingestion;
2. trace an item from source -> raw/revision -> resolution -> canonical event/evidence;
3. inspect unresolved and ambiguous work without database-console access;
4. inspect source/discovery/WebSub/quota/scheduler health;
5. search/filter the intelligence state;
6. perform explicitly supported correction/review operations safely;
7. reload the hosted application and retain real backend state;
8. complete core workflows without service-role material in the browser;
9. pass automated build/type/security-oriented checks;
10. operate without adding required recurring infrastructure cost.

_Last updated: 2026-09-15_
