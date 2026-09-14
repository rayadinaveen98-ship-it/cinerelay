# Phase 2 — Hosted Pilot Watch Pack

Date: 2026-09-14

## Purpose

This is the operational watch pack for the final two time-dependent Phase-2 exit gates. It is deliberately narrow: do not use it as a reason to expand scope before the YouTube production connector is fully production-verified.

## Hosted project

- Supabase project: `CineRelay`
- project ref: `dnqaejljfzwhsainpdxb`
- region: `ap-south-1`
- branch under validation: `phase-2/youtube-connector`
- PR: `#2`

## Pilot sources

The active Tier-A YouTube canaries are:

1. Mythri Movie Makers
2. Sithara Entertainments
3. Haarika & Hassine Creations
4. Geetha Arts

All four have generation-1 WebSub leases in `ACTIVE` state.

Hosted lease times observed on 2026-09-14:

- renewal due: approximately `2026-09-22 11:04 UTC`
- lease expiry: approximately `2026-09-24 11:04 UTC`

The maintenance worker runs every 10 minutes, so a due renewal should be requested shortly after `renew_after` becomes eligible.

## Current live incident state

Three post-subscription Geetha Arts uploads were recovered by the uploads-playlist fallback with no prior WebSub receipt. They are documented in `PHASE2_PILOT_INCIDENT_2026-09-14.md`.

Current health expectation:

- Geetha Arts: `DEGRADED / WEBSUB_MISSED_DELIVERY` until a successful WebSub push proves recovery;
- the other three pilot channels: `HEALTHY` unless a real miss/error is observed.

`youtube-websub` and `youtube-fallback-worker` are now hosted version 8. The callback persists minimal `REJECTED` / `IGNORED` diagnostics after a valid callback token resolves, so the next real upload can distinguish a missing hub POST from a callback-level rejection.

## Exit gate A — natural signed WebSub upload

A pass requires a genuinely new upload published after the subscription was established, delivered by the WebSub hub rather than manually replayed or discovered first by fallback.

Evidence required for one pilot upload:

1. a new accepted `connector_receipts` row for provider `YOUTUBE_WEBSUB`;
2. signed callback accepted and receipt status progresses successfully;
3. `YOUTUBE_ENRICH_VIDEO` job created from the WebSub notification;
4. targeted `videos.list` enrichment succeeds;
5. `raw_items` + `raw_item_revisions` persist the real upload;
6. `PROCESS_RAW_ITEM` runs automatically through cron;
7. entity resolution is either correctly `RESOLVED` or safely `AMBIGUOUS/UNRESOLVED` — never forced;
8. when the upload contains a supported meaningful event, exactly one canonical event is created with real evidence;
9. repeated evidence/retries do not create duplicate canonical feed events;
10. provider-delivery-to-canonical-event latency is recorded.

A fallback-only discovery does **not** satisfy the WebSub push exit gate, although it proves safety recovery.

If the next callback is rejected/ignored, version 8 should persist a diagnostic receipt. That diagnostic is evidence for investigation, but it does not satisfy Exit Gate A.

## Exit gate B — zero-gap lease renewal

A pass requires a real hosted renewal generation.

Evidence required:

1. generation 1 remains `ACTIVE` while renewal starts;
2. generation 2 is created in `RENEWING`/`PENDING` state;
3. the WebSub hub verifies generation 2;
4. generation 2 becomes `ACTIVE`;
5. generation 1 becomes `SUPERSEDED` only after generation 2 verification;
6. there is no point where the source has no usable active lease;
7. source health remains healthy or recovers without an expiry gap;
8. no duplicate renewal storm is created by repeated maintenance runs.

## Watch queries

### 1. Current WebSub generations

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

### 2. Latest real WebSub receipts and diagnostics

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
join public.source_identities si on si.id = cr.source_identity_id
join public.sources s on s.id = si.source_id
where cr.provider = 'YOUTUBE_WEBSUB'
order by cr.received_at desc
limit 50;
```

Interpretation:

- normal video external key + `QUEUED`/processed progression = accepted WebSub path;
- `diagnostic:rejected:*` = callback token resolved but the payload/signature/Atom validation was rejected;
- `diagnostic:ignored:*` = callback token and signature path reached parsing but no matching accepted channel entry was queued.

Do not treat diagnostic rows as successful push delivery.

### 3. Recent ingestion jobs

```sql
select
  id,
  job_type,
  state,
  attempt_count,
  created_at,
  run_after,
  completed_at,
  last_error,
  payload
from public.jobs
where job_type in ('YOUTUBE_ENRICH_VIDEO', 'PROCESS_RAW_ITEM')
order by created_at desc
limit 50;
```

### 4. Latest YouTube raw items and revisions

```sql
select
  r.id as raw_item_id,
  s.display_name,
  r.platform_item_id,
  r.raw_title,
  r.canonical_url,
  r.published_at,
  r.created_at,
  r.updated_at,
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
  rr.methods,
  rr.engine_version,
  rr.created_at
from public.entity_resolution_results rr
left join public.entities e on e.id = rr.entity_id
order by rr.created_at desc
limit 50;
```

### 6. Latest canonical events + YouTube evidence

```sql
select
  ev.id as event_id,
  e.canonical_name,
  ev.event_type,
  ev.verification_state,
  ev.priority_band,
  ev.headline,
  ev.structured_data,
  ev.classifier_version,
  ev.detected_at,
  ee.evidence_role,
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

### 7. Duplicate-event guard

```sql
select dedupe_key, count(*)
from public.events
group by dedupe_key
having count(*) > 1;
```

Expected result: no rows.

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

Health interpretation relevant to the pilot:

- `HEALTHY`: no proven connector failure;
- `WEBSUB_MISSED_DELIVERY`: fallback recovered at least one upload that WebSub had not surfaced; this should persist until a real successful WebSub delivery clears it;
- `FALLBACK_WINDOW_GAP`: previous known upload fell outside the bounded latest-50 safety window;
- quiet channel + `last_websub_at is null` is **not by itself a failure**.

### 9. Cron execution health

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

### 10. Dispatcher HTTP results

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

## Latency measurement

For the natural WebSub canary, record at minimum:

- `connector_receipts.received_at`
- `raw_items.created_at`
- `events.detected_at` when a canonical event is produced

Primary metric for a meaningful classified event:

`canonical_event_latency = events.detected_at - connector_receipts.received_at`

For an item that is correctly ignored/unresolved and produces no event, also record:

`raw_ingest_latency = raw_items.created_at - connector_receipts.received_at`

The Phase-0 target for push-capable Tier-A sources is p50 < 2 minutes and p95 < 5 minutes after provider notification availability. One canary cannot establish a percentile distribution, but it can verify that the architecture is within the intended order of magnitude.

## Incident conditions

Investigate immediately if any of the following occurs:

- WebSub receipt is accepted but no enrichment job appears;
- WebSub receipt remains unprocessed after the minute worker cadence;
- a new upload is found by fallback but no prior accepted WebSub receipt exists;
- a `diagnostic:rejected:*` or `diagnostic:ignored:*` receipt appears;
- any job reaches `DEAD_LETTER`;
- source health becomes `AUTH_REQUIRED`, `PARSER_BROKEN`, `BUDGET_EXHAUSTED`, or remains unexpectedly degraded;
- duplicate `dedupe_key` rows appear in `events`;
- generation 1 expires before generation 2 becomes active;
- repeated maintenance cycles create multiple simultaneous renewal generations.

`DEGRADED / WEBSUB_MISSED_DELIVERY` is currently expected for Geetha Arts because a real miss has already been proven; it should not be manually cleared. A later accepted WebSub push should clear it through `record_youtube_websub_delivery`.

## Phase-2 completion rule

Do not merge PR #2 merely because the implementation, fallback recovery and hosted scheduler are green.

Phase 2 can be marked production-verified only after both:

- Exit gate A: one natural valid signed WebSub upload is observed end to end; and
- Exit gate B: one real zero-gap WebSub lease renewal is observed.

Until then the correct state is:

**IMPLEMENTATION COMPLETE / HOSTED PILOT ACTIVE / FINAL LIVE-UPLOAD + RENEWAL EVIDENCE PENDING**
