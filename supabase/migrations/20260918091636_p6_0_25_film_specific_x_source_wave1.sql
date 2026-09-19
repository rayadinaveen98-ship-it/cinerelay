insert into public.sources (
  display_name, authority_tier, source_role, territory, languages, active, notes
)
select
  'The Paradise — Official Film', 1, 'PROJECT_OFFICIAL', 'IN', array['te','en']::text[], true,
  'P6.0.25 first-party film-specific X source; entity link intentionally deferred until operator resolution.'
where not exists (
  select 1 from public.sources where lower(display_name)=lower('The Paradise — Official Film')
);

with target as (
  select id from public.sources where lower(display_name)=lower('The Paradise — Official Film') limit 1
)
insert into public.source_identities (
  source_id, platform, platform_identity_id, handle, canonical_url,
  connector_type, poll_class, access_mode, connector_config, active
)
select
  target.id,
  'X',
  null,
  '@TheParadiseOffl',
  'https://x.com/TheParadiseOffl',
  'X_API_V2',
  'HOT_5M',
  'API',
  jsonb_build_object(
    'schemaVersion',1,
    'discoveryPriority','HIGH',
    'activationState','PENDING_X_API_CREDENTIALS',
    'userIdResolved',false,
    'ingestOriginalPosts',true,
    'includeReplies',false,
    'includeReposts',false,
    'projectName','The Paradise'
  ),
  false
from target
where not exists (
  select 1 from public.source_identities
  where platform='X' and lower(coalesce(handle,''))=lower('@TheParadiseOffl')
);
