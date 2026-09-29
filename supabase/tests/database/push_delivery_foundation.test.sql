begin;

create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('d1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'p52-user1@example.com', '', now(), now()),
  ('d1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'p52-user2@example.com', '', now(), now());

insert into public.entities (id, entity_type, canonical_name, primary_language, country_code, status)
values ('d2000000-0000-4000-8000-000000000001', 'MOVIE', 'P5.2 Delivery Movie', 'te', 'IN', 'ACTIVE');

insert into public.events (
  id, primary_entity_id, event_type, verification_state, priority_band,
  headline, structured_data, dedupe_key, status, classifier_version, created_at
) values (
  'd3000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'PROJECT_ANNOUNCED', 'OFFICIAL', 'HIGH', 'P5.2 project announced',
  '{}'::jsonb, 'p52-delivery-event', 'ACTIVE', 'test-p52', now() - interval '10 minutes'
);

insert into public.alert_deliveries (
  id, user_id, event_id, delivery_kind, dedupe_key, status, scheduled_for, payload
) values (
  'd4000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'PUSH', 'p52-alert-user1', 'PENDING', now() - interval '5 minutes',
  jsonb_build_object('eventId','d3000000-0000-4000-8000-000000000001','headline','P5.2 project announced')
);

select ok((select relrowsecurity from pg_class where oid='public.push_device_registrations'::regclass), 'push device registrations have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.push_delivery_targets'::regclass), 'push delivery targets have RLS enabled');
select ok(not has_table_privilege('authenticated', 'public.push_device_registrations', 'SELECT'), 'authenticated clients cannot read raw provider registrations');
select ok(not has_table_privilege('authenticated', 'public.push_delivery_targets', 'SELECT'), 'authenticated clients cannot read internal per-device delivery state');
select ok(not has_function_privilege('authenticated', 'public.upsert_push_device_registration(uuid,text,text,text,text,text,text)', 'EXECUTE'), 'authenticated clients cannot call service registration RPC directly');
select ok(not has_function_privilege('authenticated', 'public.materialize_due_push_targets(integer)', 'EXECUTE'), 'authenticated clients cannot materialize delivery targets');
select ok(not has_function_privilege('authenticated', 'public.lease_push_delivery_targets(integer,integer)', 'EXECUTE'), 'authenticated clients cannot lease delivery targets');
select ok(not has_function_privilege('authenticated', 'public.complete_push_delivery_target(uuid,uuid,text,text,text,text,integer)', 'EXECUTE'), 'authenticated clients cannot complete provider deliveries');

select public.upsert_push_device_registration(
  'd1000000-0000-4000-8000-000000000001', 'FCM', 'TOKEN',
  'p52-token-one-abcdefghijklmnopqrstuvwxyz-0001', 'ANDROID', 'p52-installation-1', 'cinerelay.android'
);

select results_eq(
  $$select count(*) from public.push_device_registrations where user_id='d1000000-0000-4000-8000-000000000001'::uuid and active=true$$,
  array[1::bigint],
  'first registration creates one active user device'
);

select public.upsert_push_device_registration(
  'd1000000-0000-4000-8000-000000000001', 'FCM', 'TOKEN',
  'p52-token-two-abcdefghijklmnopqrstuvwxyz-0002', 'ANDROID', 'p52-installation-1', 'cinerelay.android'
);

select results_eq(
  $$select count(*) from public.push_device_registrations where user_id='d1000000-0000-4000-8000-000000000001'::uuid and active=true and installation_id='p52-installation-1'$$,
  array[1::bigint],
  'token rotation leaves exactly one active registration for an installation'
);

select results_eq(
  $$select count(*) from public.push_device_registrations where target_value='p52-token-one-abcdefghijklmnopqrstuvwxyz-0001' and active=false and disable_reason='REGISTRATION_ROTATED'$$,
  array[1::bigint],
  'rotated provider target is retained as inactive history'
);

select is(public.materialize_due_push_targets(100), 1, 'due user alert materializes one target for the active device');
select is(public.materialize_due_push_targets(100), 0, 'repeat materialization is idempotent');

create temp table p52_first_lease on commit drop as
select * from public.lease_push_delivery_targets(10, 60);

select results_eq(
  $$select count(*) from p52_first_lease$$,
  array[1::bigint],
  'one due device target is leased'
);

select results_eq(
  $$select status || ':' || attempt_count::text from public.push_delivery_targets where id=(select target_id from p52_first_lease limit 1)$$,
  array['LEASED:1'::text],
  'first lease marks target leased and increments attempt count'
);

select public.complete_push_delivery_target(
  (select target_id from p52_first_lease limit 1),
  (select lease_token from p52_first_lease limit 1),
  'TRANSIENT_ERROR', null, 'UNAVAILABLE', 'synthetic provider outage', 120
);

select results_eq(
  $$select status from public.push_delivery_targets where id=(select target_id from p52_first_lease limit 1)$$,
  array['RETRY'::text],
  'transient provider failure moves the child target to RETRY'
);

select ok(
  (select next_attempt_at > now() from public.push_delivery_targets where id=(select target_id from p52_first_lease limit 1)),
  'transient failure schedules a future retry'
);

update public.push_delivery_targets
set next_attempt_at = now() - interval '1 second'
where id = (select target_id from p52_first_lease limit 1);

create temp table p52_second_lease on commit drop as
select * from public.lease_push_delivery_targets(10, 60);

select results_eq(
  $$select attempt_count from p52_second_lease$$,
  array[2::integer],
  'retry lease increments the per-device attempt count without creating a new target'
);

select public.complete_push_delivery_target(
  (select target_id from p52_second_lease limit 1),
  (select lease_token from p52_second_lease limit 1),
  'INVALID_REGISTRATION', null, 'UNREGISTERED', 'synthetic invalid token', null
);

select results_eq(
  $$select count(*) from public.push_device_registrations where target_value='p52-token-two-abcdefghijklmnopqrstuvwxyz-0002' and active=false and disable_reason='UNREGISTERED'$$,
  array[1::bigint],
  'FCM invalid-registration outcome deactivates the provider target'
);

select results_eq(
  $$select status from public.push_delivery_targets where id=(select target_id from p52_second_lease limit 1)$$,
  array['PERMANENT_FAILURE'::text],
  'invalid registration becomes a permanent child failure'
);

select results_eq(
  $$select status || ':' || coalesce(failure_code,'') from public.alert_deliveries where id='d4000000-0000-4000-8000-000000000001'::uuid$$,
  array['FAILED:ALL_DEVICE_TARGETS_FAILED'::text],
  'parent alert becomes failed only after all materialized device targets are terminal failures'
);

select public.upsert_push_device_registration(
  'd1000000-0000-4000-8000-000000000001', 'FCM', 'TOKEN',
  'p52-token-three-abcdefghijklmnopqrstuvwxyz-0003', 'ANDROID', 'p52-installation-2', 'cinerelay.android'
);

select is(public.materialize_due_push_targets(100), 1, 'a later healthy registration can materialize a new target for the failed parent alert');
select is(public.materialize_due_push_targets(100), 0, 'later-device materialization is also idempotent');

create temp table p52_success_lease on commit drop as
select * from public.lease_push_delivery_targets(10, 60);

select results_eq(
  $$select count(*) from p52_success_lease$$,
  array[1::bigint],
  'only the new healthy device target is leased; the permanent failure is never re-leased'
);

select public.complete_push_delivery_target(
  (select target_id from p52_success_lease limit 1),
  (select lease_token from p52_success_lease limit 1),
  'SENT', 'projects/test/messages/p52-success', null, null, null
);

select results_eq(
  $$select status from public.alert_deliveries where id='d4000000-0000-4000-8000-000000000001'::uuid$$,
  array['SENT'::text],
  'one successful device delivery makes the parent user alert SENT after all children are terminal'
);

select results_eq(
  $$select count(*) from public.push_delivery_targets where alert_delivery_id='d4000000-0000-4000-8000-000000000001'::uuid$$,
  array[2::bigint],
  'the parent alert has exactly one historical failed target and one successful target without duplicate fan-out'
);

select is(public.materialize_due_push_targets(100), 0, 'SENT parent alerts never materialize additional device targets');

select * from finish();
rollback;
