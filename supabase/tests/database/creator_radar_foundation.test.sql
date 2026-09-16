begin;

create extension if not exists pgtap with schema extensions;
select plan(32);

insert into public.entities (id, entity_type, canonical_name, primary_language, country_code, status)
values ('f5400000-0000-4000-8000-000000000001','MOVIE','P5.4 Radar Movie','te','IN','ACTIVE');

insert into public.events (
  id, primary_entity_id, event_type, verification_state, priority_band,
  headline, structured_data, dedupe_key, status, classifier_version, detected_at, created_at
) values
  ('f5410000-0000-4000-8000-000000000001','f5400000-0000-4000-8000-000000000001','TRAILER_RELEASED','OFFICIAL','CRITICAL','P5.4 trailer released','{}','p54-event-1','ACTIVE','test-p54',now()-interval '5 hours',now()-interval '5 hours'),
  ('f5410000-0000-4000-8000-000000000002','f5400000-0000-4000-8000-000000000001','THEATRICAL_DATE_CHANGED','CONFIRMED','CRITICAL','P5.4 date changed','{}','p54-event-2','ACTIVE','test-p54',now()-interval '4 hours',now()-interval '4 hours'),
  ('f5410000-0000-4000-8000-000000000003','f5400000-0000-4000-8000-000000000001','TEASER_RELEASED','DEVELOPING','HIGH','P5.4 teaser developing','{}','p54-event-3','ACTIVE','test-p54',now()-interval '3 hours',now()-interval '3 hours'),
  ('f5410000-0000-4000-8000-000000000004','f5400000-0000-4000-8000-000000000001','INTERVIEW_RELEASED','RELIABLE_REPORT','NORMAL','P5.4 interview','{}','p54-event-4','ACTIVE','test-p54',now()-interval '2 hours',now()-interval '2 hours'),
  ('f5410000-0000-4000-8000-000000000005','f5400000-0000-4000-8000-000000000001','TRAILER_RELEASED','OFFICIAL','SUPPRESSED','P5.4 suppressed trailer','{}','p54-event-5','ACTIVE','test-p54',now()-interval '1 hour',now()-interval '1 hour');

select ok(
  (select relrowsecurity from pg_class where oid='public.creator_radar_entries'::regclass),
  'creator radar entries have RLS enabled'
);
select ok(
  not has_table_privilege('authenticated','public.creator_radar_entries','SELECT'),
  'authenticated users cannot directly select service-owned radar entries'
);
select ok(
  not has_function_privilege('authenticated','public.creator_radar_compute(uuid)','EXECUTE'),
  'authenticated users cannot directly execute the radar compute RPC'
);
select ok(
  not has_function_privilege('authenticated','public.refresh_creator_radar(integer)','EXECUTE'),
  'authenticated users cannot directly execute the radar refresh RPC'
);

select results_eq(
  $$select creator_score from public.creator_radar_compute('f5410000-0000-4000-8000-000000000001'::uuid)$$,
  array[85::integer],
  'official critical trailer scores 85 without evidence rows'
);
select results_eq(
  $$select opportunity_label from public.creator_radar_compute('f5410000-0000-4000-8000-000000000001'::uuid)$$,
  array['TRAILER_ANALYSIS'::text],
  'official critical trailer maps to TRAILER_ANALYSIS'
);
select ok(
  (select reason_codes @> array['TYPE_TRAILER_RELEASED']::text[] from public.creator_radar_compute('f5410000-0000-4000-8000-000000000001'::uuid)),
  'trailer reason code is retained'
);
select ok(
  (select reason_codes @> array['PRIORITY_CRITICAL']::text[] from public.creator_radar_compute('f5410000-0000-4000-8000-000000000001'::uuid)),
  'critical priority reason code is retained'
);
select ok(
  (select reason_codes @> array['VERIFICATION_OFFICIAL']::text[] from public.creator_radar_compute('f5410000-0000-4000-8000-000000000001'::uuid)),
  'official verification reason code is retained'
);
select results_eq(
  $$select (input_snapshot->>'evidenceCount')::integer from public.creator_radar_compute('f5410000-0000-4000-8000-000000000001'::uuid)$$,
  array[0::integer],
  'input snapshot records evidence count'
);

select results_eq(
  $$select creator_score from public.creator_radar_compute('f5410000-0000-4000-8000-000000000002'::uuid)$$,
  array[80::integer],
  'confirmed critical release-date change scores 80 without evidence rows'
);
select results_eq(
  $$select opportunity_label from public.creator_radar_compute('f5410000-0000-4000-8000-000000000002'::uuid)$$,
  array['BREAKING_EXPLAINER'::text],
  'release-date change maps to BREAKING_EXPLAINER'
);

select results_eq(
  $$select creator_score from public.creator_radar_compute('f5410000-0000-4000-8000-000000000003'::uuid)$$,
  array[46::integer],
  'developing high-priority teaser scores 46 without evidence rows'
);
select results_eq(
  $$select opportunity_label from public.creator_radar_compute('f5410000-0000-4000-8000-000000000003'::uuid)$$,
  array['FOLLOW_UP_NEEDED'::text],
  'developing evidence overrides teaser opportunity to FOLLOW_UP_NEEDED'
);
select ok(
  (select reason_codes @> array['VERIFICATION_DEVELOPING']::text[] from public.creator_radar_compute('f5410000-0000-4000-8000-000000000003'::uuid)),
  'developing verification reason code is retained'
);

select results_eq(
  $$select creator_score from public.creator_radar_compute('f5410000-0000-4000-8000-000000000004'::uuid)$$,
  array[18::integer],
  'lower-signal reliable report stays below action threshold'
);
select results_eq(
  $$select opportunity_label from public.creator_radar_compute('f5410000-0000-4000-8000-000000000004'::uuid)$$,
  array['NO_ACTION'::text],
  'lower-signal reliable report maps to NO_ACTION'
);

select results_eq(
  $$select creator_score from public.creator_radar_compute('f5410000-0000-4000-8000-000000000005'::uuid)$$,
  array[0::integer],
  'suppressed event always scores zero'
);
select results_eq(
  $$select opportunity_label from public.creator_radar_compute('f5410000-0000-4000-8000-000000000005'::uuid)$$,
  array['NO_ACTION'::text],
  'suppressed event always maps to NO_ACTION'
);
select ok(
  (select reason_codes @> array['EVENT_NOT_ACTIONABLE']::text[] from public.creator_radar_compute('f5410000-0000-4000-8000-000000000005'::uuid)),
  'suppressed event records non-actionable reason'
);

select is(public.refresh_creator_radar(2), 2, 'bounded refresh processes only two stale events');
select results_eq(
  $$select count(*) from public.creator_radar_entries$$,
  array[2::bigint],
  'first bounded refresh creates exactly two entries'
);
select is(public.refresh_creator_radar(10), 3, 'second refresh processes the remaining three events');
select results_eq(
  $$select count(*) from public.creator_radar_entries$$,
  array[5::bigint],
  'all five events receive one radar entry'
);
select is(public.refresh_creator_radar(100), 0, 'repeat refresh is idempotent when no inputs changed');
select results_eq(
  $$select count(*) from public.creator_radar_entries where engine_version='creator-radar-v1'$$,
  array[5::bigint],
  'all entries use the locked v1 engine version'
);
select results_eq(
  $$select count(*) from public.creator_radar_entries where input_snapshot ? 'eventId'$$,
  array[5::bigint],
  'all entries retain an input event id snapshot'
);

update public.events
set priority_band='HIGH', updated_at=now()
where id='f5410000-0000-4000-8000-000000000004'::uuid;

select is(public.refresh_creator_radar(1), 1, 'event update makes only the changed radar entry stale');
select results_eq(
  $$select creator_score::integer from public.creator_radar_entries where event_id='f5410000-0000-4000-8000-000000000004'::uuid$$,
  array[28::integer],
  'stale entry is rescored from updated factual inputs'
);
select results_eq(
  $$select input_snapshot->>'priorityBand' from public.creator_radar_entries where event_id='f5410000-0000-4000-8000-000000000004'::uuid$$,
  array['HIGH'::text],
  'updated input snapshot records new priority band'
);
select results_eq(
  $$select count(distinct event_id) from public.creator_radar_entries$$,
  array[5::bigint],
  'event primary key prevents duplicate radar entries'
);
select results_eq(
  $$select count(*) from public.creator_radar_entries where opportunity_label='TRAILER_ANALYSIS'$$,
  array[1::bigint],
  'only actionable trailer remains TRAILER_ANALYSIS'
);

select * from finish();
rollback;
