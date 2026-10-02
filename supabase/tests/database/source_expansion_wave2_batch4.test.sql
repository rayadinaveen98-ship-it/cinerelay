begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select is(
  (
    select count(*)::integer
    from public.sources
    where display_name in (
      'Gopuram Films',
      'Neelam Productions',
      'YNOT Studios',
      'V Creations',
      'Wayfarer Films',
      'VELS Film International'
    )
      and authority_tier = 1
      and source_role = 'PRODUCTION_HOUSE'
      and active = true
  ),
  6,
  'wave 2 batch 4 registers six active Tier-1 production-house brands'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where platform = 'YOUTUBE'
      and active = true
      and connector_config ->> 'expansionWave' = 'wave2-batch4'
  ),
  7,
  'wave 2 batch 4 registers exactly seven active YouTube identities'
);

select is(
  (
    select count(*)::integer
    from public.youtube_channel_state ycs
    join public.source_identities si on si.id = ycs.source_identity_id
    where si.connector_config ->> 'expansionWave' = 'wave2-batch4'
      and ycs.uploads_playlist_id = 'UU' || substring(si.platform_identity_id from 3)
  ),
  7,
  'all batch 4 identities have canonical uploads-playlist fallback state'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where s.display_name = 'VELS Film International'
      and si.connector_config ->> 'expansionWave' = 'wave2-batch4'
      and si.platform_identity_id = any(array[
        'UCMsAo0XUISOL6O1ek_3QWfg',
        'UCPR9Pu-BhBVhnQy7eYsvo-A'
      ]::text[])
      and si.active = true
  ),
  2,
  'VELS Film International has both verified first-party YouTube lanes'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where s.display_name = 'Gopuram Films'
      and si.platform_identity_id = 'UCowkzSd9XuqmT8cDj4Ilyzw'
      and si.active = true
  ),
  1,
  'Gopuram Films canonical YouTube identity is active once'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where s.display_name = 'Neelam Productions'
      and si.platform_identity_id = 'UCfySW6uJdx9zM8ApGbt0JFw'
      and si.active = true
  ),
  1,
  'Neelam Productions canonical YouTube identity is active once'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where s.display_name = 'YNOT Studios'
      and si.platform_identity_id = 'UCqVDSxEb7MNfYvddpbri4TA'
      and si.active = true
  ),
  1,
  'YNOT Studios canonical YouTube identity is active once'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where s.display_name = 'V Creations'
      and si.platform_identity_id = 'UClqoU3DHuKFsYCCLXUNUE1g'
      and si.active = true
  ),
  1,
  'V Creations rights-owner YouTube identity is active once'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where s.display_name = 'Wayfarer Films'
      and si.platform_identity_id = 'UCqhz8slFDrgzO5qiSLChWMQ'
      and si.active = true
  ),
  1,
  'Wayfarer Films canonical YouTube identity is active once'
);

select is(
  (
    select count(*)::integer
    from public.source_identities
    where platform = 'X'
      and active = true
  ),
  0,
  'wave 2 batch 4 does not reactivate X'
);

select * from finish();
rollback;
