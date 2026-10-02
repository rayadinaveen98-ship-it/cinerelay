begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select is(
  (
    select count(*)::integer
    from public.sources
    where display_name in ('Chaupal','TarangPlus','NammaFlix','Lionsgate Play','Planet Marathi OTT')
      and active = true
      and authority_tier = 1
      and source_role = 'OTT_PLATFORM'
  ),
  5,
  'Batch 8 registers five active Tier-1 OTT brands'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where active = true
      and platform = 'YOUTUBE'
      and connector_config->>'expansionWave' = 'wave2-batch8'
  ),
  5,
  'Batch 8 registers five active canonical YouTube identities'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where connector_config->>'expansionWave' = 'wave2-batch8'
      and connector_type = 'YOUTUBE_WEBSUB'
      and poll_class = 'PUSH'
      and access_mode = 'WEBHOOK'
  ),
  5,
  'All Batch 8 identities use the WebSub accelerator path'
);

select is(
  (
    select count(*)::integer
    from public.youtube_channel_state ycs
    join public.source_identities si on si.id = ycs.source_identity_id
    where si.connector_config->>'expansionWave' = 'wave2-batch8'
      and ycs.uploads_playlist_id = 'UU' || substring(si.platform_identity_id from 3)
  ),
  5,
  'All Batch 8 identities have canonical uploads-playlist fallback state'
);

select is(
  (
    select count(distinct platform_identity_id)::integer
    from public.source_identities
    where connector_config->>'expansionWave' = 'wave2-batch8'
  ),
  5,
  'Batch 8 canonical channel IDs are unique'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where connector_config->>'expansionWave' = 'wave2-batch8'
      and connector_config->>'ownershipVerified' = 'true'
      and connector_config->>'canonicalChannelIdVerified' = 'true'
      and connector_config->>'webSubRole' = 'ACCELERATOR'
      and connector_config->>'fallbackAuthoritative' = 'true'
  ),
  5,
  'Every Batch 8 identity records ownership and fallback trust metadata'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where platform_identity_id = any(array[
      'UCH3FAffJyp6RBYLSZsYnKdQ',
      'UCujyiVE2bbQwzkQX-nGI1yQ',
      'UCeYxCTD4uwa5zbzw6hSi5sA',
      'UCzciyhKgQO2l4RC6fdLrZIg',
      'UCtBgzRNQFIW8TFifPtgzG9Q'
    ]::text[])
  ),
  5,
  'Each approved Batch 8 canonical channel ID exists exactly once'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where connector_config->>'expansionWave' = 'wave2-batch8'
      and connector_config->>'lane' in ('PUNJABI_OTT','ODIA_OTT','KANNADA_OTT','PREMIUM_OTT','MARATHI_OTT')
  ),
  5,
  'Batch 8 records one explicit OTT coverage lane per identity'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where si.connector_config->>'expansionWave' = 'wave2-batch8'
      and s.active = true
      and s.authority_tier = 1
      and s.source_role = 'OTT_PLATFORM'
  ),
  5,
  'Batch 8 identities remain attached only to reviewed Tier-1 OTT parents'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where platform = 'X'
      and active = true
  ),
  0,
  'Wave 2 Batch 8 does not reactivate X'
);

select * from finish();
rollback;
