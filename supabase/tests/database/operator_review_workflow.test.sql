begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.sources (id, display_name, authority_tier, source_role, active)
values ('22000000-0000-4000-8000-000000000001', 'Operator Review Studio', 1, 'PRODUCTION_HOUSE', true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, canonical_url, connector_type, poll_class, access_mode, active
) values (
  '32000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', 'YOUTUBE',
  'UCreview0000000000000000', 'https://www.youtube.com/channel/UCreview0000000000000000',
  'YOUTUBE_PLAYLIST', 'HOT_5M', 'API', true
);

insert into public.entities (id, entity_type, canonical_name, primary_language, country_code, status)
values ('42000000-0000-4000-8000-000000000001', 'MOVIE', 'Operator Review Movie', 'te', 'IN', 'ACTIVE');

insert into public.raw_items (
  id, source_identity_id, platform_item_id, canonical_url, published_at, first_seen_at, last_seen_at,
  item_type, raw_title, raw_text, normalized_text, metadata, content_fingerprint
) values
(
  '52000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', 'reviewVideo1',
  'https://www.youtube.com/watch?v=reviewVideo1', now(), now(), now(), 'YOUTUBE_VIDEO',
  'Operator Review Movie announcement', 'Official announcement', 'operator review movie announcement official announcement',
  '{}'::jsonb, repeat('a', 64)
),
(
  '52000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000001', 'reviewVideo2',
  'https://www.youtube.com/watch?v=reviewVideo2', now(), now(), now(), 'YOUTUBE_VIDEO',
  'Operator Review Movie poster', 'Official poster', 'operator review movie poster official poster',
  '{}'::jsonb, repeat('b', 64)
);

select public.record_entity_resolution(
  '52000000-0000-4000-8000-000000000001', null, 0, 'UNRESOLVED',
  '[{"method":"SOURCE_ENTITY_SCOPE","candidateCount":0}]'::jsonb, 'source-scope-resolver-v1'
);

select lives_ok(
  $$select public.operator_resolve_raw_item(
    '62000000-0000-4000-8000-000000000001'::uuid,
    '52000000-0000-4000-8000-000000000001'::uuid,
    'Reviewed official title',
    '42000000-0000-4000-8000-000000000001'::uuid
  )$$,
  'operator can resolve an unresolved raw item to an existing entity'
);

select results_eq(
  $$select count(*) from public.operator_resolution_overrides where raw_item_id='52000000-0000-4000-8000-000000000001'::uuid and entity_id='42000000-0000-4000-8000-000000000001'::uuid and active=true$$,
  array[1::bigint],
  'active durable resolution override is persisted'
);

select results_eq(
  $$select count(*) from public.source_entity_candidates where source_identity_id='32000000-0000-4000-8000-000000000001'::uuid and entity_id='42000000-0000-4000-8000-000000000001'::uuid and active=true$$,
  array[0::bigint],
  'operator resolution does not teach broad production-house source scope'
);

select results_eq(
  $$select count(*) from public.audit_actions where action_type='RESOLVE_RAW_ITEM' and target_id='52000000-0000-4000-8000-000000000001'::uuid$$,
  array[1::bigint],
  'resolution action is audited'
);

select results_eq(
  $$select count(*) from public.jobs where job_type='PROCESS_RAW_ITEM' and idempotency_key like 'operator-resolution:%'$$,
  array[1::bigint],
  'resolution action enqueues normal raw-item processing'
);

select lives_ok(
  $$select public.operator_clear_resolution_override(
    '62000000-0000-4000-8000-000000000001'::uuid,
    '52000000-0000-4000-8000-000000000001'::uuid,
    'Return to automatic resolver'
  )$$,
  'operator can clear a resolution override'
);

select results_eq(
  $$select count(*) from public.operator_resolution_overrides where raw_item_id='52000000-0000-4000-8000-000000000001'::uuid and active=false$$,
  array[1::bigint],
  'cleared override remains as inactive audit-supporting state'
);

insert into public.events (
  id, primary_entity_id, event_type, verification_state, priority_band, headline, structured_data,
  dedupe_key, status, classifier_version
) values
(
  '72000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'PROJECT_ANNOUNCED',
  'OFFICIAL', 'HIGH', 'Operator Review Movie announced', '{}'::jsonb, 'operator-review-event-1', 'ACTIVE', 'test-v1'
),
(
  '72000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001', 'POSTER_RELEASED',
  'OFFICIAL', 'NORMAL', 'Operator Review Movie poster', '{}'::jsonb, 'operator-review-event-2', 'ACTIVE', 'test-v1'
),
(
  '72000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000001', 'FIRST_LOOK_RELEASED',
  'OFFICIAL', 'NORMAL', 'Operator Review Movie first look', '{}'::jsonb, 'operator-review-event-3', 'ACTIVE', 'test-v1'
);

insert into public.event_evidence (event_id, raw_item_id, evidence_role, weight)
values
('72000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000001', 'PRIMARY', 1),
('72000000-0000-4000-8000-000000000003', '52000000-0000-4000-8000-000000000002', 'PRIMARY', 1);

select lives_ok(
  $$select public.operator_suppress_event(
    '62000000-0000-4000-8000-000000000001'::uuid,
    '72000000-0000-4000-8000-000000000001'::uuid,
    'Duplicate/irrelevant event'
  )$$,
  'operator can suppress an event'
);

select public.upsert_canonical_event_with_evidence(
  '72000000-0000-4000-8000-000000000099'::uuid,
  '42000000-0000-4000-8000-000000000001'::uuid,
  'PROJECT_ANNOUNCED', 'OFFICIAL', 'HIGH', 'Automatic replay headline', '{}'::jsonb,
  'operator-review-event-1', 'deterministic-domain-v1.1', '52000000-0000-4000-8000-000000000001'::uuid
);

select results_eq(
  $$select status || ':' || priority_band from public.events where id='72000000-0000-4000-8000-000000000001'::uuid$$,
  array['SUPPRESSED:SUPPRESSED'::text],
  'automatic upsert cannot undo operator suppression'
);

select lives_ok(
  $$select public.operator_reclassify_event(
    '62000000-0000-4000-8000-000000000001'::uuid,
    '72000000-0000-4000-8000-000000000002'::uuid,
    'GLIMPSE_RELEASED',
    'Evidence is a glimpse, not a poster'
  )$$,
  'operator can reclassify an active event'
);

select results_eq(
  $$select event_type || ':' || classifier_version from public.events where id='72000000-0000-4000-8000-000000000002'::uuid$$,
  array['GLIMPSE_RELEASED:operator-review-v1'::text],
  'reclassification persists as operator-reviewed classifier state'
);

select lives_ok(
  $$select public.operator_merge_events(
    '62000000-0000-4000-8000-000000000001'::uuid,
    '72000000-0000-4000-8000-000000000003'::uuid,
    '72000000-0000-4000-8000-000000000002'::uuid,
    'Duplicate canonical event'
  )$$,
  'operator can merge duplicate events for the same entity'
);

select results_eq(
  $$select (select status from public.events where id='72000000-0000-4000-8000-000000000003'::uuid) || ':' || (select count(*)::text from public.event_evidence where event_id='72000000-0000-4000-8000-000000000002'::uuid)$$,
  array['SUPERSEDED:2'::text],
  'merge supersedes the duplicate and copies its evidence to the survivor'
);

select * from finish();
rollback;
