begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

select results_eq(
  $$select count(*) from public.ott_providers where code in ('NETFLIX','PRIME_VIDEO','JIOHOTSTAR','ZEE5','SONYLIV','AHA','SUN_NXT','ETV_WIN') and active=true$$,
  array[8::bigint],
  'initial India OTT provider registry contains the eight locked providers'
);

insert into public.sources (id, display_name, authority_tier, source_role, active)
values
  ('26000000-0000-4000-8000-000000000001', 'OTT Test Platform', 1, 'OTT_PLATFORM', true),
  ('26000000-0000-4000-8000-000000000002', 'OTT Test Trade', 3, 'TRADE_MEDIA', true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, canonical_url, connector_type, poll_class, access_mode, active
) values
  (
    '36000000-0000-4000-8000-000000000001', '26000000-0000-4000-8000-000000000001', 'WEB',
    'ott-test-platform', 'https://ott-platform.example/releases', 'PAGE_POLL', 'ACTIVE_15M', 'PUBLIC_WEB', true
  ),
  (
    '36000000-0000-4000-8000-000000000002', '26000000-0000-4000-8000-000000000002', 'RSS',
    'ott-test-trade', 'https://ott-trade.example/feed.xml', 'RSS_ATOM', 'ACTIVE_15M', 'FEED', true
  );

insert into public.entities (id, entity_type, canonical_name, slug, primary_language, country_code, status)
values
  ('46000000-0000-4000-8000-000000000001', 'MOVIE', 'OTT Foundation Film', 'ott-foundation-film', 'te', 'IN', 'ACTIVE'),
  ('46000000-0000-4000-8000-000000000002', 'MOVIE', 'OTT Reported Film', 'ott-reported-film', 'ta', 'IN', 'ACTIVE');

insert into public.raw_items (
  id, source_identity_id, platform_item_id, canonical_url, published_at, first_seen_at, last_seen_at,
  item_type, raw_title, raw_text, normalized_text, metadata, content_fingerprint
) values
  (
    '56000000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-000000000001', 'ottOfficial1',
    'https://ott-platform.example/ott-foundation-film', now(), now(), now(), 'WEB_PAGE',
    'OTT Foundation Film streams October 10', 'Watch OTT Foundation Film from October 10, 2026.',
    'ott foundation film streams october 10 watch ott foundation film from october 10 2026', '{}'::jsonb, repeat('b', 64)
  ),
  (
    '56000000-0000-4000-8000-000000000002', '36000000-0000-4000-8000-000000000001', 'ottOfficial2',
    'https://ott-platform.example/ott-foundation-film-new-date', now(), now(), now(), 'WEB_PAGE',
    'OTT Foundation Film now streams October 17', 'The streaming date is now October 17, 2026.',
    'ott foundation film now streams october 17 the streaming date is now october 17 2026', '{}'::jsonb, repeat('c', 64)
  ),
  (
    '56000000-0000-4000-8000-000000000003', '36000000-0000-4000-8000-000000000002', 'ottTradeConflict',
    'https://ott-trade.example/ott-foundation-film', now(), now(), now(), 'RSS_ITEM',
    'OTT Foundation Film reportedly arriving October 24', 'Trade report claims October 24, 2026.',
    'ott foundation film reportedly arriving october 24 trade report claims october 24 2026', '{}'::jsonb, repeat('d', 64)
  ),
  (
    '56000000-0000-4000-8000-000000000004', '36000000-0000-4000-8000-000000000002', 'ottTradeReported',
    'https://ott-trade.example/ott-reported-film', now(), now(), now(), 'RSS_ITEM',
    'OTT Reported Film may stream November 6', 'A reliable trade report points to November 6, 2026.',
    'ott reported film may stream november 6 a reliable trade report points to november 6 2026', '{}'::jsonb, repeat('e', 64)
  );

select lives_ok(
  $$select public.upsert_ott_release_with_evidence(
    '46000000-0000-4000-8000-000000000001'::uuid,
    'NETFLIX',
    '56000000-0000-4000-8000-000000000001'::uuid,
    'IN', array['te'], 'POST_THEATRICAL', '2026-10-10'::date, 'DAY', 'UPCOMING', 'CONFIRMED',
    'Official platform release date'
  )$$,
  'first-party OTT evidence can create a confirmed release'
);

select results_eq(
  $$select op.code || ':' || r.release_date::text || ':' || r.evidence_status || ':' || r.state
    from public.ott_releases r join public.ott_providers op on op.id=r.provider_id
    where r.entity_id='46000000-0000-4000-8000-000000000001'::uuid and r.territory='IN'$$,
  array['NETFLIX:2026-10-10:CONFIRMED:UPCOMING'::text],
  'canonical OTT release stores provider date evidence state and lifecycle state'
);

select results_eq(
  $$select evidence_role || ':' || is_first_party::text from public.ott_release_evidence
    where raw_item_id='56000000-0000-4000-8000-000000000001'::uuid$$,
  array['PRIMARY:true'::text],
  'initial official evidence is retained as first-party primary evidence'
);

select results_eq(
  $$select count(*) from public.events
    where primary_entity_id='46000000-0000-4000-8000-000000000001'::uuid
      and event_type='OTT_DATE_ANNOUNCED' and status='ACTIVE'$$,
  array[1::bigint],
  'initial dated OTT release emits the canonical OTT date announcement event'
);

select lives_ok(
  $$select public.upsert_ott_release_with_evidence(
    '46000000-0000-4000-8000-000000000001'::uuid,
    'NETFLIX',
    '56000000-0000-4000-8000-000000000002'::uuid,
    'IN', array['te'], 'POST_THEATRICAL', '2026-10-17'::date, 'DAY', 'UPCOMING', 'CONFIRMED',
    'Official platform date change'
  )$$,
  'equal-strength first-party evidence may change a confirmed date'
);

select results_eq(
  $$select release_date::text || ':' || previous_release_date::text
    from public.ott_releases
    where entity_id='46000000-0000-4000-8000-000000000001'::uuid$$,
  array['2026-10-17:2026-10-10'::text],
  'date change updates one canonical row and preserves the previous date'
);

select results_eq(
  $$select count(*) from public.ott_release_history
    where ott_release_id=(select id from public.ott_releases where entity_id='46000000-0000-4000-8000-000000000001'::uuid)
      and old_release_date='2026-10-10'::date and new_release_date='2026-10-17'::date$$,
  array[1::bigint],
  'material canonical date changes are written to OTT release history'
);

select results_eq(
  $$select count(*) from public.events
    where primary_entity_id='46000000-0000-4000-8000-000000000001'::uuid
      and event_type='OTT_DATE_CHANGED' and status='ACTIVE'$$,
  array[1::bigint],
  'confirmed date change emits an OTT date changed event'
);

select throws_ok(
  $$select public.upsert_ott_release_with_evidence(
    '46000000-0000-4000-8000-000000000002'::uuid,
    'ZEE5',
    '56000000-0000-4000-8000-000000000004'::uuid,
    'IN', array['ta'], 'POST_THEATRICAL', '2026-11-06'::date, 'DAY', 'UPCOMING', 'CONFIRMED',
    'Trade report must not become confirmed'
  )$$,
  'P0001',
  'ott_confirmed_requires_first_party_evidence',
  'secondary trade evidence cannot silently become a confirmed OTT date'
);

select results_eq(
  $$select (public.upsert_ott_release_with_evidence(
    '46000000-0000-4000-8000-000000000001'::uuid,
    'NETFLIX',
    '56000000-0000-4000-8000-000000000003'::uuid,
    'IN', array['te'], 'POST_THEATRICAL', '2026-10-24'::date, 'DAY', 'UPCOMING', 'REPORTED',
    'Conflicting secondary report'
  )->>'acceptedCanonical')::boolean$$,
  array[false],
  'weaker conflicting report is retained without moving a confirmed canonical date'
);

select results_eq(
  $$select r.release_date::text || ':' || r.evidence_status || ':' || e.evidence_role
    from public.ott_releases r
    join public.ott_release_evidence e on e.ott_release_id=r.id
    where r.entity_id='46000000-0000-4000-8000-000000000001'::uuid
      and e.raw_item_id='56000000-0000-4000-8000-000000000003'::uuid$$,
  array['2026-10-17:CONFIRMED:CONFLICTING'::text],
  'confirmed canonical date survives while the weaker disagreement remains auditable'
);

select results_eq(
  $$select (public.upsert_ott_release_with_evidence(
    '46000000-0000-4000-8000-000000000002'::uuid,
    'ZEE5',
    '56000000-0000-4000-8000-000000000004'::uuid,
    'IN', array['ta'], 'POST_THEATRICAL', '2026-11-06'::date, 'DAY', 'UPCOMING', 'REPORTED',
    'Credible secondary report'
  )->>'acceptedCanonical')::boolean$$,
  array[true],
  'credible secondary reporting may create a clearly labeled REPORTED OTT release'
);

select results_eq(
  $$select evidence_status || ':' || release_date::text from public.ott_releases
    where entity_id='46000000-0000-4000-8000-000000000002'::uuid$$,
  array['REPORTED:2026-11-06'::text],
  'reported release remains explicitly labeled reported in canonical state'
);

select results_eq(
  $$select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname in ('ott_providers','ott_releases','ott_release_evidence','ott_release_history')
      and c.relrowsecurity=true$$,
  array[4::bigint],
  'all public OTT intelligence tables have row-level security enabled'
);

select * from finish();
rollback;
