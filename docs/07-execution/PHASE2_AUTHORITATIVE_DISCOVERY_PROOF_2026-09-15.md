# Phase 2 — Authoritative YouTube Discovery Production Proof

Date: 2026-09-15

## Decision

CineRelay no longer depends on YouTube WebSub delivery for ingestion correctness.

The production contract is now:

`official uploads playlist -> authoritative discovery -> targeted videos.list enrichment -> raw/revision persistence -> intelligence processing`

WebSub remains enabled as a best-effort low-latency accelerator. A working WebSub delivery may reduce discovery latency, but a missed push cannot create a data-loss gap or block the product roadmap.

This decision follows repeated real-world evidence that Google accepted and verified WebSub subscriptions while upload notifications were not observed by CineRelay. The uploads-playlist path repeatedly found the same real uploads with `fallback_gap_count = 0`.

## Production deployment

Validated branch head before documentation updates:

`58854a4413f35ceb8e7fbca2452b23513f6d8e07`

CineRelay CI run:

- run: `#132`
- run id: `34959975534`
- result: **PASS** across all three jobs
- intelligence/connectors: PASS
- Edge Functions: PASS
- database migrations + pgTAP + lint: PASS

Deployment-native artifact:

- name: `cinerelay-edge-deploy-bundle`
- artifact id: `10393330447`
- digest: `sha256:9d8f75d6ab50763056b7e92a9c0235b1b954f512cd4b9366f724ab04aa5b7a17`

Production deployments from that artifact:

- `youtube-websub` -> v9 / ACTIVE
- `youtube-fallback-worker` -> v9 / ACTIVE

The legacy `youtube-fallback-worker` slug is intentionally retained for compatibility. Its operational role is now authoritative uploads-playlist discovery.

## Discovery cadence

The worker uses an adaptive per-source schedule:

- normal source: **15 minutes**
- source with `WEBSUB_MISSED_DELIVERY` or bounded-window risk: **5 minutes**
- provider/API/quota failure backoff: **30 minutes**

The hosted cron dispatcher invokes the discovery worker every **5 minutes** so hot sources can be serviced at their intended cadence. The worker itself decides whether each source is due.

## Controlled production canary

All four active pilot YouTube channel rows were intentionally made due once, then the normal hosted scheduler path dispatched the discovery action.

Scheduler request id: `2975`

HTTP result: `200`

Worker result:

```json
{
  "due": 4,
  "checked": 4,
  "discoveredUploads": 1,
  "baselineSources": 0,
  "gapSources": 0,
  "quotaUsedBefore": 13,
  "quotaUsedAfter": 17,
  "discoveryMode": "UPLOADS_PLAYLIST_PRIMARY",
  "webSubRole": "ACCELERATOR"
}
```

This proves the production worker checked all four pilot sources, consumed four playlist-read units, and found one real new upload without exceeding the bounded discovery window.

## Real upload proof

The canary discovered a real Haarika & Hassine Creations upload:

- video id: `C6R0LkeURFo`
- title: `#AadarshaKutumbam - Releasing on Oct 2nd, 2026 | #Venkatesh #SrinidhiShetty | #Trivikram | #ThamanS`
- channel id: `UCme6XJ0pNj-zyVyYkAJikxw`
- published: `2026-09-15 10:45:17 UTC`
- discovery marker: `UPLOADS_PLAYLIST_PRIMARY`

Pipeline evidence:

- discovery job created: `2026-09-15 10:54:21.704231 UTC`
- `YOUTUBE_ENRICH_VIDEO`: **SUCCEEDED** at `2026-09-15 10:55:01.783064 UTC`
- `PROCESS_RAW_ITEM`: **SUCCEEDED** at `2026-09-15 10:55:02.557453 UTC`
- entity resolution: `UNRESOLVED`
- resolution score: `0`
- resolver: `source-scope-resolver-v1`
- no false canonical event was invented
- bounded-window gap count for the canary: `0`

The unresolved result is correct behavior for the current source/entity scope and is independent of ingestion reliability.

## Adaptive cadence proof

Immediately after the production canary:

- Geetha Arts: `DEGRADED / WEBSUB_MISSED_DELIVERY` -> next check in **5.00 minutes**
- Haarika & Hassine Creations: `DEGRADED / WEBSUB_MISSED_DELIVERY` -> next check in **5.00 minutes**
- Mythri Movie Makers: `HEALTHY` -> next check in **15.00 minutes**
- Sithara Entertainments: `HEALTHY` -> next check in **15.00 minutes**

Haarika becoming degraded is intentional: the authoritative discovery canary found a real upload that had not been observed through WebSub, so the accelerator-health signal correctly changed without affecting ingestion correctness.

## WebSub v9 ingress observability proof

The previous callback recorded rejected/ignored diagnostics only after a callback token had resolved. A POST with a missing or unrecognized token could therefore return `404` without leaving evidence.

v9 adds safe ingress telemetry before token resolution. It records only operational metadata; it does not store callback tokens, signature values, or rejected request bodies.

Controlled probe:

- pg_net request id: `2971`
- POST to public `youtube-websub` endpoint with no callback token
- HTTP response: expected `404 Not Found`
- persisted provider: `YOUTUBE_WEBSUB_INGRESS`
- status: `RECEIVED`
- token state: `MISSING`
- signature present: `false`
- telemetry bucket: 5 minutes

This closes the pre-token diagnostic blind spot. Future real WebSub POSTs can now distinguish `MATCHED`, `UNKNOWN`, `MISSING`, and `TOO_LONG` token states before deeper validation.

## Quota proof

After the production canary on 2026-09-15, current recorded YouTube Data API usage was still extremely small:

- `playlistItems.list`: 14 units / 14 requests
- `videos.list`: 4 units / 4 requests

The authoritative polling design therefore has substantial operating headroom for the four-source pilot while retaining the existing quota reserve guard and provider-error backoff.

## Phase-2 reliability conclusion

The revised Phase-2 reliability contract is satisfied:

1. official-source discovery is unattended;
2. uploads-playlist discovery is authoritative for correctness;
3. real new uploads are automatically found and enriched;
4. raw/revision and downstream intelligence processing run automatically;
5. bounded-window gaps are explicitly detected and surfaced;
6. source health distinguishes ingestion correctness from WebSub accelerator health;
7. quota usage is accounted and guarded;
8. WebSub remains available for faster delivery when the upstream path works;
9. WebSub ingress is now observable even before token resolution;
10. zero-gap WebSub lease replacement remains production-proven independently.

A future successful natural WebSub delivery is useful operational evidence, but it is **not** a correctness dependency and is no longer a Phase-2 merge blocker.

Phase 2 is therefore **production-verified and ready to merge** under the revised reliability contract.
