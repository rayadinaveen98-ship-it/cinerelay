with registry(display_name, channel_id, handle, priority) as (
  values
    ('UV Creations','UCmse5JbKneJqVyerfhDVYvQ','@UVCreations','HIGH'),
    ('Niharika Entertainment','UCfm7ruQ8mPzPyw0w7e7pqEA','@NiharikaEnt','HIGH'),
    ('Saregama South','UC68nKdrLbLL0Vj7ilVkLmmg','@saregamasouth','NORMAL')
), inserted as (
  insert into public.source_identities (
    source_id, platform, platform_identity_id, handle, canonical_url,
    connector_type, poll_class, access_mode, connector_config, active
  )
  select
    s.id,
    'YOUTUBE',
    r.channel_id,
    r.handle,
    'https://www.youtube.com/channel/' || r.channel_id,
    'YOUTUBE_WEBSUB',
    'PUSH',
    'WEBHOOK',
    jsonb_build_object('schemaVersion',1,'discoveryPriority',r.priority),
    true
  from registry r
  join public.sources s on lower(s.display_name)=lower(r.display_name)
  where not exists (
    select 1 from public.source_identities si
    where si.platform='YOUTUBE' and si.platform_identity_id=r.channel_id
  )
  returning id, source_id, platform_identity_id
), targets as (
  select si.id as source_identity_id, si.platform_identity_id as channel_id,
         coalesce(si.connector_config->>'discoveryPriority','NORMAL') as priority
  from public.source_identities si
  join public.sources s on s.id=si.source_id
  where si.platform='YOUTUBE'
    and si.platform_identity_id in (
      'UCmse5JbKneJqVyerfhDVYvQ',
      'UCfm7ruQ8mPzPyw0w7e7pqEA',
      'UC68nKdrLbLL0Vj7ilVkLmmg'
    )
)
insert into public.youtube_channel_state (
  source_identity_id, channel_id, uploads_playlist_id, next_fallback_check_at
)
select
  t.source_identity_id,
  t.channel_id,
  'UU' || substring(t.channel_id from 3),
  now()
from targets t
on conflict (source_identity_id) do update
set channel_id=excluded.channel_id,
    uploads_playlist_id=excluded.uploads_playlist_id,
    next_fallback_check_at=least(coalesce(public.youtube_channel_state.next_fallback_check_at, now()), now()),
    updated_at=now();

insert into public.source_health (
  source_identity_id, health_state, next_due_at, last_attempt_at, last_success_at,
  consecutive_failures, last_http_status, parser_version, updated_at
)
select
  si.id, 'HEALTHY', now(), now(), now(), 0, 200, 'youtube-v1', now()
from public.source_identities si
where si.platform='YOUTUBE'
  and si.platform_identity_id in (
    'UCmse5JbKneJqVyerfhDVYvQ',
    'UCfm7ruQ8mPzPyw0w7e7pqEA',
    'UC68nKdrLbLL0Vj7ilVkLmmg'
  )
on conflict (source_identity_id) do update
set health_state='HEALTHY', next_due_at=excluded.next_due_at,
    consecutive_failures=0, last_http_status=200,
    last_error_code=null, last_error_message=null,
    parser_version='youtube-v1', updated_at=now();
