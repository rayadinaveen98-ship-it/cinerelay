begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

select results_eq(
  $$select connector_config #>> '{parserProfile,profileVersion}'
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where s.display_name = 'JioStar — JioHotstar OTT Releases' and si.platform = 'WEB'$$,
  array['jiostar-jiohotstar-ott-release-v3'::text],
  'JioStar parser profile advances to v3'
);

select results_eq(
  $$select connector_config #>> '{parserProfile,includeUrlPattern}'
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where s.display_name = 'JioStar — JioHotstar OTT Releases' and si.platform = 'WEB'$$,
  array['^https://www' || chr(92) || '.jiostar' || chr(92) || '.com/news/[^/?#]+/?$'],
  'JioStar URL regex stores one literal regex escape before each domain dot'
);

select ok(
  (select position(chr(92) || chr(92) in (connector_config #>> '{parserProfile,includeUrlPattern}')) = 0
   from public.source_identities si join public.sources s on s.id = si.source_id
   where s.display_name = 'JioStar — JioHotstar OTT Releases' and si.platform = 'WEB'),
  'JioStar URL regex contains no doubled backslash literals'
);

select ok(
  (select position(chr(92) || chr(92) in (connector_config #>> '{parserProfile,includeTitlePattern}')) = 0
   from public.source_identities si join public.sources s on s.id = si.source_id
   where s.display_name = 'JioStar — JioHotstar OTT Releases' and si.platform = 'WEB'),
  'JioStar title regex contains no doubled backslash literals'
);

select ok(
  (select position(chr(92) || chr(92) in (connector_config #>> '{parserProfile,excludeTitlePattern}')) = 0
   from public.source_identities si join public.sources s on s.id = si.source_id
   where s.display_name = 'JioStar — JioHotstar OTT Releases' and si.platform = 'WEB'),
  'JioStar exclusion regex contains no doubled backslash literals'
);

select results_eq(
  $$select parser_profile_version
    from public.page_source_state ps
    join public.source_identities si on si.id = ps.source_identity_id
    join public.sources s on s.id = si.source_id
    where s.display_name = 'JioStar — JioHotstar OTT Releases' and si.platform = 'WEB'$$,
  array['jiostar-jiohotstar-ott-release-v3'::text],
  'JioStar runtime page state is queued with parser profile v3'
);

select * from finish();
rollback;
