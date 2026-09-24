begin;

create extension if not exists pgtap with schema extensions;
select plan(3);

insert into public.entities (id, entity_type, canonical_name, primary_language, country_code, status)
values ('f5500000-0000-4000-8000-000000000001','MOVIE','Radar Freshness Movie','te','IN','ACTIVE');

insert into public.events (
  id, primary_entity_id, event_type, verification_state, priority_band,
  headline, structured_data, dedupe_key, status, classifier_version,
  detected_at, created_at, updated_at
) values (
  'f5510000-0000-4000-8000-000000000001',
  'f5500000-0000-4000-8000-000000000001',
  'OTT_DATE_ANNOUNCED',
  'OFFICIAL',
  'CRITICAL',
  'Strong but stale OTT date announcement',
  '{}',
  'radar-v2-stale-ott',
  'ACTIVE',
  'test-radar-v2',
  now()-interval '4 days',
  now()-interval '4 days',
  now()-interval '4 days'
);

select results_eq(
  $$select opportunity_label from public.creator_radar_compute('f5510000-0000-4000-8000-000000000001'::uuid)$$,
  array['NO_ACTION'::text],
  'strong event older than 72 hours moves out of the actionable Radar lane'
);

select ok(
  (select reason_codes @> array['AGE_OVER_72H_ACTION_HORIZON']::text[] from public.creator_radar_compute('f5510000-0000-4000-8000-000000000001'::uuid)),
  '72-hour action horizon is explicit in Radar reasons'
);

select ok(
  (select creator_score > 0 from public.creator_radar_compute('f5510000-0000-4000-8000-000000000001'::uuid)),
  'stale story retains a nonzero watchlist score while leaving the actionable lane'
);

select * from finish();
rollback;
