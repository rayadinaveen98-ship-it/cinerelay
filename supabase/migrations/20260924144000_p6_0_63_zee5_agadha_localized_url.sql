begin;

update public.source_identities
set platform_identity_id = 'zee5:0-0-1z51080183',
    canonical_url = 'https://www.zee5.com/te/videos/details/agadha-trailer/0-0-1z51080183',
    updated_at = now()
where connector_type = 'OTT_PROVIDER_DETAIL'
  and platform = 'WEB'
  and platform_identity_id = 'zee5:0-0-1z51080182';

update public.page_source_state ps
set page_url = 'https://www.zee5.com/te/videos/details/agadha-trailer/0-0-1z51080183',
    next_check_at = now(),
    updated_at = now()
from public.source_identities si
where ps.source_identity_id = si.id
  and si.connector_type = 'OTT_PROVIDER_DETAIL'
  and si.platform_identity_id = 'zee5:0-0-1z51080183';

update public.source_health sh
set health_state = 'HEALTHY',
    next_due_at = now(),
    last_error_code = null,
    last_error_message = null,
    updated_at = now()
from public.source_identities si
where sh.source_identity_id = si.id
  and si.connector_type = 'OTT_PROVIDER_DETAIL'
  and si.platform_identity_id = 'zee5:0-0-1z51080183';

commit;
