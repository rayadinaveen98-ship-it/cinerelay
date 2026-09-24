begin;

do $migration$
declare
  v_source_id uuid;
  v_identity_id uuid;
  v_page_url text := 'https://www.jiostar.com/news-category/entertainment/';
  v_existing_identity uuid;
begin
  select id into v_existing_identity
  from public.source_identities
  where canonical_url = v_page_url
  limit 1;

  if v_existing_identity is not null then
    return;
  end if;

  insert into public.sources (
    display_name,
    authority_tier,
    source_role,
    territory,
    languages,
    active,
    notes
  ) values (
    'JioStar — JioHotstar OTT Releases',
    1,
    'OTT_PLATFORM',
    'IN',
    array['hi','te','ta','ml','kn','en']::text[],
    true,
    'First-party JioStar entertainment newsroom. P6.0.60 title filtering retains release/streaming announcements while suppressing general platform, TV and reality-show news.'
  ) returning id into v_source_id;

  insert into public.source_identities (
    source_id,
    platform,
    canonical_url,
    connector_type,
    poll_class,
    access_mode,
    connector_config,
    active
  ) values (
    v_source_id,
    'WEB',
    v_page_url,
    'FIRST_PARTY_HTML',
    'COLD_6H',
    'PUBLIC_WEB',
    jsonb_build_object(
      'sourceClass', 'FIRST_PARTY_OTT_RELEASE_PAGE',
      'discoveryPriority', 'HIGH',
      'parserProfile', jsonb_build_object(
        'profileVersion', 'jiostar-jiohotstar-ott-release-v1',
        'itemSelector', 'a[href]',
        'linkSelector', '@self',
        'titleSelector', '@self',
        'includeUrlPattern', '^https://www\\.jiostar\\.com/news/[^/?#]+/?$',
        'includeTitlePattern', '(?:\\bto\\s+stream\\b|\\bstreaming\\b|\\bpremieres?\\b|\\bavailable\\b).*\\bJioHotstar\\b|\\bJioHotstar\\b.*(?:\\bto\\s+stream\\b|\\bstreaming\\b|\\bpremieres?\\b|\\bavailable\\b)',
        'excludeTitlePattern', '\\b(?:season|series|episode|episodes|show|reality|Bigg Boss|Hotstar Specials|television|TV premiere|ratings?|benchmark|sponsor)\\b',
        'maxItems', 30,
        'minItems', 1,
        'order', 'NEWEST_FIRST'
      )
    ),
    true
  ) returning id into v_identity_id;

  perform public.register_page_source(v_identity_id, v_page_url);
end;
$migration$;

commit;
