insert into public.youtube_channel_state (
  source_identity_id, channel_id, uploads_playlist_id, next_fallback_check_at
)
select
  si.id,
  si.platform_identity_id,
  'UU' || substring(si.platform_identity_id from 3),
  now()
from public.source_identities si
where si.platform='YOUTUBE'
  and si.active=true
  and si.platform_identity_id in (
    'UCmse5JbKneJqVyerfhDVYvQ',
    'UCfm7ruQ8mPzPyw0w7e7pqEA',
    'UC68nKdrLbLL0Vj7ilVkLmmg'
  )
on conflict (source_identity_id) do update
set channel_id=excluded.channel_id,
    uploads_playlist_id=excluded.uploads_playlist_id,
    next_fallback_check_at=least(coalesce(public.youtube_channel_state.next_fallback_check_at, now()), now()),
    updated_at=now();
