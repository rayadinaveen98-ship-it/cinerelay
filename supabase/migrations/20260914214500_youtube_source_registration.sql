begin;

create or replace function public.register_youtube_source(
  p_channel_id text,
  p_display_name text,
  p_custom_url text,
  p_uploads_playlist_id text,
  p_authority_tier smallint,
  p_source_role text,
  p_entity_ids uuid[] default '{}'::uuid[]
)
returns table(source_id uuid, source_identity_id uuid, created boolean)
language plpgsql
as $$
declare
  existing_identity_id uuid;
  target_source_id uuid;
  target_identity_id uuid;
  was_created boolean := false;
  now_value timestamptz := now();
begin
  if p_channel_id is null or p_channel_id !~ '^UC[A-Za-z0-9_-]{22}$' then
    raise exception 'invalid YouTube channel id';
  end if;
  if p_uploads_playlist_id is not null and p_uploads_playlist_id !~ '^UU[A-Za-z0-9_-]{22}$' then
    raise exception 'invalid YouTube uploads playlist id';
  end if;
  if p_display_name is null or btrim(p_display_name) = '' or length(p_display_name) > 300 then
    raise exception 'invalid source display name';
  end if;
  if p_authority_tier < 1 or p_authority_tier > 5 then
    raise exception 'invalid authority tier';
  end if;
  if p_source_role is null or btrim(p_source_role) = '' or length(p_source_role) > 100 then
    raise exception 'invalid source role';
  end if;

  -- Serialize registration of the same external identity so concurrent requests
  -- cannot create duplicate source parents before the unique identity constraint fires.
  perform pg_advisory_xact_lock(hashtextextended('youtube:' || p_channel_id, 0));

  select si.id, si.source_id
    into existing_identity_id, target_source_id
  from public.source_identities si
  where si.platform = 'YOUTUBE'
    and si.platform_identity_id = p_channel_id
  for update;

  if existing_identity_id is null then
    insert into public.sources (
      display_name,
      authority_tier,
      source_role,
      active,
      notes
    ) values (
      btrim(p_display_name),
      p_authority_tier,
      btrim(p_source_role),
      true,
      'Registered by register_youtube_source'
    )
    returning id into target_source_id;

    insert into public.source_identities (
      source_id,
      platform,
      platform_identity_id,
      handle,
      canonical_url,
      connector_type,
      poll_class,
      access_mode,
      connector_config,
      active
    ) values (
      target_source_id,
      'YOUTUBE',
      p_channel_id,
      nullif(btrim(coalesce(p_custom_url, '')), ''),
      'https://www.youtube.com/channel/' || p_channel_id,
      'YOUTUBE_WEBSUB',
      'PUSH',
      'WEBHOOK',
      '{"schemaVersion":1}'::jsonb,
      true
    )
    returning id into target_identity_id;

    was_created := true;
  else
    target_identity_id := existing_identity_id;

    update public.sources
    set display_name = btrim(p_display_name),
        authority_tier = p_authority_tier,
        source_role = btrim(p_source_role),
        active = true,
        updated_at = now_value
    where id = target_source_id;

    update public.source_identities
    set handle = nullif(btrim(coalesce(p_custom_url, '')), ''),
        canonical_url = 'https://www.youtube.com/channel/' || p_channel_id,
        connector_type = 'YOUTUBE_WEBSUB',
        poll_class = 'PUSH',
        access_mode = 'WEBHOOK',
        connector_config = coalesce(connector_config, '{}'::jsonb) || '{"schemaVersion":1}'::jsonb,
        active = true,
        updated_at = now_value
    where id = target_identity_id;
  end if;

  insert into public.youtube_channel_state (
    source_identity_id,
    channel_id,
    uploads_playlist_id,
    next_fallback_check_at
  ) values (
    target_identity_id,
    p_channel_id,
    p_uploads_playlist_id,
    case when p_uploads_playlist_id is null then null else now_value end
  )
  on conflict (source_identity_id) do update
    set channel_id = excluded.channel_id,
        uploads_playlist_id = excluded.uploads_playlist_id,
        next_fallback_check_at = case
          when excluded.uploads_playlist_id is null then null
          else coalesce(public.youtube_channel_state.next_fallback_check_at, now_value)
        end,
        updated_at = now_value;

  insert into public.source_health (
    source_identity_id,
    health_state,
    last_attempt_at,
    last_success_at,
    consecutive_failures,
    last_http_status,
    last_error_code,
    last_error_message,
    parser_version,
    updated_at
  ) values (
    target_identity_id,
    'HEALTHY',
    now_value,
    now_value,
    0,
    200,
    null,
    null,
    'youtube-v1',
    now_value
  )
  on conflict (source_identity_id) do update
    set health_state = 'HEALTHY',
        last_attempt_at = excluded.last_attempt_at,
        last_success_at = excluded.last_success_at,
        consecutive_failures = 0,
        last_http_status = 200,
        last_error_code = null,
        last_error_message = null,
        parser_version = 'youtube-v1',
        updated_at = now_value;

  perform public.replace_source_entity_candidates(
    target_identity_id,
    coalesce(p_entity_ids, '{}'::uuid[])
  );

  return query select target_source_id, target_identity_id, was_created;
end;
$$;

comment on function public.register_youtube_source is 'Atomically registers/reactivates one validated YouTube source, operational state, health and bounded title scope under a per-channel transaction lock.';

commit;
