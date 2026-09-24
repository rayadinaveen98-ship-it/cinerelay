begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into public.sources (id, display_name, authority_tier, source_role, active)
values
  ('24000000-0000-4000-8000-000000000001', 'Precision Trade', 3, 'TRADE_MEDIA', true),
  ('24000000-0000-4000-8000-000000000002', 'Precision Studio', 1, 'PRODUCTION_HOUSE', true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, canonical_url, connector_type, poll_class, access_mode, active
) values
  (
    '34000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', 'RSS',
    'precision-trade', 'https://precision.example/feed.xml', 'RSS_ATOM', 'ACTIVE_15M', 'FEED', true
  ),
  (
    '34000000-0000-4000-8000-000000000002', '24000000-0000-4000-8000-000000000002', 'YOUTUBE',
    'UCprecisionStudio00000001', 'https://www.youtube.com/channel/UCprecisionStudio00000001',
    'YOUTUBE_PLAYLIST', 'HOT_5M', 'API', true
  );

insert into public.entities (id, entity_type, canonical_name, slug, primary_language, country_code, status)
values ('44000000-0000-4000-8000-000000000001', 'MOVIE', 'Precision Film', 'precision-film', 'te', 'IN', 'ACTIVE');

insert into public.raw_items (
  id, source_identity_id, platform_item_id, canonical_url, published_at, first_seen_at, last_seen_at,
  item_type, raw_title, raw_text, normalized_text, metadata, content_fingerprint
) values
  (
    '54000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', 'precisionInterview',
    'https://precision.example/interview', now(), now(), now(), 'RSS_ITEM',
    'Interview: Director discusses Precision Film',
    'The director was asked whether avoiding the trailer is a good move.',
    'interview director discusses precision film the director was asked whether avoiding the trailer is a good move',
    '{}'::jsonb, repeat('5', 64)
  ),
  (
    '54000000-0000-4000-8000-000000000002', '34000000-0000-4000-8000-000000000001', 'precisionSong',
    'https://precision.example/song', now(), now(), now(), 'RSS_ITEM',
    'Precision Film: Star drops a sneak peek of third song',
    'The film is scheduled to arrive in theatres worldwide on September 24, 2026.',
    'precision film star drops a sneak peek of third song the film is scheduled to arrive in theatres worldwide on september 24 2026',
    '{}'::jsonb, repeat('6', 64)
  ),
  (
    '54000000-0000-4000-8000-000000000003', '34000000-0000-4000-8000-000000000001', 'precisionTrailer',
    'https://precision.example/trailer', now(), now(), now(), 'RSS_ITEM',
    'Precision Film trailer released',
    'The trailer is now available.',
    'precision film trailer released the trailer is now available',
    '{}'::jsonb, repeat('7', 64)
  ),
  (
    '54000000-0000-4000-8000-000000000004', '34000000-0000-4000-8000-000000000002', 'precisionDate',
    'https://www.youtube.com/watch?v=precisionDate', now(), now(), now(), 'YOUTUBE_VIDEO',
    'Proud to announce Precision Film',
    'Worldwide theatrical release on 18 December 2026.',
    'proud to announce precision film worldwide theatrical release on 18 december 2026',
    '{}'::jsonb, repeat('8', 64)
  );

select public.upsert_canonical_event_with_evidence(
  '74000000-0000-4000-8000-000000000001'::uuid,
  '44000000-0000-4000-8000-000000000001'::uuid,
  'TRAILER_RELEASED', 'RELIABLE_REPORT', 'CRITICAL', 'Trailer released', '{}'::jsonb,
  'precision-film|TRAILER_RELEASED|{}', 'deterministic-domain-v1.1',
  '54000000-0000-4000-8000-000000000001'::uuid
);

select results_eq(
  $$select count(*) from public.events where id='74000000-0000-4000-8000-000000000001'::uuid$$,
  array[0::bigint],
  'trade interview body mention cannot create trailer event'
);
select results_eq(
  $$select reason from public.classifier_event_rejections where raw_item_id='54000000-0000-4000-8000-000000000001'::uuid and attempted_event_type='TRAILER_RELEASED'$$,
  array['non_first_party_trailer_not_title_grounded'::text],
  'rejected trade trailer false positive is recorded'
);

select public.upsert_canonical_event_with_evidence(
  '74000000-0000-4000-8000-000000000002'::uuid,
  '44000000-0000-4000-8000-000000000001'::uuid,
  'THEATRICAL_DATE_ANNOUNCED', 'RELIABLE_REPORT', 'CRITICAL',
  'Theatrical release date announced for 2026-09-24', '{"date":"2026-09-24"}'::jsonb,
  'precision-film|THEATRICAL_DATE_ANNOUNCED|{"date":"2026-09-24"}', 'deterministic-domain-v1.1',
  '54000000-0000-4000-8000-000000000002'::uuid
);

select results_eq(
  $$select count(*) from public.events where id='74000000-0000-4000-8000-000000000002'::uuid$$,
  array[0::bigint],
  'trade song article background release date cannot create theatrical-date event'
);
select results_eq(
  $$select reason from public.classifier_event_rejections where raw_item_id='54000000-0000-4000-8000-000000000002'::uuid and attempted_event_type='THEATRICAL_DATE_ANNOUNCED'$$,
  array['non_first_party_theatrical_date_not_title_grounded'::text],
  'rejected background release-date false positive is recorded'
);

select public.upsert_canonical_event_with_evidence(
  '74000000-0000-4000-8000-000000000003'::uuid,
  '44000000-0000-4000-8000-000000000001'::uuid,
  'TRAILER_RELEASED', 'RELIABLE_REPORT', 'CRITICAL', 'Trailer released', '{}'::jsonb,
  'precision-film|TRAILER_RELEASED|{"proof":1}', 'deterministic-domain-v1.1',
  '54000000-0000-4000-8000-000000000003'::uuid
);

select results_eq(
  $$select event_type from public.events where id='74000000-0000-4000-8000-000000000003'::uuid$$,
  array['TRAILER_RELEASED'::text],
  'trade trailer claim remains allowed when headline is title-grounded'
);
select results_eq(
  $$select count(*) from public.event_evidence where event_id='74000000-0000-4000-8000-000000000003'::uuid and raw_item_id='54000000-0000-4000-8000-000000000003'::uuid$$,
  array[1::bigint],
  'allowed trade trailer retains canonical evidence'
);

select public.upsert_canonical_event_with_evidence(
  '74000000-0000-4000-8000-000000000004'::uuid,
  '44000000-0000-4000-8000-000000000001'::uuid,
  'THEATRICAL_DATE_ANNOUNCED', 'OFFICIAL', 'CRITICAL',
  'Theatrical release date announced for 2026-12-18', '{"date":"2026-12-18"}'::jsonb,
  'precision-film|THEATRICAL_DATE_ANNOUNCED|{"date":"2026-12-18"}', 'deterministic-domain-v1.1',
  '54000000-0000-4000-8000-000000000004'::uuid
);

select results_eq(
  $$select event_type from public.events where id='74000000-0000-4000-8000-000000000004'::uuid$$,
  array['THEATRICAL_DATE_ANNOUNCED'::text],
  'first-party release-date claim may be grounded in official body copy'
);
select results_eq(
  $$select count(*) from public.classifier_event_rejections where raw_item_id='54000000-0000-4000-8000-000000000004'::uuid$$,
  array[0::bigint],
  'first-party official date announcement is not rejected'
);

select * from finish();
rollback;
