# Phase 2 — Hosted Pilot Watch Pack

Date: 2026-09-14

## Current purpose

Phase 2 now has **one** remaining production exit gate: a genuinely new upload must be accepted through the WebSub callback before fallback becomes its first discovery path.

Gate B — zero-gap renewal — passed in production through the incident-driven Geetha Arts generation-2 renewal canary. See `PHASE2_GATE_B_RENEWAL_PROOF_2026-09-14.md`.

## Hosted project

- project: `CineRelay`
- ref: `dnqaejljfzwhsainpdxb`
- region: `ap-south-1`
- branch: `phase-2/youtube-connector`
- draft PR: `#2`

## Pilot sources

1. Mythri Movie Makers
2. Sithara Entertainments
3. Haarika & Hassine Creations
4. Geetha Arts

Geetha Arts currently has generation 2 `ACTIVE`; generation 1 is `SUPERSEDED`. The other three sources retain usable generation-1 leases.

## Current incident state

Three Geetha Arts uploads published after generation-1 verification were recovered by fallback with no accepted WebSub receipt:

- `cYvPtLZSL5I` — `2026-09-14 12:30:22 UTC`
- `DCYcSoTobwU` — `2026-09-14 13:30:35 UTC`
- `b98yv5Gu1r4` — `2026-09-14 13:45:28 UTC`

Current Geetha health must remain:

- `DEGRADED`
- `WEBSUB_MISSED_DELIVERY`
- `last_websub_at = null`
- `consecutive_websub_events = 0`

A successful enrichment or lease renewal must **not** clear this delivery failure. Only a successful real WebSub delivery may clear it.

Relevant hosted versions:

- `youtube-websub`: v8
- `youtube-fallback-worker`: v8
- `youtube-enrichment-worker`: v8

## Final Gate A — accepted natural WebSub upload

A pass requires a genuinely new upload to be delivered by the WebSub hub and accepted by CineRelay before fallback becomes its first discovery path.

Required evidence:

1. accepted `connector_receipts` row for provider `YOUTUBE_WEBSUB`;
2. no diagnostic rejection/ignore for the qualifying delivery;
3. `YOUTUBE_ENRICH_VIDEO` job created from the WebSub notification;
4. targeted `videos.list` enrichment succeeds;
5. raw item + revision persist;
6. `PROCESS_RAW_ITEM` completes automatically;
7. entity resolution is truthful (`RESOLVED`, `AMBIGUOUS`, or `UNRESOLVED`);
8. when the content maps to a supported event, exactly one canonical event is created with evidence;
9. replay/retry does not create duplicate canonical events;
10. receipt-to-raw latency is recorded;
11. receipt-to-canonical latency is recorded when an event is produced;
12. fallback was not the first discovery path.

A fallback-only discovery does **not** pass Gate A.

## Callback diagnostic interpretation

The hardened v8 callback persists minimal operational diagnostics only after a valid callback token resolves.

Interpretation:

- normal video external key + queued/processed progression = accepted WebSub path;
- `diagnostic:rejected:*` = callback reached CineRelay but signature/payload/validation failed;
- `diagnostic:ignored:*` = callback reached parsing but no acceptable matching channel entry was queued;
- no receipt/diagnostic at all + later fallback discovery = likely no usable callback reached CineRelay for that upload.

Diagnostic rows are investigation evidence, not Gate-A success.

## Watch queries

### 1. WebSub generations

```sql
select
  s.display_name,
  cs.generation,
  cs.state,
  cs.requested_at,
  cs.verified_at,
  cs.renew_after,
  cs.expires_at,
  cs.last_error
from public.connector_subscriptions cs
join public.source_identities si on si.id = cs.source_identity_id
join public.sources s on s.id = si.source_id
where cs.provider = 'YOUTUBE_WEBSUB'
order by s.display_name, cs.generation desc;
```

### 2. WebSub receipts + diagnostics

```sql
select
  cr.id,
  s.display_name,
  cr.external_key,
  cr.status,
  cr.received_at,
  cr.processed_at,
  cr.error_message,
  cr.metadata
from public.connector_receipts cr
left join public.source_identities si on si.id = cr.source_identity_id
left join public.sources s on s.id = si.source_id
where cr.provider = 'YOUTUBE_WEBSUB'
order by cr.received_at desc
limit 50;
```

### 3. Recent ingestion jobs

```sql
select
  id,
  job_type,
  state,
  attempt_count,
  created_at,
  completed_at,
  last_error,
  payload
from public.jobs
where job_type in ('YOUTUBE_ENRICH_VIDEO', 'PROCESS_RAW_ITEM')
order by created_at desc
limit 50;
```

### 4. Latest YouTube raw items

```sql
select
  r.id as raw_item_id,
  s.display_name,
  r.platform_item_id,
  r.raw_title,
  r.published_at,
  r.created_at,
  r.current_revision_id
from public.raw_items r
join public.source_identities si on si.id = r.source_identity_id
join public.sources s on s.id = si.source_id
where si.platform = 'YOUTUBE'
order by r.created_at desc
limit 50;
```

### 5. Latest resolution results

```sql
select
  rr.raw_item_id,
  rr.resolution_state,
  rr.score,
  e.canonical_name,
  rr.engine_version,
  rr.created_at
from public.entity_resolution_results rr
left join public.entities e on e.id = rr.entity_id
order by rr.created_at desc
limit 50;
```

### 6. Latest canonical events + evidence

```sql
select
  ev.id as event_id,
  e.canonical_name,
  ev.event_type,
  ev.verification_state,
  ev.priority_band,
  ev.headline,
  ev.detected_at,
  ri.platform_item_id,
  ri.canonical_url
from public.events ev
join public.entities e on e.id = ev.primary_entity_id
join public.event_evidence ee on ee.event_id = ev.id
join public.raw_items ri on ri.id = ee.raw_item_id
join public.source_identities si on si.id = ri.source_identity_id
where si.platform = 'YOUTUBE'
order by ev.detected_at desc
limit 50;
```

### 7. Duplicate guard

```sql
select dedupe_key, count(*)
from public.events
group by dedupe_key
having count(*) > 1;
```

Expected: no rows.

### 8. Source health

```sql
select
  s.display_name,
  sh.health_state,
  sh.last_attempt_at,
  sh.last_success_at,
  sh.last_item_at,
  sh.last_error_code,
  sh.last_error_message,
  ycs.last_websub_at,
  ycs.last_fallback_check_at,
  ycs.next_fallback_check_at,
  ycs.fallback_gap_count,
  ycs.consecutive_websub_events
from public.source_health sh
join public.source_identities si on si.id = sh.source_identity_id
join public.sources s on s.id = si.source_id
left join public.youtube_channel_state ycs on ycs.source_identity_id = si.id
where si.platform = 'YOUTUBE'
order by s.display_name;
```

### 9. Cron health

```sql
select
  d.jobid,
  j.jobname,
  d.status,
  d.return_message,
  d.start_time,
  d.end_time
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname like 'cinerelay-%'
order by d.start_time desc
limit 50;
```

### 10. Dispatcher results

```sql
select
  id,
  status_code,
  timed_out,
  error_msg,
  content,
  created
from net._http_response
order by created desc
limit 50;
```

## Latency recording

For the qualifying push record:

- `connector_receipts.received_at`
- `raw_items.created_at`
- `events.detected_at` when applicable

Metrics:

`raw_ingest_latency = raw_items.created_at - connector_receipts.received_at`

`canonical_event_latency = events.detected_at - connector_receipts.received_at`

Phase-0 target for push-capable Tier-A sources remains p50 < 2 minutes and p95 < 5 minutes after provider notification availability. One final canary validates order of magnitude, not a percentile distribution.

## Incident conditions

Investigate immediately if:

- accepted receipt appears but no enrichment job follows;
- accepted receipt remains unprocessed after the worker cadence;
- fallback discovers a new upload before any accepted receipt;
- `diagnostic:rejected:*` or `diagnostic:ignored:*` appears;
- any job reaches `DEAD_LETTER`;
- duplicate canonical-event dedupe keys appear;
- Geetha becomes `HEALTHY` without an accepted WebSub delivery;
- any active lease expires without a replacement.

## Gate-B reference

Gate B is already passed. Do not re-open it unless a later regression contradicts the zero-gap renewal proof.

Evidence: `PHASE2_GATE_B_RENEWAL_PROOF_2026-09-14.md`.

## Phase-2 completion rule

PR #2 remains draft until Gate A passes.

Current correct state:

**IMPLEMENTATION COMPLETE / HOSTED PILOT ACTIVE / ONE FINAL LIVE PUSH GATE PENDING**
