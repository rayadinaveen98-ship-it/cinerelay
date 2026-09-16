begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.sources (id, display_name, authority_tier, source_role)
values ('51000000-0000-4000-8000-000000000001', 'Page Test Studio', 1, 'PRODUCTION_HOUSE');

insert into public.source_identities (
  id, source_id, platform, canonical_url, connector_type, poll_class, access_mode, connector_config, active
) values (
  '52000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000001',
  'WEB',
  'https://studio.example.com/news/',
  'FIRST_PARTY_HTML',
  'NORMAL_60M',
  'PUBLIC_WEB',
  '{"parserProfile":{"profileVersion":"studio-news-v1","itemSelector":"article.news-card","linkSelector":"a.story-link","titleSelector":".story-title","minItems":1}}'::jsonb,
  true
);

select lives_ok(
  $$select public.register_page_source(
    '52000000-0000-4000-8000-000000000001'::uuid,
    'https://studio.example.com/news/'::text
  )$$,
  'page source registration succeeds for an active PUBLIC_WEB identity'
);

select results_eq(
  $$select count(*) from public.page_source_state where source_identity_id = '52000000-0000-4000-8000-000000000001'::uuid$$,
  array[1::bigint],
  'registration creates one page state row'
);

select results_eq(
  $$select page_url from public.page_source_state where source_identity_id = '52000000-0000-4000-8000-000000000001'::uuid$$,
  array['https://studio.example.com/news/'::text],
  'registered page URL is persisted'
);

select results_eq(
  $$select parser_profile_version from public.page_source_state where source_identity_id = '52000000-0000-4000-8000-000000000001'::uuid$$,
  array['studio-news-v1'::text],
  'parser profile version is derived from service-side connector config'
);

select results_eq(
  $$select parser_version from public.source_health where source_identity_id = '52000000-0000-4000-8000-000000000001'::uuid$$,
  array['first-party-html-v1'::text],
  'registration initializes source health parser version'
);

update public.source_identities
set connector_config = jsonb_set(connector_config, '{parserProfile,profileVersion}', '"studio-news-v2"'::jsonb)
where id = '52000000-0000-4000-8000-000000000001'::uuid;

select lives_ok(
  $$select public.register_page_source(
    '52000000-0000-4000-8000-000000000001'::uuid,
    'https://studio.example.com/press/'::text
  )$$,
  'page re-registration is idempotent and updates runtime registration state'
);

select results_eq(
  $$select page_url || '|' || parser_profile_version from public.page_source_state where source_identity_id = '52000000-0000-4000-8000-000000000001'::uuid$$,
  array['https://studio.example.com/press/|studio-news-v2'::text],
  're-registration updates page URL and parser profile version without duplication'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.page_source_state'::regclass),
  'page_source_state has RLS enabled'
);

select ok(
  not has_table_privilege('authenticated', 'public.page_source_state', 'SELECT'),
  'authenticated users cannot read page connector runtime state directly'
);

select ok(
  not has_function_privilege('authenticated', 'public.register_page_source(uuid,text)', 'EXECUTE'),
  'authenticated users cannot invoke page registration directly'
);

select * from finish();
rollback;
