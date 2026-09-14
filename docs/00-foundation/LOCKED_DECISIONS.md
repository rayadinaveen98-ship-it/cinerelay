# Locked Decisions

These are the current product and architecture decisions. They are intentionally explicit so implementation does not drift.

## Identity

- Product name: **CineRelay**.
- Tagline direction: **Every official update. One cinema feed.**
- Repository: `rayadinaveen98-ship-it/cinerelay`.
- GitHub is the permanent source of truth.
- Repository may remain public.
- No open-source license is granted unless one is explicitly added later.

## Product boundary

- CineRelay is a live cinema/series intelligence system.
- It is separate from a static movie-database product.
- It may integrate with a broader movie/series database later through stable entity IDs/APIs.
- V1 is creator/researcher-first, not a mass-consumer social feed.
- India-first coverage is a rollout strategy, not a domain limitation.

## Core data philosophy

- The canonical object exposed to clients is an **event**, not a raw social post.
- Raw source items are preserved for traceability.
- An event may have multiple evidence items.
- One source item may yield multiple structured claims/events when justified.
- Events are never considered trustworthy merely because an AI model generated them.
- Original source URLs and timestamps are first-class data.
- Source authority is stored independently from event confidence.

## Source policy

- Official sources are prioritized over aggregators.
- APIs/webhooks/feeds are preferred over scraping.
- Scraping is never a foundational dependency when a documented first-party mechanism exists.
- Unsupported private content is out of scope.
- Deleted/ephemeral content cannot be guaranteed.
- Platform access failure must degrade visibly rather than silently.
- We do not promise 100% of everything on the internet.

## Platform decisions

### YouTube

- Tier-1 source for V1.
- Use YouTube WebSub/PubSubHubbub for near-real-time upload/title/description notifications.
- Use YouTube Data API only where needed for metadata/enrichment and respect quota.
- Do not poll channel search endpoints as the main strategy.

### X

- Dedicated CineRelay/FrameByNavin radar account is useful for curated following and manual discovery.
- Programmatic API ingestion is **optional**, not required for ₹0 V1.
- X API is pay-per-use; no core engine may depend on a paid X read path.
- If enabled later, use authenticated reverse-chronological timeline/search endpoints and strict budget caps.

### Instagram

- Dedicated radar account is useful for human monitoring/source discovery.
- Backend ingestion must use permitted professional-account API capabilities where available.
- Following accounts in Instagram does not imply API access to the home feed.
- Consumer-account coverage and external Stories are not guaranteed.
- Do not build the product around brittle authenticated-browser scraping.

### Threads

- Treat as a supported/experimental connector where official public-profile endpoints permit retrieval.
- Do not make it mandatory for V1 completeness.

### Websites / feeds

- RSS/Atom and first-party press/news pages are preferred.
- Website change monitoring is allowed only for public pages and must be polite, rate-limited and source-specific.
- Respect robots, terms and technical restrictions.

## Intelligence decisions

- Deterministic rules come before LLM calls for obvious classification and entity matching.
- AI is a pluggable assistive layer for extraction, summarization, ambiguity resolution and low-confidence classification.
- AI output must include evidence references and structured confidence.
- No event becomes `OFFICIAL` because of model confidence; officiality comes from source authority/evidence.
- Deduplication is mandatory before high-priority notifications.
- Entity resolution must understand aliases, working titles, transliterations and language variants.

## Verification states

User-facing verification uses these conceptual states:

1. **OFFICIAL** — direct authoritative source.
2. **CONFIRMED** — independently corroborated by authoritative/reliable evidence.
3. **RELIABLE_REPORT** — trusted reporting without direct official confirmation.
4. **DEVELOPING** — credible but incomplete/conflicting evidence.
5. **RUMOR** — unverified claim retained only when the product intentionally surfaces rumor tracking.

Rumors are off by default for high-priority alerts.

## V1 event classes

V1 must support at least:

- project announcement;
- title announcement/change;
- cast/crew announcement;
- production launch/pooja;
- shooting start/wrap/schedule update;
- first look/poster;
- glimpse;
- teaser;
- trailer;
- song/music update;
- promo/spot;
- making/BTS;
- interview;
- press meet;
- pre-release/promotional event;
- certification/runtime update;
- theatrical release date announcement/change;
- OTT/platform announcement/date change;
- premiere/special screening;
- sequel/spinoff/season renewal update;
- delay/postponement;
- cancellation/hold where reliably established.

## Backend architecture

- Primary datastore: **Supabase Postgres**.
- Supabase also provides Auth, RLS, Realtime, Edge Functions, Cron, Vault and optional Storage.
- Scheduled work uses database-backed jobs plus Supabase Cron/Edge Functions.
- Work is chunked and idempotent; no long-running monolithic crawler.
- Postgres remains the source of truth; client caches are disposable.
- Search begins with Postgres full-text/trigram capabilities; no separate search cluster in V1.
- `pgvector` may be enabled for semantic/entity-assist use but is not required for basic operation.

## Web client

- React + TypeScript.
- Vite-based client-rendered application for V1.
- TanStack Query for remote-state caching.
- TanStack Router or equivalent typed router.
- Tailwind CSS plus a small owned design system; shadcn primitives may be used selectively.
- Static deployment on a zero-cost host such as Cloudflare Pages.
- Do not require SSR for the internal/creator V1 dashboard.

## Android client

- Native Kotlin + Jetpack Compose.
- Unidirectional data flow / feature-oriented architecture.
- Room for offline/cache data.
- Hilt for DI.
- WorkManager only for device-side deferred sync/maintenance, not source monitoring.
- Firebase Cloud Messaging for push notifications.
- The phone never acts as the monitoring engine.

## API/contracts

- One shared domain/event schema serves web and Android.
- Database schema and API contracts are versioned.
- Prefer generated/shared DTO contracts over manually diverging client models.
- Backward-compatible migrations are preferred once external clients exist.

## Cost philosophy

- Target infrastructure cost for prototype and early personal use: **₹0/month**.
- No feature may silently enable paid usage.
- Paid connectors must have explicit feature flags and spend caps.
- X ingestion remains disabled until the user intentionally funds API credits.
- Store metadata/evidence references rather than mirroring large media assets.
- Infrastructure upgrades happen only after measured limits are reached.

## Copyright/media policy

- Do not mirror full trailers, songs, press meets or social videos into CineRelay storage.
- Prefer canonical platform URLs/embeds and permitted thumbnails/metadata.
- Poster/artwork storage requires a deliberate rights/usage decision; it is not an automatic crawler behavior.
- Evidence records may store hashes, text extracts and metadata necessary for deduplication/audit where legally appropriate.

## Design philosophy

- Visual direction: **cinema intelligence newsroom / signal room**, not Netflix clone.
- Dark-first, premium, calm, information-dense but not noisy.
- Verification and provenance are visible UI elements, not hidden metadata.
- High-priority color is used sparingly.
- The interface should reward scanning speed and trust over decorative spectacle.

## Build order

1. Foundation/specification.
2. Database + source registry.
3. Ingestion/job framework.
4. YouTube connector.
5. Normalization/entity/verification/classification/deduplication pipeline.
6. Minimal internal web console.
7. Source health/observability.
8. Additional free connectors.
9. Alert engine + FCM.
10. Android app.
11. Broader coverage/discovery automation.
12. Optional paid connectors and advanced AI.

## Change rule

Any implementation that conflicts with this file is considered incorrect until the decision is intentionally revised and documented.

_Last updated: 2026-09-14_
