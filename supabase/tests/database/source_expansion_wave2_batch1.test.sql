begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

select is(
  (
    select count(*)::integer
    from public.sources
    where display_name in (
      'Bollywood Hungama',
      'Filmibeat',
      'The Indian Express — Entertainment',
      'The Hollywood Reporter India'
    )
      and active = true
  ),
  4,
  'wave 2 batch 1 registers four active media source brands exactly once'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where s.display_name in ('Bollywood Hungama','Filmibeat','The Indian Express — Entertainment')
      and si.platform = 'RSS'
      and si.connector_type = 'RSS_ATOM'
      and si.access_mode = 'FEED'
      and si.active = true
  ),
  12,
  'wave 2 batch 1 registers twelve active RSS identities'
);

select is(
  (
    select count(*)::integer
    from public.feed_source_state fss
    join public.source_identities si on si.id = fss.source_identity_id
    join public.sources s on s.id = si.source_id
    where s.display_name in ('Bollywood Hungama','Filmibeat','The Indian Express — Entertainment')
  ),
  12,
  'all twelve RSS identities have feed runtime state'
);

select is(
  (
    select count(*)::integer
    from public.sources
    where display_name in ('Bollywood Hungama','Filmibeat','The Hollywood Reporter India')
      and authority_tier = 3
      and source_role = 'TRADE_MEDIA'
  ),
  3,
  'film-focused media brands remain capped at Tier 3 trade media'
);

select is(
  (
    select count(*)::integer
    from public.sources
    where display_name = 'The Indian Express — Entertainment'
      and authority_tier = 4
      and source_role = 'GENERAL_MEDIA'
  ),
  1,
  'Indian Express entertainment remains Tier 4 general media'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where s.display_name = 'The Hollywood Reporter India'
      and si.platform = 'YOUTUBE'
      and si.platform_identity_id = 'UCNIGzoK1vgYYqLSF1MvI-3A'
      and si.connector_type = 'YOUTUBE_WEBSUB'
      and si.poll_class = 'PUSH'
      and si.access_mode = 'WEBHOOK'
      and si.active = true
  ),
  1,
  'THR India canonical YouTube identity is active exactly once'
);

select is(
  (
    select count(*)::integer
    from public.youtube_channel_state ycs
    join public.source_identities si on si.id = ycs.source_identity_id
    where si.platform_identity_id = 'UCNIGzoK1vgYYqLSF1MvI-3A'
      and ycs.uploads_playlist_id = 'UUNIGzoK1vgYYqLSF1MvI-3A'
  ),
  1,
  'THR India has canonical uploads-playlist fallback runtime state'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where platform = 'X'
      and active = true
  ),
  0,
  'source expansion wave 2 does not reactivate X'
);

select * from finish();
rollback;
