begin;

create table if not exists public.page_source_state (
  source_identity_id uuid primary key references public.source_identities(id) on delete cascade,
  page_url text not null,
  etag text,
  last_modified text,
  last_checked_at timestamptz,
  last_successful_fetch_at timestamptz,
  next_check_at timestamptz,
  last_http_status integer,
  parser_version text not null default 'first-party-html-v1',
  parser_profile_version text not null,
  last_item_id text,
  last_item_count integer not null default 0 check (last_item_count >= 0),
  structure_fingerprint text,
  consecutive_not_modified integer not null default 0 check (consecutive_not_modified >= 0),
  gap_count integer not null default 0 check (gap_count >= 0),
  drift_count integer not null default 0 check (drift_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.page_source_state enable row level security;

create index if not exists page_source_state_due_idx
  on public.page_source_state (next_check_at nulls first);

create or replace function public.register_page_source(
  p_source_identity_id uuid,
  p_page_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access_mode text;
  v_connector_type text;
  v_config jsonb;
  v_profile_version text;
begin
  if p_page_url is null or p_page_url !~* '^https://' then
    raise exception 'page_url_must_be_https';
  end if;

  select access_mode, connector_type, connector_config
    into v_access_mode, v_connector_type, v_config
  from public.source_identities
  where id = p_source_identity_id
    and active = true;

  if not found then
    raise exception 'source_identity_not_found_or_inactive';
  end if;

  if v_access_mode <> 'PUBLIC_WEB' then
    raise exception 'source_identity_access_mode_must_be_public_web';
  end if;

  if v_connector_type <> 'FIRST_PARTY_HTML' then
    raise exception 'source_identity_connector_type_must_be_first_party_html';
  end if;

  if jsonb_typeof(v_config -> 'parserProfile') <> 'object'
     or nullif(v_config #>> '{parserProfile,profileVersion}', '') is null
     or nullif(v_config #>> '{parserProfile,itemSelector}', '') is null
     or nullif(v_config #>> '{parserProfile,linkSelector}', '') is null then
    raise exception 'source_identity_parser_profile_invalid';
  end if;

  v_profile_version := v_config #>> '{parserProfile,profileVersion}';

  insert into public.page_source_state (
    source_identity_id,
    page_url,
    next_check_at,
    parser_version,
    parser_profile_version,
    updated_at
  ) values (
    p_source_identity_id,
    p_page_url,
    now(),
    'first-party-html-v1',
    v_profile_version,
    now()
  )
  on conflict (source_identity_id) do update
    set page_url = excluded.page_url,
        next_check_at = least(coalesce(public.page_source_state.next_check_at, now()), now()),
        parser_version = excluded.parser_version,
        parser_profile_version = excluded.parser_profile_version,
        updated_at = now();

  insert into public.source_health (
    source_identity_id,
    health_state,
    next_due_at,
    parser_version,
    updated_at
  ) values (
    p_source_identity_id,
    'HEALTHY',
    now(),
    'first-party-html-v1',
    now()
  )
  on conflict (source_identity_id) do update
    set next_due_at = least(coalesce(public.source_health.next_due_at, now()), now()),
        parser_version = excluded.parser_version,
        updated_at = now();
end;
$$;

revoke all on table public.page_source_state from public, anon, authenticated;
grant select, insert, update, delete on table public.page_source_state to service_role;

revoke all on function public.register_page_source(uuid, text) from public, anon, authenticated;
grant execute on function public.register_page_source(uuid, text) to service_role;

commit;
