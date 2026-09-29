begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into public.sources (id, display_name, authority_tier, source_role, active)
values
  ('26200000-0000-4000-8000-000000000001', 'First Party OTT Test', 1, 'OTT_PLATFORM', true),
  ('26200000-0000-4000-8000-000000000002', 'Trade OTT Test', 3, 'TRADE_MEDIA', true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, canonical_url, connector_type, poll_class, access_mode, active
) values
  (
    '36200000-0000-4000-8000-000000000001', '26200000-0000-4000-8000-000000000001', 'YOUTUBE',
    'first-party-ott-test', 'https://youtube.example/first-party-ott-test', 'YOUTUBE_WEBSUB', 'PUSH', 'WEBHOOK', true
  ),
  (
    '36200000-0000-4000-8000-000000000002', '26200000-0000-4000-8000-000000000002', 'RSS',
    'trade-ott-test', 'https://trade.example/ott-test.xml', 'RSS_ATOM', 'ACTIVE_15M', 'FEED', true
  );

insert into public.raw_items (
  id, source_identity_id, platform_item_id, canonical_url, published_at, first_seen_at, last_seen_at,
  item_type, raw_title, raw_text, normalized_text, metadata, content_fingerprint
) values
  (
    '56200000-0000-4000-8000-000000000001', '36200000-0000-4000-8000-000000000001', 'firstPartyOttRelease',
    'https://youtube.example/watch/first-party-ott-release', now(), now(), now(), 'VIDEO',
    'Direct OTT Film Movie, Streaming from Sept 25th', 'Official OTT platform confirms the movie release.',
    'direct ott film movie streaming from sept 25th official ott platform confirms the movie release', '{}'::jsonb, repeat('3', 64)
  ),
  (
    '56200000-0000-4000-8000-000000000002', '36200000-0000-4000-8000-000000000002', 'tradeOnlyOttRelease',
    'https://trade.example/trade-only-ott-release', now(), now(), now(), 'RSS_ITEM',
    'Trade Only Film Movie streaming September 25', 'Trade source reports a streaming date.',
    'trade only film movie streaming september 25 trade source reports a streaming date', '{}'::jsonb, repeat('4', 64)
  );

select lives_ok(
  $$select public.submit_entity_discovery_candidate(
    'Direct OTT Film','MOVIE','56200000-0000-4000-8000-000000000001'::uuid,
    0.97,'te','IN','DETERMINISTIC_TITLE',0.98,
    '{"signalType":"OTT_RELEASE","providerCode":"SONYLIV","releaseDate":"2026-09-25","datePrecision":"DAY","state":"UPCOMING","evidenceStatus":"CONFIRMED","releaseType":"POST_THEATRICAL"}'::jsonb
  )$$,
  'direct Tier-1 OTT evidence can submit a movie candidate'
);

select results_eq(
  $$select (public.system_promote_verified_ott_candidate(
      (select id from public.entity_discovery_candidates where normalized_name='direct ott film' and proposed_entity_type='MOVIE')
    )->>'promoted')::boolean$$,
  array[true],
  'one direct confirmed Tier-1 OTT source can use the narrow first-party promotion path'
);

select results_eq(
  $$select count(*) from public.entities
    where entity_type='MOVIE' and status='ACTIVE'
      and public.normalize_entity_discovery_name(canonical_name)='direct ott film'$$,
  array[1::bigint],
  'first-party OTT promotion creates exactly one canonical movie entity'
);

select results_eq(
  $$select status || ':' || (promoted_entity_id is not null)::text
    from public.entity_discovery_candidates
    where normalized_name='direct ott film' and proposed_entity_type='MOVIE'$$,
  array['PROMOTED:true'::text],
  'first-party candidate records its promoted entity'
);

select results_eq(
  $$select
      (select count(*) from public.operator_resolution_overrides oro
        join public.entities e on e.id=oro.entity_id
        where public.normalize_entity_discovery_name(e.canonical_name)='direct ott film'
          and oro.active=true)::text || ':' ||
      (select count(*) from public.source_entity_candidates sec
        join public.entities e on e.id=sec.entity_id
        where public.normalize_entity_discovery_name(e.canonical_name)='direct ott film'
          and sec.active=true)::text$$,
  array['1:0'::text],
  'direct OTT evidence is preserved at item scope without teaching the provider a film scope'
);

select results_eq(
  $$select count(*) from public.jobs
    where idempotency_key like 'process:first-party-ott-promotion:%'
      and payload->>'rawItemId'='56200000-0000-4000-8000-000000000001'$$,
  array[1::bigint],
  'first-party promotion re-enqueues its evidence item for canonical OTT persistence'
);

select lives_ok(
  $$select public.submit_entity_discovery_candidate(
    'Trade Only Film','MOVIE','56200000-0000-4000-8000-000000000002'::uuid,
    0.92,'te','IN','DETERMINISTIC_TITLE',0.90,
    '{"signalType":"OTT_RELEASE","providerCode":"ZEE5","releaseDate":"2026-09-25","datePrecision":"DAY","state":"UPCOMING","evidenceStatus":"REPORTED","releaseType":"POST_THEATRICAL"}'::jsonb
  )$$,
  'trade-only OTT evidence can still submit a reported candidate'
);

select results_eq(
  $$select (public.system_promote_verified_ott_candidate(
      (select id from public.entity_discovery_candidates where normalized_name='trade only film' and proposed_entity_type='MOVIE')
    )->>'promoted')::boolean$$,
  array[false],
  'a single trade report cannot use the first-party fast path or the corroborated path'
);

select results_eq(
  $$select
      has_function_privilege('anon', 'public.system_promote_first_party_ott_candidate(uuid)', 'EXECUTE')::text || ':' ||
      has_function_privilege('service_role', 'public.system_promote_first_party_ott_candidate(uuid)', 'EXECUTE')::text || ':' ||
      has_function_privilege('anon', 'public.system_promote_verified_ott_candidate(uuid)', 'EXECUTE')::text || ':' ||
      has_function_privilege('service_role', 'public.system_promote_verified_ott_candidate(uuid)', 'EXECUTE')::text$$,
  array['false:true:false:true'::text],
  'first-party and dispatcher promotion functions remain service-role only'
);

select * from finish();
rollback;
