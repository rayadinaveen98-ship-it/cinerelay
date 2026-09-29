create or replace function public.attach_source_identity(
  p_source_id uuid,
  p_platform text,
  p_platform_identity_id text,
  p_handle text,
  p_canonical_url text,
  p_connector_type text,
  p_poll_class text,
  p_access_mode text,
  p_connector_config jsonb default '{}'::jsonb,
  p_active boolean default false
)
returns table(source_identity_id uuid, created boolean)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_platform text := upper(btrim(coalesce(p_platform, '')));
  v_platform_identity_id text := nullif(btrim(coalesce(p_platform_identity_id, '')), '');
  v_handle text := nullif(btrim(coalesce(p_handle, '')), '');
  v_url text := btrim(coalesce(p_canonical_url, ''));
  v_connector_type text := upper(btrim(coalesce(p_connector_type, '')));
  v_poll_class text := upper(btrim(coalesce(p_poll_class, '')));
  v_access_mode text := upper(btrim(coalesce(p_access_mode, '')));
  v_by_platform uuid;
  v_by_platform_source uuid;
  v_by_url uuid;
  v_by_url_source uuid;
  v_target uuid;
  v_target_source uuid;
  v_created boolean := false;
begin
  if not exists (select 1 from public.sources where id = p_source_id and active = true) then
    raise exception 'source_not_found_or_inactive';
  end if;
  if v_platform = '' or length(v_platform) > 50 then raise exception 'invalid_platform'; end if;
  if v_connector_type = '' or length(v_connector_type) > 100 then raise exception 'invalid_connector_type'; end if;
  if v_poll_class = '' or length(v_poll_class) > 50 then raise exception 'invalid_poll_class'; end if;
  if v_access_mode = '' or length(v_access_mode) > 50 then raise exception 'invalid_access_mode'; end if;
  if v_url = '' or v_url !~ '^https://[^[:space:]]+$' then raise exception 'invalid_canonical_url'; end if;
  if p_connector_config is null or jsonb_typeof(p_connector_config) <> 'object' then raise exception 'invalid_connector_config'; end if;
  if v_platform = 'YOUTUBE' and (v_platform_identity_id is null or v_platform_identity_id !~ '^UC[A-Za-z0-9_-]{22}$') then
    raise exception 'invalid_youtube_channel_id';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('source-identity:' || v_platform || ':' || coalesce(v_platform_identity_id, v_url), 0));

  if v_platform_identity_id is not null then
    select id, source_id into v_by_platform, v_by_platform_source
    from public.source_identities
    where platform = v_platform and platform_identity_id = v_platform_identity_id
    for update;
  end if;

  select id, source_id into v_by_url, v_by_url_source
  from public.source_identities
  where canonical_url = v_url
  for update;

  if v_by_platform is not null and v_by_url is not null and v_by_platform <> v_by_url then
    raise exception 'source_identity_key_conflict';
  end if;

  v_target := coalesce(v_by_platform, v_by_url);
  v_target_source := coalesce(v_by_platform_source, v_by_url_source);

  if v_target is not null and v_target_source <> p_source_id then
    raise exception 'source_identity_owned_by_other_source';
  end if;

  if v_target is null then
    insert into public.source_identities (
      source_id, platform, platform_identity_id, handle, canonical_url,
      connector_type, poll_class, access_mode, connector_config, active
    ) values (
      p_source_id, v_platform, v_platform_identity_id, v_handle, v_url,
      v_connector_type, v_poll_class, v_access_mode, p_connector_config, coalesce(p_active, false)
    )
    returning id into v_target;
    v_created := true;
  else
    update public.source_identities
    set platform_identity_id = v_platform_identity_id,
        handle = v_handle,
        canonical_url = v_url,
        connector_type = v_connector_type,
        poll_class = v_poll_class,
        access_mode = v_access_mode,
        connector_config = coalesce(connector_config, '{}'::jsonb) || p_connector_config,
        active = coalesce(p_active, false),
        updated_at = now()
    where id = v_target;
  end if;

  return query select v_target, v_created;
end;
$$;

create or replace function public.seed_source_identity_runtime(
  p_source_identity_id uuid,
  p_uploads_playlist_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_identity public.source_identities%rowtype;
  v_playlist_id text;
  v_username text;
  v_health_state text;
  v_next_due timestamptz;
begin
  select * into v_identity
  from public.source_identities
  where id = p_source_identity_id
  for update;

  if v_identity.id is null then raise exception 'source_identity_not_found'; end if;

  if v_identity.platform = 'YOUTUBE' then
    if v_identity.connector_type <> 'YOUTUBE_WEBSUB' or v_identity.access_mode <> 'WEBHOOK' then
      raise exception 'youtube_identity_contract_invalid';
    end if;
    if v_identity.platform_identity_id is null or v_identity.platform_identity_id !~ '^UC[A-Za-z0-9_-]{22}$' then
      raise exception 'invalid_youtube_channel_id';
    end if;
    v_playlist_id := nullif(btrim(coalesce(p_uploads_playlist_id, '')), '');
    if v_playlist_id is null then
      v_playlist_id := 'UU' || substring(v_identity.platform_identity_id from 3);
    end if;
    if v_playlist_id !~ '^UU[A-Za-z0-9_-]{22}$' then raise exception 'invalid_youtube_uploads_playlist_id'; end if;

    insert into public.youtube_channel_state (
      source_identity_id, channel_id, uploads_playlist_id, next_fallback_check_at
    ) values (
      v_identity.id, v_identity.platform_identity_id, v_playlist_id,
      case when v_identity.active then now() else null end
    )
    on conflict (source_identity_id) do update
    set channel_id = excluded.channel_id,
        uploads_playlist_id = excluded.uploads_playlist_id,
        next_fallback_check_at = case
          when v_identity.active then least(coalesce(public.youtube_channel_state.next_fallback_check_at, now()), now())
          else null
        end,
        updated_at = now();

    v_health_state := case when v_identity.active then 'HEALTHY' else 'DISABLED' end;
    v_next_due := case when v_identity.active then now() else null end;

  elsif v_identity.platform = 'X' then
    if v_identity.connector_type <> 'X_API_V2' or v_identity.access_mode <> 'API' then
      raise exception 'x_identity_contract_invalid';
    end if;
    v_username := lower(regexp_replace(btrim(coalesce(v_identity.handle, '')), '^@+', ''));
    if v_username = '' or v_username !~ '^[a-z0-9_]{1,15}$' then raise exception 'invalid_x_username'; end if;

    insert into public.x_profile_source_state (
      source_identity_id, username, next_check_at, connector_version, updated_at
    ) values (
      v_identity.id, v_username,
      case when v_identity.active then now() else null end,
      'x-api-v2-profile-v1', now()
    )
    on conflict (source_identity_id) do update
    set username = excluded.username,
        next_check_at = case
          when v_identity.active then least(coalesce(public.x_profile_source_state.next_check_at, now()), now())
          else null
        end,
        connector_version = excluded.connector_version,
        updated_at = now();

    v_health_state := case when v_identity.active then 'AUTH_REQUIRED' else 'DISABLED' end;
    v_next_due := case when v_identity.active then now() else null end;
  else
    raise exception 'runtime_seed_platform_unsupported:%', v_identity.platform;
  end if;

  insert into public.source_health (
    source_identity_id, health_state, next_due_at, consecutive_failures,
    parser_version, updated_at
  ) values (
    v_identity.id, v_health_state, v_next_due, 0,
    case when v_identity.platform='YOUTUBE' then 'youtube-v1' else 'x-api-v2-profile-v1' end,
    now()
  )
  on conflict (source_identity_id) do update
  set health_state = excluded.health_state,
      next_due_at = excluded.next_due_at,
      consecutive_failures = 0,
      parser_version = excluded.parser_version,
      updated_at = now();

  return jsonb_build_object(
    'sourceIdentityId', v_identity.id,
    'platform', v_identity.platform,
    'active', v_identity.active,
    'healthState', v_health_state,
    'runtimeSeeded', true
  );
end;
$$;

revoke execute on function public.attach_source_identity(uuid,text,text,text,text,text,text,text,jsonb,boolean) from public, anon, authenticated;
revoke execute on function public.seed_source_identity_runtime(uuid,text) from public, anon, authenticated;
grant execute on function public.attach_source_identity(uuid,text,text,text,text,text,text,text,jsonb,boolean) to service_role;
grant execute on function public.seed_source_identity_runtime(uuid,text) to service_role;
