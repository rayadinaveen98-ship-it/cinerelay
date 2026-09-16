begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('c1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'p5-user1@example.com', '', now(), now()),
  ('c1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'p5-user2@example.com', '', now(), now()),
  ('c1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'p5-user3@example.com', '', now(), now());

insert into public.entities (id, entity_type, canonical_name, primary_language, country_code, status)
values ('c2000000-0000-4000-8000-000000000001', 'MOVIE', 'P5 Alert Movie', 'te', 'IN', 'ACTIVE');

insert into public.sources (id, display_name, authority_tier, source_role, active)
values ('c3000000-0000-4000-8000-000000000001', 'P5 Official Studio', 1, 'PRODUCTION_HOUSE', true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, canonical_url, connector_type, poll_class, access_mode, active
) values (
  'c4000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000001',
  'YOUTUBE', 'UCp5alert000000000000000', 'https://www.youtube.com/channel/UCp5alert000000000000000',
  'YOUTUBE_PLAYLIST', 'HOT_5M', 'API', true
);

insert into public.raw_items (
  id, source_identity_id, platform_item_id, canonical_url, item_type,
  raw_title, raw_text, normalized_text, metadata, content_fingerprint
) values
(
  'c5000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001', 'p5-alert-1',
  'https://www.youtube.com/watch?v=p5-alert-1', 'YOUTUBE_VIDEO', 'P5 alert one', 'Official update',
  'p5 alert one official update', '{}'::jsonb, repeat('c',64)
),
(
  'c5000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000001', 'p5-alert-2',
  'https://www.youtube.com/watch?v=p5-alert-2', 'YOUTUBE_VIDEO', 'P5 alert two', 'Repeat evidence',
  'p5 alert two repeat evidence', '{}'::jsonb, repeat('d',64)
);

insert into public.user_entity_follows (user_id, entity_id, active)
values
  ('c1000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', true),
  ('c1000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000001', true);

insert into public.user_alert_preferences (user_id, alert_mode)
values ('c1000000-0000-4000-8000-000000000002', 'MUTED');

select ok((select relrowsecurity from pg_class where oid='public.user_entity_follows'::regclass), 'entity follows has RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.user_alert_preferences'::regclass), 'alert preferences has RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.user_alert_event_preferences'::regclass), 'event preferences has RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.alert_deliveries'::regclass), 'alert outbox has RLS enabled');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select is((select count(*) from public.user_entity_follows), 1::bigint, 'authenticated user sees only own follows');
reset role;

select public.upsert_canonical_event_with_evidence(
  'c6000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'PROJECT_ANNOUNCED', 'OFFICIAL', 'HIGH', 'P5 Alert Movie announced',
  '{}'::jsonb, 'p5-alert-event-project', 'test-p5',
  'c5000000-0000-4000-8000-000000000001'
);

select results_eq(
  $$select count(*) from public.alert_deliveries where user_id='c1000000-0000-4000-8000-000000000001'::uuid and event_id='c6000000-0000-4000-8000-000000000001'::uuid and delivery_kind='PUSH'$$,
  array[1::bigint],
  'default preferences plan one instant alert for a HIGH official event'
);

select results_eq(
  $$select count(*) from public.alert_deliveries where user_id='c1000000-0000-4000-8000-000000000002'::uuid$$,
  array[0::bigint],
  'muted follower receives no alert plan'
);

select public.upsert_canonical_event_with_evidence(
  'c6000000-0000-4000-8000-000000000099',
  'c2000000-0000-4000-8000-000000000001',
  'PROJECT_ANNOUNCED', 'OFFICIAL', 'HIGH', 'P5 Alert Movie announced',
  '{}'::jsonb, 'p5-alert-event-project', 'test-p5',
  'c5000000-0000-4000-8000-000000000002'
);

select results_eq(
  $$select count(*) from public.alert_deliveries where user_id='c1000000-0000-4000-8000-000000000001'::uuid and event_id='c6000000-0000-4000-8000-000000000001'::uuid and delivery_kind='PUSH'$$,
  array[1::bigint],
  'repeat evidence on the same canonical event does not duplicate the push alert'
);

select public.upsert_canonical_event_with_evidence(
  'c6000000-0000-4000-8000-000000000002',
  'c2000000-0000-4000-8000-000000000001',
  'POSTER_RELEASED', 'OFFICIAL', 'NORMAL', 'P5 Alert Movie poster',
  '{}'::jsonb, 'p5-alert-event-poster', 'test-p5',
  'c5000000-0000-4000-8000-000000000001'
);

select results_eq(
  $$select count(*) from public.alert_deliveries where event_id='c6000000-0000-4000-8000-000000000002'::uuid$$,
  array[0::bigint],
  'NORMAL event is filtered by the default HIGH minimum priority'
);

insert into public.user_alert_event_preferences (user_id, event_type, enabled, mode_override)
values ('c1000000-0000-4000-8000-000000000001', 'TRAILER_RELEASED', true, 'DIGEST');

select public.upsert_canonical_event_with_evidence(
  'c6000000-0000-4000-8000-000000000003',
  'c2000000-0000-4000-8000-000000000001',
  'TRAILER_RELEASED', 'OFFICIAL', 'CRITICAL', 'P5 Alert Movie trailer released',
  '{}'::jsonb, 'p5-alert-event-trailer', 'test-p5',
  'c5000000-0000-4000-8000-000000000001'
);

select results_eq(
  $$select delivery_kind || ':' || status from public.alert_deliveries where user_id='c1000000-0000-4000-8000-000000000001'::uuid and event_id='c6000000-0000-4000-8000-000000000003'::uuid$$,
  array['DIGEST:DEFERRED'::text],
  'per-event-type DIGEST override creates one deferred digest entry'
);

select results_eq(
  $$select count(*) from public.alert_deliveries where user_id='c1000000-0000-4000-8000-000000000001'::uuid and event_id='c6000000-0000-4000-8000-000000000003'::uuid and delivery_kind='PUSH'$$,
  array[0::bigint],
  'digest override suppresses instant push for that event type'
);

select public.upsert_canonical_event_with_evidence(
  'c6000000-0000-4000-8000-000000000004',
  'c2000000-0000-4000-8000-000000000001',
  'SHOOT_WRAPPED', 'RUMOR', 'HIGH', 'Rumored P5 shoot wrap',
  '{}'::jsonb, 'p5-alert-event-rumor-filtered', 'test-p5',
  'c5000000-0000-4000-8000-000000000001'
);

select results_eq(
  $$select count(*) from public.alert_deliveries where event_id='c6000000-0000-4000-8000-000000000004'::uuid$$,
  array[0::bigint],
  'rumors are excluded from alerts by default'
);

insert into public.user_alert_preferences (user_id, include_rumors)
values ('c1000000-0000-4000-8000-000000000001', true)
on conflict (user_id) do update set include_rumors=excluded.include_rumors;

select public.upsert_canonical_event_with_evidence(
  'c6000000-0000-4000-8000-000000000005',
  'c2000000-0000-4000-8000-000000000001',
  'SONG_RELEASED', 'RUMOR', 'HIGH', 'Rumored P5 song release',
  '{}'::jsonb, 'p5-alert-event-rumor-enabled', 'test-p5',
  'c5000000-0000-4000-8000-000000000001'
);

select results_eq(
  $$select count(*) from public.alert_deliveries where user_id='c1000000-0000-4000-8000-000000000001'::uuid and event_id='c6000000-0000-4000-8000-000000000005'::uuid and delivery_kind='PUSH'$$,
  array[1::bigint],
  'explicit rumor opt-in permits a high-priority rumor alert'
);

select is(
  public.next_alert_allowed_at(
    '2026-09-16 18:00:00+00'::timestamptz,
    'Asia/Kolkata', true, time '22:30', time '08:00', false, 'HIGH'
  ),
  '2026-09-17 02:30:00+00'::timestamptz,
  'overnight quiet hours defer to 08:00 local time'
);

select is(
  public.next_alert_allowed_at(
    '2026-09-16 18:00:00+00'::timestamptz,
    'Asia/Kolkata', true, time '22:30', time '08:00', true, 'CRITICAL'
  ),
  '2026-09-16 18:00:00+00'::timestamptz,
  'critical bypass can override quiet hours only when explicitly enabled'
);

select throws_ok(
  $$insert into public.user_alert_preferences (user_id, timezone_name) values ('c1000000-0000-4000-8000-000000000003'::uuid, 'Not/A_Real_Timezone')$$,
  'P0001',
  'invalid_alert_timezone',
  'invalid IANA timezone is rejected before it can break alert scheduling'
);

select ok(
  not has_table_privilege('authenticated', 'public.alert_deliveries', 'INSERT'),
  'authenticated clients cannot insert directly into the alert outbox'
);

select ok(
  not has_function_privilege('authenticated', 'public.plan_event_alerts(uuid)', 'EXECUTE'),
  'authenticated clients cannot invoke the internal alert planner directly'
);

insert into public.user_entity_follows (user_id, entity_id, active)
values ('c1000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000001', true);

select public.plan_event_alerts('c6000000-0000-4000-8000-000000000001');

select results_eq(
  $$select count(*) from public.alert_deliveries where user_id='c1000000-0000-4000-8000-000000000003'::uuid and event_id='c6000000-0000-4000-8000-000000000001'::uuid$$,
  array[0::bigint],
  'following after an event was created does not backfill an old alert'
);

insert into public.events (
  id, primary_entity_id, event_type, verification_state, priority_band, headline,
  structured_data, dedupe_key, status, classifier_version
) values (
  'c6000000-0000-4000-8000-000000000006', 'c2000000-0000-4000-8000-000000000001',
  'PROJECT_CANCELLED', 'OFFICIAL', 'CRITICAL', 'Suppressed P5 event', '{}'::jsonb,
  'p5-alert-event-suppressed', 'SUPPRESSED', 'test-p5'
);

select is(public.plan_event_alerts('c6000000-0000-4000-8000-000000000006'), 0, 'suppressed event plans no alerts');

insert into public.alert_deliveries (
  user_id, event_id, delivery_kind, dedupe_key, status, scheduled_for, payload
) values (
  'c1000000-0000-4000-8000-000000000002', 'c6000000-0000-4000-8000-000000000001',
  'DIGEST', 'manual-user2-alert', 'DEFERRED', now() + interval '1 day', '{}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select is((select count(*) from public.alert_deliveries where user_id='c1000000-0000-4000-8000-000000000002'::uuid), 0::bigint, 'RLS hides another user alert outbox rows');
reset role;

select results_eq(
  $$select count(*) from public.alert_deliveries where user_id='c1000000-0000-4000-8000-000000000001'::uuid$$,
  array[3::bigint],
  'eligible events produce exactly the expected three user alert rows without repost spam'
);

select results_eq(
  $$select count(*) from public.alert_deliveries d join public.events e on e.id=d.event_id where d.user_id='c1000000-0000-4000-8000-000000000001'::uuid and e.verification_state='RUMOR'$$,
  array[1::bigint],
  'only the explicitly opted-in rumor appears in the user alert outbox'
);

select results_eq(
  $$select count(*) from public.event_evidence where event_id='c6000000-0000-4000-8000-000000000001'::uuid$$,
  array[2::bigint],
  'alert planning preserves canonical event evidence dedupe/repeat behavior'
);

select * from finish();
rollback;
