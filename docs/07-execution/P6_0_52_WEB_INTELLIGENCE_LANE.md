# P6.0.52 — Web intelligence lane

## Goal

Add a clean user-facing **Web** newsroom lane without creating a second ingestion architecture. CineRelay continues to normalize source activity into the existing raw-item, canonical-event, evidence, Radar, and source-health pipeline.

## Logical lane contract

The Android and public newsroom/source APIs expose three logical lanes:

- `YOUTUBE` — active official YouTube source mesh.
- `WEB` — unified public-web lane backed by both database platforms `WEB` and `RSS`.
- `X` — deliberately paused after the provider payment gate.

`WEB` is a presentation/API lane, not a new storage platform. RSS/Atom and first-party HTML identities remain distinct underneath so provenance and connector health are preserved.

## Initial Web source mesh

The live database already contained four active identities before this slice:

1. **About Amazon India — Prime Video** — first-party HTML / tier 1 / OTT platform.
2. **The Walt Disney Company** — RSS / tier 1 / production house.
3. **123Telugu — Movie News** — RSS / tier 3 / trade media.
4. **TeluguCinema — News** — RSS / tier 3 / trade media.

The UI therefore avoids describing every Web source as an official channel. First-party and tracked/trade provenance remain visible.

## Feed parser production repair

During the P6.0.52 preflight, all three active RSS identities were found in `PARSER_BROKEN` state with the same runtime failure:

`this.options.updateTag is not a function`

The first-party Prime Video page-poll identity remained healthy.

Repair:

- upgraded `fast-xml-parser` from `5.2.5` to `5.10.1` in the root package, feed connector package, and feed worker Deno import map;
- advanced `FEED_PARSER_VERSION` to `feed-parser-v2`;
- supplied an explicit identity `updateTag` callback as a defensive parser contract;
- retained the existing feed canaries and updated the parser-version assertion.

The feed/page workers themselves remain the ingestion mechanisms; no replacement polling subsystem was introduced.

## API changes

### `cinerelay-newsroom-api`

- accepts `WEB` in addition to `YOUTUBE` and `X`;
- maps logical `WEB` to storage platforms `WEB` + `RSS`;
- preserves each returned source identity's actual platform for provenance;
- expands generic artwork/thumbnail lookup beyond YouTube metadata.

### `cinerelay-sources-api`

- accepts logical `WEB`;
- returns the combined active RSS + first-party Web source directory;
- keeps actual identity platform plus logical lane metadata;
- retains recent-activity metrics and authority ordering.

No database schema migration is required.

## Android changes

- `NewsroomPlatform` now supports `YOUTUBE`, `WEB`, and `X`.
- Control Room exposes **YouTube / Web / X paused**.
- YouTube source-role filters remain YouTube-only.
- Home shows the active logical lane correctly and uses first-party/tracked-source wording instead of mislabeling trade Web sources.
- Sources has a dedicated Web source desk and shows RSS/Web provenance.
- Source notification bells remain **YouTube-only** in this slice; existing notification consent semantics are unchanged.
- X remains disabled/dormant.

## Release gates

P6.0.52 is complete only when:

1. CineRelay core CI passes.
2. Notification Preferences CI remains green.
3. Android Canary compiles and produces the permanently signed update APK.
4. Deployment-native Edge bundles are deployed for the feed worker, newsroom API, and sources API while preserving their existing authentication mode.
5. Production `source_health` confirms active RSS identities no longer fail with the `updateTag` parser error.
6. Live Web source/newsroom responses expose RSS + WEB identities without mixing YouTube/X.
