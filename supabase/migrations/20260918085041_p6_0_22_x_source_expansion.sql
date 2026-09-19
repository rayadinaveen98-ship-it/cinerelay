-- P6.0.22: X first-party source expansion.
-- Registry only. X identities remain inactive until official API credentials are configured
-- and a hosted connector canary passes.

with wanted_sources(display_name, source_role, languages) as (
  values
    ('UV Creations','PRODUCTION_HOUSE',array['te']::text[]),
    ('Sri Venkateswara Creations','PRODUCTION_HOUSE',array['te']::text[]),
    ('Swapna Cinema','PRODUCTION_HOUSE',array['te']::text[]),
    ('Wall Poster Cinema','PRODUCTION_HOUSE',array['te']::text[]),
    ('Niharika Entertainment','PRODUCTION_HOUSE',array['te']::text[]),
    ('Fortune Four Cinemas','PRODUCTION_HOUSE',array['te']::text[]),
    ('Saregama South','MUSIC_LABEL',array['te','ta','kn','ml']::text[])
)
insert into public.sources (
  display_name, authority_tier, source_role, territory, languages, active, notes
)
select
  w.display_name,
  1,
  w.source_role,
  'IN',
  w.languages,
  true,
  'P6.0.22 X first-party source expansion'
from wanted_sources w
where not exists (
  select 1 from public.sources s where lower(s.display_name)=lower(w.display_name)
);

with wanted(display_name, handle, priority) as (
  values
    ('Mythri Movie Makers','@MythriOfficial','HIGH'),
    ('Sithara Entertainments','@SitharaEnts','HIGH'),
    ('Haarika & Hassine Creations','@haarikahassine','HIGH'),
    ('Geetha Arts','@GeethaArts','HIGH'),
    ('People Media Factory','@peoplemediafcy','HIGH'),
    ('Vyjayanthi Network','@VyjayanthiFilms','HIGH'),
    ('14 Reels Plus','@14ReelsPlus','HIGH'),
    ('Suresh Productions','@SureshProdns','NORMAL'),
    ('Aditya Music','@adityamusic','NORMAL'),
    ('Sony Music South','@SonyMusicSouth','NORMAL'),
    ('DVV Entertainment','@DVVMovies','NORMAL'),
    ('SLV Cinemas','@SLVCinemasOffl','NORMAL'),
    ('UV Creations','@UV_Creations','HIGH'),
    ('Sri Venkateswara Creations','@SVC_official','HIGH'),
    ('Swapna Cinema','@SwapnaCinema','HIGH'),
    ('Wall Poster Cinema','@walpostercinema','HIGH'),
    ('Niharika Entertainment','@NiharikaEnt','HIGH'),
    ('Fortune Four Cinemas','@Fortune4Cinemas','NORMAL'),
    ('Saregama South','@saregamasouth','NORMAL')
)
insert into public.source_identities (
  source_id,
  platform,
  platform_identity_id,
  handle,
  canonical_url,
  connector_type,
  poll_class,
  access_mode,
  connector_config,
  active
)
select
  s.id,
  'X',
  lower(regexp_replace(w.handle, '^@', '')),
  w.handle,
  'https://x.com/' || regexp_replace(w.handle, '^@', ''),
  'X_API_V2',
  case when w.priority='HIGH' then 'HOT_5M' else 'ACTIVE_15M' end,
  'API',
  jsonb_build_object(
    'schemaVersion', 1,
    'discoveryPriority', w.priority,
    'activationState', 'PENDING_X_API_CREDENTIALS',
    'userIdResolved', false,
    'includeReplies', false,
    'includeReposts', false,
    'ingestOriginalPosts', true
  ),
  false
from wanted w
join public.sources s on lower(s.display_name)=lower(w.display_name)
where not exists (
  select 1
  from public.source_identities si
  where si.source_id=s.id and si.platform='X'
);
