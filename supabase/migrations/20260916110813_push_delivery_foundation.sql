begin;

create table public.push_device_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'FCM' check (provider in ('FCM')),
  target_kind text not null default 'TOKEN' check (target_kind in ('TOKEN','FID')),
  target_value text not null check (char_length(target_value) between 20 and 4096),
  platform text not null check (platform in ('ANDROID','IOS','WEB')),
  installation_id text check (installation_id is null or char_length(installation_id) between 1 and 255),
  app_id text not null default 'cinerelay' check (char_length(app_id) between 1 and 200),
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  last_success_at timestamptz,
  disabled_at timestamptz,
  disable_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, target_value)
);

create unique index push_device_registrations_active_installation_idx
  on public.push_device_registrations (user_id, provider, installation_id)
  where active = true and installation_id is not null;

create index push_device_registrations_user_active_idx
  on public.push_device_registrations (user_id, provider, active, last_seen_at desc);

create table public.push_delivery_targets (
  id uuid primary key default gen_random_uuid(),
  alert_delivery_id uuid not null references public.alert_deliveries(id) on delete cascade,
  device_registration_id uuid not null references public.push_device_registrations(id),
  status text not null default 'PENDING'
    check (status in ('PENDING','LEASED','RETRY','SENT','PERMANENT_FAILURE')),
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
  unique (alert_delivery_id, device_registration_id),
  check ((status = 'LEASED') = (lease_token is not null and leased_until is not null))
);

create index push_delivery_targets_due_idx
  on public.push_delivery_targets (status, next_attempt_at, leased_until, created_at)
  where status in ('PENDING','RETRY','LEASED');

create index push_delivery_targets_alert_idx
  on public.push_delivery_targets (alert_delivery_id, status);

create trigger push_device_registrations_set_updated_at
before update on public.push_device_registrations
for each row execute function public.set_updated_at();

create trigger push_delivery_targets_set_updated_at
before update on public.push_delivery_targets
for each row execute function public.set_updated_at();

create or replace function public.upsert_push_device_registration(
  p_user_id uuid,
  p_provider text,
  p_target_kind text,
  p_target_value text,
  p_platform text,
  p_installation_id text default null,
  p_app_id text default 'cinerelay'
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
declare
  v_id uuid;
  v_provider text := upper(btrim(coalesce(p_provider, '')));
  v_target_kind text := upper(btrim(coalesce(p_target_kind, '')));
  v_platform text := upper(btrim(coalesce(p_platform, '')));
  v_target text := btrim(coalesce(p_target_value, ''));
  v_installation text := nullif(btrim(coalesce(p_installation_id, '')), '');
  v_app_id text := btrim(coalesce(p_app_id, ''));
begin
  if p_user_id is null then raise exception 'push_user_required'; end if;
  if v_provider <> 'FCM' then raise exception 'push_provider_unsupported'; end if;
  if v_target_kind not in ('TOKEN','FID') then raise exception 'push_target_kind_invalid'; end if;
  if char_length(v_target) < 20 or char_length(v_target) > 4096 then raise exception 'push_target_invalid'; end if;
  if v_platform not in ('ANDROID','IOS','WEB') then raise exception 'push_platform_invalid'; end if;
  if v_installation is not null and char_length(v_installation) > 255 then raise exception 'push_installation_invalid'; end if;
  if char_length(v_app_id) < 1 or char_length(v_app_id) > 200 then raise exception 'push_app_id_invalid'; end if;

  if v_installation is not null then
    update public.push_device_registrations
    set active = false,
        disabled_at = now(),
        disable_reason = 'REGISTRATION_ROTATED'
    where user_id = p_user_id
      and provider = v_provider
      and installation_id = v_installation
      and active = true
      and target_value <> v_target;
  end if;

  insert into public.push_device_registrations (
    user_id, provider, target_kind, target_value, platform,
    installation_id, app_id, active, last_seen_at, disabled_at, disable_reason
  ) values (
    p_user_id, v_provider, v_target_kind, v_target, v_platform,
    v_installation, v_app_id, true, now(), null, null
  )
  on conflict (provider, target_value) do update
    set user_id = excluded.user_id,
        target_kind = excluded.target_kind,
        platform = excluded.platform,
        installation_id = excluded.installation_id,
        app_id = excluded.app_id,
        active = true,
        last_seen_at = now(),
        disabled_at = null,
        disable_reason = null,
        updated_at = now()
  returning id into v_id;

  return jsonb_build_object(
    'registrationId', v_id,
    'provider', v_provider,
    'targetKind', v_target_kind,
    'platform', v_platform,
    'installationId', v_installation,
    'active', true
  );
end;
$$;

create or replace function public.deactivate_push_device_registration(
  p_user_id uuid,
  p_registration_id uuid,
  p_reason text default 'USER_UNREGISTERED'
)
returns boolean
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  if p_user_id is null or p_registration_id is null then raise exception 'push_registration_required'; end if;

  update public.push_device_registrations
  set active = false,
      disabled_at = now(),
      disable_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'USER_UNREGISTERED')
  where id = p_registration_id
    and user_id = p_user_id
    and active = true;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.materialize_due_push_targets(p_limit integer default 100)
returns integer
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_count integer := 0;
begin
  with due_alerts as (
    select d.id, d.user_id
    from public.alert_deliveries d
    where d.delivery_kind = 'PUSH'
      and d.status in ('PENDING','DEFERRED','FAILED')
      and d.scheduled_for <= now()
    order by d.scheduled_for asc, d.created_at asc
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  )
  insert into public.push_delivery_targets (
    alert_delivery_id, device_registration_id, status, next_attempt_at
  )
  select d.id, r.id, 'PENDING', now()
  from due_alerts d
  join public.push_device_registrations r
    on r.user_id = d.user_id
   and r.provider = 'FCM'
   and r.target_kind = 'TOKEN'
   and r.active = true
  on conflict (alert_delivery_id, device_registration_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.lease_push_delivery_targets(
  p_limit integer default 25,
  p_lease_seconds integer default 60
)
returns table (
  target_id uuid,
  alert_delivery_id uuid,
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
set search_path = pg_catalog, public, extensions
as $$
declare
  v_lease_token uuid := gen_random_uuid();
  v_lease_seconds integer := greatest(15, least(coalesce(p_lease_seconds, 60), 300));
begin
  return query
  with candidates as (
    select t.id
    from public.push_delivery_targets t
    join public.alert_deliveries d on d.id = t.alert_delivery_id
    join public.push_device_registrations r on r.id = t.device_registration_id
    where d.delivery_kind = 'PUSH'
      and d.status not in ('SENT','SUPPRESSED')
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
    update public.push_delivery_targets t
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
    l.alert_delivery_id,
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
  join public.alert_deliveries d on d.id = l.alert_delivery_id
  join public.push_device_registrations r on r.id = l.device_registration_id;
end;
$$;

create or replace function public.complete_push_delivery_target(
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
set search_path = pg_catalog, public
as $$
declare
  v_target public.push_delivery_targets%rowtype;
  v_outcome text := upper(btrim(coalesce(p_outcome, '')));
  v_retry_seconds integer;
  v_has_open boolean;
  v_has_sent boolean;
  v_parent_status text;
begin
  select * into v_target
  from public.push_delivery_targets
  where id = p_target_id
  for update;

  if v_target.id is null then raise exception 'push_target_not_found'; end if;
  if v_target.status <> 'LEASED' or v_target.lease_token is distinct from p_lease_token then
    raise exception 'push_lease_mismatch';
  end if;

  if v_outcome = 'SENT' then
    update public.push_delivery_targets
    set status = 'SENT',
        lease_token = null,
        leased_until = null,
        provider_message_id = nullif(btrim(coalesce(p_provider_message_id, '')), ''),
        last_error_code = null,
        last_error_message = null,
        sent_at = now(),
        updated_at = now()
    where id = v_target.id;

    update public.push_device_registrations
    set last_success_at = now(), last_seen_at = now()
    where id = v_target.device_registration_id;

  elsif v_outcome = 'INVALID_REGISTRATION' then
    update public.push_delivery_targets
    set status = 'PERMANENT_FAILURE',
        lease_token = null,
        leased_until = null,
        last_error_code = coalesce(nullif(btrim(coalesce(p_error_code, '')), ''), 'FCM_UNREGISTERED'),
        last_error_message = left(coalesce(p_error_message, ''), 1000),
        updated_at = now()
    where id = v_target.id;

    update public.push_device_registrations
    set active = false,
        disabled_at = now(),
        disable_reason = coalesce(nullif(btrim(coalesce(p_error_code, '')), ''), 'FCM_UNREGISTERED')
    where id = v_target.device_registration_id;

  elsif v_outcome = 'PERMANENT_ERROR' then
    update public.push_delivery_targets
    set status = 'PERMANENT_FAILURE',
        lease_token = null,
        leased_until = null,
        last_error_code = coalesce(nullif(btrim(coalesce(p_error_code, '')), ''), 'PROVIDER_PERMANENT_ERROR'),
        last_error_message = left(coalesce(p_error_message, ''), 1000),
        updated_at = now()
    where id = v_target.id;

  elsif v_outcome = 'TRANSIENT_ERROR' then
    if v_target.attempt_count >= 5 then
      update public.push_delivery_targets
      set status = 'PERMANENT_FAILURE',
          lease_token = null,
          leased_until = null,
          last_error_code = 'RETRY_EXHAUSTED:' || coalesce(nullif(btrim(coalesce(p_error_code, '')), ''), 'TRANSIENT'),
          last_error_message = left(coalesce(p_error_message, ''), 1000),
          updated_at = now()
      where id = v_target.id;
    else
      v_retry_seconds := case v_target.attempt_count
        when 1 then 60
        when 2 then 300
        when 3 then 1800
        else 7200
      end;
      if p_retry_after_seconds is not null then
        v_retry_seconds := greatest(v_retry_seconds, greatest(30, least(p_retry_after_seconds, 86400)));
      end if;

      update public.push_delivery_targets
      set status = 'RETRY',
          lease_token = null,
          leased_until = null,
          next_attempt_at = now() + make_interval(secs => v_retry_seconds),
          last_error_code = coalesce(nullif(btrim(coalesce(p_error_code, '')), ''), 'PROVIDER_TRANSIENT_ERROR'),
          last_error_message = left(coalesce(p_error_message, ''), 1000),
          updated_at = now()
      where id = v_target.id;
    end if;
  else
    raise exception 'push_outcome_invalid';
  end if;

  select
    coalesce(bool_or(status in ('PENDING','RETRY','LEASED')), false),
    coalesce(bool_or(status = 'SENT'), false)
  into v_has_open, v_has_sent
  from public.push_delivery_targets
  where alert_delivery_id = v_target.alert_delivery_id;

  if not v_has_open then
    if v_has_sent then
      update public.alert_deliveries
      set status = 'SENT',
          sent_at = coalesce(sent_at, now()),
          failure_code = null,
          failure_message = null,
          updated_at = now()
      where id = v_target.alert_delivery_id
        and status <> 'SUPPRESSED';
      v_parent_status := 'SENT';
    else
      update public.alert_deliveries
      set status = 'FAILED',
          failure_code = 'ALL_DEVICE_TARGETS_FAILED',
          failure_message = 'All materialized push-device targets reached permanent failure.',
          updated_at = now()
      where id = v_target.alert_delivery_id
        and status <> 'SUPPRESSED';
      v_parent_status := 'FAILED';
    end if;
  else
    select status into v_parent_status
    from public.alert_deliveries
    where id = v_target.alert_delivery_id;
  end if;

  return jsonb_build_object(
    'targetId', v_target.id,
    'alertDeliveryId', v_target.alert_delivery_id,
    'outcome', v_outcome,
    'parentStatus', v_parent_status
  );
end;
$$;

alter table public.push_device_registrations enable row level security;
alter table public.push_delivery_targets enable row level security;

revoke all on table public.push_device_registrations from public, anon, authenticated;
revoke all on table public.push_delivery_targets from public, anon, authenticated;
grant select, insert, update, delete on public.push_device_registrations to service_role;
grant select, insert, update, delete on public.push_delivery_targets to service_role;

revoke all on function public.upsert_push_device_registration(uuid,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.deactivate_push_device_registration(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.materialize_due_push_targets(integer) from public, anon, authenticated;
revoke all on function public.lease_push_delivery_targets(integer,integer) from public, anon, authenticated;
revoke all on function public.complete_push_delivery_target(uuid,uuid,text,text,text,text,integer) from public, anon, authenticated;

grant execute on function public.upsert_push_device_registration(uuid,text,text,text,text,text,text) to service_role;
grant execute on function public.deactivate_push_device_registration(uuid,uuid,text) to service_role;
grant execute on function public.materialize_due_push_targets(integer) to service_role;
grant execute on function public.lease_push_delivery_targets(integer,integer) to service_role;
grant execute on function public.complete_push_delivery_target(uuid,uuid,text,text,text,text,integer) to service_role;

comment on table public.push_device_registrations is
  'Service-owned push registration inventory. Raw provider targets are never directly exposed to authenticated clients.';
comment on table public.push_delivery_targets is
  'Per-device durable push delivery state. One user alert fans out idempotently to active device registrations and retries independently per device.';
comment on function public.lease_push_delivery_targets(integer,integer) is
  'Leases due push targets with SKIP LOCKED and an expiring lease token so concurrent workers cannot double-send the same target.';
comment on function public.complete_push_delivery_target(uuid,uuid,text,text,text,text,integer) is
  'Completes a leased push target, applies bounded retry/backoff, deactivates invalid registrations and aggregates terminal child state back to the user alert.';

commit;
