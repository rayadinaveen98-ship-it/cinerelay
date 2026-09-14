begin;

create or replace function public.activate_connector_subscription(
  p_subscription_id uuid,
  p_lease_seconds integer,
  p_verified_at timestamptz,
  p_expires_at timestamptz,
  p_renew_after timestamptz
)
returns void
language plpgsql
as $$
declare
  subscription_provider text;
  subscription_source uuid;
  subscription_generation integer;
begin
  if p_lease_seconds <= 0 or p_expires_at <= p_verified_at or p_renew_after >= p_expires_at then
    raise exception 'invalid subscription lease';
  end if;

  select provider, source_identity_id, generation
    into subscription_provider, subscription_source, subscription_generation
  from public.connector_subscriptions
  where id = p_subscription_id
  for update;

  if subscription_provider is null then
    raise exception 'subscription not found';
  end if;

  update public.connector_subscriptions
  set state = 'SUPERSEDED', renew_after = null
  where provider = subscription_provider
    and source_identity_id = subscription_source
    and generation < subscription_generation
    and state in ('ACTIVE','RENEWING');

  update public.connector_subscriptions
  set state = 'ACTIVE',
      lease_seconds = p_lease_seconds,
      verified_at = p_verified_at,
      expires_at = p_expires_at,
      renew_after = p_renew_after,
      denied_at = null,
      last_error = null
  where id = p_subscription_id;

  insert into public.source_health (
    source_identity_id,
    health_state,
    last_attempt_at,
    last_success_at,
    subscription_expires_at,
    consecutive_failures,
    updated_at
  ) values (
    subscription_source,
    'HEALTHY',
    p_verified_at,
    p_verified_at,
    p_expires_at,
    0,
    p_verified_at
  )
  on conflict (source_identity_id) do update
    set subscription_expires_at = p_expires_at,
        last_attempt_at = p_verified_at,
        last_success_at = p_verified_at,
        health_state = case
          when public.source_health.last_error_code in (
            'WEBSUB_LEASE_EXPIRED',
            'WEBSUB_VERIFICATION_TIMEOUT',
            'WEBSUB_RENEW_REQUEST_FAILED',
            'WEBSUB_SUBSCRIBE_FAILED'
          ) then 'HEALTHY'
          else public.source_health.health_state
        end,
        consecutive_failures = case
          when public.source_health.last_error_code in (
            'WEBSUB_LEASE_EXPIRED',
            'WEBSUB_VERIFICATION_TIMEOUT',
            'WEBSUB_RENEW_REQUEST_FAILED',
            'WEBSUB_SUBSCRIBE_FAILED'
          ) then 0
          else public.source_health.consecutive_failures
        end,
        last_error_code = case
          when public.source_health.last_error_code in (
            'WEBSUB_LEASE_EXPIRED',
            'WEBSUB_VERIFICATION_TIMEOUT',
            'WEBSUB_RENEW_REQUEST_FAILED',
            'WEBSUB_SUBSCRIBE_FAILED'
          ) then null
          else public.source_health.last_error_code
        end,
        last_error_message = case
          when public.source_health.last_error_code in (
            'WEBSUB_LEASE_EXPIRED',
            'WEBSUB_VERIFICATION_TIMEOUT',
            'WEBSUB_RENEW_REQUEST_FAILED',
            'WEBSUB_SUBSCRIBE_FAILED'
          ) then null
          else public.source_health.last_error_message
        end,
        updated_at = p_verified_at;
end;
$$;

create or replace function public.deactivate_connector_subscription(p_subscription_id uuid)
returns void
language plpgsql
as $$
declare
  subscription_source uuid;
begin
  select source_identity_id into subscription_source
  from public.connector_subscriptions
  where id = p_subscription_id
  for update;

  if subscription_source is null then
    raise exception 'subscription not found';
  end if;

  update public.connector_subscriptions
  set state = 'INACTIVE', renew_after = null
  where id = p_subscription_id;

  update public.source_health
  set subscription_expires_at = null,
      updated_at = now()
  where source_identity_id = subscription_source;
end;
$$;

create or replace function public.record_youtube_websub_delivery(
  p_source_identity_id uuid,
  p_latest_video_id text,
  p_accepted_count integer,
  p_received_at timestamptz default now()
)
returns void
language plpgsql
as $$
begin
  if p_accepted_count <= 0 then
    raise exception 'accepted count must be positive';
  end if;
  if p_latest_video_id is null or p_latest_video_id !~ '^[A-Za-z0-9_-]{11}$' then
    raise exception 'invalid latest YouTube video id';
  end if;

  update public.youtube_channel_state
  set last_websub_at = p_received_at,
      latest_known_video_id = p_latest_video_id,
      consecutive_websub_events = consecutive_websub_events + p_accepted_count,
      updated_at = p_received_at
  where source_identity_id = p_source_identity_id;

  if not found then
    raise exception 'youtube channel state not found';
  end if;
end;
$$;

comment on function public.activate_connector_subscription is 'Activates a verified lease, supersedes older generations, and synchronizes WebSub-specific source health without hiding unrelated connector failures.';
comment on function public.record_youtube_websub_delivery is 'Atomically advances YouTube WebSub operational state and consecutive delivery count.';

commit;
