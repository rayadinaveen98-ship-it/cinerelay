begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    where si.platform = 'YOUTUBE'
      and si.platform_identity_id = any(array[
        'UCBnxEdpoZwstJqC1yZpOjRA',
        'UCGjn3ZbkkNcQaj00qwJ0DYQ',
        'UCeM3IXubMXTH3LdsMQ3VAhw',
        'UChRi1dpwnsZcIo1LSwzY0Iw',
        'UCLtCejNl8eAg4PO_9lf2TIg',
        'UCp8WoMOdQrSSPAJmQTGbNTw',
        'UC_A7K2dXFsTMAciGmnNxy-Q'
      ]::text[])
      and si.active = true
  ),
  7,
  'all seven approved YouTube source identities are active exactly once'
);

select is(
  (
    select count(*)::integer
    from public.youtube_channel_state ycs
    join public.source_identities si on si.id = ycs.source_identity_id
    where si.platform_identity_id = any(array[
      'UCBnxEdpoZwstJqC1yZpOjRA',
      'UCGjn3ZbkkNcQaj00qwJ0DYQ',
      'UCeM3IXubMXTH3LdsMQ3VAhw',
      'UChRi1dpwnsZcIo1LSwzY0Iw',
      'UCLtCejNl8eAg4PO_9lf2TIg',
      'UCp8WoMOdQrSSPAJmQTGbNTw',
      'UC_A7K2dXFsTMAciGmnNxy-Q'
    ]::text[])
      and ycs.uploads_playlist_id = 'UU' || substring(si.platform_identity_id from 3)
  ),
  7,
  'all seven approved YouTube sources have canonical uploads-playlist fallback state'
);

select is(
  (
    select count(*)::integer
    from public.sources s
    join public.source_identities si on si.source_id = s.id
    where si.platform = 'YOUTUBE'
      and si.platform_identity_id = any(array[
        'UCBnxEdpoZwstJqC1yZpOjRA',
        'UCGjn3ZbkkNcQaj00qwJ0DYQ',
        'UCeM3IXubMXTH3LdsMQ3VAhw',
        'UChRi1dpwnsZcIo1LSwzY0Iw',
        'UCLtCejNl8eAg4PO_9lf2TIg',
        'UCp8WoMOdQrSSPAJmQTGbNTw',
        'UC_A7K2dXFsTMAciGmnNxy-Q'
      ]::text[])
      and s.authority_tier = 1
      and s.active = true
  ),
  7,
  'approved source parents remain active Tier-1 sources'
);

select is(
  (
    select count(*)::integer
    from public.sources s
    where lower(s.display_name) = lower('ManoramaMAX')
      and s.source_role = 'OTT_PLATFORM'
      and s.authority_tier = 1
      and s.active = true
  ),
  1,
  'ManoramaMAX is registered once as an active Tier-1 OTT provider'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    join public.sources s on s.id = si.source_id
    where lower(s.display_name) = lower('ManoramaMAX')
      and si.platform = 'WEB'
      and si.platform_identity_id = 'manoramamax.com'
      and si.connector_type = 'FIRST_PARTY_HTML'
      and si.access_mode = 'PUBLIC_WEB'
      and si.poll_class = 'MANUAL'
      and si.active = false
  ),
  1,
  'ManoramaMAX official root is attached but deliberately inactive'
);

select is(
  (
    select count(*)::integer
    from public.page_source_state pss
    join public.source_identities si on si.id = pss.source_identity_id
    where si.platform_identity_id = 'manoramamax.com'
  ),
  0,
  'ManoramaMAX has no page runtime until an explicit parser profile is verified'
);

select is(
  (
    select count(*)::integer
    from public.source_identities si
    where si.platform = 'X'
      and si.active = true
  ),
  0,
  'v0.2.3 source expansion does not reactivate the dormant X connector'
);

select * from finish();
rollback;
