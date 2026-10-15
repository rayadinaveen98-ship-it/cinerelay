-- CineRelay v0.2.7: prevent source-activity queue starvation and stale push floods.
-- Preserve historical evidence: suppress stale alerts, never DELETE delivery records.
-- This one-time rollout guard intentionally cancels pending pre-existing catch-up
-- notifications older than 10 minutes so the fixed worker cannot flood devices.
update public.source_activity_deliveries d
set status = 'SUPPRESSED',
    failure_code = 'RELEASE_BACKLOG_GUARD',
    failure_message = 'Stale notification suppressed during v0.2.7 queue recovery; original evidence retained.',
    updated_at = now()
where d.status in ('PENDING', 'DEFERRED', 'FAILED')
  and d.created_at < now() - interval '10 minutes'
  and not exists (
    select 1 from public.source_activity_delivery_targets t
    where t.source_activity_delivery_id = d.id
      and t.status = 'LEASED'
  );

create or replace function public.materialize_due_source_activity_targets(p_limit integer default 100)
returns integer
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_count integer := 0;
begin
  -- Device eligibility and duplicate exclusion MUST precede the bounded LIMIT.
  -- Otherwise the first 100 pending messages for an unregistered user can
  -- starve newer, deliverable notifications indefinitely.
  with eligible_targets as (
    select d.id as delivery_id, r.id as registration_id
    from public.source_activity_deliveries d
    join public.push_device_registrations r
      on r.user_id = d.user_id
     and r.provider = 'FCM'
     and r.target_kind = 'TOKEN'
     and r.active = true
    where d.status in ('PENDING','DEFERRED','FAILED')
      and d.scheduled_for <= now()
      and d.created_at >= now() - interval '24 hours'
      and not exists (
        select 1
        from public.source_activity_delivery_targets t
        where t.source_activity_delivery_id = d.id
          and t.device_registration_id = r.id
      )
    order by d.scheduled_for asc, d.created_at asc, r.id asc
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  )
  insert into public.source_activity_delivery_targets (
    source_activity_delivery_id, device_registration_id, status, next_attempt_at
  )
  select e.delivery_id, e.registration_id, 'PENDING', now()
  from eligible_targets e
  on conflict (source_activity_delivery_id, device_registration_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- Bounded, auditable TTL cleanup for subsequent interruptions.
-- Quiet-hour alerts have a 24-hour grace period. No backdated notification
-- may be materialized after that limit.
create or replace function public.expire_stale_source_activity_deliveries(p_limit integer default 500)
returns integer
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_count integer := 0;
begin
  with stale as (
    select d.id
    from public.source_activity_deliveries d
    where d.status in ('PENDING', 'DEFERRED', 'FAILED')
      and d.created_at < now() - interval '24 hours'
      and not exists (
        select 1 from public.source_activity_delivery_targets t
        where t.source_activity_delivery_id = d.id
          and t.status = 'LEASED'
      )
    order by d.created_at asc, d.id asc
    for update of d skip locked
    limit greatest(1, least(coalesce(p_limit, 500), 1000))
  )
  update public.source_activity_deliveries d
  set status = 'SUPPRESSED',
      failure_code = 'STALE_ACTIVITY_TTL',
      failure_message = 'Official source activity is older than 24 hours; no stale push will be sent.',
      updated_at = now()
  from stale s
  where d.id = s.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke execute on function public.materialize_due_source_activity_targets(integer) from public, anon, authenticated;
grant execute on function public.materialize_due_source_activity_targets(integer) to service_role;
revoke execute on function public.expire_stale_source_activity_deliveries(integer) from public, anon, authenticated;
grant execute on function public.expire_stale_source_activity_deliveries(integer) to service_role;

-- Both tasks operate entirely within Postgres; no app credentials or HTTP
-- requests are needed. Refreshing findings makes older warnings resolve.
do $block$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job
    where jobname in (
      'cinerelay-source-activity-expiry',
      'cinerelay-source-maintenance-refresh'
    )
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$block$;

select cron.schedule(
  'cinerelay-source-activity-expiry',
  '*/10 * * * *',
  $job$select public.expire_stale_source_activity_deliveries(500);$job$
);

select cron.schedule(
  'cinerelay-source-maintenance-refresh',
  '*/15 * * * *',
  $job$select public.refresh_source_maintenance_findings();$job$
);
