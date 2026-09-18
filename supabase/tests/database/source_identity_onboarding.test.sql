begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into public.sources (id, display_name, authority_tier, source_role, active)
values
  ('51000000-0000-4000-8000-000000000001', 'Onboarding Test Studio A', 1, 'PRODUCTION_HOUSE', true),
  ('51000000-0000-4000-8000-000000000002', 'Onboarding Test Studio B', 1, 'PRODUCTION_HOUSE', true);

select results_eq(
  $$select created from public.attach_source_identity(
    '51000000-0000-4000-8000-000000000001'::uuid,
    'YOUTUBE',
    'UC1234567890123456789012',
    '@TestStudioA',
    'https://www.youtube.com/channel/UC1234567890123456789012',
    'YOUTUBE_WEBSUB',
    'PUSH',
    'WEBHOOK',
    '{"schemaVersion":1,"discoveryPriority":"HIGH"}'::jsonb,
    true
  )$$,
  array[true],
  'first YouTube attach creates one identity'
);

select results_eq(
  $$select created from public.attach_source_identity(
    '51000000-0000-4000-8000-000000000001'::uuid,
    'YOUTUBE',
    'UC1234567890123456789012',
    '@TestStudioA',
    'https://www.youtube.com/channel/UC1234567890123456789012',
    'YOUTUBE_WEBSUB',
    'PUSH',
    'WEBHOOK',
    '{"schemaVersion":1,"discoveryPriority":"HIGH"}'::jsonb,
    true
  )$$,
  array[false],
  're-attaching the same YouTube identity is idempotent'
);

select results_eq(
  $$select count(*) from public.source_identities where platform='YOUTUBE' and platform_identity_id='UC1234567890123456789012'$$,
  array[1::bigint],
  'idempotent attach does not duplicate the YouTube identity'
);

select lives_ok(
  $$select public.seed_source_identity_runtime(
    (select id from public.source_identities where platform='YOUTUBE' and platform_identity_id='UC1234567890123456789012'),
    null
  )$$,
  'YouTube runtime seeding succeeds in a separate phase'
);

select results_eq(
  $$select uploads_playlist_id from public.youtube_channel_state where source_identity_id=(select id from public.source_identities where platform='YOUTUBE' and platform_identity_id='UC1234567890123456789012')$$,
  array['UU1234567890123456789012'::text],
  'YouTube state derives the uploads playlist from the canonical channel ID'
);

select results_eq(
  $$select health_state from public.source_health where source_identity_id=(select id from public.source_identities where platform='YOUTUBE' and platform_identity_id='UC1234567890123456789012')$$,
  array['HEALTHY'::text],
  'active YouTube runtime is HEALTHY after seeding'
);

select results_eq(
  $$select created from public.attach_source_identity(
    '51000000-0000-4000-8000-000000000001'::uuid,
    'X',
    'teststudioa',
    '@TestStudioA',
    'https://x.com/TestStudioA',
    'X_API_V2',
    'HOT_5M',
    'API',
    '{"schemaVersion":1,"activationState":"PENDING_X_API_CREDENTIALS"}'::jsonb,
    false
  )$$,
  array[true],
  'dormant X identity attaches without activation'
);

select lives_ok(
  $$select public.seed_source_identity_runtime(
    (select id from public.source_identities where platform='X' and platform_identity_id='teststudioa'),
    null
  )$$,
  'dormant X runtime state can be seeded safely'
);

select results_eq(
  $$select (si.active::text || '|' || coalesce(xs.next_check_at::text,'NULL') || '|' || sh.health_state || '|' || coalesce(sh.next_due_at::text,'NULL'))
    from public.source_identities si
    join public.x_profile_source_state xs on xs.source_identity_id=si.id
    join public.source_health sh on sh.source_identity_id=si.id
    where si.platform='X' and si.platform_identity_id='teststudioa'$$,
  array['false|NULL|DISABLED|NULL'::text],
  'dormant X seed keeps polling disabled and unscheduled'
);

select throws_ok(
  $$select * from public.attach_source_identity(
    '51000000-0000-4000-8000-000000000002'::uuid,
    'YOUTUBE',
    'UC1234567890123456789012',
    '@TestStudioA',
    'https://www.youtube.com/channel/UC1234567890123456789012',
    'YOUTUBE_WEBSUB',
    'PUSH',
    'WEBHOOK',
    '{"schemaVersion":1}'::jsonb,
    true
  )$$,
  'P0001',
  'source_identity_owned_by_other_source',
  'an identity cannot be silently reassigned to another source'
);

select ok(
  not has_function_privilege('authenticated', 'public.attach_source_identity(uuid,text,text,text,text,text,text,text,jsonb,boolean)', 'EXECUTE'),
  'authenticated users cannot attach source identities directly'
);

select ok(
  not has_function_privilege('authenticated', 'public.seed_source_identity_runtime(uuid,text)', 'EXECUTE'),
  'authenticated users cannot seed source runtime state directly'
);

select * from finish();
rollback;
