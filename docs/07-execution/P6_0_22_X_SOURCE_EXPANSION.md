# P6.0.22 — X Source Expansion

Status: **REGISTRY + CONNECTOR CONTRACT IMPLEMENTED; LIVE INGESTION NOT YET ACTIVATED**

## Goal

Expand CineRelay's first-party cinema intelligence coverage onto X without weakening provenance or pretending that an unconfigured connector is live.

## Trust boundary

- X identities in this milestone are first-party official accounts attached to tier-1 CineRelay sources.
- `platform = X`, `connector_type = X_API_V2`, `access_mode = API`.
- Every X identity is intentionally `active = false` until valid X API credentials are configured and a hosted canary succeeds.
- Connector config carries `activationState = PENDING_X_API_CREDENTIALS`.
- Initial ingestion is original-post-only: replies and reposts are excluded.
- Baseline activation must not backfill a historical notification flood.
- Raw X posts may surface as source activity/newsroom signals, but they do not become canonical verified movie events merely because they came from X.

## Registry

### HIGH / HOT_5M

1. Mythri Movie Makers — `@MythriOfficial`
2. Sithara Entertainments — `@SitharaEnts`
3. Haarika & Hassine Creations — `@haarikahassine`
4. Geetha Arts — `@GeethaArts`
5. People Media Factory — `@peoplemediafcy`
6. Vyjayanthi Network — `@VyjayanthiFilms`
7. 14 Reels Plus — `@14ReelsPlus`
8. UV Creations — `@UV_Creations`
9. Sri Venkateswara Creations — `@SVC_official`
10. Swapna Cinema — `@SwapnaCinema`
11. Wall Poster Cinema — `@walpostercinema`
12. Niharika Entertainment — `@NiharikaEnt`

### NORMAL / ACTIVE_15M

13. Suresh Productions — `@SureshProdns`
14. Aditya Music — `@adityamusic`
15. Sony Music South — `@SonyMusicSouth`
16. DVV Entertainment — `@DVVMovies`
17. SLV Cinemas — `@SLVCinemasOffl`
18. Fortune Four Cinemas — `@Fortune4Cinemas`
19. Saregama South — `@saregamasouth`

Hosted verification checkpoint after migration:

- total X identities: **19**
- HIGH / HOT_5M: **12**
- NORMAL / ACTIVE_15M: **7**
- active: **0**
- pending X API credentials: **19**

## Reproducibility

Hosted migration:

`20260918085041_p6_0_22_x_source_expansion`

Repository migration:

`supabase/migrations/20260918085041_p6_0_22_x_source_expansion.sql`

The migration resolves sources by stable display name instead of hardcoding generated source UUIDs.

## X connector contract

Package:

`packages/x-connector`

Version:

`x-api-v2-profile-v1`

Implemented behavior:

- username validation and normalization;
- handle-to-X-user lookup URL construction;
- numeric X user-id validation;
- user-post timeline URL construction;
- `since_id` checkpoint support;
- pagination-token support;
- explicit tweet/media fields;
- author-id validation;
- canonical `x.com/<handle>/status/<id>` links;
- reply/repost classification and original-post filtering;
- baseline-safe delta planning;
- missing-checkpoint/gap detection;
- HOT_5M / ACTIVE_15M cadence helpers;
- `Retry-After` and rate-limit-reset handling;
- exponential failure backoff.

Canary suite:

`tests/x-connector/run-x-connector.mjs`

The root CI contract now builds and tests the X connector as part of `npm run ci`.

## Activation prerequisites

Do not change any X identity to `active = true` until all of the following are true:

1. an official X developer app/API credential is available;
2. the required profile lookup and user-post timeline endpoints are accessible under that account's current X API plan;
3. a hosted worker resolves a known handle to the expected numeric X user ID;
4. a baseline poll succeeds without emitting historical raw items as fresh notifications;
5. rate-limit/usage-cap behavior is observed and safe cadence is confirmed;
6. a post-baseline genuine new post is ingested with source, X post ID, published time, CineRelay first-seen time, and original URL;
7. processing/newsroom behavior preserves the raw-source-versus-canonical-event boundary.

## Next slice

Build `x-profile-poll-worker`, durable poll state/RPCs, scheduler dispatch, and hosted canary. Keep the 19 identities dormant until credentials and endpoint access are proven.
