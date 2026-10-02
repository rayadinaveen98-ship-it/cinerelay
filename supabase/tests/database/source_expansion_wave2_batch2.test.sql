create extension if not exists pgtap with schema extensions;

begin;
select plan(10);

select is(
  (select count(*)::integer
   from public.source_identities si
   join public.sources s on s.id = si.source_id
   where s.display_name = 'The Indian Express — Entertainment'
     and si.platform = 'RSS'
     and si.active = true),
  9,
  'Indian Express Entertainment has 9 active RSS identities after Batch 2'
);

select is(
  (select count(*)::integer
   from public.source_identities si
   join public.feed_source_state fs on fs.source_identity_id = si.id
   where si.canonical_url in (
     'https://indianexpress.com/section/entertainment/telugu/feed/',
     'https://indianexpress.com/section/entertainment/tamil/feed/',
     'https://indianexpress.com/section/entertainment/malayalam/feed/',
     'https://indianexpress.com/section/entertainment/regional/feed/',
     'https://indianexpress.com/section/entertainment/web-series/feed/',
     'https://indianexpress.com/section/entertainment/movie-review/feed/',
     'https://indianexpress.com/section/entertainment/bollywood/feed/',
     'https://indianexpress.com/section/entertainment/bollywood/box-office-collection/feed/'
   )),
  8,
  'all 8 new Indian Express feeds have feed runtime state'
);

select ok(
  exists (
    select 1 from public.sources
    where display_name = 'Koimoi'
      and authority_tier = 3
      and source_role = 'TRADE_MEDIA'
      and active = true
  ),
  'Koimoi is registered as active Tier 3 trade media'
);

select ok(
  exists (
    select 1
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    join public.feed_source_state fs on fs.source_identity_id = si.id
    where s.display_name = 'Koimoi'
      and si.platform = 'RSS'
      and si.canonical_url = 'https://www.koimoi.com/feed/'
      and si.active = true
  ),
  'Koimoi RSS identity is active with feed runtime'
);

select ok(
  exists (
    select 1 from public.sources
    where display_name = 'Filmfare'
      and authority_tier = 3
      and source_role = 'TRADE_MEDIA'
      and active = true
  ),
  'Filmfare is registered as active Tier 3 trade media'
);

select ok(
  exists (
    select 1
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    join public.youtube_channel_state yc on yc.source_identity_id = si.id
    where s.display_name = 'Filmfare'
      and si.platform = 'YOUTUBE'
      and si.platform_identity_id = 'UC500dYMU9OMJdJKWRqGlhog'
      and si.active = true
      and yc.channel_id = 'UC500dYMU9OMJdJKWRqGlhog'
  ),
  'Filmfare canonical YouTube identity has fallback runtime'
);

select ok(
  exists (
    select 1 from public.sources
    where display_name = 'Cinema Express'
      and authority_tier = 3
      and source_role = 'TRADE_MEDIA'
      and active = true
  ),
  'Cinema Express is registered as active Tier 3 trade media'
);

select ok(
  exists (
    select 1
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    join public.youtube_channel_state yc on yc.source_identity_id = si.id
    where s.display_name = 'Cinema Express'
      and si.platform = 'YOUTUBE'
      and si.platform_identity_id = 'UC2MgcperJNAFDQgafrijUnA'
      and si.active = true
      and yc.channel_id = 'UC2MgcperJNAFDQgafrijUnA'
  ),
  'Cinema Express canonical YouTube identity has fallback runtime'
);

select is(
  (select count(*)::integer
   from public.source_identities
   where connector_config->>'expansionWave' = 'wave2-batch2'
     and active = true),
  11,
  'Batch 2 adds exactly 11 active identities'
);

select is(
  (select count(*)::integer
   from public.source_identities
   where platform = 'X' and active = true),
  0,
  'X remains dormant after Batch 2'
);

select * from finish();
rollback;
