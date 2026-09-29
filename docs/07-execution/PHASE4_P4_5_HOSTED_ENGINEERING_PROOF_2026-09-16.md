# P4.5 Hosted Engineering Proof — Instagram Professional / Business Discovery

Date: 2026-09-16

## Result

**ENGINEERING COMPLETE / HOSTED FOUNDATION DEPLOYED / REAL META CREDENTIAL + OFFICIAL-MEDIA GATE PENDING**

P4.5 adds an official Meta Instagram Professional-account acquisition path through Facebook Login / Business Discovery. It does not activate production polling or claim Instagram completeness before the external Meta authorization gate is satisfied.

## Canonical implementation

Branch:

`phase-4/instagram-professional`

Draft PR:

`#8` stacked on `phase-4/threads-public-profiles`

Canonical migration-reconciliation head:

`a30e0011270d52aa6f61a7c001249a9d021408a5`

Canonical CI:

- CineRelay CI `#270`;
- run `35078724368`;
- all four jobs PASS;
- connector suite PASS;
- web-console build + privileged-secret marker guard PASS;
- `instagram-business-poll-worker` Deno type-check PASS;
- deployment-native Edge bundle PASS;
- fresh migrations + pgTAP + DB lint PASS.

## Hosted migration

Supabase project:

`dnqaejljfzwhsainpdxb`

Canonical hosted migration:

`20260916091834_instagram_business_discovery_connector`

The first Git filename used an earlier local timestamp. After the hosted migration was applied, Git was reconciled to the exact hosted migration version with identical SQL so the migration ledger remains canonical.

## Hosted runtime

Deployed from the deployment-native artifact produced by green CI #270:

- `instagram-business-poll-worker` v1 ACTIVE;
- `cinerelay-scheduler-dispatch` v5 ACTIVE.

The dispatcher contains the `instagram-business-poll` action, but there is deliberately no Instagram pg_cron heartbeat yet.

## Hosted trust-boundary verification

Post-deployment database verification returned:

- `instagram_business_source_state` exists: `true`;
- RLS enabled: `true`;
- authenticated direct SELECT: `false`;
- authenticated `register_instagram_business_source(uuid,text,text)` execute: `false`;
- hosted `INSTAGRAM / INSTAGRAM_BUSINESS_DISCOVERY` source identities: `0`;
- hosted Instagram state rows: `0`;
- hosted Instagram cron jobs: `0`.

This confirms that deploying the engineering foundation did not create or trust any Instagram source and did not start background polling.

## Advisor verification

Supabase security/performance advisors were run after DDL deployment.

For the new Instagram state table, the security advisor reports the expected informational `RLS enabled with no policy` condition. This is intentional for the service-role-only internal state surface: direct `public`, `anon`, and `authenticated` table privileges were revoked, and the registration RPC is also unavailable to authenticated clients.

No new P4.5 exposed-access warning was introduced. Existing project-level warnings remain tracked separately.

The due-index is currently reported as unused, which is expected while there are zero registered Instagram identities and no Instagram scheduler heartbeat.

## Credential boundary

The worker expects server-only runtime configuration:

- `INSTAGRAM_BUSINESS_DISCOVERY_ACCESS_TOKEN`;
- `INSTAGRAM_MANAGED_IG_USER_ID`;
- `INSTAGRAM_GRAPH_API_VERSION`;
- optional `INSTAGRAM_BUSINESS_DISCOVERY_TOKEN_EXPIRES_AT`.

No token, managed account ID, or API credential is committed to Git or exposed to the browser bundle.

## Remaining production gate

P4.5 must not be marked production-verified and no Instagram cron should be enabled until all of the following are proven with real Meta authorization:

1. a Professional Instagram account linked to a Facebook Page is authorized;
2. a valid server-side Page/API token and managed Instagram user ID are configured;
3. one curated official cinema/OTT/studio Business or Creator account is registered;
4. its first successful poll baselines the current media window with zero historical replay;
5. one genuinely new official media item after that baseline traverses `raw_items -> raw_item_revisions -> PROCESS_RAW_ITEM` exactly once;
6. an unchanged repeat creates no duplicate work;
7. invalid/expired authorization surfaces as `AUTH_REQUIRED` rather than silent data loss.

Synthetic fixtures prove connector mechanics only and are not a substitute for official-source evidence.
