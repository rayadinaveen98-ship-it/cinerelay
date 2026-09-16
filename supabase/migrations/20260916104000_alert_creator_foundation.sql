begin;

create table public.user_entity_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entity_id)
);

create index user_entity_follows_entity_active_idx
  on public.user_entity_follows (entity_id, user_id)
  where active = true;

create table public.user_alert_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alert_mode text not null default 'INSTANT'
    check (alert_mode in ('INSTANT','DIGEST','BOTH','MUTED')),
  minimum_priority_band text not null default 'HIGH'
    check (minimum_priority_band in ('CRITICAL','HIGH','NORMAL','LOW')),
  include_developing boolean not null default true,
  include_rumors boolean not null default false,
  quiet_hours_enabled boolean not null default false,
  quiet_start_local time not null default time '22:30',
  quiet_end_local time not null default time '08:00',
  timezone_name text not null default 'Asia/Kolkata'
    check (char_length(timezone_name) between 1 and 80),
  critical_bypass_quiet_hours boolean not null default false,
  digest_hour_local smallint not null default 9 check (digest_hour_local between 0 and 23),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quiet_start_local <> quiet_end_local)
);

create table public.user_alert_event_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null references public.event_types(code) on delete cascade,
  enabled boolean not null default true,
  mode_override text check (mode_override is null or mode_override in ('INSTANT','DIGEST','BOTH','MUTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_type)
);

create table public.alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  delivery_kind text not null check (delivery_kind in ('PUSH','DIGEST')),
  dedupe_key text not null unique,
  status text not null default 'PENDING'
    check (status in ('PENDING','DEFERRED','SENT','FAILED','SUPPRESSED')),
  scheduled_for timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  failure_code text,
  failure_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index alert_deliveries_due_idx
  on public.alert_deliveries (status, scheduled_for, created_at)
  where status in ('PENDING','DEFERRED','FAILED');
create index alert_deliveries_user_created_idx
  on public.alert_deliveries (user_id, created_at desc);
create index alert_deliveries_event_idx
  on public.alert_deliveries (event_id);

create trigger user_entity_follows_set_updated_at
before update on public.user_entity_follows
for each row execute function public.set_updated_at();

create trigger user_alert_preferences_set_updated_at
before update on public.user_alert_preferences
for each row execute function public.set_updated_at();

create trigger user_alert_event_preferences_set_updated_at
before update on public.user_alert_event_preferences
for each row execute function public.set_updated_at();

create trigger alert_deliveries_set_updated_at
before update on public.alert_deliveries
for each row execute function public.set_updated_at();

create or replace function public.validate_alert_timezone()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = new.timezone_name
  ) then
    raise exception 'invalid_alert_timezone';
  end if;
  return new;
end;
$$;

create trigger user_alert_preferences_validate_timezone
before insert or update of timezone_name on public.user_alert_preferences
for each row execute function public.validate_alert_timezone();

create or replace function public.alert_priority_rank(p_band text)
returns integer
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case p_band
    when 'CRITICAL' then 0
    when 'HIGH' then 1
    when 'NORMAL' then 2
    when 'LOW' then 3
    when 'SUPPRESSED' then 99
    else 99
  end;
$$;

create or replace function public.next_alert_allowed_at(
  p_now timestamptz,
  p_timezone text,
  p_enabled boolean,
  p_start time,
  p_end time,
  p_critical_bypass boolean,
  p_priority_band text
)
returns timestamptz
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  v_local timestamp without time zone;
  v_local_time time;
  v_end_local timestamp without time zone;
  v_in_quiet boolean := false;
begin
  if not coalesce(p_enabled, false)
     or (coalesce(p_critical_bypass, false) and p_priority_band = 'CRITICAL') then
    return p_now;
  end if;

  v_local := timezone(p_timezone, p_now);
  v_local_time := v_local::time;

  if p_start < p_end then
    v_in_quiet := v_local_time >= p_start and v_local_time < p_end;
    if v_in_quiet then
      v_end_local := v_local::date + p_end;
    end if;
  else
    v_in_quiet := v_local_time >= p_start or v_local_time < p_end;
    if v_in_quiet then
      if v_local_time >= p_start then
        v_end_local := (v_local::date + 1) + p_end;
      else
        v_end_local := v_local::date + p_end;
      end if;
    end if;
  end if;

  if not v_in_quiet then return p_now; end if;
  return v_end_local at time zone p_timezone;
end;
$$;

create or replace function public.next_alert_digest_at(
  p_now timestamptz,
  p_timezone text,
  p_digest_hour smallint
)
returns timestamptz
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  v_local timestamp without time zone;
  v_target timestamp without time zone;
begin
  v_local := timezone(p_timezone, p_now);
  v_target := v_local::date + make_interval(hours => p_digest_hour::integer);
  if v_target <= v_local then
    v_target := v_target + interval '1 day';
  end if;
  return v_target at time zone p_timezone;
end;
$$;

create or replace function public.plan_event_alerts(p_event_id uuid)
returns integer
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
declare
  v_event public.events%rowtype;
  v_push integer := 0;
  v_digest integer := 0;
  v_now timestamptz := now();
begin
  select * into v_event
  from public.events
  where id = p_event_id;

  if v_event.id is null then raise exception 'alert_event_not_found'; end if;
  if v_event.status <> 'ACTIVE' or v_event.priority_band = 'SUPPRESSED' then return 0; end if;

  with eligible as (
    select
      f.user_id,
      coalesce(p.alert_mode, 'INSTANT') as alert_mode,
      coalesce(p.minimum_priority_band, 'HIGH') as minimum_priority_band,
      coalesce(p.include_developing, true) as include_developing,
      coalesce(p.include_rumors, false) as include_rumors,
      coalesce(p.quiet_hours_enabled, false) as quiet_hours_enabled,
      coalesce(p.quiet_start_local, time '22:30') as quiet_start_local,
      coalesce(p.quiet_end_local, time '08:00') as quiet_end_local,
      coalesce(p.timezone_name, 'Asia/Kolkata') as timezone_name,
      coalesce(p.critical_bypass_quiet_hours, false) as critical_bypass_quiet_hours,
      coalesce(p.digest_hour_local, 9) as digest_hour_local,
      coalesce(ep.enabled, true) as event_enabled,
      coalesce(ep.mode_override, p.alert_mode, 'INSTANT') as effective_mode
    from public.user_entity_follows f
    left join public.user_alert_preferences p on p.user_id = f.user_id
    left join public.user_alert_event_preferences ep
      on ep.user_id = f.user_id and ep.event_type = v_event.event_type
    where f.entity_id = v_event.primary_entity_id
      and f.active = true
      and f.created_at <= v_event.created_at
  ), push_rows as (
    select
      e.*,
      public.next_alert_allowed_at(
        v_now, e.timezone_name, e.quiet_hours_enabled,
        e.quiet_start_local, e.quiet_end_local,
        e.critical_bypass_quiet_hours, v_event.priority_band
      ) as scheduled_for
    from eligible e
    where e.event_enabled = true
      and e.effective_mode in ('INSTANT','BOTH')
      and public.alert_priority_rank(v_event.priority_band) <= public.alert_priority_rank(e.minimum_priority_band)
      and (v_event.verification_state <> 'RUMOR' or e.include_rumors)
      and (v_event.verification_state <> 'DEVELOPING' or e.include_developing)
  )
  insert into public.alert_deliveries (
    user_id, event_id, delivery_kind, dedupe_key, status, scheduled_for, payload
  )
  select
    r.user_id,
    v_event.id,
    'PUSH',
    'alert:' || r.user_id::text || ':' || v_event.id::text || ':push',
    case when r.scheduled_for > v_now + interval '1 second' then 'DEFERRED' else 'PENDING' end,
    r.scheduled_for,
    jsonb_build_object(
      'eventId', v_event.id,
      'entityId', v_event.primary_entity_id,
      'eventType', v_event.event_type,
      'verificationState', v_event.verification_state,
      'priorityBand', v_event.priority_band,
      'headline', v_event.headline
    )
  from push_rows r
  on conflict (dedupe_key) do nothing;
  get diagnostics v_push = row_count;

  with eligible as (
    select
      f.user_id,
      coalesce(p.alert_mode, 'INSTANT') as alert_mode,
      coalesce(p.minimum_priority_band, 'HIGH') as minimum_priority_band,
      coalesce(p.include_developing, true) as include_developing,
      coalesce(p.include_rumors, false) as include_rumors,
      coalesce(p.quiet_hours_enabled, false) as quiet_hours_enabled,
      coalesce(p.quiet_start_local, time '22:30') as quiet_start_local,
      coalesce(p.quiet_end_local, time '08:00') as quiet_end_local,
      coalesce(p.timezone_name, 'Asia/Kolkata') as timezone_name,
      coalesce(p.critical_bypass_quiet_hours, false) as critical_bypass_quiet_hours,
      coalesce(p.digest_hour_local, 9) as digest_hour_local,
      coalesce(ep.enabled, true) as event_enabled,
      coalesce(ep.mode_override, p.alert_mode, 'INSTANT') as effective_mode
    from public.user_entity_follows f
    left join public.user_alert_preferences p on p.user_id = f.user_id
    left join public.user_alert_event_preferences ep
      on ep.user_id = f.user_id and ep.event_type = v_event.event_type
    where f.entity_id = v_event.primary_entity_id
      and f.active = true
      and f.created_at <= v_event.created_at
  ), digest_rows as (
    select
      e.*,
      public.next_alert_allowed_at(
        public.next_alert_digest_at(v_now, e.timezone_name, e.digest_hour_local),
        e.timezone_name, e.quiet_hours_enabled,
        e.quiet_start_local, e.quiet_end_local,
        e.critical_bypass_quiet_hours, v_event.priority_band
      ) as scheduled_for
    from eligible e
    where e.event_enabled = true
      and e.effective_mode in ('DIGEST','BOTH')
      and public.alert_priority_rank(v_event.priority_band) <= public.alert_priority_rank(e.minimum_priority_band)
      and (v_event.verification_state <> 'RUMOR' or e.include_rumors)
      and (v_event.verification_state <> 'DEVELOPING' or e.include_developing)
  )
  insert into public.alert_deliveries (
    user_id, event_id, delivery_kind, dedupe_key, status, scheduled_for, payload
  )
  select
    r.user_id,
    v_event.id,
    'DIGEST',
    'alert:' || r.user_id::text || ':' || v_event.id::text || ':digest',
    'DEFERRED',
    r.scheduled_for,
    jsonb_build_object(
      'eventId', v_event.id,
      'entityId', v_event.primary_entity_id,
      'eventType', v_event.event_type,
      'verificationState', v_event.verification_state,
      'priorityBand', v_event.priority_band,
      'headline', v_event.headline
    )
  from digest_rows r
  on conflict (dedupe_key) do nothing;
  get diagnostics v_digest = row_count;

  return v_push + v_digest;
end;
$$;

-- Integrate alert planning at the canonical event boundary. Repeated evidence calls
-- are safe because alert_deliveries has a stable per-user/event/kind dedupe key.
create or replace function public.upsert_canonical_event_with_evidence(
  p_event_id uuid,
  p_primary_entity_id uuid,
  p_event_type text,
  p_verification_state text,
  p_priority_band text,
  p_headline text,
  p_structured_data jsonb,
  p_dedupe_key text,
  p_classifier_version text,
  p_raw_item_id uuid
)
returns uuid
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
declare
  result_id uuid;
  had_evidence boolean;
begin
  if p_verification_state not in ('OFFICIAL','CONFIRMED','RELIABLE_REPORT','DEVELOPING','RUMOR') then
    raise exception 'invalid verification state';
  end if;
  if p_priority_band not in ('CRITICAL','HIGH','NORMAL','LOW','SUPPRESSED') then
    raise exception 'invalid priority band';
  end if;

  insert into public.events (
    id, primary_entity_id, event_type, event_schema_version, detected_at,
    verification_state, priority_band, headline, structured_data,
    dedupe_key, status, classifier_version
  ) values (
    p_event_id, p_primary_entity_id, p_event_type, 1, now(),
    p_verification_state, p_priority_band, p_headline,
    coalesce(p_structured_data, '{}'::jsonb), p_dedupe_key,
    'ACTIVE', p_classifier_version
  )
  on conflict (dedupe_key) do update
    set verification_state = case
          when public.verification_rank(excluded.verification_state) < public.verification_rank(public.events.verification_state)
            then excluded.verification_state
          else public.events.verification_state
        end,
        priority_band = case
          when excluded.priority_band = 'CRITICAL' then 'CRITICAL'
          when public.events.priority_band = 'CRITICAL' then public.events.priority_band
          when excluded.priority_band = 'HIGH' then 'HIGH'
          when public.events.priority_band = 'HIGH' then public.events.priority_band
          when excluded.priority_band = 'NORMAL' then 'NORMAL'
          else public.events.priority_band
        end,
        headline = excluded.headline,
        structured_data = excluded.structured_data,
        classifier_version = excluded.classifier_version,
        updated_at = now()
  returning id into result_id;

  select exists(select 1 from public.event_evidence where event_id = result_id)
    into had_evidence;

  insert into public.event_evidence (event_id, raw_item_id, evidence_role, weight)
  values (result_id, p_raw_item_id, case when had_evidence then 'REPEAT' else 'PRIMARY' end, 1)
  on conflict (event_id, raw_item_id) do nothing;

  perform public.plan_event_alerts(result_id);
  return result_id;
end;
$$;

alter table public.user_entity_follows enable row level security;
alter table public.user_alert_preferences enable row level security;
alter table public.user_alert_event_preferences enable row level security;
alter table public.alert_deliveries enable row level security;

revoke all on table public.user_entity_follows from public, anon, authenticated;
revoke all on table public.user_alert_preferences from public, anon, authenticated;
revoke all on table public.user_alert_event_preferences from public, anon, authenticated;
revoke all on table public.alert_deliveries from public, anon, authenticated;

grant select, insert, update, delete on public.user_entity_follows to authenticated;
grant select, insert, update, delete on public.user_alert_preferences to authenticated;
grant select, insert, update, delete on public.user_alert_event_preferences to authenticated;
grant select on public.alert_deliveries to authenticated;

grant select, insert, update, delete on public.user_entity_follows to service_role;
grant select, insert, update, delete on public.user_alert_preferences to service_role;
grant select, insert, update, delete on public.user_alert_event_preferences to service_role;
grant select, insert, update, delete on public.alert_deliveries to service_role;

create policy user_entity_follows_select_own
  on public.user_entity_follows for select to authenticated
  using ((select auth.uid()) = user_id);
create policy user_entity_follows_insert_own
  on public.user_entity_follows for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy user_entity_follows_update_own
  on public.user_entity_follows for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy user_entity_follows_delete_own
  on public.user_entity_follows for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy user_alert_preferences_select_own
  on public.user_alert_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy user_alert_preferences_insert_own
  on public.user_alert_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy user_alert_preferences_update_own
  on public.user_alert_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy user_alert_preferences_delete_own
  on public.user_alert_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy user_alert_event_preferences_select_own
  on public.user_alert_event_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy user_alert_event_preferences_insert_own
  on public.user_alert_event_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy user_alert_event_preferences_update_own
  on public.user_alert_event_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy user_alert_event_preferences_delete_own
  on public.user_alert_event_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy alert_deliveries_select_own
  on public.alert_deliveries for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on function public.plan_event_alerts(uuid) from public, anon, authenticated;
grant execute on function public.plan_event_alerts(uuid) to service_role;

comment on table public.user_entity_follows is
  'Per-user entity follow graph. Alerts are planned only for active follows that existed when a canonical event was first created.';
comment on table public.user_alert_preferences is
  'Per-user alert defaults for priority, verification, quiet hours and digest scheduling. Defaults are high-priority instant alerts with rumors disabled.';
comment on table public.user_alert_event_preferences is
  'Optional per-event-type overrides layered on top of the user alert defaults.';
comment on table public.alert_deliveries is
  'Idempotent alert outbox. P5 delivery workers consume due rows; event processing never sends directly to FCM.';
comment on function public.plan_event_alerts(uuid) is
  'Plans deduplicated PUSH/DIGEST outbox rows from a canonical event and the follow/preference graph. No external delivery occurs here.';

commit;
