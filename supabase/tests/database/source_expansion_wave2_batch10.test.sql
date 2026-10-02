begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

select is(
  (
    select count(*)::integer from public.sources
    where display_name in ('AAO NXT','EPIC ON')
      and active=true and authority_tier=1 and source_role='OTT_PLATFORM'
  ),
  2,
  'Batch 10 registers two active Tier-1 OTT parents'
);

select is(
  (
    select count(*)::integer from public.sources
    where display_name='Ultra Media & Entertainment'
      and active=true and authority_tier=1 and source_role='MEDIA_LIBRARY'
  ),
  1,
  'Batch 10 registers Ultra as one Tier-1 media-library parent'
);

select is(
  (
    select count(*)::integer from public.sources
    where display_name='The Walt Disney Company'
      and active=true and authority_tier=1 and source_role='PRODUCTION_HOUSE'
  ),
  1,
  'Batch 10 reuses the reviewed Walt Disney parent'
);

select is(
  (
    select count(*)::integer from public.sources
    where lower(display_name)=lower('Disney India')
  ),
  0,
  'Batch 10 does not create a duplicate Disney India source brand'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where active=true and platform='YOUTUBE' and connector_config->>'expansionWave'='wave2-batch10'
  ),
  4,
  'Batch 10 registers four active canonical YouTube identities'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch10'
      and connector_type='YOUTUBE_WEBSUB' and poll_class='PUSH' and access_mode='WEBHOOK'
  ),
  4,
  'All Batch 10 identities use the WebSub accelerator path'
);

select is(
  (
    select count(*)::integer
    from public.youtube_channel_state ycs
    join public.source_identities si on si.id=ycs.source_identity_id
    where si.connector_config->>'expansionWave'='wave2-batch10'
      and ycs.uploads_playlist_id='UU' || substring(si.platform_identity_id from 3)
  ),
  4,
  'All Batch 10 identities have canonical uploads-playlist fallback state'
);

select is(
  (
    select count(distinct platform_identity_id)::integer from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch10'
  ),
  4,
  'Batch 10 canonical channel IDs are unique'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where platform_identity_id=any(array[
      'UCF10UJGXCkKXRGbm2qjMjYw',
      'UCUOJBde9-K1CKiOzwO8hQIg',
      'UCXv0AGtxxRzxJ7lP1M2l4jA',
      'UCcpyP5B4qeKplEHv6wYnJcw'
    ]::text[])
  ),
  4,
  'Each approved Batch 10 canonical channel ID exists exactly once'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id=si.source_id
    where si.connector_config->>'expansionWave'='wave2-batch10'
      and (
        (s.display_name in ('AAO NXT','EPIC ON') and s.source_role='OTT_PLATFORM' and si.connector_config->>'evidenceRole'='FIRST_PARTY_OTT')
        or (s.display_name='Ultra Media & Entertainment' and s.source_role='MEDIA_LIBRARY' and si.connector_config->>'evidenceRole'='RIGHTS_OWNER_LIBRARY')
        or (s.display_name='The Walt Disney Company' and s.source_role='PRODUCTION_HOUSE' and si.connector_config->>'evidenceRole'='FIRST_PARTY_STUDIO')
      )
  ),
  4,
  'Batch 10 preserves OTT, rights-library and studio evidence roles'
);

select is(
  (select count(*)::integer from public.source_identities where platform='X' and active=true),
  0,
  'Wave 2 Batch 10 does not reactivate X'
);

select * from finish();
rollback;
