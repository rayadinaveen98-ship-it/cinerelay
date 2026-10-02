begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

select is(
  (
    select count(*)::integer
    from public.sources
    where display_name='ZEE5'
      and active=true
      and authority_tier=1
      and source_role='OTT_PLATFORM'
  ),
  1,
  'Batch 13 reuses exactly one active Tier-1 ZEE5 OTT parent'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where active=true
      and platform='YOUTUBE'
      and connector_config->>'expansionWave'='wave2-batch13'
  ),
  4,
  'Batch 13 registers four active ZEE5 regional YouTube identities'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch13'
      and connector_type='YOUTUBE_WEBSUB'
      and poll_class='PUSH'
      and access_mode='WEBHOOK'
  ),
  4,
  'All Batch 13 identities use the WebSub accelerator path'
);

select is(
  (
    select count(*)::integer
    from public.youtube_channel_state ycs
    join public.source_identities si on si.id=ycs.source_identity_id
    where si.connector_config->>'expansionWave'='wave2-batch13'
      and ycs.uploads_playlist_id='UU' || substring(si.platform_identity_id from 3)
  ),
  4,
  'All Batch 13 identities have authoritative uploads-playlist fallback state'
);

select is(
  (
    select count(distinct platform_identity_id)::integer
    from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch13'
  ),
  4,
  'Batch 13 canonical channel IDs are unique'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where platform_identity_id=any(array[
      'UCicXylkn7Ztg5wXJLwKJaUg',
      'UCoCeHuiVL9uIirmbjmrM57w',
      'UCmqkTdYhSNZDS_R_omUKgdQ',
      'UCJwISYlGFwkWXLAjwEH-_Zg'
    ]::text[])
  ),
  4,
  'Each approved Batch 13 canonical channel ID exists exactly once'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch13'
      and connector_config->>'canonicalChannelIdVerified'='true'
      and connector_config->>'ownershipVerified'='true'
      and connector_config->>'fallbackAuthoritative'='true'
      and connector_config->>'regionalPublisher'='true'
      and connector_config->>'evidenceRole'='FIRST_PARTY_OTT'
  ),
  4,
  'Batch 13 carries first-party OTT trust metadata on all four identities'
);

select is(
  (
    select count(distinct connector_config->'languages')::integer
    from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch13'
  ),
  4,
  'Batch 13 preserves four distinct regional language lanes'
);

select is(
  (select count(*)::integer from public.source_identities where platform='X' and active=true),
  0,
  'Wave 2 Batch 13 does not reactivate X'
);

select * from finish();
rollback;
