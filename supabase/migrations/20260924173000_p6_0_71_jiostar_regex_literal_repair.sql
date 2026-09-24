begin;

do $migration$
declare
  v_bs text := chr(92);
  v_url_pattern text;
  v_title_pattern text;
  v_exclude_pattern text;
begin
  v_url_pattern := '^https://www' || v_bs || '.jiostar' || v_bs || '.com/news/[^/?#]+/?$';
  v_title_pattern := '(?:' || v_bs || 'bto' || v_bs || 's+stream' || v_bs || 'b|'
    || v_bs || 'bstreaming' || v_bs || 'b|'
    || v_bs || 'bpremieres?' || v_bs || 'b|'
    || v_bs || 'bavailable' || v_bs || 'b).*'
    || v_bs || 'bJioHotstar' || v_bs || 'b|'
    || v_bs || 'bJioHotstar' || v_bs || 'b.*(?:'
    || v_bs || 'bto' || v_bs || 's+stream' || v_bs || 'b|'
    || v_bs || 'bstreaming' || v_bs || 'b|'
    || v_bs || 'bpremieres?' || v_bs || 'b|'
    || v_bs || 'bavailable' || v_bs || 'b)';
  v_exclude_pattern := v_bs || 'b(?:season|series|episode|episodes|show|reality|Bigg Boss|Hotstar Specials|television|TV premiere|ratings?|benchmark|sponsor)' || v_bs || 'b';

  update public.source_identities si
  set connector_config = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              si.connector_config,
              '{parserProfile,profileVersion}',
              to_jsonb('jiostar-jiohotstar-ott-release-v3'::text),
              true
            ),
            '{parserProfile,includeUrlPattern}',
            to_jsonb(v_url_pattern),
            true
          ),
          '{parserProfile,includeTitlePattern}',
          to_jsonb(v_title_pattern),
          true
        ),
        '{parserProfile,excludeTitlePattern}',
        to_jsonb(v_exclude_pattern),
        true
      ),
      updated_at = now()
  from public.sources s
  where s.id = si.source_id
    and s.display_name = 'JioStar — JioHotstar OTT Releases'
    and si.platform = 'WEB';

  update public.page_source_state ps
  set next_check_at = now(),
      drift_count = 0,
      parser_profile_version = 'jiostar-jiohotstar-ott-release-v3',
      updated_at = now()
  from public.source_identities si
  join public.sources s on s.id = si.source_id
  where ps.source_identity_id = si.id
    and s.display_name = 'JioStar — JioHotstar OTT Releases'
    and si.platform = 'WEB';

  -- Do not predeclare the source healthy here. The next real page poll must
  -- prove the repaired profile against the live JioStar page and own health recovery.
end;
$migration$;

commit;
