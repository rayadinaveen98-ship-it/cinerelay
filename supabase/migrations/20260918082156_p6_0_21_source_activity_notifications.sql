create table public.user_source_activity_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  include_videos boolean not null default true,
  include_shorts boolean not null default true,
  official_youtube_only boolean not null default true,
  activated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_source_activity_preferences_has_content check (include_videos or include_shorts)
);

create table public.source_activity_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_item_id uuid not null references public.raw_items(id) on delete cascade,
  source_identity_id uuid not null references public.source_identities(id) on delete cascade,
  dedupe_key text not null unique,
  status text not null default 'PENDING' check (status in ('PENDING','DEFERRED','SENT','FAILED','SUPPRESSED')),
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  failure_code text,
  failure_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, raw_item_id)
);

create index source_activity_deliveries_due_idx
  on public.source_activity_deliveries (scheduled_for, created_at)
  where status in ('PENDING','DEFERRED','FAILED');

create table public.source_activity_delivery_targets (
  id uuid primary key default gen_random_uuid(),
  source_activity_delivery_id uuid not null references public.source_activity_deliveries(id) on delete cascade,
  device_registration_id uuid not null references public.push_device_registrations(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','RETRY','LEASED','SENT','PERMANENT_FAILURE')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  leased_until timestamptz,
  last_attempt_at timestamptz,
  provider_message_id text,
  last_error_code text,
  last_error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_activity_delivery_id, device_registration_id)
);

create index source_activity_delivery_targets_due_idx
  on public.source_activity_delivery_targets (next_attempt_at, created_at)
  where status in ('PENDING','RETRY','LEASED');

alter table public.user_source_activity_preferences enable row level security;
alter table public.source_activity_deliveries enable row level security;
alter table public.source_activity_delivery_targets enable row level security;

create policy user_source_activity_preferences_select_own
  on public.user_source_activity_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy user_source_activity_preferences_insert_own
  on public.user_source_activity_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy user_source_activity_preferences_update_own
  on public.user_source_activity_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy user_source_activity_preferences_delete_own
  on public.user_source_activity_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);
create policy source_activity_deliveries_select_own
  on public.source_activity_deliveries for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.user_source_activity_preferences from anon, authenticated;
revoke all on table public.source_activity_deliveries from anon, authenticated;
revoke all on table public.source_activity_delivery_targets from anon, authenticated;
grant select, insert, update, delete on table public.user_source_activity_preferences to authenticated;
grant select on table public.source_activity_deliveries to authenticated;
grant all on table public.user_source_activity_preferences to service_role;
grant all on table public.source_activity_deliveries to service_role;
grant all on table public.source_activity_delivery_targets to service_role;

create or replace function public.plan_due_source_activity_notifications(p_limit integer default 200)
returns integer
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_count integer := 0;
begin
  with eligible as (
    select
      pref.user_id,
      ri.id as raw_item_id,
      ri.source_identity_id,
      ri.raw_title,
      ri.canonical_url,
      ri.published_at,
      ri.first_seen_at,
      s.display_name as source_name,
      s.source_role,
      case
        when lower(coalesce(ri.raw_title, '')) like '%#shorts%' then 'SHORT'
        else 'VIDEO'
      end as activity_kind,
      public.next_alert_allowed_at(
        now(),
        coalesce(ap.timezone_name, 'Asia/Kolkata'),
        coalesce(ap.quiet_hours_enabled, false),
        coalesce(ap.quiet_start_local, time '22:30'),
        coalesce(ap.quiet_end_local, time '08:00'),
        coalesce(ap.critical_bypass_quiet_hours, false),
        'HIGH'
      ) as scheduled_for
    from public.user_source_activity_preferences pref
    join public.raw_items ri
      on ri.first_seen_at >= pref.activated_at
     and ri.first_seen_at >= now() - interval '2 hours'
    join public.source_identities si on si.id = ri.source_identity_id
    join public.sources s on s.id = si.source_id
    left join public.user_alert_preferences ap on ap.user_id = pref.user_id
    where pref.enabled = true
      and pref.official_youtube_only = true
      and si.active = true
      and s.active = true
      and si.platform = 'YOUTUBE'
      and s.authority_tier = 1
      and s.source_role in ('PRODUCTION_HOUSE','MUSIC_LABEL')
      and ri.item_type = 'YOUTUBE_VIDEO'
      and ri.deleted_or_unavailable_at is null
      and coalesce(ri.published_at, ri.first_seen_at) >= ri.first_seen_at - interval '60 minutes'
      and (
        (lower(coalesce(ri.raw_title, '')) like '%#shorts%' and pref.include_shorts = true)
        or
        (lower(coalesce(ri.raw_title, '')) not like '%#shorts%' and pref.include_videos = true)
      )
      and not exists (
        select 1 from public.source_activity_deliveries d
        where d.user_id = pref.user_id and d.raw_item_id = ri.id
      )
    order by ri.first_seen_at asc
    limit greatest(1, least(coalesce(p_limit, 200), 500))
  )
  insert into public.source_activity_deliveries (
    user_id, raw_item_id, source_identity_id, dedupe_key, status, scheduled_for, payload
  )
  select
    e.user_id,
    e.raw_item_id,
    e.source_identity_id,
    'source-activity:' || e.user_id::text || ':' || e.raw_item_id::text,
    case when e.scheduled_for > now() + interval '1 second' then 'DEFERRED' else 'PENDING' end,
    e.scheduled_for,
    jsonb_build_object(
      'notificationClass', 'SOURCE_ACTIVITY',
      'rawItemId', e.raw_item_id,
      'sourceIdentityId', e.source_identity_id,
      'sourceName', e.source_name,
      'sourceRole', e.source_role,
      'platform', 'YOUTUBE',
      'activityKind', e.activity_kind,
      'headline', coalesce(nullif(btrim(coalesce(e.raw_title, '')), ''), 'New official YouTube upload'),
      'canonicalUrl', e.canonical_url,
      'publishedAt', e.published_at,
      'verificationState', 'OFFICIAL_SOURCE_ACTIVITY',
      'priorityBand', 'HIGH'
    )
  from eligible e
  on conflict (user_id, raw_item_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.materialize_due_source_activity_targets(p_limit integer default 100)
returns integer
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_count integer := 0;
begin
  with due_deliveries as (
    select d.id, d.user_id
    from public.source_activity_deliveries d
    where d.status in ('PENDING','DEFERRED','FAILED')
      and d.scheduled_for <= now()
    order by d.scheduled_for asc, d.created_at asc
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  )
  insert into public.source_activity_delivery_targets (
    source_activity_delivery_id, device_registration_id, status, next_attempt_at
  )
  select d.id, r.id, 'PENDING', now()
  from due_deliveries d
  join public.push_device_registrations r
    on r.user_id = d.user_id
   and r.provider = 'FCM'
   and r.target_kind = 'TOKEN'
   and r.active = true
  on conflict (source_activity_delivery_id, device_registration_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.lease_source_activity_targets(p_limit integer default 25, p_lease_seconds integer default 60)
returns table(
  target_id uuid,
  source_activity_delivery_id uuid,
  device_registration_id uuid,
  user_id uuid,
  target_kind text,
  target_value text,
  platform text,
  app_id text,
  payload jsonb,
  attempt_count integer,
  lease_token uuid,
  leased_until timestamptz
)
language plpgsql
set search_path to 'pg_catalog', 'public', 'extensions'
as $$
declare
  v_lease_token uuid := gen_random_uuid();
  v_lease_seconds integer := greatest(15, least(coalesce(p_lease_seconds, 60), 300));
begin
  return query
  with candidates as (
    select t.id
    from public.source_activity_delivery_targets t
    join public.source_activity_deliveries d on d.id = t.source_activity_delivery_id
    join public.push_device_registrations r on r.id = t.device_registration_id
    where d.status not in ('SENT','SUPPRESSED')
      and r.active = true
      and r.provider = 'FCM'
      and r.target_kind = 'TOKEN'
      and (
        (t.status in ('PENDING','RETRY') and t.next_attempt_at <= now())
        or (t.status = 'LEASED' and t.leased_until <= now())
      )
    order by t.next_attempt_at asc, t.created_at asc
    for update of t skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ), leased as (
    update public.source_activity_delivery_targets t
    set status = 'LEASED',
        lease_token = v_lease_token,
        leased_until = now() + make_interval(secs => v_lease_seconds),
        attempt_count = t.attempt_count + 1,
        last_attempt_at = now(),
        last_error_code = null,
        last_error_message = null,
        updated_at = now()
    from candidates c
    where t.id = c.id
    returning t.*
  )
  select
    l.id,
    l.source_activity_delivery_id,
    l.device_registration_id,
    d.user_id,
    r.target_kind,
    r.target_value,
    r.platform,
    r.app_id,
    d.payload,
    l.attempt_count,
    l.lease_token,
    l.leased_until
  from leased l
  join public.source_activity_deliveries d on d.id = l.source_activity_delivery_id
  join public.push_device_registrations r on r.id = l.device_registration_id;
end;
$$;

create or replace function public.complete_source_activity_target(
  p_target_id uuid,
  p_lease_token uuid,
  p_outcome text,
  p_provider_message_id text default null,
  p_error_code text default null,
  p_error_message text default null,
  p_retry_after_seconds integer default null
)
returns jsonb
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_target public.source_activity_delivery_targets%rowtype;
  v_outcome text := upper(btrim(coalesce(p_outcome, '')));
  v_retry_seconds integer;
  v_has_open boolean;
  v_has_sent boolean;
  v_parent_status text;
begin
  select * into v_target
  from public.source_activity_delivery_targets
  where id = p_target_id
  for update;

  if v_target.id is null then raise exception 'source_activity_target_not_found'; end if;
  if v_target.status <> 'LEASED' or v_target.lease_token is distinct from p_lease_token then
    raise exception 'source_activity_lease_mismatch';
  end if;

  if v_outcome = 'SENT' then
    update public.source_activity_delivery_targets
    set status = 'SENT', lease_token = null, leased_until = null,
        provider_message_id = nullif(btrim(coalesce(p_provider_message_id, '')), ''),
        last_error_code = null, last_error_message = null, sent_at = now(), updated_at = now()
    where id = v_target.id;
    update public.push_device_registrations
    set last_success_at = now(), last_seen_at = now()
    where id = v_target.device_registration_id;
  elsif v_outcome = 'INVALID_REGISTRATION' then
    update public.source_activity_delivery_targets
    set status = 'PERMANENT_FAILURE', lease_token = null, leased_until = null,
        last_error_code = coalesce(nullif(btrim(coalesce(p_error_code, '')), ''), 'FCM_UNREGISTERED'),
        last_error_message = left(coalesce(p_error_message, ''), 1000), updated_at = now()
    where id = v_target.id;
    update public.push_device_registrations
    set active = false, disabled_at = now(),
        disable_reason = coalesce(nullif(btrim(coalesce(p_error_code, '')), ''), 'FCM_UNREGISTERED')
    where id = v_target.device_registration_id;
  elsif v_outcome = 'PERMANENT_ERROR' then
    update public.source_activity_delivery_targets
    set status = 'PERMANENT_FAILURE', lease_token = null, leased_until = null,
        last_error_code = coalesce(nullif(btrim(coalesce(p_error_code, '')), ''), 'PROVIDER_PERMANENT_ERROR'),
        last_error_message = left(coalesce(p_error_message, ''), 1000), updated_at = now()
    where id = v_target.id;
  elsif v_outcome = 'TRANSIENT_ERROR' then
    if v_target.attempt_count >= 5 then
      update public.source_activity_delivery_targets
      set status = 'PERMANENT_FAILURE', lease_token = null, leased_until = null,
          last_error_code = 'RETRY_EXHAUSTED:' || coalesce(nullif(btrim(coalesce(p_error_code, '')), ''), 'TRANSIENT'),
          last_error_message = left(coalesce(p_error_message, ''), 1000), updated_at = now()
      where id = v_target.id;
    else
      v_retry_seconds := case v_target.attempt_count when 1 then 60 when 2 then 300 when 3 then 1800 else 7200 end;
      if p_retry_after_seconds is not null then
        v_retry_seconds := greatest(v_retry_seconds, greatest(30, least(p_retry_after_seconds, 86400)));
      end if;
      update public.source_activity_delivery_targets
      set status = 'RETRY', lease_token = null, leased_until = null,
          next_attempt_at = now() + make_interval(secs => v_retry_seconds),
          last_error_code = coalesce(nullif(btrim(coalesce(p_error_code, '')), ''), 'PROVIDER_TRANSIENT_ERROR'),
          last_error_message = left(coalesce(p_error_message, ''), 1000), updated_at = now()
      where id = v_target.id;
    end if;
  else
    raise exception 'source_activity_outcome_invalid';
  end if;

  select coalesce(bool_or(status in ('PENDING','RETRY','LEASED')), false),
         coalesce(bool_or(status = 'SENT'), false)
  into v_has_open, v_has_sent
  from public.source_activity_delivery_targets
  where source_activity_delivery_id = v_target.source_activity_delivery_id;

  if not v_has_open then
    if v_has_sent then
      update public.source_activity_deliveries
      set status = 'SENT', sent_at = coalesce(sent_at, now()), failure_code = null, failure_message = null, updated_at = now()
      where id = v_target.source_activity_delivery_id and status <> 'SUPPRESSED';
      v_parent_status := 'SENT';
    else
      update public.source_activity_deliveries
      set status = 'FAILED', failure_code = 'ALL_DEVICE_TARGETS_FAILED',
          failure_message = 'All materialized source-activity device targets reached permanent failure.', updated_at = now()
      where id = v_target.source_activity_delivery_id and status <> 'SUPPRESSED';
      v_parent_status := 'FAILED';
    end if;
  else
    select status into v_parent_status
    from public.source_activity_deliveries
    where id = v_target.source_activity_delivery_id;
  end if;

  return jsonb_build_object(
    'targetId', v_target.id,
    'sourceActivityDeliveryId', v_target.source_activity_delivery_id,
    'outcome', v_outcome,
    'parentStatus', v_parent_status
  );
end;
$$;

revoke execute on function public.plan_due_source_activity_notifications(integer) from public, anon, authenticated;
revoke execute on function public.materialize_due_source_activity_targets(integer) from public, anon, authenticated;
revoke execute on function public.lease_source_activity_targets(integer,integer) from public, anon, authenticated;
revoke execute on function public.complete_source_activity_target(uuid,uuid,text,text,text,text,integer) from public, anon, authenticated;

grant execute on function public.plan_due_source_activity_notifications(integer) to service_role;
grant execute on function public.materialize_due_source_activity_targets(integer) to service_role;
grant execute on function public.lease_source_activity_targets(integer,integer) to service_role;
grant execute on function public.complete_source_activity_target(uuid,uuid,text,text,text,text,integer) to service_role;
