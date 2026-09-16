begin;

create table if not exists public.feed_source_state (
  source_identity_id uuid primary key references public.source_identities(id) on delete cascade,
  feed_url text not null,
  etag text,
  last_modified text,
  last_checked_at timestamptz,
  last_successful_fetch_at timestamptz,
  next_check_at timestamptz,
  last_http_status integer,
  parser_version text not null default 'feed-parser-v1',
  last_entry_id text,
  consecutive_not_modified integer not null default 0 check (consecutive_not_modified >= 0),
  gap_count integer not null default 0 check (gap_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.feed_source_state enable row level security;

create index if not exists feed_source_state_due_idx
  on public.feed_source_state (next_check_at nulls first);

create table if not exists public.connector_domain_state (
  domain text primary key,
  min_interval_seconds integer not null default 30 check (min_interval_seconds between 1 and 86400),
  last_request_at timestamptz,
  next_allowed_at timestamptz,
  rate_limited_until timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_http_status integer,
  updated_at timestamptz not null default now()
);

alter table public.connector_domain_state enable row level security;

create index if not exists connector_domain_state_next_allowed_idx
  on public.connector_domain_state (next_allowed_at);

create or replace function public.register_feed_source(
  p_source_identity_id uuid,
  p_feed_url text,
  p_parser_version text default 'feed-parser-v1'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access_mode text;
  v_connector_type text;
begin
  if p_feed_url is null or p_feed_url !~* '^https://' then
    raise exception 'feed_url_must_be_https';
  end if;

  select access_mode, connector_type
    into v_access_mode, v_connector_type
  from public.source_identities
  where id = p_source_identity_id
    and active = true;

  if not found then
    raise exception 'source_identity_not_found_or_inactive';
  end if;

  if v_access_mode <> 'FEED' then
    raise exception 'source_identity_access_mode_must_be_feed';
  end if;

  if v_connector_type <> 'RSS_ATOM' then
    raise exception 'source_identity_connector_type_must_be_rss_atom';
  end if;

  insert into public.feed_source_state (
    source_identity_id,
    feed_url,
    next_check_at,
    parser_version,
    updated_at
  ) values (
    p_source_identity_id,
    p_feed_url,
    now(),
    coalesce(nullif(p_parser_version, ''), 'feed-parser-v1'),
    now()
  )
  on conflict (source_identity_id) do update
    set feed_url = excluded.feed_url,
        next_check_at = least(coalesce(public.feed_source_state.next_check_at, now()), now()),
        parser_version = excluded.parser_version,
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
    coalesce(nullif(p_parser_version, ''), 'feed-parser-v1'),
    now()
  )
  on conflict (source_identity_id) do update
    set next_due_at = least(coalesce(public.source_health.next_due_at, now()), now()),
        parser_version = excluded.parser_version,
        updated_at = now();
end;
$$;

revoke all on table public.feed_source_state from public, anon, authenticated;
revoke all on table public.connector_domain_state from public, anon, authenticated;
grant select, insert, update, delete on table public.feed_source_state to service_role;
grant select, insert, update, delete on table public.connector_domain_state to service_role;

revoke all on function public.register_feed_source(uuid, text, text) from public, anon, authenticated;
grant execute on function public.register_feed_source(uuid, text, text) to service_role;

commit;
