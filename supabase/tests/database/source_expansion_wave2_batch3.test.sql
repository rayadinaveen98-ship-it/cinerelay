begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where platform = 'YOUTUBE'
      and active = true
      and config ->> 'expansionWave' = 'wave2-batch3'
  ),
  8,
  'wave 2 batch 3 registers exactly eight active YouTube identities'
);

select is(
  (
    select count(*)::integer
    from public.youtube_channel_state ycs
    join public.source_identities si on si.id = ycs.source_identity_id
    where si.config ->> 'expansionWave' = 'wave2-batch3'
      and ycs.uploads_playlist_id = 'UU' || substring(si.platform_identity_id from 3)
  ),
  8,
  'all batch 3 YouTube identities have canonical uploads-playlist fallback runtime'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where s.display_name = 'ManoramaMAX'
      and si.config ->> 'expansionWave' = 'wave2-batch3'
      and si.platform_identity_id = 'UCz1ht-a2eKE_s1vMh3OHtIg'
      and si.active = true
  ),
  1,
  'ManoramaMAX official YouTube lane is active exactly once'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where s.display_name = 'Sony LIV'
      and si.config ->> 'expansionWave' = 'wave2-batch3'
      and si.platform_identity_id = any(array[
        'UC-ybzIsgchcx7PHqOSxn5OQ',
        'UCQmxcMxjYcBM5Pel4qUW2hA',
        'UCHu48NlukyWGqjh3DUKcBmA'
      ]::text[])
      and si.active = true
  ),
  3,
  'Sony LIV gains Telugu, Tamil and Malayalam official YouTube lanes'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where s.display_name = 'Sun NXT'
      and si.config ->> 'expansionWave' = 'wave2-batch3'
      and si.platform_identity_id = any(array[
        'UCo3J37dmHuiL7L0klvO1KKA',
        'UC26UNezdPZfGkRnxX3fVWGA',
        'UCCnC56Bsc1z_R55KdNFq5MA'
      ]::text[])
      and si.active = true
  ),
  3,
  'Sun NXT gains Telugu, Malayalam and Kannada official YouTube lanes'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where s.display_name = 'Bollywood Hungama'
      and s.authority_tier = 3
      and s.source_role = 'TRADE_MEDIA'
      and si.platform_identity_id = 'UColde1DYHBhFE1wTIZECmvA'
      and si.config ->> 'expansionWave' = 'wave2-batch3'
      and si.active = true
  ),
  1,
  'Bollywood Hungama YouTube remains Tier 3 trade-media evidence'
);

select is(
  (
    select count(*)::integer
    from public.sources
    where (display_name in ('ManoramaMAX','Sony LIV','Sun NXT') and authority_tier = 1)
       or (display_name = 'Bollywood Hungama' and authority_tier = 3)
  ),
  4,
  'batch 3 preserves reviewed parent source authority tiers'
);

select is(
  (
    select count(*)::integer
    from public.sources
    where display_name in ('ManoramaMAX','Sony LIV','Sun NXT','Bollywood Hungama')
      and active = true
  ),
  4,
  'batch 3 reuses the four existing active source brands without creating aliases'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where platform = 'X'
      and active = true
  ),
  0,
  'wave 2 batch 3 does not reactivate X'
);

select * from finish();
rollback;
