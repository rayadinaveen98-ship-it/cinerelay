# Phase 4.4 Hosted Engineering Proof — Threads Public Profiles

Date: 2026-09-16

## Result

**P4.4 engineering + hosted foundation: PASS**

**Real Meta authorization / official-post release gate: PENDING**

CineRelay now has a production-hosted Threads public-profile connector foundation using Meta's official Threads API capability. No Threads source has been activated and no cron has been enabled before a valid Meta discovery credential and curated official profile exist.

## Canonical branch / CI proof

Branch:

`phase-4/threads-public-profiles`

Canonical reconciliation head:

`1178a95263e42417246f306f84144ad6c2d5dc40`

CineRelay CI:

- run number `#264`;
- run id `35076303251`;
- conclusion `SUCCESS`.

The immediately preceding full implementation gate `#262` also passed all four jobs after the access-mode compatibility fix.

Verified CI coverage includes:

- Threads connector TypeScript build and deterministic V1/V2 canaries;
- full existing connector/intelligence suite;
- web console build and privileged-secret browser scan;
- `threads-profile-poll-worker` Deno type-check;
- deployment-native Edge bundle build;
- fresh database migrations;
- Threads pgTAP registration/security tests plus the existing DB test suite;
- database lint.

## Compatibility incident caught by CI

The first P4.4 database test run used a proposed `OFFICIAL_API` access-mode value. The frozen CineRelay data contract already represents official programmatic access with `API`.

The fresh-database test correctly rejected `OFFICIAL_API` through `source_identities_access_mode_check` before any hosted rollout.

P4.4 was corrected to reuse:

`access_mode = API`

across the registration guard, database test, worker query and design documentation. No core access-mode enum expansion was introduced.

## Hosted migration

Hosted migration ledger:

`20260916085300_threads_public_profile_connector`

Git was reconciled to that exact hosted version after Supabase assigned the canonical timestamp.

Hosted state now includes:

- `public.threads_profile_source_state`;
- RLS enabled;
- service-role-only table access;
- `register_threads_profile_source(uuid,text,text)` with public/anon/authenticated execute revoked;
- source identity validation for `THREADS / THREADS_PROFILE_API / API`;
- curated-handle/username equality guard;
- source-health initialization.

Hosted verification immediately after migration:

- state table exists: `true`;
- RLS enabled: `true`;
- authenticated direct SELECT: `false`;
- authenticated registration RPC execute: `false`;
- Threads identities: `0`;
- Threads state rows: `0`;
- Threads cron jobs: `0`.

## Hosted Edge runtime

Deployment source:

The exact deployment-native artifact produced by green CI #262 was downloaded and used for hosted deployment; no ad-hoc production rebuild was used.

Active runtime:

- `threads-profile-poll-worker` v1 ACTIVE;
- `cinerelay-scheduler-dispatch` v4 ACTIVE.

The scheduler dispatcher now recognizes `threads-profile-poll`, but there is deliberately no pg_cron heartbeat for that action yet.

The first dispatcher deployment attempt exposed a Supabase import-map metadata reuse quirk from the prior dispatcher version. No runtime change occurred from that failed attempt. Re-deploying with the current bundle's `deno.json` explicitly pinned succeeded as dispatcher v4.

## Runtime safety boundary

The worker requires:

- the existing independent `x-cinerelay-internal-key` server boundary;
- server-side `THREADS_PROFILE_DISCOVERY_ACCESS_TOKEN` before any Meta request.

The browser artifact is CI-scanned for the Threads token marker, and no Meta credential is stored in source rows, raw items, Git, or browser configuration.

The worker is prepared to surface:

- `AUTH_REQUIRED` for 401/403;
- `RATE_LIMITED` for 429;
- `PARSER_BROKEN` for response-contract failures;
- `DEGRADED` for fetch failures or a bounded-window continuity gap;
- `HEALTHY` after successful observation.

## Advisor review

Security advisor after hosted migration:

- new Threads state table appears only as the expected informational `RLS enabled / no policy` notice because direct client privileges are intentionally revoked and service-role access is server-side;
- no new P4.4 function-search-path warning;
- existing project warnings for two older functions and Auth leaked-password protection remain unrelated to P4.4.

Performance advisor after hosted migration:

- the new due-time index is reported as unused because there are intentionally zero Threads state rows / zero polling activity yet;
- no new unindexed foreign-key finding is attributed to the Threads state table because its source identity foreign key is also the primary key.

## Remaining external release gate

Do not activate the Threads cron or mark P4.4 production-verified until all of these are true:

1. Meta Threads app/user authorization is configured with `threads_profile_discovery`;
2. the access token is installed server-side;
3. one curated official cinema/OTT/studio Threads profile is registered;
4. first poll baselines without historical replay;
5. one genuine post-baseline official post creates exactly one raw item, one initial revision and one processing job;
6. a later unchanged poll creates no duplicate work;
7. an invalid/expired credential is observably represented as `AUTH_REQUIRED`.

Synthetic fixtures prove engineering transport semantics only; they do not substitute for this official-evidence gate.
