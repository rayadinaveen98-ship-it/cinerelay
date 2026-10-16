begin;
create extension if not exists pgtap with schema extensions;
select plan(20);
select ok(not public.automated_ott_candidate_title_looks_canonical('Catch Joel Joseph in Kappi Squad'), 'reject promotional candidate: Catch Joel Joseph in Kappi Squad');
select ok(not public.automated_ott_candidate_title_looks_canonical('Catch Rinosh George in Kappi Squad'), 'reject promotional candidate: Catch Rinosh George in Kappi Squad');
select ok(not public.automated_ott_candidate_title_looks_canonical('Happy Ending Telugu Movie Scenes'), 'reject promotional candidate: Happy Ending Telugu Movie Scenes');
select ok(not public.automated_ott_candidate_title_looks_canonical('Hot Takes keep getting hotter 🔥😎 #Awarapan2OnPrime'), 'reject promotional candidate: Hot Takes keep getting hotter 🔥😎 #Awarapan2OnPrime');
select ok(not public.automated_ott_candidate_title_looks_canonical('Jailer 2 Super Show!'), 'reject promotional candidate: Jailer 2 Super Show!');
select ok(not public.automated_ott_candidate_title_looks_canonical('The entertainer everyone’s been waiting for! ❤️ Bethlehem Kudumba Unit'), 'reject promotional candidate: The entertainer everyone’s been waiting for! ❤️ Bethlehem Ku');
select ok(not public.automated_ott_candidate_title_looks_canonical('The little things that made Bethlehem, Bethlehem. 💛 Bethlehem Kudumba Unit'), 'reject promotional candidate: The little things that made Bethlehem, Bethlehem. 💛 Bethleh');
select ok(not public.automated_ott_candidate_title_looks_canonical('Love & Romance | Honeymoon Express Telugu Movie'), 'reject promotional candidate: Love & Romance | Honeymoon Express Telugu Movie');
select ok(not public.automated_ott_candidate_title_looks_canonical('From 60 to 20, love always! ❤️ Hotstar Specials #LoveAlways streaming'), 'reject promotional candidate: From 60 to 20, love always! ❤️ Hotstar Specials #LoveAlways ');
select ok(not public.automated_ott_candidate_title_looks_canonical('Ee Jagathiki moolam Dhanam ayithe... aah Dhananiki moolam oka VARAM 🔮 This'), 'reject promotional candidate: Ee Jagathiki moolam Dhanam ayithe... aah Dhananiki moolam ok');
select ok(public.automated_ott_candidate_title_looks_canonical('#Love'), 'preserve valid movie name: #Love');
select ok(public.automated_ott_candidate_title_looks_canonical('కాంతార'), 'preserve valid movie name: కాంతార');
select ok(public.automated_ott_candidate_title_looks_canonical('Aasha'), 'preserve valid movie name: Aasha');
select ok(public.automated_ott_candidate_title_looks_canonical('Paranthu Po'), 'preserve valid movie name: Paranthu Po');
select ok(public.automated_ott_candidate_title_looks_canonical('Catch Me If You Can'), 'preserve valid movie name: Catch Me If You Can');
select ok(public.automated_ott_candidate_title_looks_canonical('Scary Movie'), 'preserve valid movie name: Scary Movie');

-- A caption-like SERIES used to bypass the MOVIE-only quality gate.
insert into public.entity_discovery_candidates
 (id, proposed_entity_type, proposed_name, normalized_name, confidence, status, metadata)
values
 ('e6700000-0000-4000-8000-000000000001','SERIES',
  'From 60 to 20, love always! Hotstar Specials',
  'phase1-quality-bad-series',0.99,'PENDING',
  '{"signalType":"OTT_RELEASE"}'::jsonb),
 ('e6700000-0000-4000-8000-000000000002','SERIES',
  'Aspirants','phase1-quality-clean-series',0.99,'PENDING',
  '{"signalType":"OTT_RELEASE"}'::jsonb);

select is(
 public.system_promote_first_party_ott_candidate('e6700000-0000-4000-8000-000000000001')->>'reason',
 'automated_ott_candidate_title_quality_gate',
 'series caption blocked in first-party promoter');
select is(
 public.system_promote_verified_ott_candidate_two_source('e6700000-0000-4000-8000-000000000001')->>'reason',
 'automated_ott_candidate_title_quality_gate',
 'series caption blocked in corroborated promoter');
select is(
 public.system_promote_first_party_ott_candidate('e6700000-0000-4000-8000-000000000002')->>'reason',
 'first_party_ott_candidate_type_or_confidence_gate',
 'clean series goes beyond title quality gate, without being promoted');
select is(
 (select count(*)::text from public.entities e
  where e.canonical_name='From 60 to 20, love always! Hotstar Specials'),
 '0',
 'blocked series creates no new canonical entity');
select * from finish();
rollback;
