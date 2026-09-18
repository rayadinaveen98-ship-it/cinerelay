# P6.0.29 — Sri Venkateswara Creations YouTube Onboarding

Status: **HOSTED-PROVEN**

## Goal

Use the P6.0.28 two-phase onboarding helper on a real existing tier-1 source instead of hand-writing another source/identity/state migration.

## Source

- source: `Sri Venkateswara Creations`
- authority tier: `1`
- source role: `PRODUCTION_HOUSE`
- existing X identity: `@SVC_official` (inactive / credential-gated)
- verified YouTube channel id: `UCH-aQJq1vGWCfvgoWXYmkcA`
- YouTube handle: `@srivenkateswaracreations3802`
- discovery priority: `HIGH`

The YouTube identity was attached to the existing source organization; no duplicate `sources` row was created.

## Migration

Hosted + repository migration:

`20260918093809_p6_0_29_svc_youtube_onboarding`

The migration resolves the existing source by display name, calls `attach_source_identity(...)`, then calls `seed_source_identity_runtime(...)` in a separate phase.

## Hosted baseline proof

Controlled authoritative uploads-playlist fallback after onboarding:

- scheduler HTTP status: `200`
- fallback `due`: `15`
- `checked`: `15`
- `baselineSources`: `1`
- `gapSources`: `0`
- `highPrioritySources`: `10`
- one genuine delta elsewhere in the network was discovered during the same run

SVC-specific state after the run:

- newest video checkpoint: non-null
- health: `HEALTHY`
- last error: `NULL`
- next fallback: exactly +5 minutes
- SVC raw-item count after baseline: `0`

This proves the new channel was baselined without historical upload backfill.

## Inventory impact

Official active YouTube coverage increases from **15 to 16 channels**.
