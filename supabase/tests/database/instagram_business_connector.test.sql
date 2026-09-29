begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into public.sources (id, display_name, authority_tier, source_role, active)
values ('91000000-0000-4000-8000-000000000001', 'Instagram Test Studio', 1, 'PRODUCTION_HOUSE', true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, handle, canonical_url,
  connector_type, poll_class, access_mode, active
) values (
  '92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  'INSTAGRAM', null, '@Example.Studio', 'https://www.instagram.com/example.studio/',
  'INSTAGRAM_BUSINESS_DISCOVERY', 'ACTIVE_15M', 'API', true
);

select lives_ok(
  $$select public.register_instagram_business_source(
    '92000000-0000-4000-8000-000000000001'::uuid,
    '@Example.Studio',
    'instagram-business-discovery-v1'
  )$$,
  'service path can register an active Instagram Business Discovery source'
);

select results_eq(
  $$select username from public.instagram_business_source_state
    where source_identity_id='92000000-0000-4000-8000-000000000001'::uuid$$,
  array['example.studio'::text],
  'Instagram username is normalized before persistence'
);

select results_eq(
  $$select connector_version from public.instagram_business_source_state
    where source_identity_id='92000000-0000-4000-8000-000000000001'::uuid$$,
  array['instagram-business-discovery-v1'::text],
  'connector version is pinned in runtime state'
);

select results_eq(
  $$select count(*) from public.source_health
    where source_identity_id='92000000-0000-4000-8000-000000000001'::uuid$$,
  array[1::bigint],
  'registration creates source health telemetry'
);

select ok(
  (select relrowsecurity from pg_class where oid='public.instagram_business_source_state'::regclass),
  'Instagram connector state has RLS enabled'
);

select ok(
  not has_table_privilege('authenticated', 'public.instagram_business_source_state', 'SELECT'),
  'authenticated users cannot directly read Instagram connector state'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.register_instagram_business_source(uuid,text,text)',
    'EXECUTE'
  ),
  'authenticated users cannot invoke Instagram registration RPC'
);

select throws_ok(
  $$select public.register_instagram_business_source(
    '92000000-0000-4000-8000-000000000001'::uuid,
    'bad/name',
    'instagram-business-discovery-v1'
  )$$,
  'P0001',
  'invalid_instagram_username',
  'invalid Instagram usernames fail closed'
);

update public.source_identities
set access_mode='PUBLIC_WEB'
where id='92000000-0000-4000-8000-000000000001'::uuid;

select throws_ok(
  $$select public.register_instagram_business_source(
    '92000000-0000-4000-8000-000000000001'::uuid,
    'example.studio',
    'instagram-business-discovery-v1'
  )$$,
  'P0001',
  'source_identity_access_mode_must_be_api',
  'registration rejects non-API access mode'
);

update public.source_identities
set access_mode='API', handle='@different'
where id='92000000-0000-4000-8000-000000000001'::uuid;

select throws_ok(
  $$select public.register_instagram_business_source(
    '92000000-0000-4000-8000-000000000001'::uuid,
    'example.studio',
    'instagram-business-discovery-v1'
  )$$,
  'P0001',
  'source_identity_handle_mismatch',
  'registration rejects a username that disagrees with the curated identity handle'
);

update public.source_identities
set handle='@example.studio', platform='WEB'
where id='92000000-0000-4000-8000-000000000001'::uuid;

select throws_ok(
  $$select public.register_instagram_business_source(
    '92000000-0000-4000-8000-000000000001'::uuid,
    'example.studio',
    'instagram-business-discovery-v1'
  )$$,
  'P0001',
  'source_identity_platform_must_be_instagram',
  'registration rejects non-Instagram identities'
);

select * from finish();
rollback;
