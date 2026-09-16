begin;

create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('e1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'p53-user1@example.com', '', now(), now()),
  ('e1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'p53-user2@example.com', '', now(), now());

insert into public.entities (id, entity_type, canonical_name, primary_language, country_code, status)
values ('e2000000-0000-4000-8000-000000000001', 'MOVIE', 'P5.3 Digest Movie', 'te', 'IN', 'ACTIVE');

insert into public.events (
  id, primary_entity_id, event_type, verification_state, priority_band,
  headline, structured_data, dedupe_key, status, classifier_version, detected_at, created_at
) values
  ('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','PROJECT_ANNOUNCED','OFFICIAL','HIGH','P5.3 project announced','{}','p53-event-1','ACTIVE','test-p53',now()-interval '5 hours',now()-interval '5 hours'),
  ('e3000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001','CAST_ANNOUNCED','CONFIRMED','NORMAL','P5.3 cast announced','{}','p53-event-2','ACTIVE','test-p53',now()-interval '4 hours',now()-interval '4 hours'),
  ('e3000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000001','TRAILER_RELEASED','OFFICIAL','CRITICAL','P5.3 trailer released','{}','p53-event-3','ACTIVE','test-p53',now()-interval '3 hours',now()-interval '3 hours'),
  ('e3000000-0000-4000-8000-000000000004','e2000000-0000-4000-8000-000000000001','POSTER_RELEASED','OFFICIAL','NORMAL','P5.3 future poster','{}','p53-event-4','ACTIVE','test-p53',now()-interval '1 hour',now()-interval '1 hour');

insert into public.alert_deliveries (
  id, user_id, event_id, delivery_kind, dedupe_key, status, scheduled_for, payload, created_at
) values
  ('e4000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','DIGEST','p53-u1-e1-digest','DEFERRED',date_trunc('hour',now())-interval '2 hours','{}',now()-interval '4 hours'),
  ('e4000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000002','DIGEST','p53-u1-e2-digest','DEFERRED',date_trunc('hour',now())-interval '2 hours','{}',now()-interval '3 hours'),
  ('e4000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000003','DIGEST','p53-u2-e3-digest','DEFERRED',date_trunc('hour',now())-interval '1 hour','{}',now()-interval '2 hours'),
  ('e4000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000004','DIGEST','p53-u1-e4-future','DEFERRED',date_trunc('hour',now())+interval '1 day','{}',now()-interval '1 hour'),
  ('e4000000-0000-4000-8000-000000000005','e1000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','PUSH','p53-u1-e1-push','PENDING',now()-interval '1 hour','{}',now()-interval '4 hours');

select ok((select relrowsecurity from pg_class where oid='public.alert_digest_batches'::regclass), 'digest batches have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.alert_digest_items'::regclass), 'digest items have RLS enabled');
select ok(has_table_privilege('authenticated','public.alert_digest_batches','SELECT'), 'authenticated users may select digest batches through RLS');
select ok(not has_table_privilege('authenticated','public.alert_digest_batches','INSERT'), 'authenticated users cannot insert digest batches');
select ok(has_table_privilege('authenticated','public.alert_digest_items','SELECT'), 'authenticated users may select digest items through RLS');
select ok(not has_table_privilege('authenticated','public.alert_digest_items','INSERT'), 'authenticated users cannot insert digest items');
select ok(not has_function_privilege('authenticated','public.compose_due_alert_digests(integer)','EXECUTE'), 'authenticated users cannot invoke the internal digest composer');

select is(public.compose_due_alert_digests(1), 1, 'bounded first pass composes exactly one due digest alert');
select results_eq(
  $$select status from public.alert_digest_batches where user_id='e1000000-0000-4000-8000-000000000001'::uuid$$,
  array['BUILDING'::text],
  'batch remains BUILDING while another due row exists for the same slot'
);
select results_eq(
  $$select item_count from public.alert_digest_batches where user_id='e1000000-0000-4000-8000-000000000001'::uuid$$,
  array[1::integer],
  'partial batch exposes the number of already composed items'
);

select is(public.compose_due_alert_digests(1), 1, 'second bounded pass composes the remaining row for the first slot');
select results_eq(
  $$select status from public.alert_digest_batches where user_id='e1000000-0000-4000-8000-000000000001'::uuid$$,
  array['READY'::text],
  'batch becomes READY only when its due slot is complete'
);
select results_eq(
  $$select item_count from public.alert_digest_batches where user_id='e1000000-0000-4000-8000-000000000001'::uuid$$,
  array[2::integer],
  'completed first-user digest contains both due items'
);
select results_eq(
  $$select highest_priority_band from public.alert_digest_batches where user_id='e1000000-0000-4000-8000-000000000001'::uuid$$,
  array['HIGH'::text],
  'digest highest priority reflects the strongest included event'
);
select results_eq(
  $$select (payload->>'itemCount')::integer from public.alert_digest_batches where user_id='e1000000-0000-4000-8000-000000000001'::uuid$$,
  array[2::integer],
  'digest payload records itemCount'
);
select results_eq(
  $$select payload->>'kind' from public.alert_digest_batches where user_id='e1000000-0000-4000-8000-000000000001'::uuid$$,
  array['CINERELAY_DIGEST'::text],
  'digest payload has a stable kind marker'
);
select results_eq(
  $$select payload->'items'->0->>'headline' from public.alert_digest_batches where user_id='e1000000-0000-4000-8000-000000000001'::uuid$$,
  array['P5.3 project announced'::text],
  'higher-priority event is ordered before normal-priority event'
);
select results_eq(
  $$select title from public.alert_digest_batches where user_id='e1000000-0000-4000-8000-000000000001'::uuid$$,
  array['CineRelay digest - 2 updates'::text],
  'digest title is deterministic and count-based'
);
select results_eq(
  $$select count(*) from public.alert_deliveries where user_id='e1000000-0000-4000-8000-000000000001'::uuid and delivery_kind='DIGEST' and status='COMPOSED'$$,
  array[2::bigint],
  'first-user due digest rows become COMPOSED'
);
select results_eq(
  $$select count(*) from public.alert_deliveries where user_id='e1000000-0000-4000-8000-000000000001'::uuid and delivery_kind='DIGEST' and status='COMPOSED' and composed_at is not null$$,
  array[2::bigint],
  'composed digest rows record composed_at'
);

select is(public.compose_due_alert_digests(100), 1, 'next pass composes the second user due slot');
select results_eq(
  $$select status from public.alert_digest_batches where user_id='e1000000-0000-4000-8000-000000000002'::uuid$$,
  array['READY'::text],
  'second-user digest becomes READY'
);
select results_eq(
  $$select highest_priority_band from public.alert_digest_batches where user_id='e1000000-0000-4000-8000-000000000002'::uuid$$,
  array['CRITICAL'::text],
  'critical event produces a critical digest batch'
);
select results_eq(
  $$select count(*) from public.alert_digest_items$$,
  array[3::bigint],
  'exactly three due digest items are materialized across users'
);
select results_eq(
  $$select count(distinct alert_delivery_id) from public.alert_digest_items$$,
  array[3::bigint],
  'each source digest alert belongs to at most one digest item'
);
select results_eq(
  $$select status from public.alert_deliveries where id='e4000000-0000-4000-8000-000000000004'::uuid$$,
  array['DEFERRED'::text],
  'future digest alert is not composed early'
);
select results_eq(
  $$select status from public.alert_deliveries where id='e4000000-0000-4000-8000-000000000005'::uuid$$,
  array['PENDING'::text],
  'push delivery rows are untouched by digest composition'
);
select is(public.compose_due_alert_digests(100), 0, 'repeat composition is idempotent after all due rows are composed');
select results_eq(
  $$select count(*) from public.alert_digest_batches$$,
  array[2::bigint],
  'one durable batch exists per user and scheduled digest slot'
);
select results_eq(
  $$select count(*) from public.alert_digest_batches where status='BUILDING'$$,
  array[0::bigint],
  'no completed due slot remains in BUILDING state'
);
select results_eq(
  $$select count(*) from public.alert_digest_batches where ready_at is not null$$,
  array[2::bigint],
  'ready batches record ready_at'
);

select * from finish();
rollback;
