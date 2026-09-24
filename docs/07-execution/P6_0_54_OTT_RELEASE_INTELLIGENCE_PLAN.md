# P6.0.54 — OTT Release Intelligence

## Product intent

OTT is a first-class CineRelay intelligence feature, not another ingestion platform.

Source platforms answer: **where did the information come from?**
OTT answers: **when and where can this film or series be streamed?**

The architecture therefore remains:

- Source lanes: YouTube, Web, X later.
- Intelligence surfaces: Story Clusters, Film/Series hubs, OTT Releases.

## User-facing destination

Add a dedicated `OTT` destination with a TV/play-screen symbol and the label `OTT`.

Core views:

- Today
- This Week
- Upcoming
- Released
- Date TBA

Primary filters:

- language,
- streaming provider,
- movie / series,
- release state.

Initial India-focused provider set:

- Netflix
- Prime Video
- JioHotstar
- ZEE5
- SonyLIV
- aha
- Sun NXT
- ETV Win

Provider coverage should expand only after source reliability is proven.

## Release types

CineRelay must model both:

1. OTT originals / direct streaming premieres.
2. Post-theatrical OTT releases.

A Film/Series Hub should eventually show the complete lifecycle, for example:

`announcement → trailer → theatrical release → continuing coverage → OTT announcement → OTT release`

## Evidence states

Every future OTT date must carry an evidence state.

### Confirmed

At least one first-party source explicitly provides the provider/date. Preferred evidence order:

1. OTT platform / first-party streaming announcement.
2. official studio / production house / distributor.
3. official film / creator announcement.

### Reported

Credible secondary reporting exists, but CineRelay has not yet found first-party confirmation.

### TBA

The streaming destination or rights may be known, but the date is not officially established.

CineRelay must never silently promote a reported date to confirmed.

## Canonical model

Suggested canonical record:

```text
OttRelease
  id
  entityId                 # Film/Series hub identity
  providerId
  territory                # e.g. IN
  languages[]
  releaseType              # ORIGINAL | POST_THEATRICAL
  releaseDate
  datePrecision            # DAY | MONTH | TBA
  state                    # UPCOMING | RELEASED | DELAYED | TBA
  evidenceStatus           # CONFIRMED | REPORTED | TBA
  evidenceRefs[]
  firstObservedAt
  lastVerifiedAt
  previousReleaseDate
```

Date changes must update the canonical record rather than create duplicate releases. CineRelay should preserve the previous date and generate a change event when useful.

## Home integration

Home should receive a compact `Streaming This Week` rail containing a small set of upcoming confirmed releases. It should not replace or mix with the normal news feed.

The rail links to the dedicated OTT destination.

## Film / Series hub integration

P6.0.53 hubs are a prerequisite for the best OTT experience.

Each hub can expose:

- provider,
- OTT release date,
- evidence status,
- territory/languages,
- date-change history,
- supporting first-party evidence.

Global search should support queries such as:

- `Netflix Telugu`
- `Prime Video Tamil`
- a film title → its OTT release card inside the Film Hub.

## Data strategy

Use CineRelay's own evidence engine as the source of truth for future dates.

Structured catalog/provider services may assist with:

- entity matching,
- posters/backdrops,
- provider availability,
- release verification after a title becomes streamable.

They must not be the sole authority for future Indian OTT release dates.

## Dependency order

- P6.0.51 — Control Room / navigation cleanup.
- P6.0.52 — Web + RSS + first-party official websites, including OTT-provider web sources.
- P6.0.53 — Story Clusters + Film/Series entity hubs + Search.
- P6.0.54 — OTT Release Intelligence.

## P6.0.54 acceptance target

A signed-in CineRelay user can open OTT and reliably answer:

- What is streaming today?
- What is coming this week?
- Which Telugu/Tamil/Malayalam/Kannada/Hindi titles are coming next?
- Which service has the title?
- Is the date confirmed, reported, or TBA?
- What first-party evidence supports the displayed date?
