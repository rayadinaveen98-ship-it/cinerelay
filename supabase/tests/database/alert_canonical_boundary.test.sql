begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='alert_deliveries'
      and column_name='raw_item_id'
  ),
  'alert outbox has no raw-item delivery path'
);

select is(
  (
    select is_nullable
    from information_schema.columns
    where table_schema='public'
      and table_name='alert_deliveries'
      and column_name='event_id'
  ),
  'NO',
  'every alert delivery requires a canonical event id'
);

select ok(
  exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name=kcu.constraint_name
     and tc.constraint_schema=kcu.constraint_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name=ccu.constraint_name
     and tc.constraint_schema=ccu.constraint_schema
    where tc.constraint_type='FOREIGN KEY'
      and tc.table_schema='public'
      and tc.table_name='alert_deliveries'
      and kcu.column_name='event_id'
      and ccu.table_schema='public'
      and ccu.table_name='events'
      and ccu.column_name='id'
  ),
  'alert event_id is constrained to public.events(id)'
);

select ok(
  not has_table_privilege('authenticated', 'public.alert_deliveries', 'INSERT'),
  'clients cannot bypass canonical planning by inserting directly into the alert outbox'
);

insert into public.sources (id, display_name, authority_tier, source_role, active)
values ('d3000000-0000-4000-8000-000000000001', 'P6 Raw Trade Feed', 3, 'TRADE_MEDIA', true);

insert into public.source_identities (
  id, source_id, platform, platform_identity_id, canonical_url, connector_type, poll_class, access_mode, active
) values (
  'd4000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'RSS', 'p6-raw-trade-feed', 'https://example.com/feed',
  'RSS_ATOM', 'ACTIVE_15M', 'FEED', true
);

insert into public.raw_items (
  id, source_identity_id, platform_item_id, canonical_url, published_at, first_seen_at,
  item_type, raw_title, raw_text, normalized_text, media_type, metadata, content_fingerprint
) values (
  'd5000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000001',
  'p6-raw-trade-item', 'https://example.com/news/raw-trade-item', now(), now(),
  'FEED_ENTRY', 'Unconfirmed trade report', 'Sources suggest an update; makers have not confirmed it.',
  'unconfirmed trade report sources suggest an update makers have not confirmed it',
  'TEXT', '{}'::jsonb, repeat('e',64)
);

select results_eq(
  $$select count(*) from public.alert_deliveries$$,
  array[0::bigint],
  'inserting an unresolved raw trade-media item creates no alert delivery'
);

select results_eq(
  $$select count(*) from public.events$$,
  array[0::bigint],
  'raw alert-boundary fixture does not require or invent a canonical event'
);

select * from finish();
rollback;
