insert into public.sources (display_name, authority_tier, source_role, territory, languages, active, notes)
select v.display_name, 1, 'OTT_PLATFORM', 'IN', v.languages, true, 'P6.0.23 official OTT platform source'
from (values
  ('Netflix India', array['en','hi']::text[]),
  ('Netflix India South', array['te','ta','ml','kn','en']::text[]),
  ('Prime Video India', array['en','hi','te','ta','ml','kn']::text[]),
  ('ZEE5 Telugu', array['te','en']::text[]),
  ('aha', array['te','ta','en']::text[]),
  ('Sun NXT', array['te','ta','ml','kn','en']::text[]),
  ('Sony LIV', array['en','hi','te','ta','ml','kn']::text[])
) as v(display_name, languages)
where not exists (
  select 1 from public.sources s where lower(s.display_name)=lower(v.display_name)
);

with registry(display_name, handle, priority, poll_class) as (
  values
    ('Netflix India','@NetflixIndia','NORMAL','ACTIVE_15M'),
    ('Netflix India South','@Netflix_INSouth','HIGH','HOT_5M'),
    ('Prime Video India','@PrimeVideoIN','HIGH','HOT_5M'),
    ('ZEE5 Telugu','@ZEE5Telugu','HIGH','HOT_5M'),
    ('aha','@ahavideoIN','HIGH','HOT_5M'),
    ('Sun NXT','@sunnxt','NORMAL','ACTIVE_15M'),
    ('Sony LIV','@SonyLIV','NORMAL','ACTIVE_15M')
)
insert into public.source_identities (
  source_id, platform, platform_identity_id, handle, canonical_url,
  connector_type, poll_class, access_mode, connector_config, active
)
select s.id, 'X', null, r.handle,
       'https://x.com/' || regexp_replace(r.handle, '^@', ''),
       'X_API_V2', r.poll_class, 'API',
       jsonb_build_object(
         'schemaVersion',1,
         'discoveryPriority',r.priority,
         'activationState','PENDING_X_API_CREDENTIALS',
         'userIdResolved',false,
         'ingestOriginalPosts',true,
         'includeReplies',false,
         'includeReposts',false
       ),
       false
from registry r
join public.sources s on lower(s.display_name)=lower(r.display_name)
where not exists (
  select 1 from public.source_identities si
  where si.platform='X' and lower(coalesce(si.handle,''))=lower(r.handle)
);
