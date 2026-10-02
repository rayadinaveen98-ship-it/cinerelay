begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

select is(
  (
    select count(*)::integer
    from public.sources
    where display_name in (
      'T-Series Tamil','T-Series Kannada','T-Series Malayalam','T-Series Gujarati','T-Series Marathi'
    )
      and active=true
      and authority_tier=1
      and source_role='MUSIC_LABEL'
  ),
  5,
  'Batch 12 registers five active Tier-1 T-Series regional music-label parents'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where active=true
      and platform='YOUTUBE'
      and connector_config->>'expansionWave'='wave2-batch12'
  ),
  5,
  'Batch 12 registers five active regional YouTube identities'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch12'
      and connector_type='YOUTUBE_WEBSUB'
      and poll_class='PUSH'
      and access_mode='WEBHOOK'
  ),
  5,
  'All Batch 12 identities use the WebSub accelerator path'
);

select is(
  (
    select count(*)::integer
    from public.youtube_channel_state ycs
    join public.source_identities si on si.id=ycs.source_identity_id
    where si.connector_config->>'expansionWave'='wave2-batch12'
      and ycs.uploads_playlist_id='UU' || substring(si.platform_identity_id from 3)
  ),
  5,
  'All Batch 12 identities have authoritative uploads-playlist fallback state'
);

select is(
  (
    select count(distinct platform_identity_id)::integer
    from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch12'
  ),
  5,
  'Batch 12 canonical channel IDs are unique'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where platform_identity_id=any(array[
      'UCAEv0ANkT221wXsTnxFnBsQ',
      'UCovxnbWKPCA5iJDxa9zbBew',
      'UCUoj77TIUy9DhLNe5EVmF-A',
      'UCev6abkwjdHj_dB3rquFfbQ',
      'UCCo_LMj-m3iGSSuytYq9n6Q'
    ]::text[])
  ),
  5,
  'Each approved Batch 12 canonical channel ID exists exactly once'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where connector_config->>'expansionWave'='wave2-batch12'
      and connector_config->>'canonicalChannelIdVerified'='true'
      and connector_config->>'ownershipVerified'='true'
      and connector_config->>'fallbackAuthoritative'='true'
      and connector_config->>'regionalPublisher'='true'
      and connector_config->>'evidenceRole'='FIRST_PARTY_MUSIC_LABEL'
  ),
  5,
  'Batch 12 carries verified ownership, fallback and regional evidence metadata'
);

select is(
  (
    select count(distinct (languages[1]))::integer
    from public.sources
    where display_name in (
      'T-Series Tamil','T-Series Kannada','T-Series Malayalam','T-Series Gujarati','T-Series Marathi'
    )
  ),
  5,
  'Batch 12 preserves five distinct regional language lanes'
);

select is(
  (select count(*)::integer from public.source_identities where platform='X' and active=true),
  0,
  'Wave 2 Batch 12 does not reactivate X'
);

select * from finish();
rollback;
