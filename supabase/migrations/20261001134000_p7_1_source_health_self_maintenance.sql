begin;

create table if not exists public.source_maintenance_findings (
  id uuid primary key default gen_random_uuid(),
  finding_key text not null unique,
  finding_type text not null check (finding_type in (
    'WEBSUB_ACCELERATOR_MISS',
    'SCHEDULE_DRIFT',
    'SOURCE_STALE',
    'SOURCE_DEAD',
    'PARSER_DRIFT',
    'POISON_JOB',
    'POLL_CLASS_RECOMMENDATION',
    'SUBSCRIPTION_EXPIRING'
  )),
  severity text not null check (severity in ('INFO','WARN','CRITICAL')),
  source_identity_id uuid references public.source_identities(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED')),
  recommended_action text,
  details jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_identity_id is not null or job_id is not null)
);

create trigger source_maintenance_findings_set_updated_at
before update on public.source_maintenance_findings
for each row execute function public.set_updated_at();

create index if not exists source_maintenance_findings_open_idx
  on public.source_maintenance_findings (status, severity, finding_type, last_seen_at desc);
create index if not exists source_maintenance_findings_source_idx
  on public.source_maintenance_findings (source_identity_id, status, last_seen_at desc)
  where source_identity_id is not null;
create index if not exists source_maintenance_findings_job_idx
  on public.source_maintenance_findings (job_id, status, last_seen_at desc)
  where job_id is not null;

alter table public.source_maintenance_findings enable row level security;
revoke all on table public.source_maintenance_findings from public, anon, authenticated;
grant select, insert, update, delete on table public.source_maintenance_findings to service_role;

create or replace function public.source_effective_health(
  p_source_identity_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with base as (
    select
      si.id,
      si.platform,
      si.connector_type,
      si.poll_class,
      si.active,
      sh.health_state,
      sh.last_attempt_at,
      sh.last_success_at,
      sh.last_item_at,
      sh.next_due_at,
      sh.consecutive_failures,
      sh.last_error_code,
      sh.last_error_message,
      sh.subscription_expires_at,
      yc.last_websub_at,
      yc.last_fallback_check_at,
      yc.next_fallback_check_at,
      yc.fallback_gap_count
    from public.source_identities si
    left join public.source_health sh on sh.source_identity_id = si.id
    left join public.youtube_channel_state yc on yc.source_identity_id = si.id
    where si.id = p_source_identity_id
  ), derived as (
    select *,
      case
        when not coalesce(active, false) then 'INACTIVE'
        when platform = 'YOUTUBE'
          and last_error_code in ('WEBSUB_MISSED_DELIVERY','WEBSUB_STALE')
          and coalesce(consecutive_failures, 0) = 0
          and last_fallback_check_at >= p_now - interval '2 hours'
          then 'HEALTHY'
        when coalesce(consecutive_failures, 0) >= 5
          and coalesce(last_success_at, '-infinity'::timestamptz) < p_now - interval '72 hours'
          then 'DEAD'
        when coalesce(last_success_at, '-infinity'::timestamptz) < p_now - interval '24 hours'
          then 'STALE'
        else coalesce(health_state, 'UNKNOWN')
      end as effective_state,
      (
        platform = 'YOUTUBE'
        and last_error_code in ('WEBSUB_MISSED_DELIVERY','WEBSUB_STALE')
        and last_fallback_check_at >= p_now - interval '2 hours'
      ) as websub_accelerator_only,
      (
        next_due_at is not null
        and next_due_at < p_now - interval '30 minutes'
        and coalesce(last_success_at, '-infinity'::timestamptz) > next_due_at
      ) as source_schedule_drift,
      (
        platform = 'YOUTUBE'
        and next_fallback_check_at is not null
        and next_fallback_check_at < p_now - interval '30 minutes'
        and coalesce(last_fallback_check_at, '-infinity'::timestamptz) > next_fallback_check_at
      ) as youtube_schedule_drift
    from base
  )
  select jsonb_build_object(
    'sourceIdentityId', id,
    'platform', platform,
    'connectorType', connector_type,
    'pollClass', poll_class,
    'storedState', health_state,
    'effectiveState', effective_state,
    'webSubAcceleratorOnly', websub_accelerator_only,
    'scheduleDrift', source_schedule_drift or youtube_schedule_drift,
    'lastAttemptAt', last_attempt_at,
    'lastSuccessAt', last_success_at,
    'lastItemAt', last_item_at,
    'lastFallbackCheckAt', last_fallback_check_at,
    'nextDueAt', next_due_at,
    'nextFallbackCheckAt', next_fallback_check_at,
    'consecutiveFailures', coalesce(consecutive_failures, 0),
    'lastErrorCode', last_error_code,
    'fallbackGapCount', coalesce(fallback_gap_count, 0),
    'subscriptionExpiresAt', subscription_expires_at
  )
  from derived;
$$;

revoke all on function public.source_effective_health(uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.source_effective_health(uuid,timestamptz) to service_role;

create or replace function public.refresh_source_maintenance_findings(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_upserted integer := 0;
  v_resolved integer := 0;
  v_open integer := 0;
begin
  create temporary table if not exists pg_temp.cinerelay_p7_findings (
    finding_key text primary key,
    finding_type text not null,
    severity text not null,
    source_identity_id uuid,
    job_id uuid,
    recommended_action text,
    details jsonb not null
  ) on commit drop;
  truncate pg_temp.cinerelay_p7_findings;

  insert into pg_temp.cinerelay_p7_findings
    (finding_key, finding_type, severity, source_identity_id, recommended_action, details)
  select
    'websub:' || si.id::text,
    'WEBSUB_ACCELERATOR_MISS',
    'INFO',
    si.id,
    'WebSub is an accelerator only; keep fallback ingestion authoritative and renew subscription when due.',
    jsonb_build_object(
      'storedHealthState', sh.health_state,
      'lastErrorCode', sh.last_error_code,
      'lastSuccessAt', sh.last_success_at,
      'lastFallbackCheckAt', yc.last_fallback_check_at,
      'lastWebSubAt', yc.last_websub_at,
      'fallbackGapCount', coalesce(yc.fallback_gap_count,0)
    )
  from public.source_identities si
  join public.source_health sh on sh.source_identity_id = si.id
  join public.youtube_channel_state yc on yc.source_identity_id = si.id
  where si.active = true
    and si.platform = 'YOUTUBE'
    and sh.last_error_code in ('WEBSUB_MISSED_DELIVERY','WEBSUB_STALE')
    and coalesce(sh.consecutive_failures,0) = 0
    and yc.last_fallback_check_at >= p_now - interval '2 hours';

  insert into pg_temp.cinerelay_p7_findings
    (finding_key, finding_type, severity, source_identity_id, recommended_action, details)
  select
    'schedule:' || si.id::text,
    'SCHEDULE_DRIFT',
    'WARN',
    si.id,
    'Repair scheduler bookkeeping; recent successful work proves the connector is alive.',
    jsonb_build_object(
      'nextDueAt', sh.next_due_at,
      'lastSuccessAt', sh.last_success_at,
      'nextFallbackCheckAt', yc.next_fallback_check_at,
      'lastFallbackCheckAt', yc.last_fallback_check_at
    )
  from public.source_identities si
  left join public.source_health sh on sh.source_identity_id = si.id
  left join public.youtube_channel_state yc on yc.source_identity_id = si.id
  where si.active = true
    and (
      (sh.next_due_at is not null and sh.next_due_at < p_now - interval '30 minutes' and sh.last_success_at > sh.next_due_at)
      or
      (si.platform = 'YOUTUBE' and yc.next_fallback_check_at is not null and yc.next_fallback_check_at < p_now - interval '30 minutes' and yc.last_fallback_check_at > yc.next_fallback_check_at)
    );

  insert into pg_temp.cinerelay_p7_findings
    (finding_key, finding_type, severity, source_identity_id, recommended_action, details)
  select
    'stale:' || si.id::text,
    case when coalesce(sh.consecutive_failures,0) >= 5 and coalesce(sh.last_success_at, '-infinity'::timestamptz) < p_now - interval '72 hours' then 'SOURCE_DEAD' else 'SOURCE_STALE' end,
    case when coalesce(sh.consecutive_failures,0) >= 5 and coalesce(sh.last_success_at, '-infinity'::timestamptz) < p_now - interval '72 hours' then 'CRITICAL' else 'WARN' end,
    si.id,
    case when coalesce(sh.consecutive_failures,0) >= 5 then 'Review for retirement or replacement; do not auto-retire a trusted identity.' else 'Check connector/auth/parser state and restore authoritative polling.' end,
    jsonb_build_object(
      'platform', si.platform,
      'connectorType', si.connector_type,
      'lastAttemptAt', sh.last_attempt_at,
      'lastSuccessAt', sh.last_success_at,
      'consecutiveFailures', coalesce(sh.consecutive_failures,0),
      'lastErrorCode', sh.last_error_code,
      'lastErrorMessage', sh.last_error_message
    )
  from public.source_identities si
  left join public.source_health sh on sh.source_identity_id = si.id
  where si.active = true
    and (
      sh.last_success_at is null
      or sh.last_success_at < p_now - interval '24 hours'
    )
    and not (
      si.platform = 'X'
      and sh.last_error_code = 'X_HTTP_ERROR'
      and sh.last_http_status = 402
    );

  insert into pg_temp.cinerelay_p7_findings
    (finding_key, finding_type, severity, source_identity_id, recommended_action, details)
  select
    'parser:' || si.id::text,
    'PARSER_DRIFT',
    case when coalesce(sh.consecutive_failures,0) >= 3 then 'CRITICAL' else 'WARN' end,
    si.id,
    'Review the bounded parser profile before allowing state to advance.',
    jsonb_build_object(
      'connectorType', si.connector_type,
      'parserVersion', sh.parser_version,
      'consecutiveFailures', coalesce(sh.consecutive_failures,0),
      'lastErrorCode', sh.last_error_code,
      'lastErrorMessage', sh.last_error_message,
      'lastAttemptAt', sh.last_attempt_at
    )
  from public.source_identities si
  join public.source_health sh on sh.source_identity_id = si.id
  where si.active = true
    and si.connector_type in ('RSS_ATOM','FIRST_PARTY_HTML','PUBLIC_WEB')
    and coalesce(sh.consecutive_failures,0) >= 2
    and sh.last_error_code is not null
    and sh.last_error_code not in ('HTTP_RATE_LIMIT','RATE_LIMITED');

  insert into pg_temp.cinerelay_p7_findings
    (finding_key, finding_type, severity, job_id, recommended_action, details)
  select
    'job:' || j.id::text,
    'POISON_JOB',
    'CRITICAL',
    j.id,
    'Inspect the retained raw item with current code, then explicitly requeue or retire this exhausted job.',
    jsonb_build_object(
      'jobType', j.job_type,
      'attemptCount', j.attempt_count,
      'maxAttempts', j.max_attempts,
      'runAfter', j.run_after,
      'lastError', j.last_error,
      'payload', j.payload
    )
  from public.jobs j
  where j.state not in ('SUCCEEDED','COMPLETED','DONE')
    and j.attempt_count >= j.max_attempts;

  insert into pg_temp.cinerelay_p7_findings
    (finding_key, finding_type, severity, source_identity_id, recommended_action, details)
  select
    'poll:' || si.id::text,
    'POLL_CLASS_RECOMMENDATION',
    'INFO',
    si.id,
    'Review and apply the recommended poll class if it matches editorial importance and provider limits.',
    jsonb_build_object(
      'currentPollClass', si.poll_class,
      'recommendedPollClass', stats.recommended_poll_class,
      'items7d', stats.items_7d,
      'items30d', stats.items_30d
    )
  from public.source_identities si
  join lateral (
    select
      count(*) filter (where ri.first_seen_at >= p_now - interval '7 days')::integer as items_7d,
      count(*) filter (where ri.first_seen_at >= p_now - interval '30 days')::integer as items_30d,
      case
        when count(*) filter (where ri.first_seen_at >= p_now - interval '7 days') >= 7 then 'ACTIVE_15M'
        when count(*) filter (where ri.first_seen_at >= p_now - interval '30 days') >= 8 then 'NORMAL_60M'
        when count(*) filter (where ri.first_seen_at >= p_now - interval '30 days') >= 1 then 'COLD_6H'
        else 'DAILY'
      end as recommended_poll_class
    from public.raw_items ri
    where ri.source_identity_id = si.id
      and ri.first_seen_at >= p_now - interval '30 days'
  ) stats on true
  where si.active = true
    and si.connector_type <> 'YOUTUBE_WEBSUB'
    and si.poll_class in ('HOT_5M','ACTIVE_15M','NORMAL_60M','COLD_6H','DAILY')
    and si.poll_class is distinct from stats.recommended_poll_class;

  insert into pg_temp.cinerelay_p7_findings
    (finding_key, finding_type, severity, source_identity_id, recommended_action, details)
  select
    'subscription:' || sh.source_identity_id::text,
    'SUBSCRIPTION_EXPIRING',
    'WARN',
    sh.source_identity_id,
    'Renew the WebSub subscription before expiry; fallback polling remains authoritative.',
    jsonb_build_object('subscriptionExpiresAt', sh.subscription_expires_at)
  from public.source_health sh
  join public.source_identities si on si.id = sh.source_identity_id
  where si.active = true
    and si.platform = 'YOUTUBE'
    and sh.subscription_expires_at is not null
    and sh.subscription_expires_at <= p_now + interval '12 hours';

  insert into public.source_maintenance_findings (
    finding_key, finding_type, severity, source_identity_id, job_id,
    status, recommended_action, details, first_seen_at, last_seen_at, resolved_at
  )
  select
    f.finding_key, f.finding_type, f.severity, f.source_identity_id, f.job_id,
    'OPEN', f.recommended_action, f.details, p_now, p_now, null
  from pg_temp.cinerelay_p7_findings f
  on conflict (finding_key) do update
    set finding_type = excluded.finding_type,
        severity = excluded.severity,
        source_identity_id = excluded.source_identity_id,
        job_id = excluded.job_id,
        status = 'OPEN',
        recommended_action = excluded.recommended_action,
        details = excluded.details,
        last_seen_at = p_now,
        resolved_at = null,
        updated_at = p_now;
  get diagnostics v_upserted = row_count;

  update public.source_maintenance_findings existing
  set status = 'RESOLVED',
      resolved_at = p_now,
      updated_at = p_now
  where existing.status = 'OPEN'
    and not exists (
      select 1 from pg_temp.cinerelay_p7_findings current
      where current.finding_key = existing.finding_key
    );
  get diagnostics v_resolved = row_count;

  select count(*) into v_open
  from public.source_maintenance_findings
  where status = 'OPEN';

  return jsonb_build_object(
    'refreshedAt', p_now,
    'upserted', v_upserted,
    'resolved', v_resolved,
    'open', v_open
  );
end;
$$;

revoke all on function public.refresh_source_maintenance_findings(timestamptz) from public, anon, authenticated;
grant execute on function public.refresh_source_maintenance_findings(timestamptz) to service_role;

alter table public.event_types enable row level security;
revoke all on table public.event_types from public, anon, authenticated;
grant select on table public.event_types to anon, authenticated, service_role;

drop policy if exists event_types_public_read on public.event_types;
create policy event_types_public_read
on public.event_types
for select
to anon, authenticated
using (true);

alter function public.record_youtube_websub_delivery(uuid,text,integer,timestamptz)
  set search_path = pg_catalog, public;

commit;
