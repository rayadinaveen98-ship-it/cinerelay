# Product Charter

## Mission

CineRelay exists to make cinema information observable.

Instead of forcing creators, journalists and serious movie followers to monitor scattered YouTube channels, social accounts, studio sites, OTT platforms, news outlets and event feeds, CineRelay continuously turns those signals into one structured, source-backed stream.

## Problem

Movie and series information is fragmented by platform and publisher.

A project's lifecycle can be spread across:

- production-house announcements;
- official movie accounts;
- actors/directors;
- music labels;
- distributors;
- OTT platforms;
- YouTube uploads/lives;
- Instagram/X/Threads posts;
- press releases and websites;
- interviews and press meets;
- trusted trade/media reporting.

The user currently has to discover, compare, verify and remember these changes manually.

## Product promise

For followed cinema entities, CineRelay should answer four questions quickly:

1. **What happened?**
2. **When did it happen?**
3. **Who originally said/published it?**
4. **How trustworthy is the information?**

## Primary V1 user

A serious cinema creator/editor/researcher who needs reliable, fast awareness of movie and series activity.

FrameByNavin is the first real power-user workflow, but the product is not branded or architected as a FrameByNavin-only tool.

## Future users

- film journalists and publications;
- creator teams;
- fan communities;
- entertainment researchers;
- distributors and marketing teams;
- regular movie/series followers who want clean alerts instead of noisy feeds.

## Jobs to be done

### Stay current

See meaningful recent activity without visiting many platforms.

### Verify before publishing

Open the original evidence and understand whether an update is official, confirmed, reported, developing or rumor-level.

### Follow a project lifecycle

See one chronological timeline from announcement through production, marketing, theatrical/streaming release and later updates.

### Detect changes

Know when important structured facts change, especially release dates, title/status, cast, platform availability and promotional schedule.

### Find content opportunities

Surface high-value updates that may warrant a Short, Reel, video, article or deeper analysis without replacing editorial judgment.

## North-star behavior

A user should be able to open CineRelay and trust that:

> if an important update was published by a tracked authoritative source, CineRelay will either show it, explain why it was filtered, or expose that the source connector is unhealthy.

This is more important than having the largest possible feed.

## Product values

### Provenance before presentation

Every meaningful event keeps links to its source evidence.

### Official-source-first

Original sources outrank reposts and articles describing the same event.

### Precision over noise

Ten useful events are better than one hundred duplicated posts.

### Transparent uncertainty

CineRelay distinguishes official confirmation from reporting, inference and rumor.

### Event history, not ephemeral feed only

Updates become durable structured timeline entries rather than disappearing after a day.

### Human control

Users can inspect, correct, merge, suppress or reclassify system output when needed.

### Free-first engineering

V1 must be useful at ₹0/month infrastructure cost where practical. Paid connectors must be optional and isolated.

## Non-goals for V1

CineRelay V1 is not:

- a replacement for IMDb/TMDB as a complete historical title database;
- a movie-review/community rating platform;
- a ticketing service;
- a streaming player;
- a piracy/link-indexing service;
- a generic entertainment gossip app;
- an autonomous news publisher;
- a system that claims 100% coverage of private/deleted/unsupported platform content;
- a full social-media archive;
- a requirement to ingest every post from every actor.

## Scope philosophy

The V1 source universe is curated. Coverage quality is measured before source count is expanded.

The system begins with high-value official sources in Indian cinema and major streaming/studio sources, then expands by language, territory and source class.

## Success criteria for the first usable product

- A curated source can be registered once and monitored repeatedly.
- YouTube official uploads appear near-real-time through WebSub.
- Poll-based connectors track supported public sources without duplicates.
- Every raw item is preserved with ingestion metadata.
- Entity resolution correctly associates most high-value items in the controlled test set.
- Important event categories are classified consistently.
- Duplicate coverage of the same announcement collapses into one event with multiple evidence records.
- Source authority is visible to the user.
- Connector failures are visible rather than silent.
- Web and Android clients read the same event model.

## Long-term vision

CineRelay can become a cinema event graph: a continuously updated map of projects, people, companies, sources, claims and changes.

That intelligence layer can later power creator alerts, newsroom workflows, public discovery, APIs, analytics and integrations with a broader movie/series knowledge database.

_Last updated: 2026-09-14_
