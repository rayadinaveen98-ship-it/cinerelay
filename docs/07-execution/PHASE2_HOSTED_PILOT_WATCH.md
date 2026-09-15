# Phase 2 — Hosted Pilot Watch Pack

Date: 2026-09-15

## Purpose

Phase 2 is production-verified. This watch pack now monitors ongoing YouTube ingestion reliability and WebSub accelerator behavior; it is **not** a merge gate.

The correctness path is authoritative uploads-playlist discovery. WebSub is retained as a best-effort low-latency accelerator.

See:

- `PHASE2_AUTHORITATIVE_DISCOVERY_PROOF_2026-09-15.md`
- `PHASE2_GATE_B_RENEWAL_PROOF_2026-09-14.md`

## Hosted project

- project: `CineRelay`
- ref: `dnqaejljfzwhsainpdxb`
- region: `ap-south-1`
- branch: `phase-2/youtube-connector`
- PR: `#2`

## Pilot sources

1. Mythri Movie Makers
2. Sithara Entertainments
3. Haarika & Hassine Creations
4. Geetha Arts

## Operating contract

Authoritative discovery cadence:

- WebSub-degraded/hot source: 5 minutes
- normal source: 15 minutes
- provider/API/quota backoff: 30 minutes

The hosted dispatcher invokes the discovery worker every 5 minutes; the worker checks only sources whose own due time has arrived.

`fallback_gap_count > 0` is now the critical correctness alarm. A WebSub miss is an accelerator-health degradation, not an ingestion failure when authoritative discovery remains within its bounded window.

## Current WebSub telemetry

`youtube-websub` v9 records safe ingress evidence before callback-token resolution.

Providers:

- `YOUTUBE_WEBSUB_INGRESS`: coarse ingress telemetry before token/signature/payload validation
- `YOUTUBE_WEBSUB`: accepted notifications and post-token rejected/ignored diagnostics

Ingress token states:

- `MATCHED`: callback token resolved to a known subscription
- `UNKNOWN`: a token was supplied but did not resolve
- `MISSING`: POST arrived without a token
- `TOO_LONG`: token exceeded the callback safety bound

No callback token value, HMAC signature value, or rejected payload body is stored.

A controlled production request `2971` proved the pre-token path by persisting `MISSING` while returning the expected `404`.

## Production discovery proof

Production scheduler request `2975`:

- HTTP 200
- four pilot sources checked
- one real upload discovered
- zero bounded-window gap sources
- discovery mode `UPLOADS_PLAYLIST_PRIMARY`
- WebSub role `ACCELERATOR`

Real upload:

- source: Haarika & Hassine Creations
- video: `C6R0LkeURFo`
- published: `2026-09-15 10:45:17 UTC`
- enrichment: SUCCEEDED
- processing: SUCCEEDED
- resolution: `UNRESOLVED / 0`
- no false canonical event

## Watch queries

### 1. Source health + discovery cadence

```sql
select
  s.display_name,
  sh.health_state,
  sh.last_error_code,
  sh.last_error_message,
  ycs.latest_known_video_id,
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

Expected correctness condition: `fallback_gap_count = 0` for all active pilot sources.

### 2. WebSub ingress telemetry

```sql
select
  cr.received_at,
  s.display_name,
  cr.status,
  cr.metadata
from public.connector_receipts cr
left join public.source_identities si on si.id = cr.source_identity_id
left join public.sources s on s.id = si.source_id
where cr.provider = 'YOUTUBE_WEBSUB_INGRESS'
order by cr.received_at desc
limit 50;
```

### 3. Accepted/rejected WebSub receipts

```sql
select
  cr.received_at,
  s.display_name,
  cr.external_key,
  cr.status,
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

### 4. Recent YouTube jobs

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

### 5. Latest YouTube raw items

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

### 6. Latest resolution results

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

### 7. Duplicate event guard

```sql
select dedupe_key, count(*)
from public.events
group by dedupe_key
having count(*) > 1;
```

Expected: no rows.

### 8. Quota usage

```sql
select
  usage_day,
  method,
  sum(units) as units,
  sum(request_count) as requests
from public.connector_quota_usage
where provider = 'YOUTUBE_DATA_API'
group by usage_day, method
order by usage_day desc, method;
```

### 9. Cron health

```sql
select
  d.jobid,
  j.jobname,
  j.schedule,
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

## Investigation rules

Investigate immediately when:

- `fallback_gap_count` increases;
- authoritative discovery cannot find the previous baseline inside the 50-item window;
- discovery/API jobs reach `DEAD_LETTER`;
- quota reserve guard remains active long enough to threaten the bounded discovery window;
- a discovered upload does not complete enrichment and raw processing;
- duplicate canonical-event dedupe keys appear;
- a WebSub `MATCHED` ingress fails deeper validation repeatedly;
- an active WebSub lease expires without a replacement.

WebSub misses alone are not data-loss incidents when authoritative discovery remains healthy. They should remain visible through `WEBSUB_MISSED_DELIVERY` so accelerator reliability can be improved independently.

## Completion state

**PHASE 2 COMPLETE / PRODUCTION-VERIFIED**

Natural WebSub success remains useful ongoing operational evidence but is not a Phase-2 merge blocker.
