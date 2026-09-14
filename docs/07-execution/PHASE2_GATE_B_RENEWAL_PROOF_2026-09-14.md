# Phase 2 Gate B — Zero-Gap Renewal Proof

Date: 2026-09-14

## Result

**Gate B zero-gap renewal property: PASS**

CineRelay completed a real production WebSub renewal for the Geetha Arts pilot source through the normal hosted maintenance path:

`Vault -> pg_net -> cinerelay-scheduler-dispatch -> youtube-maintenance-worker -> youtube-subscription-admin -> Google PubSubHubbub -> youtube-websub verification callback`

The renewal was intentionally advanced during incident recovery rather than waiting for the original 2026-09-22 `renew_after` timestamp. This is therefore an **incident-driven early production renewal canary**, not evidence that the naturally scheduled September 22 tick has occurred.

The property Phase 2 needed to prove — no delivery gap while replacing a live lease — is nevertheless proven with the real hosted hub and production state machine.

## Trigger

Geetha Arts generation 1 had already produced three fallback-recovered uploads without an accepted WebSub delivery. To refresh the live hub subscription while preserving safety, only that source's `renew_after` was advanced to the current time.

No lease was deleted or deactivated before the replacement was verified.

## Hosted maintenance result

Scheduler request id: `283`

HTTP result:

- status: `200`
- timed out: `false`
- `renewalDue = 1`
- `renewed = 1`
- `renewalFailures = 0`
- `verificationTimeouts = 0`
- `expired = 0`
- `skippedInFlight = 0`

## Generation evidence

### Generation 1

- generation: `1`
- state before renewal: `ACTIVE`
- verified at: `2026-09-14 11:04:49.709 UTC`
- original expiry: `2026-09-24 11:04:49.709 UTC`
- state after generation-2 verification: `SUPERSEDED`

### Generation 2

- generation: `2`
- requested at: `2026-09-14 14:13:03.525049 UTC`
- verified at: `2026-09-14 14:13:05.490 UTC`
- resulting state: `ACTIVE`
- new renewal due: `2026-09-22 14:13:05.490 UTC`
- new expiry: `2026-09-24 14:13:05.490 UTC`

Google verified the replacement generation roughly two seconds after the renewal request.

## Zero-gap proof

The production activation RPC supersedes older generations only after the replacement callback is verified. The observed state confirms this contract:

1. generation 1 remained a usable `ACTIVE` lease while generation 2 was requested;
2. generation 2 was verified by the real Google hub;
3. generation 2 became `ACTIVE`;
4. only then did generation 1 become `SUPERSEDED`;
5. there was no observed state in which Geetha Arts had no usable WebSub lease;
6. no duplicate renewal generation or retry storm was created.

## Health ownership proof during renewal

The renewal also confirmed that subscription success does not erase unrelated delivery degradation.

After generation 2 activated, Geetha Arts remained:

- `DEGRADED`
- `WEBSUB_MISSED_DELIVERY`
- `last_websub_at = null`
- `consecutive_websub_events = 0`

That is correct because lease verification and delivery success are separate facts. A verified subscription does not prove that a notification has been delivered.

## Related health regression fixed before this canary

During the same incident, successful fallback enrichment briefly reset Geetha Arts to `HEALTHY`. Root cause: the enrichment worker treated a successful `videos.list` call as permission to clear the shared source-health error, even when that error belonged to the WebSub delivery subsystem.

The repair adds `record_youtube_enrichment_success(...)`, an atomic database RPC that clears only enrichment-owned failures (`YOUTUBE_API_ERROR`, `ENRICHMENT_FAILED`, quota guard states). WebSub/fallback/subscription failures remain untouched.

Hosted proof after repair:

1. Geetha health was restored to `DEGRADED / WEBSUB_MISSED_DELIVERY`;
2. a successful enrichment-health canary was recorded;
3. the source remained `DEGRADED / WEBSUB_MISSED_DELIVERY` afterward.

The updated enrichment worker is hosted version `8`.

## CI evidence

Branch head for the health-ownership repair: `2eb955f4071743e6d3477739715e234255f8a2dc`

CineRelay CI run `#122` passed all three jobs.

Database proof:

- fresh PostgreSQL-17 migration startup: PASS
- pgTAP: **40 tests / PASS**
- DB lint: no schema errors
- all Edge Function Deno checks: PASS
- intelligence/connectors job: PASS

## Gate consequence

Gate B no longer blocks Phase 2.

The remaining production blocker is **Gate A**:

> A genuinely new upload must produce an accepted WebSub delivery through the hardened callback and automatically traverse CineRelay's ingestion/intelligence pipeline before fallback becomes its first discovery path.

The naturally scheduled renewal timing can still be observed later as long-horizon operational evidence, but it is not required to re-prove the already demonstrated zero-gap generation replacement property.
