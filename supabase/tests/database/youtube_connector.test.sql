begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

select has_table('public', 'connector_subscriptions', 'connector_subscriptions exists');
select has_table('public', 'youtube_channel_state', 'youtube_channel_state exists');
select has_table('public', 'source_entity_candidates', 'source_entity_candidates exists');

insert into public.entities (id, entity_type, canonical_name, slug, status)
values
  ('10000000-0000-4000-8000-000000000001', 'MOVIE', 'Example Film', 'example-film-test', 'ACTIVE'),
  ('10000000-0000-4000-8000-000000000002', 'SERIES', 'Example Series', 'example-series-test', 'ACTIVE');

insert into public.entity_aliases (entity_id, alias, normalized_alias, alias_type)
values
  ('10000000-0000-4000-8000-000000000001', '#ExampleFilm', 'examplefilm', 'HASHTAG'),
  ('10000000-0000-4000-8000-000000000002', 'Example Series S1', 'example series s1', 'OFFICIAL');

insert into public.sources (id, display_name, authority_tier, source_role, active)
values ('20000000-0000-4000-8000-000000000001', 'Example Studio', 1, 'PRODUCTION_HOUSE', true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, canonical_url,
  connector_type, poll_class, access_mode, active
)
values (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'YOUTUBE',
  'UCaaaaaaaaaaaaaaaaaaaaaa',
  'https://www.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa',
  'YOUTUBE_WEBSUB', 'PUSH', 'WEBHOOK', true
);

insert into public.raw_items (
  id, source_identity_id, platform_item_id, canonical_url, item_type,
  raw_title, raw_text, normalized_text, media_type, content_fingerprint
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'vidAAA12345',
    'https://www.youtube.com/watch?v=vidAAA12345',
    'YOUTUBE_VIDEO',
    'Example Film Official Trailer',
    'The official trailer of #ExampleFilm is here.',
    'example film official trailer the official trailer of examplefilm is here',
    'VIDEO',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    'vidBBB12345',
    'https://www.youtube.com/watch?v=vidBBB12345',
    'YOUTUBE_VIDEO',
    'Example Film Trailer Repost',
    'Example Film trailer released.',
    'example film trailer repost example film trailer released',
    'VIDEO',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  );

select is(
  public.replace_source_entity_candidates(
    '30000000-0000-4000-8000-000000000001',
    array[
      '10000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-4000-8000-000000000002'::uuid
    ]
  ),
  2,
  'source candidate scope can be established atomically'
);

select results_eq(
  $$select count(*) from public.source_entity_candidates where source_identity_id = '30000000-0000-4000-8000-000000000001' and active = true$$,
  array[2::bigint],
  'candidate scope contains exactly two active titles'
);

select is(
  public.replace_source_entity_candidates(
    '30000000-0000-4000-8000-000000000001',
    array['10000000-0000-4000-8000-000000000001'::uuid]
  ),
  1,
  'source candidate scope replacement removes stale titles'
);

select lives_ok(
  $$select public.record_entity_resolution(
    '40000000-0000-4000-8000-000000000001',
    null,
    0,
    'UNRESOLVED',
    '[{"method":"TEST"}]'::jsonb,
    'test-resolver-v1'
  )$$,
  'unresolved raw items can be recorded without inventing an entity'
);

select results_eq(
  $$select count(*) from public.entity_resolution_results where raw_item_id = '40000000-0000-4000-8000-000000000001' and resolution_state = 'UNRESOLVED' and entity_id is null$$,
  array[1::bigint],
  'unresolved resolution remains auditable with a null entity id'
);

select is(
  public.enqueue_job('TEST_JOB', 'test:idempotent-job', '{"value":1}'::jsonb, 50),
  public.enqueue_job('TEST_JOB', 'test:idempotent-job', '{"value":2}'::jsonb, 25),
  're-enqueuing the same idempotency key returns the same job'
);

select results_eq(
  $$select count(*) from public.jobs where idempotency_key = 'test:idempotent-job'$$,
  array[1::bigint],
  'idempotent enqueue creates only one job row'
);

select lives_ok(
  $$select public.upsert_canonical_event_with_evidence(
    '50000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'TRAILER_RELEASED',
    'RELIABLE_REPORT',
    'CRITICAL',
    'Trailer released',
    '{}'::jsonb,
    'test:example-film:trailer',
    'test-classifier-v1',
    '40000000-0000-4000-8000-000000000001'
  )$$,
  'first evidence creates a canonical event'
);

select lives_ok(
  $$select public.upsert_canonical_event_with_evidence(
    '50000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'TRAILER_RELEASED',
    'OFFICIAL',
    'CRITICAL',
    'Trailer released',
    '{}'::jsonb,
    'test:example-film:trailer',
    'test-classifier-v1',
    '40000000-0000-4000-8000-000000000002'
  )$$,
  'repeat evidence deduplicates into the existing canonical event'
);

select results_eq(
  $$select count(*) from public.events where dedupe_key = 'test:example-film:trailer'$$,
  array[1::bigint],
  'duplicate evidence does not create duplicate canonical events'
);

select results_eq(
  $$select count(*) from public.event_evidence ee join public.events e on e.id = ee.event_id where e.dedupe_key = 'test:example-film:trailer'$$,
  array[2::bigint],
  'canonical event preserves both evidence rows'
);

select results_eq(
  $$select verification_state from public.events where dedupe_key = 'test:example-film:trailer'$$,
  array['OFFICIAL'::text],
  'stronger official evidence upgrades canonical verification state'
);

select ok(
  has_table_privilege('service_role', 'public.raw_items', 'SELECT'),
  'service_role can read internal raw items through the Data API'
);

select ok(
  has_table_privilege('service_role', 'public.raw_items', 'INSERT'),
  'service_role can persist internal raw items through the Data API'
);

select ok(
  has_table_privilege('service_role', 'public.connector_quota_usage', 'INSERT'),
  'service_role can append connector quota usage'
);

select ok(
  has_function_privilege(
    'service_role',
    to_regprocedure('public.enqueue_job(text,text,jsonb,integer,timestamp with time zone)'),
    'EXECUTE'
  ),
  'service_role can invoke internal queue RPCs'
);

select ok(
  not has_table_privilege('anon', 'public.raw_items', 'SELECT'),
  'anonymous clients cannot read internal raw items'
);

select ok(
  not has_function_privilege(
    'authenticated',
    to_regprocedure('public.enqueue_job(text,text,jsonb,integer,timestamp with time zone)'),
    'EXECUTE'
  ),
  'authenticated clients cannot invoke internal queue RPCs'
);

select * from finish();
rollback;
