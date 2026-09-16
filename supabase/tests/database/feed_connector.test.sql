begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into public.sources (id, display_name, authority_tier, source_role)
values ('41000000-0000-4000-8000-000000000001', 'Feed Test Studio', 1, 'STUDIO');

insert into public.source_identities (
  id, source_id, platform, canonical_url, connector_type, poll_class, access_mode, connector_config, active
) values (
  '42000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000001',
  'RSS',
  'https://studio.example.com/news',
  'RSS_ATOM',
  'ACTIVE_15M',
  'FEED',
  '{}'::jsonb,
  true
);

select throws_ok(
  $$select public.register_feed_source(
    '42000000-0000-4000-8000-000000000001'::uuid,
    'http://studio.example.com/feed.xml'::text,
    'feed-parser-v1'::text
  )$$,
  'P0001',
  'feed_url_must_be_https',
  'feed registration rejects insecure HTTP URLs'
);

select lives_ok(
  $$select public.register_feed_source(
    '42000000-0000-4000-8000-000000000001'::uuid,
    'https://studio.example.com/feed.xml'::text,
    'feed-parser-v1'::text
  )$$,
  'feed source registration succeeds for an active FEED identity'
);

select results_eq(
  $$select count(*) from public.feed_source_state where source_identity_id = '42000000-0000-4000-8000-000000000001'::uuid$$,
  array[1::bigint],
  'registration creates one feed state row'
);

select results_eq(
  $$select feed_url from public.feed_source_state where source_identity_id = '42000000-0000-4000-8000-000000000001'::uuid$$,
  array['https://studio.example.com/feed.xml'::text],
  'registered feed URL is persisted'
);

select results_eq(
  $$select parser_version from public.source_health where source_identity_id = '42000000-0000-4000-8000-000000000001'::uuid$$,
  array['feed-parser-v1'::text],
  'registration initializes source health parser version'
);

select lives_ok(
  $$select public.register_feed_source(
    '42000000-0000-4000-8000-000000000001'::uuid,
    'https://studio.example.com/feed-v2.xml'::text,
    'feed-parser-v2'::text
  )$$,
  'feed re-registration is idempotent and updates connector state'
);

select results_eq(
  $$select feed_url || '|' || parser_version from public.feed_source_state where source_identity_id = '42000000-0000-4000-8000-000000000001'::uuid$$,
  array['https://studio.example.com/feed-v2.xml|feed-parser-v2'::text],
  're-registration updates feed URL and parser version without duplication'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.feed_source_state'::regclass),
  'feed_source_state has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.connector_domain_state'::regclass),
  'connector_domain_state has RLS enabled'
);

select ok(
  not has_table_privilege('authenticated', 'public.feed_source_state', 'SELECT'),
  'authenticated users cannot read connector feed state directly'
);

select ok(
  not has_function_privilege('authenticated', 'public.register_feed_source(uuid,text,text)', 'EXECUTE'),
  'authenticated users cannot invoke feed registration directly'
);

select * from finish();
rollback;
