# P6.0.6 — Telugu YouTube Source Expansion

Date: 2026-09-16
Status: PRODUCTION + MUSIC FIRST-PARTY EXPANSION HOSTED-PROVEN

## Goal

Expand CineRelay's official Telugu cinema YouTube coverage without weakening provenance, freshness, quota safety, or newsroom noise controls.

The expansion uses the same P6.0.4/P6.0.5 contract:

- official first-party sources only;
- exact YouTube channel IDs;
- authoritative uploads-playlist polling;
- WebSub treated as an accelerator, not a dependency;
- HIGH priority sources target 5-minute fallback;
- NORMAL priority sources target 15-minute fallback;
- source + original URL remain visible in the newsroom;
- raw signals can surface before canonical entity resolution.

## Existing production-house baseline before this slice

HIGH priority:

- Mythri Movie Makers
- Sithara Entertainments
- Haarika & Hassine Creations
- Geetha Arts

All four retained active WebSub leases and the 5-minute authoritative fallback safety net.

## New production-house sources enrolled

### People Media Factory

- YouTube channel: `UCrzx3ZPXEZpzEGLF1gIuORQ`
- handle: `@PeopleMediaFactory`
- role: `PRODUCTION_HOUSE`
- authority tier: `1`
- discovery priority: `HIGH`
- uploads playlist: `UUrzx3ZPXEZpzEGLF1gIuORQ`
- hosted fallback baseline established successfully
- hosted cadence: 5 minutes

### Vyjayanthi Network

- YouTube channel: `UC70pKToywlxOGdgIvz8gYqA`
- handle: `@VyjayanthiNetwork`
- role: `PRODUCTION_HOUSE`
- authority tier: `1`
- discovery priority: `HIGH`
- uploads playlist: `UU70pKToywlxOGdgIvz8gYqA`
- hosted fallback baseline established successfully
- hosted cadence: 5 minutes

### 14 Reels Plus

- YouTube channel: `UC6oaZCtrOI-cmrVgNkc0c3g`
- handle: `@14ReelsPlus`
- role: `PRODUCTION_HOUSE`
- authority tier: `1`
- discovery priority: `HIGH`
- uploads playlist: `UU6oaZCtrOI-cmrVgNkc0c3g`
- hosted baseline video id: `KwPH0Nh2LiQ`
- hosted cadence: exactly 5.00 minutes
- hosted health after baseline: `HEALTHY`

### Suresh Productions

- YouTube channel: `UCU0PnZqMDQ0uvwacGzCX3NA`
- handle: `@SureshProductions`
- role: `PRODUCTION_HOUSE`
- authority tier: `1`
- discovery priority: `NORMAL`
- uploads playlist: `UUU0PnZqMDQ0uvwacGzCX3NA`
- hosted baseline video id: `OAbKBwHaGwM`
- hosted cadence: exactly 15.00 minutes
- hosted health after baseline: `HEALTHY`

Suresh Productions is intentionally NORMAL rather than HIGH because its very large archive-oriented library creates materially more noise and does not justify five-minute polling by default. The newsroom relevance filter still protects against archive/library clips when they are encountered.

## New music-label sources enrolled

### Aditya Music

- YouTube channel: `UCNApqoVYJbYSrni4YsbXzyQ`
- handle: `@adityamusic`
- role: `MUSIC_LABEL`
- authority tier: `1`
- discovery priority: `NORMAL`
- uploads playlist: `UUNApqoVYJbYSrni4YsbXzyQ`
- hosted baseline video id: `MMP-5_ChnOc`
- hosted cadence: exactly 15.00 minutes
- hosted health after baseline: `HEALTHY`

### Sony Music South

- YouTube channel: `UCn4rEMqKtwBQ6-oEwbd4PcA`
- handle: `@SonyMusicSouthOfficial`
- role: `MUSIC_LABEL`
- authority tier: `1`
- discovery priority: `NORMAL`
- uploads playlist: `UUn4rEMqKtwBQ6-oEwbd4PcA`
- hosted baseline video id: `Rl_bUfUvUng`
- hosted cadence: exactly 15.00 minutes
- hosted health after baseline: `HEALTHY`

Music labels are NORMAL by default because their very high upload frequency includes catalog, archive, remix, full-song, short-form and multi-language material. Fifteen-minute polling is sufficient for newsroom awareness while keeping quota/noise controlled. Current-film items can still surface immediately after ingestion through the fast newsroom projection.

## Hosted proof

### Batch 1: People Media Factory + Vyjayanthi Network

Fallback dispatcher result:

- due: 2
- checked: 2
- baselineSources: 2
- discoveredUploads: 0
- gapSources: 0
- highPrioritySources: 2
- YouTube quota units consumed: 2
- discovery mode: `UPLOADS_PLAYLIST_PRIMARY`
- WebSub role: `ACCELERATOR`

Both sources established a real latest-known video baseline and scheduled their next check five minutes later.

### Batch 2: 14 Reels Plus + Suresh Productions

Fallback dispatcher result:

- due: 2
- checked: 2
- baselineSources: 2
- discoveredUploads: 0
- gapSources: 0
- highPrioritySources: 1
- YouTube quota units consumed: 2
- discovery mode: `UPLOADS_PLAYLIST_PRIMARY`
- WebSub role: `ACCELERATOR`

Cadence proof:

- 14 Reels Plus: `5.00` minutes
- Suresh Productions: `15.00` minutes

### Batch 3: Aditya Music + Sony Music South

Fallback dispatcher result:

- due: 2
- checked: 2
- baselineSources: 2
- discoveredUploads: 0
- gapSources: 0
- highPrioritySources: 0
- YouTube quota units consumed: 2
- discovery mode: `UPLOADS_PLAYLIST_PRIMARY`
- WebSub role: `ACCELERATOR`

Cadence and health proof:

- Aditya Music: `15.00` minutes, `HEALTHY`
- Sony Music South: `15.00` minutes, `HEALTHY`

## Current official YouTube coverage after this slice

HIGH priority official production sources:

1. Mythri Movie Makers
2. Sithara Entertainments
3. Haarika & Hassine Creations
4. Geetha Arts
5. People Media Factory
6. Vyjayanthi Network
7. 14 Reels Plus

NORMAL official first-party sources:

8. Suresh Productions — production house
9. Aditya Music — music label
10. Sony Music South — music label

## Subscription note

The four original sources retain active verified WebSub leases. The newly enrolled sources are immediately useful through authoritative fallback polling even without a new WebSub lease.

P6.0.5 established that the Google hub is currently returning transport failures / earlier HTTP 503s during replacement attempts. CineRelay therefore must not block source expansion on WebSub enrollment. Push can be attached later when the provider path is healthy; fallback remains the correctness path.

## Quota behavior

Each hosted baseline batch consumed one YouTube Data API unit per source. The source expansion therefore remains comfortably inside the existing daily quota guard while preserving the emergency reserve.

HIGH priority is reserved for sources where current-release publishing patterns justify a five-minute freshness target. Archive-heavy or high-volume first-party sources default to NORMAL/15-minute cadence.

## Next

1. add more current Telugu production houses as HIGH only when exact identity and recent publishing behavior are verified;
2. evaluate additional official Telugu music/trailer channels as NORMAL first;
3. observe actual newsroom output from the expanded ten-source set and add relevance rules only when hosted evidence demonstrates a safe pattern;
4. keep the first-party source tier separate from trusted trade/public-page sources;
5. attach WebSub to newly enrolled sources only when the provider path is healthy enough to verify cleanly;
6. continue exposing provenance and original source links on every newsroom signal.
