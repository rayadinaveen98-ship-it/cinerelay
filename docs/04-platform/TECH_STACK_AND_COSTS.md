# Tech Stack and Cost Guardrails

## Goal

Build CineRelay professionally while keeping the prototype and early personal-use system at **₹0/month** wherever practical.

The stack must support eventual scale without forcing a rewrite of domain logic.

All pricing/limits below were checked on **2026-09-14** and must be revalidated before relying on them commercially.

## Locked stack

### Repository / CI

**GitHub public repository**

Use for:
- source control;
- architecture/specification;
- issues/roadmap;
- CI;
- release artifacts where appropriate.

**GitHub Actions**

Use for:
- lint/test/typecheck;
- database migration checks;
- web builds;
- Android builds/tests;
- release packaging.

Do **not** use GitHub Actions as the production polling engine.

Current cost note: standard GitHub-hosted runners are free for public repositories. Artifact/cache limits still apply.

## Backend platform

### Supabase — primary backend

Use:
- PostgreSQL database;
- Auth;
- Row Level Security;
- Realtime where useful;
- Edge Functions;
- Cron / `pg_cron`;
- `pg_net`;
- Vault/secrets;
- optional Storage for CineRelay-owned assets only.

Why:
- relational model fits entities/events/evidence very well;
- Postgres full-text/trigram/vector options avoid extra services;
- cron + functions support a job-driven ingestion architecture;
- one platform reduces operational complexity;
- excellent free tier for proving the product.

### Supabase free-plan snapshot (2026-09-14)

Current published limits include approximately:
- $0/month;
- 500 MB database per project;
- 5 GB egress;
- 1 GB Storage;
- 50,000 monthly active users;
- 500,000 Edge Function invocations;
- 2 million Realtime messages;
- 200 peak Realtime connections;
- two active free projects across eligible free usage;
- free projects may pause after one week of inactivity.

Edge Function resource limits currently include roughly:
- 2 seconds CPU per request;
- 150 seconds wall-clock on Free.

Therefore workers must be small/batched and I/O-oriented.

### Scheduling

Supabase Cron/`pg_cron` + `pg_net` can invoke an Edge Function on recurring schedules, including minute-level/sub-minute capabilities on supported Postgres versions.

Design:
- one/few scheduler jobs;
- scheduler leases due work from a `jobs` table;
- workers process bounded batches;
- retry/backoff is data-driven.

Do not create one cron job per source.

## Web app

### React + TypeScript + Vite

Why Vite/client-rendered V1 rather than Next.js:
- CineRelay V1 is an authenticated intelligence dashboard, not SEO-first publishing;
- no SSR server cost/complexity required;
- extremely fast build/dev loop;
- easy static deployment;
- framework independence from the backend.

Libraries:
- React (latest stable at implementation baseline);
- TypeScript strict mode;
- Vite;
- TanStack Query;
- TanStack Router or equivalent typed router;
- Tailwind CSS;
- selective shadcn-style primitives, owned/customized rather than a generic template;
- Zod for client boundary validation where needed.

### Web hosting — Cloudflare Pages/static assets

Use purely static hosting for V1; API traffic goes directly to Supabase endpoints/functions.

Current Cloudflare free-plan notes:
- static asset requests are free and unlimited;
- Pages Free currently supports 500 builds/month;
- Free Pages projects allow up to 20,000 files;
- Pages Functions/Workers dynamic requests would consume Workers limits, but V1 does not need them.

This is preferred over making Vercel Hobby a dependency because Vercel describes Hobby as intended for personal/non-commercial use. CineRelay should have a clean path to becoming a real product.

## Android app

### Native Kotlin + Jetpack Compose

Use:
- Kotlin;
- Jetpack Compose;
- Navigation Compose;
- ViewModel + StateFlow;
- unidirectional data flow;
- Hilt;
- Room;
- WorkManager for device-local deferred tasks;
- Kotlin coroutines/Flow;
- image loading library selected at implementation baseline;
- Supabase HTTP/API access through a maintained Kotlin client or generated API layer.

Why native Android:
- best Android UX/control;
- reliable notification/background integration;
- long-term maintainability;
- no need to force the desktop-style web dashboard and mobile app into one UI framework.

The web and Android apps share **contracts and behavior**, not UI code.

## Push notifications

### Firebase Cloud Messaging (FCM)

FCM is currently listed as no-cost.

Use only for delivery. Notification rules/eligibility live in CineRelay backend tables so the system can later add email/other delivery channels without rewriting event logic.

## Search

### V1

Use Postgres:
- full-text search;
- `pg_trgm` fuzzy matching;
- normalized aliases;
- indexed filters.

### Optional semantic assist

Enable `pgvector` only when benchmark data shows it improves entity resolution/search.

### Not in V1

Do not add Algolia, Elasticsearch/OpenSearch, Typesense Cloud or another paid/search cluster until Postgres is proven insufficient.

## AI / ML strategy

### Core rule

CineRelay must remain functional without a paid LLM.

Order of execution:
1. exact source rules;
2. regex/pattern/lexical classification;
3. deterministic entity relationships;
4. Postgres similarity/fuzzy logic;
5. optional model assistance for ambiguous cases.

### Provider abstraction

Create an `AiAssistProvider` interface rather than binding domain logic to one vendor.

Possible zero-cost experimentation:
- Cloudflare Workers AI free allocation (currently 10,000 neurons/day);
- other legitimate free model tiers available at implementation time;
- local/offline evaluation during development.

No paid AI call is required to ingest an official YouTube trailer correctly.

### AI safety/data rule

A model may:
- extract candidate dates/names;
- classify an event;
- summarize evidence;
- rank ambiguous entity matches.

A model may not:
- fabricate evidence;
- create `OFFICIAL` status without source authority;
- overwrite raw source text;
- become the only reason a high-impact fact is considered true.

## Source APIs

### YouTube

Use:
- WebSub/PubSubHubbub for push notifications;
- YouTube Data API v3 for targeted enrichment.

Current default Data API allocation: **10,000 quota units/day**.

Cost target: ₹0.

### X

Official API is currently pay-per-use.

Current published Post read price: **USD $0.005 per resource**.

Decision:
- connector disabled by default in ₹0 V1;
- source handles still stored;
- manual radar account remains useful;
- future connector requires explicit user-enabled budget/spend cap.

### Instagram

Use only first-party API capabilities available for Professional accounts/Business Discovery-style metadata where permitted.

Do not budget for or depend on unofficial scraping infrastructure.

### Threads

Use official Meta API public-profile capabilities where policy/access permits.

### RSS/official web

No platform cost; respect source limits and crawl politely.

## Media storage

V1 stores:
- external canonical URLs;
- thumbnails/metadata only when use is permitted;
- text/fingerprints needed for intelligence;
- CineRelay-owned assets.

Do not mirror large third-party poster/video/audio libraries.

Benefits:
- lower copyright risk;
- lower storage/egress;
- easier source attribution;
- ₹0-friendly operation.

## Observability

V1 avoids a paid observability stack.

Use:
- structured Edge Function logs;
- `connector_runs`;
- `source_health`;
- `jobs`/dead-letter tables;
- benchmark metrics;
- GitHub Actions output;
- admin health views.

Add Sentry/other tooling later only after a measured need.

## Testing stack

### TypeScript/web
- Vitest;
- Testing Library;
- Playwright for critical flows.

### Edge Functions
- Deno/native tests;
- fixture-based connector tests;
- integration tests against local Supabase.

### Database
- SQL migration verification;
- pgTAP where useful;
- seeded benchmark fixtures.

### Android
- JUnit;
- coroutine test utilities;
- Room tests;
- Compose UI tests;
- MockWebServer or equivalent for API integration.

## Local development

Recommended tools:
- Node.js current LTS supported by toolchain;
- `pnpm` workspaces for web/shared TS packages;
- Supabase CLI + Docker for local backend;
- Android Studio + Gradle wrapper;
- GitHub CLI optional;
- VS Code/IDE of choice for web/backend.

No paid IDE is required.

## Monorepo layout

```text
apps/
  web/
  android/
supabase/
  migrations/
  functions/
  seed/
packages/
  contracts/
  domain/
  source-fixtures/
tests/
  benchmark/
  integration/
docs/
.github/workflows/
```

## Contract strategy

Use JSON Schema/OpenAPI or generated TypeScript/Kotlin models for external API DTOs.

Do not attempt to share TypeScript runtime code with Kotlin. Share the **schema**, then generate/implement platform-native models.

## Cost model — early phase

| Component | V1 expected cost |
|---|---:|
| GitHub public repo + standard Actions runners | ₹0 |
| Supabase Free | ₹0 |
| Cloudflare static web hosting | ₹0 |
| Firebase Cloud Messaging | ₹0 |
| YouTube API/WebSub within default quota | ₹0 |
| RSS/public first-party pages | ₹0 |
| Instagram/Threads permitted APIs | ₹0 where access permits |
| X automated reads | **Disabled by default** |
| AI | ₹0 required; optional free allocation only |
| Domain name | optional paid |
| Google Play full public distribution | optional one-time USD $25 |

Direct APK/testing does not require paid Play distribution. As of September 2026, Android Developer Console also documents a no-fee limited-distribution option for up to 20 devices, while full distribution uses the one-time USD $25 registration fee.

## Upgrade triggers

### Supabase upgrade only when one of these is real

- database/storage/egress limit approaches sustained threshold;
- production pause/backup/SLA requirements justify it;
- user volume exceeds free quota;
- function volume/resources demonstrably constrain reliability.

Current Pro starts at roughly USD $25/month.

### Cloudflare dynamic compute

Not required for V1. If later used, current Workers Paid starts around USD $5/month.

### X

Buy credits only when:
- other source coverage is proven;
- X adds measurable unique events;
- cost/event is acceptable;
- budget cap and usage dashboard exist.

## Spend guardrails

Before any paid API/service is enabled:

1. feature flag defaults OFF;
2. explicit monthly budget exists;
3. hard/soft quota is configured where provider allows;
4. connector logs estimated cost;
5. system degrades gracefully at zero balance;
6. no hidden automatic upgrade.

## Sources checked for this decision

- Supabase pricing/docs: `https://supabase.com/pricing`
- Supabase Edge Function pricing: `https://supabase.com/docs/guides/functions/pricing`
- Supabase scheduled Edge Functions: `https://supabase.com/docs/guides/functions/schedule-functions`
- YouTube API quota: `https://developers.google.com/youtube/v3/getting-started`
- YouTube WebSub: `https://developers.google.com/youtube/v3/guides/push_notifications`
- X API pricing: `https://docs.x.com/x-api/getting-started/pricing`
- Cloudflare Pages limits: `https://developers.cloudflare.com/pages/platform/limits/`
- Cloudflare static asset pricing: `https://developers.cloudflare.com/pages/functions/pricing/`
- Firebase pricing: `https://firebase.google.com/pricing`
- GitHub Actions billing: `https://docs.github.com/en/billing/concepts/product-billing/github-actions`
- Android Developer Console distribution: `https://support.google.com/android-developer-console/answer/16640817`

_Last updated: 2026-09-14_
