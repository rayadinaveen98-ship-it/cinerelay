begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select is(
  (select count(*)::integer from public.sources where display_name='Hindustan Times — Entertainment' and active=true and authority_tier=4 and source_role='GENERAL_MEDIA'),
  1,
  'Batch 6 keeps Hindustan Times active as Tier 4 general media'
);

select is(
  (select count(*)::integer from public.sources where display_name='Live Hindustan — Entertainment' and active=false and authority_tier=4 and source_role='GENERAL_MEDIA'),
  1,
  'Batch 6 holds Live Hindustan inactive after parser-empty production canary'
);

select is(
  (select count(*)::integer from public.source_identities where active=true and platform='RSS' and connector_config->>'expansionWave'='wave2-batch6'),
  8,
  'Batch 6 leaves eight healthy RSS identities active'
);

select is(
  (select count(*)::integer from public.source_identities where platform='RSS' and connector_config->>'expansionWave'='wave2-batch6'),
  10,
  'Batch 6 retains ten reviewed RSS identities in the registry'
);

select is(
  (select count(*)::integer from public.feed_source_state fss join public.source_identities si on si.id=fss.source_identity_id where si.connector_config->>'expansionWave'='wave2-batch6'),
  10,
  'All Batch 6 identities retain feed runtime state for observability'
);

select is(
  (select count(*)::integer from public.source_identities si join public.sources s on s.id=si.source_id where s.display_name='Hindustan Times — Entertainment' and si.platform='RSS' and si.connector_config->>'expansionWave'='wave2-batch6' and si.active=true),
  8,
  'Hindustan Times has eight active entertainment/cinema feed lanes'
);

select is(
  (select count(*)::integer from public.source_identities si join public.sources s on s.id=si.source_id where s.display_name='Live Hindustan — Entertainment' and si.platform='RSS' and si.connector_config->>'expansionWave'='wave2-batch6' and si.active=false and si.connector_config->>'canaryStatus'='PARSER_HOLD' and si.connector_config->>'activationBlocked'='feed_parser_empty_200'),
  2,
  'Both Live Hindustan feed identities are explicitly held for parser compatibility'
);

select is(
  (select count(*)::integer from public.source_identities si join public.sources s on s.id=si.source_id where s.display_name='Hindustan Times — Entertainment' and si.connector_config->>'feedPurpose' in ('TELUGU_CINEMA','TAMIL_CINEMA') and si.active=true),
  2,
  'HT regional cinema lanes include active Telugu and Tamil feeds'
);

select is(
  (select count(*)::integer from public.source_identities si join public.sources s on s.id=si.source_id where s.display_name in ('Hindustan Times — Entertainment','Live Hindustan — Entertainment') and si.connector_config->>'trustPath'='GENERAL_MEDIA_TIER4'),
  10,
  'All Batch 6 feed identities retain Tier 4 trust path metadata'
);

select is(
  (select count(*)::integer from public.source_identities where platform='X' and active=true),
  0,
  'Wave 2 Batch 6 does not reactivate X'
);

select * from finish();
rollback;
