# Phase 2 Status — YouTube Production Connector

Date: 2026-09-15

## Overall state

**Phase 2: COMPLETE / PRODUCTION-VERIFIED / READY TO MERGE**

The Phase-2 YouTube production connector is implemented, running unattended in the hosted CineRelay Supabase project, and production-verified under the final reliability contract.

The final operating model is:

`official uploads playlist -> authoritative discovery -> targeted videos.list enrichment -> raw/revision persistence -> intelligence processing`

YouTube WebSub remains enabled as a best-effort low-latency accelerator. It is no longer a correctness dependency because repeated production uploads were missed despite verified subscriptions while uploads-playlist discovery recovered them without bounded-window gaps.

See `PHASE2_AUTHORITATIVE_DISCOVERY_PROOF_2026-09-15.md` for the production proof.

## Hosted project

- project: `CineRelay`
- ref: `dnqaejljfzwhsainpdxb`
- region: `ap-south-1`
- PostgreSQL: 17.6.x
- recurring infrastructure cost: **₹0/month**

Hosted workers are scheduled through:

`pg_cron -> pg_net -> cinerelay-scheduler-dispatch -> internal worker`

Current cadence:

- enrichment: every minute
- raw processing: every minute
- maintenance: every 10 minutes
- discovery dispatcher: every 5 minutes
- authoritative per-source discovery: 5 minutes hot / 15 minutes normal / 30 minutes provider-error backoff

Manual PowerShell is not required for normal operation.

## Pilot sources

1. Mythri Movie Makers
2. Sithara Entertainments
3. Haarika & Hassine Creations
4. Geetha Arts

All four remain registered official YouTube sources. WebSub leases continue to be maintained, but lease/push health is an accelerator signal rather than the sole ingestion path.

## Authoritative discovery production proof

On 2026-09-15 the four pilot channels were made due once and the normal hosted scheduler path invoked the production discovery worker.

Scheduler request `2975` returned HTTP `200` with:

- due: `4`
- checked: `4`
- discovered uploads: `1`
- bounded-window gap sources: `0`
- quota units before: `13`
- quota units after: `17`
- discovery mode: `UPLOADS_PLAYLIST_PRIMARY`
- WebSub role: `ACCELERATOR`

The real upload found was Haarika & Hassine Creations video `C6R0LkeURFo`, published at `2026-09-15 10:45:17 UTC`.

It automatically completed:

- authoritative uploads-playlist discovery;
- `YOUTUBE_ENRICH_VIDEO` successfully;
- raw item + revision persistence;
- `PROCESS_RAW_ITEM` successfully;
- truthful entity resolution.

The result was `UNRESOLVED / score 0`, which is correct for the current source/entity scope. No false canonical event was created.

## Adaptive cadence proof

Immediately after the production canary:

- Geetha Arts: `DEGRADED / WEBSUB_MISSED_DELIVERY` -> 5-minute discovery cadence
- Haarika & Hassine Creations: `DEGRADED / WEBSUB_MISSED_DELIVERY` -> 5-minute discovery cadence
- Mythri Movie Makers: `HEALTHY` -> 15-minute discovery cadence
- Sithara Entertainments: `HEALTHY` -> 15-minute discovery cadence

Provider/API/quota failures use a 30-minute backoff and remain visible through source health.

## WebSub v9 observability

Production `youtube-websub` v9 adds ingress telemetry before callback-token resolution.

Controlled request `2971` intentionally POSTed without a token and returned the expected `404`, while a safe `YOUTUBE_WEBSUB_INGRESS` receipt persisted with `tokenState = MISSING`.

This closes the previous blind spot where missing/unknown-token POSTs could disappear before diagnostics. The telemetry does not persist callback tokens, HMAC signature values, or rejected request bodies.

Future natural push evidence remains useful for measuring accelerator performance, but a successful push is no longer required to prove ingestion correctness.

## Gate B — zero-gap lease renewal

**Status: PASS**

The existing production proof remains valid.

During incident recovery, Geetha Arts generation 1 was intentionally made renewal-due and the normal production maintenance path created and verified generation 2 through the real Google hub.

- scheduler request id: `283`
- HTTP status: `200`
- renewal due: `1`
- renewed: `1`
- renewal failures: `0`
- verification timeouts: `0`
- expired leases: `0`
- gen 2 requested: `2026-09-14 14:13:03.525049 UTC`
- gen 2 verified: `2026-09-14 14:13:05.490 UTC`
- gen 1 remained usable until gen 2 was verified and then became `SUPERSEDED`

See `PHASE2_GATE_B_RENEWAL_PROOF_2026-09-14.md`.

## Canonical intelligence proof

Mythri Movie Makers video `rfP-ArN8nds` previously proved the canonical intelligence path:

- entity: `Family Pack`
- resolution confidence: `0.98`
- canonical event: `PROJECT_ANNOUNCED`
- verification: `OFFICIAL`
- priority: `HIGH`
- release window: `FESTIVAL / Sankranthi / 2027`
- classifier: `deterministic-domain-v1.1`
- evidence: `PRIMARY`
- replay dedupe: exactly one canonical event

Together with the 2026-09-15 discovery canary, Phase 2 now proves both ingestion correctness and downstream intelligence behavior.

## Source-health ownership

Successful enrichment clears only enrichment-owned failures through `record_youtube_enrichment_success(...)`.

WebSub/subscription/discovery failures remain independent. This prevents a successful `videos.list` call from incorrectly hiding a missed WebSub delivery.

A WebSub miss may keep a source `DEGRADED` for accelerator-health visibility while authoritative polling continues to provide correct ingestion.

## Current production function versions relevant to the final contract

- `youtube-websub`: **v9**
- `youtube-fallback-worker`: **v9** — legacy slug, authoritative discovery role
- `youtube-enrichment-worker`: v8
- `process-raw-item-worker`: v9

## Final CI baseline

Implementation head before these documentation commits:

`58854a4413f35ceb8e7fbca2452b23513f6d8e07`

CineRelay CI **#132** / run `34959975534`: **PASS** across all three jobs.

Validated:

- intelligence + connector CI: PASS
- YouTube planning/enrichment/discovery canaries: **15/15**
- all eight Edge Function type-checks: PASS
- deployment-native Edge bundle generation: PASS
- PostgreSQL-17 migration startup: PASS
- pgTAP database tests: PASS
- DB lint: PASS

Deployment artifact:

- `cinerelay-edge-deploy-bundle`
- artifact id `10393330447`
- digest `sha256:9d8f75d6ab50763056b7e92a9c0235b1b954f512cd4b9366f724ab04aa5b7a17`

Production `youtube-websub` v9 and authoritative discovery worker v9 were deployed from this exact green artifact.

## Quota evidence

After the production canary on 2026-09-15, recorded YouTube Data API usage remained very small:

- `playlistItems.list`: 14 units / 14 requests
- `videos.list`: 4 units / 4 requests

The existing quota guard and reserve remain active.

## Final Phase-2 merge rule

The production reliability requirements are now satisfied:

1. unattended official-source discovery works;
2. authoritative uploads discovery has no observed bounded-window gap;
3. real uploads automatically enrich and process downstream;
4. resolution remains truthful rather than force-matched;
5. quota and source health are observable;
6. WebSub failure cannot create an ingestion correctness gap;
7. WebSub ingress is observable before token resolution;
8. zero-gap subscription replacement is production-proven;
9. CI is green from the same artifact deployed to production.

A future natural WebSub success is an operational accelerator metric, not a Phase-2 exit gate.

PR #2 is therefore ready for final documentation-consistent CI and merge. Phase 3 may begin after the merge.

## Authoritative evidence

- `PHASE2_AUTHORITATIVE_DISCOVERY_PROOF_2026-09-15.md`
- `PHASE2_GATE_B_RENEWAL_PROOF_2026-09-14.md`
- `PHASE2_HOSTED_PILOT_WATCH.md`
- `PHASE2_PILOT_INCIDENT_2026-09-14.md`
- `PHASE2_YOUTUBE_OPERATIONS.md`

_Last updated: 2026-09-15_
