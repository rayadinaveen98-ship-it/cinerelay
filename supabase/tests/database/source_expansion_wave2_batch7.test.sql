begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select is(
  (select count(*)::integer from public.sources where display_name in ('Junglee Pictures','Surinder Films','SVF Entertainment','Eskay Movies','Dev Entertainment Ventures','Hoichoi','Addatimes') and active=true and authority_tier=1),
  7,
  'Batch 7 registers seven active Tier-1 first-party brands'
);

select is(
  (select count(*)::integer from public.sources where display_name in ('Junglee Pictures','Surinder Films','SVF Entertainment','Eskay Movies','Dev Entertainment Ventures') and source_role='PRODUCTION_HOUSE' and active=true and authority_tier=1),
  5,
  'Batch 7 registers five Tier-1 production/distribution brands'
);

select is(
  (select count(*)::integer from public.sources where display_name in ('Hoichoi','Addatimes') and source_role='OTT_PLATFORM' and active=true and authority_tier=1),
  2,
  'Batch 7 registers two Tier-1 OTT brands'
);

select is(
  (select count(*)::integer from public.source_identities where active=true and platform='YOUTUBE' and connector_config->>'expansionWave'='wave2-batch7'),
  7,
  'Batch 7 registers seven active canonical YouTube identities'
);

select is(
  (select count(*)::integer from public.source_identities where platform='YOUTUBE' and connector_type='YOUTUBE_WEBSUB' and poll_class='PUSH' and access_mode='WEBHOOK' and connector_config->>'expansionWave'='wave2-batch7'),
  7,
  'All Batch 7 identities use the WebSub accelerator path'
);

select is(
  (select count(*)::integer from public.youtube_channel_state ycs join public.source_identities si on si.id=ycs.source_identity_id where si.connector_config->>'expansionWave'='wave2-batch7' and ycs.uploads_playlist_id='UU' || substring(si.platform_identity_id from 3)),
  7,
  'All Batch 7 identities have canonical uploads-playlist fallback state'
);

select is(
  (select count(distinct platform_identity_id)::integer from public.source_identities where connector_config->>'expansionWave'='wave2-batch7'),
  7,
  'Batch 7 canonical channel IDs are unique'
);

select is(
  (select count(*)::integer from public.source_identities where connector_config->>'expansionWave'='wave2-batch7' and connector_config->>'ownershipVerified'='true' and connector_config->>'canonicalChannelIdVerified'='true' and connector_config->>'webSubRole'='ACCELERATOR' and connector_config->>'fallbackAuthoritative'='true'),
  7,
  'Every Batch 7 identity records ownership and fallback trust metadata'
);

select is(
  (select count(*)::integer from public.source_identities where platform_identity_id=any(array['UCTSewLhQ8JEhgPCT6N_YyJA','UC_IXqII-SVm7QNRwreq32dg','UC2GXNqco-k7fwg2SMM6SAzQ','UCZxu0dMOx9JpYsWkyDwunAQ','UCYBAnESPQtjTWSYsVxN9hJA','UC70iTGCj0G5vnpqqO46zQHA','UCM1PRBGrQws4TUWH6P_OJUw']::text[])),
  7,
  'Each approved Batch 7 canonical channel ID exists exactly once'
);

select is(
  (select count(*)::integer from public.source_identities where platform='X' and active=true),
  0,
  'Wave 2 Batch 7 does not reactivate X'
);

select * from finish();
rollback;
