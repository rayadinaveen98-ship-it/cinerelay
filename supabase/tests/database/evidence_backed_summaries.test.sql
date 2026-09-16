begin;

create extension if not exists pgtap with schema extensions;
select plan(40);

insert into public.entities (id, entity_type, canonical_name, primary_language, country_code, status)
values ('f5500000-0000-4000-8000-000000000001','MOVIE','P5.5 Summary Movie','te','IN','ACTIVE');

insert into public.sources (id, display_name, authority_tier, source_role, territory, languages, active)
values
  ('f5510000-0000-4000-8000-000000000001','P5.5 Official Studio',1,'OFFICIAL_PROJECT','IN',array['te'],true),
  ('f5510000-0000-4000-8000-000000000002','P5.5 Trade Desk',3,'TRADE_MEDIA','IN',array['en'],true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, canonical_url, connector_type, poll_class, access_mode, active
) values
  ('f5520000-0000-4000-8000-000000000001','f5510000-0000-4000-8000-000000000001','WEB','p55-official','https://example.com/p55-official','MANUAL','MANUAL','MANUAL',true),
  ('f5520000-0000-4000-8000-000000000002','f5510000-0000-4000-8000-000000000002','WEB','p55-trade','https://example.com/p55-trade','MANUAL','MANUAL','MANUAL',true);

insert into public.raw_items (
  id, source_identity_id, platform_item_id, canonical_url, published_at, item_type,
  raw_title, raw_text, normalized_text, content_fingerprint, first_seen_at, last_seen_at
) values
  ('f5530000-0000-4000-8000-000000000001','f5520000-0000-4000-8000-000000000001','p55-r1','https://example.com/p55/r1',now()-interval '4 hours','WEB_ARTICLE','Official trailer note','Official trailer evidence','official trailer evidence','p55-fp-1',now()-interval '4 hours',now()-interval '4 hours'),
  ('f5530000-0000-4000-8000-000000000002','f5520000-0000-4000-8000-000000000002','p55-r2','https://example.com/p55/r2',now()-interval '3 hours','WEB_ARTICLE','Trade corroboration','Trade corroborating evidence','trade corroborating evidence','p55-fp-2',now()-interval '3 hours',now()-interval '3 hours'),
  ('f5530000-0000-4000-8000-000000000003','f5520000-0000-4000-8000-000000000002','p55-r3','https://example.com/p55/r3',now()-interval '2 hours','WEB_ARTICLE','Conflicting report','Conflicting evidence','conflicting evidence','p55-fp-3',now()-interval '2 hours',now()-interval '2 hours'),
  ('f5530000-0000-4000-8000-000000000004','f5520000-0000-4000-8000-000000000001','p55-r4','https://example.com/p55/r4',now()-interval '1 hour','WEB_ARTICLE','Official release date','Official release date evidence','official release date evidence','p55-fp-4',now()-interval '1 hour',now()-interval '1 hour');

insert into public.events (
  id, primary_entity_id, event_type, verification_state, priority_band,
  headline, summary, structured_data, dedupe_key, status, classifier_version, detected_at, created_at
) values
  ('f5540000-0000-4000-8000-000000000001','f5500000-0000-4000-8000-000000000001','TRAILER_RELEASED','OFFICIAL','CRITICAL','P5.5 trailer released','CANONICAL-SENTINEL','{}','p55-event-1','ACTIVE','test-p55',now()-interval '1 hour',now()-interval '1 hour'),
  ('f5540000-0000-4000-8000-000000000002','f5500000-0000-4000-8000-000000000001','THEATRICAL_DATE_CHANGED','CONFIRMED','CRITICAL','P5.5 release date changed',null,'{}','p55-event-2','ACTIVE','test-p55',now()-interval '2 hours',now()-interval '2 hours'),
  ('f5540000-0000-4000-8000-000000000003','f5500000-0000-4000-8000-000000000001','INTERVIEW_RELEASED','RELIABLE_REPORT','NORMAL','P5.5 interview released',null,'{}','p55-event-3','ACTIVE','test-p55',now()-interval '3 hours',now()-interval '3 hours'),
  ('f5540000-0000-4000-8000-000000000004','f5500000-0000-4000-8000-000000000001','TRAILER_RELEASED','OFFICIAL','HIGH','P5.5 retracted trailer',null,'{}','p55-event-4','RETRACTED','test-p55',now()-interval '4 hours',now()-interval '4 hours');

insert into public.event_evidence (event_id, raw_item_id, evidence_role, weight, added_at)
values
  ('f5540000-0000-4000-8000-000000000001','f5530000-0000-4000-8000-000000000001','PRIMARY',1,now()-interval '4 hours'),
  ('f5540000-0000-4000-8000-000000000001','f5530000-0000-4000-8000-000000000002','CORROBORATING',0.8,now()-interval '3 hours'),
  ('f5540000-0000-4000-8000-000000000001','f5530000-0000-4000-8000-000000000003','CONFLICTING',0.5,now()-interval '2 hours'),
  ('f5540000-0000-4000-8000-000000000002','f5530000-0000-4000-8000-000000000004','PRIMARY',1,now()-interval '1 hour'),
  ('f5540000-0000-4000-8000-000000000004','f5530000-0000-4000-8000-000000000003','CONFLICTING',1,now()-interval '2 hours');

select ok(
  (select relrowsecurity from pg_class where oid='public.event_summary_entries'::regclass),
  'summary entries have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid='public.event_summary_evidence'::regclass),
  'summary evidence has RLS enabled'
);
select ok(
  not has_table_privilege('authenticated','public.event_summary_entries','SELECT'),
  'authenticated users cannot directly select service-owned summaries'
);
select ok(
  not has_table_privilege('authenticated','public.event_summary_evidence','SELECT'),
  'authenticated users cannot directly select summary evidence'
);
select ok(
  not has_function_privilege('authenticated','public.event_summary_compute(uuid)','EXECUTE'),
  'authenticated users cannot execute summary compute'
);
select ok(
  not has_function_privilege('authenticated','public.refresh_event_summaries(integer)','EXECUTE'),
  'authenticated users cannot execute summary refresh'
);

select results_eq(
  $$select summary_status from public.event_summary_compute('f5540000-0000-4000-8000-000000000003'::uuid)$$,
  array['WITHHELD'::text],
  'event without linked evidence is withheld'
);
select results_eq(
  $$select summary_text from public.event_summary_compute('f5540000-0000-4000-8000-000000000003'::uuid)$$,
  array[null::text],
  'event without evidence receives no summary text'
);
select ok(
  (select reason_codes @> array['NO_LINKED_EVIDENCE']::text[] from public.event_summary_compute('f5540000-0000-4000-8000-000000000003'::uuid)),
  'withheld summary records missing evidence reason'
);

select results_eq(
  $$select summary_status from public.event_summary_compute('f5540000-0000-4000-8000-000000000001'::uuid)$$,
  array['READY'::text],
  'active event with evidence becomes READY'
);
select ok(
  (select summary_text like 'P5.5 trailer released.%' from public.event_summary_compute('f5540000-0000-4000-8000-000000000001'::uuid)),
  'summary starts from the canonical headline'
);
select ok(
  (select summary_text like '%Verification: Official.%' from public.event_summary_compute('f5540000-0000-4000-8000-000000000001'::uuid)),
  'summary states canonical verification explicitly'
);
select ok(
  (select summary_text like '%Evidence: 3 linked items%' from public.event_summary_compute('f5540000-0000-4000-8000-000000000001'::uuid)),
  'summary states linked evidence count'
);
select ok(
  (select summary_text like '%led by P5.5 Official Studio%' from public.event_summary_compute('f5540000-0000-4000-8000-000000000001'::uuid)),
  'summary names the deterministic lead source'
);
select ok(
  (select summary_text like '%Conflicting evidence retained: 1.%' from public.event_summary_compute('f5540000-0000-4000-8000-000000000001'::uuid)),
  'summary surfaces conflicting evidence instead of hiding it'
);
select results_eq(
  $$select evidence_count from public.event_summary_compute('f5540000-0000-4000-8000-000000000001'::uuid)$$,
  array[3::integer],
  'compute reports total evidence count'
);
select results_eq(
  $$select conflicting_evidence_count from public.event_summary_compute('f5540000-0000-4000-8000-000000000001'::uuid)$$,
  array[1::integer],
  'compute reports conflicting evidence count'
);
select results_eq(
  $$select jsonb_array_length(evidence_items) from public.event_summary_compute('f5540000-0000-4000-8000-000000000001'::uuid)$$,
  array[3::integer],
  'compute returns selected evidence provenance'
);
select results_eq(
  $$select evidence_items->0->>'rawItemId' from public.event_summary_compute('f5540000-0000-4000-8000-000000000001'::uuid)$$,
  array['f5530000-0000-4000-8000-000000000001'::text],
  'primary official evidence is first'
);
select results_eq(
  $$select (evidence_items->0->>'authorityTier')::integer from public.event_summary_compute('f5540000-0000-4000-8000-000000000001'::uuid)$$,
  array[1::integer],
  'selected evidence retains source authority tier'
);

select results_eq(
  $$select summary_status from public.event_summary_compute('f5540000-0000-4000-8000-000000000004'::uuid)$$,
  array['WITHHELD'::text],
  'retracted event is withheld even with evidence'
);
select ok(
  (select reason_codes @> array['EVENT_NOT_SUMMARIZABLE']::text[] from public.event_summary_compute('f5540000-0000-4000-8000-000000000004'::uuid)),
  'retracted event records non-summarizable reason'
);

select is(public.refresh_event_summaries(2), 2, 'bounded refresh processes only two newest events');
select results_eq(
  $$select count(*) from public.event_summary_entries$$,
  array[2::bigint],
  'first bounded refresh creates exactly two projections'
);
select results_eq(
  $$select count(*) from public.event_summary_evidence where event_id='f5540000-0000-4000-8000-000000000001'::uuid$$,
  array[3::bigint],
  'READY summary persists all selected evidence rows'
);
select results_eq(
  $$select evidence_role from public.event_summary_evidence where event_id='f5540000-0000-4000-8000-000000000001'::uuid and ordinal=1$$,
  array['PRIMARY'::text],
  'persisted evidence ordering keeps primary evidence first'
);
select results_eq(
  $$select source_name from public.event_summary_evidence where event_id='f5540000-0000-4000-8000-000000000001'::uuid and ordinal=1$$,
  array['P5.5 Official Studio'::text],
  'persisted evidence retains source snapshot'
);

select is(public.refresh_event_summaries(10), 2, 'second refresh processes remaining events');
select results_eq(
  $$select count(*) from public.event_summary_entries$$,
  array[4::bigint],
  'all events receive one summary projection including withheld state'
);
select is(public.refresh_event_summaries(100), 0, 'repeat refresh is idempotent when inputs are unchanged');
select results_eq(
  $$select summary from public.events where id='f5540000-0000-4000-8000-000000000001'::uuid$$,
  array['CANONICAL-SENTINEL'::text],
  'summary engine never overwrites canonical events.summary'
);
select results_eq(
  $$select count(*) from public.event_summary_entries where generator_version='evidence-summary-v1'$$,
  array[4::bigint],
  'all projections use locked v1 generator version'
);

update public.events
set headline='P5.5 trailer headline corrected', updated_at=now()
where id='f5540000-0000-4000-8000-000000000001'::uuid;

select is(public.refresh_event_summaries(1), 1, 'same-transaction headline change makes exactly one summary stale');
select ok(
  (select summary_text like 'P5.5 trailer headline corrected.%' from public.event_summary_entries where event_id='f5540000-0000-4000-8000-000000000001'::uuid),
  'stale summary uses corrected canonical headline'
);
select results_eq(
  $$select input_snapshot->>'headline' from public.event_summary_entries where event_id='f5540000-0000-4000-8000-000000000001'::uuid$$,
  array['P5.5 trailer headline corrected'::text],
  'input snapshot records corrected headline'
);

insert into public.event_evidence (event_id, raw_item_id, evidence_role, weight, added_at)
values ('f5540000-0000-4000-8000-000000000002','f5530000-0000-4000-8000-000000000002','CORROBORATING',0.7,now());

select is(public.refresh_event_summaries(1), 1, 'same-transaction evidence addition makes affected summary stale');
select results_eq(
  $$select evidence_count from public.event_summary_entries where event_id='f5540000-0000-4000-8000-000000000002'::uuid$$,
  array[2::integer],
  'refreshed projection records new evidence count'
);
select results_eq(
  $$select count(*) from public.event_summary_evidence where event_id='f5540000-0000-4000-8000-000000000002'::uuid$$,
  array[2::bigint],
  'refreshed provenance rows include newly linked evidence'
);
select is(public.refresh_event_summaries(100), 0, 'repeat refresh returns zero after stale summaries are rebuilt');
select results_eq(
  $$select count(distinct event_id) from public.event_summary_entries$$,
  array[4::bigint],
  'event primary key prevents duplicate summary projections'
);
select results_eq(
  $$select count(*) from public.event_summary_entries where summary_status='READY'$$,
  array[2::bigint],
  'only evidence-backed active events are READY'
);
select results_eq(
  $$select count(*) from public.event_summary_entries where summary_status='WITHHELD'$$,
  array[2::bigint],
  'no-evidence and retracted events remain WITHHELD'
);

select * from finish();
rollback;
