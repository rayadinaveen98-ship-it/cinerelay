begin;

-- Production canary: both Live Hindustan endpoints returned HTTP 200 but the
-- generic feed parser accepted no entry (no last_entry_id / successful fetch).
-- Keep the reviewed identities in the registry for future parser work, but
-- remove them from active polling until compatibility is explicitly verified.
update public.source_identities si
set active = false,
    connector_config = coalesce(si.connector_config, '{}'::jsonb) || jsonb_build_object(
      'canaryStatus', 'PARSER_HOLD',
      'activationBlocked', 'feed_parser_empty_200'
    ),
    updated_at = now()
from public.sources s
where s.id = si.source_id
  and s.display_name = 'Live Hindustan — Entertainment'
  and si.platform = 'RSS'
  and si.connector_config->>'expansionWave' = 'wave2-batch6';

update public.sources s
set active = false,
    notes = trim(both ' ' from coalesce(s.notes, '') || ' Batch 6 production canary: feed endpoints returned HTTP 200 but parsed no entries; source held inactive pending parser compatibility.'),
    updated_at = now()
where s.display_name = 'Live Hindustan — Entertainment'
  and s.authority_tier = 4
  and s.source_role = 'GENERAL_MEDIA';

commit;
