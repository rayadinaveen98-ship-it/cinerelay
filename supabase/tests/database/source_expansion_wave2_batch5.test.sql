begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select is(
  (select count(*)::integer from public.source_identities where active=true and connector_config->>'expansionWave'='wave2-batch5'),
  11,
  'wave 2 batch 5 registers exactly eleven active identities'
);

select is(
  (select count(*)::integer from public.source_identities where active=true and platform='YOUTUBE' and connector_config->>'expansionWave'='wave2-batch5'),
  5,
  'batch 5 registers five active canonical YouTube identities'
);

select is(
  (select count(*)::integer from public.youtube_channel_state ycs join public.source_identities si on si.id=ycs.source_identity_id where si.connector_config->>'expansionWave'='wave2-batch5' and ycs.uploads_playlist_id='UU'||substring(si.platform_identity_id from 3)),
  5,
  'all batch 5 YouTube identities have authoritative uploads-playlist runtime'
);

select is(
  (select count(*)::integer from public.source_identities where active=true and platform='RSS' and connector_config->>'expansionWave'='wave2-batch5'),
  6,
  'batch 5 registers six active RSS identities'
);

select is(
  (select count(*)::integer from public.feed_source_state fss join public.source_identities si on si.id=fss.source_identity_id where si.connector_config->>'expansionWave'='wave2-batch5'),
  6,
  'all batch 5 RSS identities have feed runtime state'
);

select is(
  (select count(*)::integer from public.sources where display_name in ('Telugu Filmnagar','Galatta Plus','Cinema Vikatan') and authority_tier=3 and source_role='TRADE_MEDIA' and active=true),
  3,
  'cinema-focused reporting brands remain Tier 3 trade media'
);

select is(
  (select count(*)::integer from public.sources where display_name='Moviebuff Tamil' and authority_tier=3 and source_role='MEDIA_LIBRARY' and active=true),
  1,
  'Moviebuff Tamil is capped at Tier 3 media-library authority'
);

select is(
  (select count(*)::integer from public.sources where display_name in ('Behindwoods TV','NDTV Movies','The Times of India — Entertainment') and authority_tier=4 and source_role='GENERAL_MEDIA' and active=true),
  3,
  'mixed and general publishers remain Tier 4 general media'
);

select is(
  (select count(*)::integer from public.source_identities si join public.sources s on s.id=si.source_id where s.display_name='The Times of India — Entertainment' and si.platform='RSS' and si.connector_config->>'expansionWave'='wave2-batch5'),
  5,
  'TOI entertainment has one national and four regional RSS lanes in batch 5'
);

select is(
  (select count(*)::integer from public.source_identities where platform='X' and active=true),
  0,
  'wave 2 batch 5 does not reactivate X'
);

select * from finish();
rollback;
