begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

select is(
  (select count(*)::integer from public.sources where display_name in ('Hindustan Times — Entertainment','Live Hindustan — Entertainment') and active=true and authority_tier=4 and source_role='GENERAL_MEDIA'),
  2,
  'batch 6 registers two Tier 4 general-media brands'
);

select is(
  (select count(*)::integer from public.source_identities where active=true and platform='RSS' and connector_config->>'expansionWave'='wave2-batch6'),
  10,
  'batch 6 registers ten active RSS identities'
);

select is(
  (select count(*)::integer from public.feed_source_state fss join public.source_identities si on si.id=fss.source_identity_id where si.connector_config->>'expansionWave'='wave2-batch6'),
  10,
  'all batch 6 RSS identities have feed runtime state'
);

select is(
  (select count(*)::integer from public.source_identities si join public.sources s on s.id=si.source_id where s.display_name='Hindustan Times — Entertainment' and si.platform='RSS' and si.connector_config->>'expansionWave'='wave2-batch6'),
  8,
  'Hindustan Times has eight entertainment/cinema feed lanes'
);

select is(
  (select count(*)::integer from public.source_identities si join public.sources s on s.id=si.source_id where s.display_name='Live Hindustan — Entertainment' and si.platform='RSS' and si.connector_config->>'expansionWave'='wave2-batch6'),
  2,
  'Live Hindustan has article and video entertainment feed lanes'
);

select is(
  (select count(*)::integer from public.source_identities si join public.sources s on s.id=si.source_id where s.display_name='Hindustan Times — Entertainment' and si.connector_config->>'feedPurpose' in ('TELUGU_CINEMA','TAMIL_CINEMA')),
  2,
  'HT regional cinema lanes include Telugu and Tamil'
);

select is(
  (select count(*)::integer from public.source_identities si join public.sources s on s.id=si.source_id where s.display_name in ('Hindustan Times — Entertainment','Live Hindustan — Entertainment') and si.connector_config->>'trustPath'='GENERAL_MEDIA_TIER4'),
  10,
  'all batch 6 feed identities carry Tier 4 trust path metadata'
);

select is(
  (select count(*)::integer from public.source_identities where platform='X' and active=true),
  0,
  'wave 2 batch 6 does not reactivate X'
);

select * from finish();
rollback;
