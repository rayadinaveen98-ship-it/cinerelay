create table public.x_profile_source_state (
  source_identity_id uuid primary key references public.source_identities(id) on delete cascade,
  username text not null,
  x_user_id text,
  last_checked_at timestamptz,
  last_successful_fetch_at timestamptz,
  next_check_at timestamptz,
  last_http_status integer,
  connector_version text not null default 'x-api-v2-profile-v1',
  last_post_id text,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  gap_count integer not null default 0 check (gap_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.x_profile_source_state enable row level security;
revoke all on table public.x_profile_source_state from public, anon, authenticated;
grant all on table public.x_profile_source_state to service_role;

create or replace function public.register_x_profile_source(
  p_source_identity_id uuid,
  p_username text,
  p_connector_version text default 'x-api-v2-profile-v1'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_platform text;
  v_connector_type text;
  v_access_mode text;
  v_handle text;
  v_username text;
begin
  v_username := lower(regexp_replace(trim(p_username), '^@+', ''));
  if v_username is null or v_username = '' or v_username !~ '^[a-z0-9_]{1,15}$' then
    raise exception 'invalid_x_username';
  end if;

  select platform, connector_type, access_mode, handle
    into v_platform, v_connector_type, v_access_mode, v_handle
  from public.source_identities
  where id = p_source_identity_id
    and active = true;

  if not found then raise exception 'source_identity_not_found_or_inactive'; end if;
  if v_platform <> 'X' then raise exception 'source_identity_platform_must_be_x'; end if;
  if v_connector_type <> 'X_API_V2' then raise exception 'source_identity_connector_type_must_be_x_api_v2'; end if;
  if v_access_mode <> 'API' then raise exception 'source_identity_access_mode_must_be_api'; end if;
  if v_handle is not null and lower(regexp_replace(trim(v_handle), '^@+', '')) <> v_username then
    raise exception 'source_identity_handle_mismatch';
  end if;

  insert into public.x_profile_source_state (
    source_identity_id, username, next_check_at, connector_version, updated_at
  ) values (
    p_source_identity_id, v_username, now(),
    coalesce(nullif(p_connector_version, ''), 'x-api-v2-profile-v1'), now()
  )
  on conflict (source_identity_id) do update
    set username = excluded.username,
        next_check_at = least(coalesce(public.x_profile_source_state.next_check_at, now()), now()),
        connector_version = excluded.connector_version,
        updated_at = now();

  insert into public.source_health (
    source_identity_id, health_state, next_due_at, parser_version, updated_at
  ) values (
    p_source_identity_id, 'HEALTHY', now(),
    coalesce(nullif(p_connector_version, ''), 'x-api-v2-profile-v1'), now()
  )
  on conflict (source_identity_id) do update
    set next_due_at = least(coalesce(public.source_health.next_due_at, now()), now()),
        parser_version = excluded.parser_version,
        updated_at = now();
end;
$$;

revoke execute on function public.register_x_profile_source(uuid,text,text) from public, anon, authenticated;
grant execute on function public.register_x_profile_source(uuid,text,text) to service_role;
