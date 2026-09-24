# P6.0.23 — OTT X Source Expansion

Status: **REGISTRY COMPLETE; LIVE X INGESTION CREDENTIAL-GATED**

## Goal

Extend CineRelay's first-party X registry to OTT platforms that publish Telugu/South release, trailer, streaming and promotional updates.

## Added tier-1 OTT sources

- Netflix India — `@NetflixIndia` — NORMAL / ACTIVE_15M
- Netflix India South — `@Netflix_INSouth` — HIGH / HOT_5M
- Prime Video India — `@PrimeVideoIN` — HIGH / HOT_5M
- ZEE5 Telugu — `@ZEE5Telugu` — HIGH / HOT_5M
- aha — `@ahavideoIN` — HIGH / HOT_5M
- Sun NXT — `@sunnxt` — NORMAL / ACTIVE_15M
- Sony LIV — `@SonyLIV` — NORMAL / ACTIVE_15M

Every identity uses `platform=X`, `connector_type=X_API_V2`, `access_mode=API`, `active=false`, and `activationState=PENDING_X_API_CREDENTIALS`.

JioHotstar was intentionally not registered because the current public X identity was not sufficiently unambiguous at this checkpoint.

## Reproducibility

Hosted migration: `20260918090430_p6_0_23_ott_x_source_expansion`

Repository migration: `supabase/migrations/20260918090430_p6_0_23_ott_x_source_expansion.sql`

## Trust boundary

Registration is not activation. No X polling or billing is permitted until a valid X API credential and hosted canary prove the required lookup/timeline endpoints and rate-limit behavior.
