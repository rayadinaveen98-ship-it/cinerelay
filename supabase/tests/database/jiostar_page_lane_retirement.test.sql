begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

select ok(
  not (select si.active
       from public.source_identities si
       join public.sources s on s.id = si.source_id
       where s.display_name = 'JioStar — JioHotstar OTT Releases' and si.platform = 'WEB'
       limit 1),
  'mixed JioStar WEB identity stays inactive until typed parsing exists'
);

select ok(
  not (select s.active
       from public.sources s
       where s.display_name = 'JioStar — JioHotstar OTT Releases'
       limit 1),
  'retired JioStar archive source is not exposed as an active source'
);

select ok(
  (select ps.next_check_at >= '9999-01-01T00:00:00Z'::timestamptz
   from public.page_source_state ps
   join public.source_identities si on si.id = ps.source_identity_id
   join public.sources s on s.id = si.source_id
   where s.display_name = 'JioStar — JioHotstar OTT Releases' and si.platform = 'WEB'
   limit 1),
  'retired JioStar page state cannot remain in the active polling queue'
);

select ok(
  exists (
    select 1
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where si.active = true
      and s.active = true
      and s.source_role = 'OTT_PLATFORM'
      and s.authority_tier <= 2
      and lower(s.display_name) like 'jiohotstar%'
      and si.platform = 'YOUTUBE'
  ),
  'JioHotstar retains an active Tier-1/2 official YouTube coverage lane'
);

select * from finish();
rollback;
