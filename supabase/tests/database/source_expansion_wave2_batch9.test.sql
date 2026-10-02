begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select is(
  (
    select count(*)::integer from public.sources
    where display_name='STAGE' and active=true and authority_tier=1 and source_role='OTT_PLATFORM'
  ),
  1,
  'Batch 9 registers STAGE as one active Tier-1 OTT platform'
);

select is(
  (
    select count(*)::integer from public.sources
    where display_name='Shemaroo Entertainment' and active=true and authority_tier=1 and source_role='MEDIA_LIBRARY'
  ),
  1,
  'Batch 9 registers Shemaroo as one active Tier-1 media library'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where active=true and platform='YOUTUBE' and connector_config->>'expansionWave'='wave2-batch9'
  ),
  7,
  'Batch 9 registers seven active canonical YouTube identities'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch9'
      and connector_type='YOUTUBE_WEBSUB' and poll_class='PUSH' and access_mode='WEBHOOK'
  ),
  7,
  'All Batch 9 identities use the WebSub accelerator path'
);

select is(
  (
    select count(*)::integer
    from public.youtube_channel_state ycs
    join public.source_identities si on si.id=ycs.source_identity_id
    where si.connector_config->>'expansionWave'='wave2-batch9'
      and ycs.uploads_playlist_id='UU' || substring(si.platform_identity_id from 3)
  ),
  7,
  'All Batch 9 identities have canonical uploads-playlist fallback state'
);

select is(
  (
    select count(distinct platform_identity_id)::integer from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch9'
  ),
  7,
  'Batch 9 canonical channel IDs are unique'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch9'
      and connector_config->>'ownershipVerified'='true'
      and connector_config->>'canonicalChannelIdVerified'='true'
      and connector_config->>'webSubRole'='ACCELERATOR'
      and connector_config->>'fallbackAuthoritative'='true'
  ),
  7,
  'Every Batch 9 identity records ownership and fallback trust metadata'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where platform_identity_id=any(array[
      'UCxSyYieZnqPksxkYxoPMX_g',
      'UCBOmfqgTZi7yDp4-3Lr_3lA',
      'UCrbgiUM0ikz4L6zVjzVbyWg',
      'UCUKw8_dn_bmxdfdFlv0Xnhw',
      'UCRjdhRziOme0OSmUwbnwebg',
      'UCYGHffkD5HMPf4zx-R5ncBg',
      'UCQb2IrvJ-n-0dEvVSNRWdxQ'
    ]::text[])
  ),
  7,
  'Each approved Batch 9 canonical channel ID exists exactly once'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id=si.source_id
    where si.connector_config->>'expansionWave'='wave2-batch9'
      and (
        (si.platform_identity_id='UCxSyYieZnqPksxkYxoPMX_g' and s.source_role='OTT_PLATFORM')
        or
        (si.platform_identity_id<>'UCxSyYieZnqPksxkYxoPMX_g' and s.source_role='MEDIA_LIBRARY' and si.connector_config->>'evidenceRole'='RIGHTS_OWNER_LIBRARY')
      )
  ),
  7,
  'Batch 9 preserves OTT versus rights-library evidence roles'
);

select is(
  (select count(*)::integer from public.source_identities where platform='X' and active=true),
  0,
  'Wave 2 Batch 9 does not reactivate X'
);

select * from finish();
rollback;
