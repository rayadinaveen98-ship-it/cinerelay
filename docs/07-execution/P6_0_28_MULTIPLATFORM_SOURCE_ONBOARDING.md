# P6.0.28 — Safe Multi-Platform Source Onboarding

Status: **IMPLEMENTED / HOSTED SAFETY-PROVEN; CI PENDING FINAL HEAD**

## Goal

Replace ad-hoc multi-platform source expansion SQL with an explicit two-phase onboarding contract so an official organization can reuse one trusted `sources` row across YouTube/X identities without duplicate sources or partially seeded connector state.

## Hosted migration

`20260918093241_p6_0_28_multiplatform_source_onboarding`

Repository migration:

`supabase/migrations/20260918093241_p6_0_28_multiplatform_source_onboarding.sql`

## RPCs

### `attach_source_identity(...)`

Service-role-only identity attachment. It:

- requires an existing active trusted `sources` row;
- never creates a new source organization;
- validates platform/connector/access metadata;
- validates YouTube channel IDs;
- uses an advisory transaction lock for concurrent onboarding;
- reuses an existing identity by `(platform, platform_identity_id)` or canonical URL;
- rejects conflicting platform-ID/canonical-URL keys;
- rejects silent reassignment when an identity is already owned by another source;
- merges connector config and is idempotent on re-attach.

### `seed_source_identity_runtime(...)`

Separate service-role-only runtime seeding. V1 explicitly supports YouTube and X.

YouTube:

- validates the `YOUTUBE_WEBSUB` / `WEBHOOK` contract;
- derives the uploads playlist from the channel ID when omitted;
- creates/updates `youtube_channel_state`;
- schedules an immediate fallback only when the identity is active;
- initializes `source_health` as HEALTHY for active identities or DISABLED for dormant identities.

X:

- validates the `X_API_V2` / `API` contract and handle;
- creates/updates `x_profile_source_state`;
- keeps dormant identities unscheduled;
- reports source health as DISABLED while inactive, or AUTH_REQUIRED if explicitly activated before credentials are proven.

This two-phase design directly prevents the P6.0.27 failure mode where an identity persisted but its connector state did not.

## Hosted safety proof

Using existing UV Creations / Niharika Entertainment identities:

- re-attaching UV Creations YouTube returned the same identity with `created=false`;
- the YouTube identity remained unique;
- attempting to attach UV Creations' YouTube channel to Niharika Entertainment correctly raised `source_identity_owned_by_other_source`;
- seeding UV Creations' dormant X identity created runtime state while keeping `active=false`, `health_state=DISABLED`, `next_check_at=NULL`, and `next_due_at=NULL`.

No X polling/API traffic was activated by this proof.

## Regression

`supabase/tests/database/source_identity_onboarding.test.sql`

The pgTAP contract locks:

- first attach creates one identity;
- re-attach is idempotent;
- YouTube runtime seeding is separate and derives the uploads playlist;
- dormant X runtime remains unscheduled;
- cross-source identity ownership conflicts are rejected;
- authenticated users cannot invoke either onboarding RPC directly.

## Next

Use these helpers for future verified source waves instead of direct identity/state inserts. Continue expansion only with independently verified canonical platform IDs/handles.
