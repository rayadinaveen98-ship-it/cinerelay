begin;

update public.source_identities si
set connector_config = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            si.connector_config,
            '{parserProfile,profileVersion}',
            to_jsonb('jiostar-jiohotstar-ott-release-v2'::text),
            true
          ),
          '{parserProfile,includeUrlPattern}',
          to_jsonb('^https://www\.jiostar\.com/news/[^/?#]+/?$'::text),
          true
        ),
        '{parserProfile,includeTitlePattern}',
        to_jsonb('(?:\bto\s+stream\b|\bstreaming\b|\bpremieres?\b|\bavailable\b).*\bJioHotstar\b|\bJioHotstar\b.*(?:\bto\s+stream\b|\bstreaming\b|\bpremieres?\b|\bavailable\b)'::text),
        true
      ),
      '{parserProfile,excludeTitlePattern}',
      to_jsonb('\b(?:season|series|episode|episodes|show|reality|Bigg Boss|Hotstar Specials|television|TV premiere|ratings?|benchmark|sponsor)\b'::text),
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
    parser_profile_version = 'jiostar-jiohotstar-ott-release-v2',
    updated_at = now()
from public.source_identities si
join public.sources s on s.id = si.source_id
where ps.source_identity_id = si.id
  and s.display_name = 'JioStar — JioHotstar OTT Releases';

update public.source_health sh
set health_state = 'HEALTHY',
    next_due_at = now(),
    last_error_code = null,
    last_error_message = null,
    updated_at = now()
from public.source_identities si
join public.sources s on s.id = si.source_id
where sh.source_identity_id = si.id
  and s.display_name = 'JioStar — JioHotstar OTT Releases';

commit;
