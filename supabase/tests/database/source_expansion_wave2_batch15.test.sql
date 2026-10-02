begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select is(
  (
    select count(*)::integer from public.sources
    where display_name in ('Think Music India','Aditya Music')
      and active=true and authority_tier=1 and source_role='MUSIC_LABEL'
  ),
  2,
  'Batch 15 reuses two active Tier-1 music-label parents'
);

select is(
  (
    select count(*)::integer from public.sources
    where display_name in ('Tips Music','Speed Records','Divo Music')
      and active=true and authority_tier=1 and source_role='MUSIC_LABEL'
  ),
  3,
  'Batch 15 registers three new active Tier-1 music-label parents'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where active=true and platform='YOUTUBE'
      and connector_config->>'expansionWave'='wave2-batch15'
  ),
  5,
  'Batch 15 registers five active canonical YouTube identities'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch15'
      and connector_type='YOUTUBE_WEBSUB' and poll_class='PUSH' and access_mode='WEBHOOK'
  ),
  5,
  'All Batch 15 identities use the WebSub accelerator path'
);

select is(
  (
    select count(*)::integer
    from public.youtube_channel_state ycs
    join public.source_identities si on si.id=ycs.source_identity_id
    where si.connector_config->>'expansionWave'='wave2-batch15'
      and ycs.uploads_playlist_id='UU' || substring(si.platform_identity_id from 3)
  ),
  5,
  'All Batch 15 identities have authoritative uploads-playlist fallback state'
);

select is(
  (
    select count(distinct platform_identity_id)::integer
    from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch15'
  ),
  5,
  'Batch 15 canonical channel IDs are unique'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where platform_identity_id=any(array[
      'UC9Z3ZrgSyFA75VQ5HpqSbtA',
      'UCo_iDY0qQ4d4ad3zRAZtPsg',
      'UCJrDMFOdv1I2k8n9oK_V21w',
      'UCOsyDsO5tIt-VZ1iwjdQmew',
      'UC5rGGthSt-CQue8V0bj1bWg'
    ]::text[])
  ),
  5,
  'Each approved Batch 15 canonical channel ID exists exactly once'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch15'
      and connector_config->>'canonicalChannelIdVerified'='true'
      and connector_config->>'ownershipVerified'='true'
      and connector_config->>'fallbackAuthoritative'='true'
      and connector_config->>'evidenceRole'='FIRST_PARTY_MUSIC_LABEL'
  ),
  5,
  'Batch 15 carries first-party music-label trust metadata on all identities'
);

select is(
  (
    select count(*)::integer from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch15'
      and connector_config->>'regionalPublisher'='true'
  ),
  2,
  'Batch 15 marks exactly the two regional extension identities'
);

select is(
  (select count(*)::integer from public.source_identities where platform='X' and active=true),
  0,
  'Wave 2 Batch 15 does not reactivate X'
);

select * from finish();
rollback;
