begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.sources (id, display_name, authority_tier, source_role, active)
values ('81000000-0000-4000-8000-000000000001', 'Threads Test Studio', 1, 'PRODUCTION_HOUSE', true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, handle, canonical_url, connector_type, poll_class, access_mode, active
) values (
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  'THREADS', null, '@Example.Studio', 'https://www.threads.net/@example.studio',
  'THREADS_PROFILE_API', 'ACTIVE_15M', 'API', true
);

select lives_ok(
  $$select public.register_threads_profile_source(
    '82000000-0000-4000-8000-000000000001'::uuid,
    '@Example.Studio',
    'threads-profile-v1'
  )$$,
  'service role can register an active Threads public-profile source'
);

select results_eq(
  $$select username from public.threads_profile_source_state where source_identity_id='82000000-0000-4000-8000-000000000001'::uuid$$,
  array['example.studio'::text],
  'Threads username is normalized before persistence'
);

select results_eq(
  $$select connector_version from public.threads_profile_source_state where source_identity_id='82000000-0000-4000-8000-000000000001'::uuid$$,
  array['threads-profile-v1'::text],
  'connector version is pinned in runtime state'
);

select results_eq(
  $$select count(*) from public.source_health where source_identity_id='82000000-0000-4000-8000-000000000001'::uuid$$,
  array[1::bigint],
  'registration creates source health telemetry'
);

select ok(
  (select relrowsecurity from pg_class where oid='public.threads_profile_source_state'::regclass),
  'Threads connector state has RLS enabled'
);

select ok(
  not has_table_privilege('authenticated', 'public.threads_profile_source_state', 'SELECT'),
  'authenticated users cannot directly read Threads connector state'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.register_threads_profile_source(uuid,text,text)',
    'EXECUTE'
  ),
  'authenticated users cannot invoke Threads registration RPC'
);

select throws_ok(
  $$select public.register_threads_profile_source(
    '82000000-0000-4000-8000-000000000001'::uuid,
    'bad/name',
    'threads-profile-v1'
  )$$,
  'P0001',
  'invalid_threads_username',
  'invalid Threads usernames fail closed'
);

update public.source_identities
set access_mode='PUBLIC_WEB'
where id='82000000-0000-4000-8000-000000000001'::uuid;

select throws_ok(
  $$select public.register_threads_profile_source(
    '82000000-0000-4000-8000-000000000001'::uuid,
    'example.studio',
    'threads-profile-v1'
  )$$,
  'P0001',
  'source_identity_access_mode_must_be_api',
  'registration rejects non-API access modes'
);

update public.source_identities
set access_mode='API', handle='@different'
where id='82000000-0000-4000-8000-000000000001'::uuid;

select throws_ok(
  $$select public.register_threads_profile_source(
    '82000000-0000-4000-8000-000000000001'::uuid,
    'example.studio',
    'threads-profile-v1'
  )$$,
  'P0001',
  'source_identity_handle_mismatch',
  'registration rejects a username that disagrees with the curated identity handle'
);

select * from finish();
rollback;
