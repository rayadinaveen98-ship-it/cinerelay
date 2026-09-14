begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

insert into public.sources (id, display_name, authority_tier, source_role, active)
values ('21000000-0000-4000-8000-000000000001', 'Revision Test Studio', 1, 'PRODUCTION_HOUSE', true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, canonical_url,
  connector_type, poll_class, access_mode, active
)
values (
  '31000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001',
  'YOUTUBE',
  'UCbbbbbbbbbbbbbbbbbbbbbb',
  'https://www.youtube.com/channel/UCbbbbbbbbbbbbbbbbbbbbbb',
  'YOUTUBE_WEBSUB', 'PUSH', 'WEBHOOK', true
);

select lives_ok(
  $$select * from public.upsert_raw_item_revision(
    '31000000-0000-4000-8000-000000000001'::uuid,
    'abc123DEF45',
    'https://www.youtube.com/watch?v=abc123DEF45',
    '2026-09-14T11:00:00Z'::timestamptz,
    'YOUTUBE_VIDEO',
    'Revision Test Video',
    'Revision Test Description',
    'revision test video revision test description',
    'VIDEO',
    '{"youtube":{"videoId":"abc123DEF45"}}'::jsonb,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  )$$,
  'raw item revision upsert does not collide with output variable names'
);

select results_eq(
  $$select count(*) from public.raw_item_revisions rir
    join public.raw_items ri on ri.id = rir.raw_item_id
    where ri.source_identity_id = '31000000-0000-4000-8000-000000000001'::uuid
      and ri.platform_item_id = 'abc123DEF45'$$,
  array[1::bigint],
  'raw item revision is persisted exactly once'
);

select * from finish();
rollback;
