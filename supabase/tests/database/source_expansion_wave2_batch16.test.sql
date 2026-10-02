begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select is(
  (
    select count(*)::integer from public.sources
    where display_name in ('Tips Music','Speed Records','Times Music')
      and active=true and authority_tier=1 and source_role='MUSIC_LABEL'
  ),
  3,
  'Batch 16 reuses three active Tier-1 music-label parents'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where active=true and platform='YOUTUBE'
      and connector_config->>'expansionWave'='wave2-batch16'
  ),
  5,
  'Batch 16 registers five active regional YouTube identities'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch16'
      and connector_type='YOUTUBE_WEBSUB'
      and poll_class='PUSH'
      and access_mode='WEBHOOK'
  ),
  5,
  'All Batch 16 identities use the WebSub accelerator path'
);

select is(
  (
    select count(*)::integer
    from public.youtube_channel_state ycs
    join public.source_identities si on si.id=ycs.source_identity_id
    where si.connector_config->>'expansionWave'='wave2-batch16'
      and ycs.uploads_playlist_id='UU' || substring(si.platform_identity_id from 3)
  ),
  5,
  'All Batch 16 identities have authoritative uploads-playlist fallback state'
);

select is(
  (
    select count(distinct platform_identity_id)::integer
    from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch16'
  ),
  5,
  'Batch 16 canonical channel IDs are unique'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where platform_identity_id=any(array[
      'UCF8Ar7alYrtOI5SF6b7T0xA',
      'UCTHUx9uIBkpy8Z9OiKzMz0A',
      'UC_wRxe9tOFevlxOfDpRKuMw',
      'UC_oLUu-LxYOn9mDRR9k5x-A',
      'UCoXCrCeyIEU4z6xCAds7utQ'
    ]::text[])
  ),
  5,
  'Each approved Batch 16 canonical channel ID exists exactly once'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch16'
      and connector_config->>'canonicalChannelIdVerified'='true'
      and connector_config->>'ownershipVerified'='true'
      and connector_config->>'fallbackAuthoritative'='true'
      and connector_config->>'regionalPublisher'='true'
      and connector_config->>'evidenceRole'='FIRST_PARTY_MUSIC_LABEL'
  ),
  5,
  'Batch 16 carries regional first-party music-label trust metadata on all identities'
);

select is(
  (
    select count(distinct connector_config->'languages')::integer
    from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch16'
  ),
  4,
  'Batch 16 retains four distinct regional language configurations'
);

select is(
  (
    select count(*)::integer
    from (
      select s.display_name, count(*) as identity_count
      from public.source_identities si
      join public.sources s on s.id=si.source_id
      where si.connector_config->>'expansionWave'='wave2-batch16'
      group by s.display_name
      having (s.display_name='Tips Music' and count(*)=2)
          or (s.display_name='Speed Records' and count(*)=2)
          or (s.display_name='Times Music' and count(*)=1)
    ) x
  ),
  3,
  'Batch 16 preserves the expected 2/2/1 parent distribution'
);

select is(
  (select count(*)::integer from public.source_identities where platform='X' and active=true),
  0,
  'Wave 2 Batch 16 does not reactivate X'
);

select * from finish();
rollback;
