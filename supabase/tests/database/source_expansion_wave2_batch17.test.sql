begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select is(
  (
    select count(*)::integer from public.sources
    where display_name in (
      'T-Series Apna Punjab','T-Series Bangla','T-Series Haryanvi','T-Series Rajasthani','T-Series Regional'
    )
      and active=true and authority_tier=1 and source_role='MUSIC_LABEL'
  ),
  5,
  'Batch 17 registers five active Tier-1 T-Series regional music-label parents'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where active=true and platform='YOUTUBE'
      and connector_config->>'expansionWave'='wave2-batch17'
  ),
  5,
  'Batch 17 registers five active canonical YouTube identities'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch17'
      and connector_type='YOUTUBE_WEBSUB'
      and poll_class='PUSH'
      and access_mode='WEBHOOK'
  ),
  5,
  'All Batch 17 identities use the WebSub accelerator path'
);

select is(
  (
    select count(*)::integer
    from public.youtube_channel_state ycs
    join public.source_identities si on si.id=ycs.source_identity_id
    where si.connector_config->>'expansionWave'='wave2-batch17'
      and ycs.uploads_playlist_id='UU' || substring(si.platform_identity_id from 3)
  ),
  5,
  'All Batch 17 identities have authoritative uploads-playlist fallback state'
);

select is(
  (
    select count(distinct platform_identity_id)::integer
    from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch17'
  ),
  5,
  'Batch 17 canonical channel IDs are unique'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where platform_identity_id=any(array[
      'UCcvNYxWXR_5TjVK7cSCdW-g',
      'UCPH9W_9ZDQ1gemcCaIxOvCw',
      'UC3Zva7aW8lJUFZQYnC-XyHg',
      'UCkPipkv-8UZ2saO2TjE8AWA',
      'UCy2fvV-mH_4AcIgqnLg9uDw'
    ]::text[])
  ),
  5,
  'Each approved Batch 17 canonical channel ID exists exactly once'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch17'
      and connector_config->>'canonicalChannelIdVerified'='true'
      and connector_config->>'ownershipVerified'='true'
      and connector_config->>'fallbackAuthoritative'='true'
      and connector_config->>'regionalPublisher'='true'
      and connector_config->>'tSeriesOfficialDirectoryListed'='true'
      and connector_config->>'evidenceRole'='FIRST_PARTY_MUSIC_LABEL'
  ),
  5,
  'Batch 17 carries first-party T-Series regional trust metadata on all identities'
);

select is(
  (
    select count(distinct languages)::integer
    from public.sources
    where display_name in (
      'T-Series Apna Punjab','T-Series Bangla','T-Series Haryanvi','T-Series Rajasthani','T-Series Regional'
    )
  ),
  5,
  'Batch 17 preserves five distinct source language configurations'
);

select is(
  (
    select count(*)::integer from public.sources
    where display_name in (
      'T-Series Apna Punjab','T-Series Bangla','T-Series Haryanvi','T-Series Rajasthani','T-Series Regional'
    ) and territory='IN'
  ),
  5,
  'Batch 17 keeps all regional publishers in the India territory'
);

select is(
  (select count(*)::integer from public.source_identities where platform='X' and active=true),
  0,
  'Wave 2 Batch 17 does not reactivate X'
);

select * from finish();
rollback;
