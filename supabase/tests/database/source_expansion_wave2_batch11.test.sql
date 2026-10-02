begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select is(
  (
    select count(*)::integer from public.sources
    where display_name in ('ZEE5','ZEE5 Telugu')
      and active=true and authority_tier=1 and source_role='OTT_PLATFORM'
  ),
  2,
  'Batch 11 reuses two active Tier-1 ZEE5 OTT parents'
);

select is(
  (
    select count(*)::integer from public.sources
    where display_name in ('T-Series','Zee Music Company')
      and active=true and authority_tier=1 and source_role='MUSIC_LABEL'
  ),
  2,
  'Batch 11 registers two Tier-1 first-party music-label parents'
);

select is(
  (
    select count(*)::integer from public.sources
    where display_name='Applause Entertainment'
      and active=true and authority_tier=1 and source_role='PRODUCTION_HOUSE'
  ),
  1,
  'Batch 11 registers Applause as a Tier-1 first-party studio parent'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where active=true and platform='YOUTUBE'
      and connector_config->>'expansionWave'='wave2-batch11'
  ),
  5,
  'Batch 11 registers five active canonical YouTube identities'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch11'
      and connector_type='YOUTUBE_WEBSUB'
      and poll_class='PUSH'
      and access_mode='WEBHOOK'
  ),
  5,
  'All Batch 11 identities use the WebSub accelerator path'
);

select is(
  (
    select count(*)::integer
    from public.youtube_channel_state ycs
    join public.source_identities si on si.id=ycs.source_identity_id
    where si.connector_config->>'expansionWave'='wave2-batch11'
      and ycs.uploads_playlist_id='UU' || substring(si.platform_identity_id from 3)
  ),
  5,
  'All Batch 11 identities have authoritative uploads-playlist fallback state'
);

select is(
  (
    select count(distinct platform_identity_id)::integer
    from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch11'
  ),
  5,
  'Batch 11 canonical channel IDs are unique'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where platform_identity_id=any(array[
      'UCXOgAl4w-FQero1ERbGHpXQ',
      'UCVjaSUMfHkPcmJr5SKLVDTg',
      'UCq-Fj5jknLsUf-MWSy4_brA',
      'UCFFbwnve3yF62-tVXkTyHqg',
      'UCcO8c5xCPYHQtst3X56ufsQ'
    ]::text[])
  ),
  5,
  'Each approved Batch 11 canonical channel ID exists exactly once'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id=si.source_id
    where si.connector_config->>'expansionWave'='wave2-batch11'
      and (
        (s.display_name in ('ZEE5','ZEE5 Telugu') and s.source_role='OTT_PLATFORM' and si.connector_config->>'evidenceRole'='FIRST_PARTY_OTT')
        or (s.display_name in ('T-Series','Zee Music Company') and s.source_role='MUSIC_LABEL' and si.connector_config->>'evidenceRole'='FIRST_PARTY_MUSIC_LABEL')
        or (s.display_name='Applause Entertainment' and s.source_role='PRODUCTION_HOUSE' and si.connector_config->>'evidenceRole'='FIRST_PARTY_STUDIO')
      )
  ),
  5,
  'Batch 11 preserves OTT, music-label and studio evidence roles'
);

select is(
  (select count(*)::integer from public.source_identities where platform='X' and active=true),
  0,
  'Wave 2 Batch 11 does not reactivate X'
);

select * from finish();
rollback;
