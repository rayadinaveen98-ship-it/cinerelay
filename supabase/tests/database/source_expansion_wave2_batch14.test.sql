begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select is(
  (
    select count(*)::integer from public.sources
    where display_name in ('Sony Music India','Sony Music Malayalam','Times Music','DM - Desi Melodies')
      and active=true and authority_tier=1 and source_role='MUSIC_LABEL'
  ),
  4,
  'Batch 14 registers four active Tier-1 music-label parents'
);

select is(
  (
    select count(*)::integer from public.sources
    where display_name='Jio Studios'
      and active=true and authority_tier=1 and source_role='PRODUCTION_HOUSE'
  ),
  1,
  'Batch 14 registers Jio Studios as a Tier-1 first-party studio parent'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where active=true and platform='YOUTUBE'
      and connector_config->>'expansionWave'='wave2-batch14'
  ),
  5,
  'Batch 14 registers five active canonical YouTube identities'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch14'
      and connector_type='YOUTUBE_WEBSUB' and poll_class='PUSH' and access_mode='WEBHOOK'
  ),
  5,
  'All Batch 14 identities use the WebSub accelerator path'
);

select is(
  (
    select count(*)::integer
    from public.youtube_channel_state ycs
    join public.source_identities si on si.id=ycs.source_identity_id
    where si.connector_config->>'expansionWave'='wave2-batch14'
      and ycs.uploads_playlist_id='UU' || substring(si.platform_identity_id from 3)
  ),
  5,
  'All Batch 14 identities have authoritative uploads-playlist fallback state'
);

select is(
  (
    select count(distinct platform_identity_id)::integer
    from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch14'
  ),
  5,
  'Batch 14 canonical channel IDs are unique'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where platform_identity_id=any(array[
      'UC56gTxNs4f9xZ7Pa2i5xNzg',
      'UCpJmCkjsJbqIBdvTRx2zt-w',
      'UCcXQd6kHKm0b41x8zMVMmMg',
      'UCo07fumrTn1w4AxcU4j_uDw',
      'UC783dnzJqf2ghHp_pFLYbGA'
    ]::text[])
  ),
  5,
  'Each approved Batch 14 canonical channel ID exists exactly once'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id=si.source_id
    where si.connector_config->>'expansionWave'='wave2-batch14'
      and (
        (s.display_name in ('Sony Music India','Sony Music Malayalam','Times Music','DM - Desi Melodies')
          and s.source_role='MUSIC_LABEL'
          and si.connector_config->>'evidenceRole'='FIRST_PARTY_MUSIC_LABEL')
        or (s.display_name='Jio Studios'
          and s.source_role='PRODUCTION_HOUSE'
          and si.connector_config->>'evidenceRole'='FIRST_PARTY_STUDIO')
      )
  ),
  5,
  'Batch 14 preserves music-label and studio evidence roles'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch14'
      and connector_config->>'canonicalChannelIdVerified'='true'
      and connector_config->>'ownershipVerified'='true'
      and connector_config->>'fallbackAuthoritative'='true'
  ),
  5,
  'Batch 14 carries verified ownership and fallback metadata'
);

select is(
  (select count(*)::integer from public.source_identities where platform='X' and active=true),
  0,
  'Wave 2 Batch 14 does not reactivate X'
);

select * from finish();
rollback;
