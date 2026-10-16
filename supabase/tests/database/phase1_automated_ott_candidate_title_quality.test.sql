begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

select ok(public.automated_ott_candidate_title_looks_canonical('#Love'), 'standalone hashtag movie name allowed');
select ok(public.automated_ott_candidate_title_looks_canonical('కాంతార'), 'Telugu-script movie name allowed');
select ok(public.automated_ott_candidate_title_looks_canonical('Aasha'), 'short film name allowed');
select ok(not public.automated_ott_candidate_title_looks_canonical('#Karmakhya Latest Telugu Full'), 'latest Telugu full caption rejected');
select ok(not public.automated_ott_candidate_title_looks_canonical('#Karmakhya Telugu Full'), 'Telugu full movie caption rejected');
select ok(not public.automated_ott_candidate_title_looks_canonical('#UglyStory Telugu Full'), 'second promotional title rejected');
select ok(not public.automated_ott_candidate_title_looks_canonical('Aasha OTT release date: Urvashi'), 'OTT release date headline rejected');
select ok(not public.automated_ott_candidate_title_looks_canonical('After King, this top studio'), 'editorial studio headline rejected');
select ok(not public.automated_ott_candidate_title_looks_canonical('Sharanya Pradeep Byte about Karmakhya'), 'interview byte caption rejected');
select ok(not public.automated_ott_candidate_title_looks_canonical('వద్దు ! #Euphoria Telugu Full'), 'embedded promoted hashtag rejected');

insert into public.entity_discovery_candidates
  (id, proposed_entity_type, proposed_name, normalized_name, confidence, status, metadata)
values
  ('e6100000-0000-4000-8000-000000000001', 'MOVIE',
   '#Karmakhya Latest Telugu Full', 'phase1-quality-noisy-karmakhya', 0.99, 'PENDING',
   '{"signalType":"OTT_RELEASE"}'::jsonb),
  ('e6100000-0000-4000-8000-000000000002', 'MOVIE',
   'Aasha', 'phase1-quality-clean-aasha', 0.99, 'PENDING',
   '{"signalType":"OTT_RELEASE"}'::jsonb);

create temp table phase1_quality_precheck as
select (select count(*) from public.entities) as entities,
       (select count(*) from public.events) as events;

select is(
  public.system_promote_first_party_ott_candidate('e6100000-0000-4000-8000-000000000001') ->> 'reason',
  'automated_ott_candidate_title_quality_gate',
  'historical bad title blocked from first-party automatic promotion'
);

select is(
  public.system_promote_verified_ott_candidate_two_source('e6100000-0000-4000-8000-000000000001') ->> 'reason',
  'automated_ott_candidate_title_quality_gate',
  'historical bad title blocked from two-source automatic promotion'
);

select is(
  public.system_promote_first_party_ott_candidate('e6100000-0000-4000-8000-000000000002') ->> 'reason',
  'first_party_ott_evidence_gate',
  'clean title reaches evidence gate rather than being blacklisted'
);

select results_eq(
  $$select (select count(*) from public.entities)::text || ':' ||
           (select count(*) from public.events)::text$$,
  $$select entities::text || ':' || events::text from phase1_quality_precheck$$,
  'testing blocked automatic promotions creates no canonical entities or events'
);

select * from finish();
rollback;
