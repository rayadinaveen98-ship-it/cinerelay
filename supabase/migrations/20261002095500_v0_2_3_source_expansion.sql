begin;

do $$
declare
  r record;
  v_source uuid;
  v_identity uuid;
begin
  -- Explicitly approved official/high-confidence YouTube source gap-fill.
  -- register_youtube_source is idempotent on canonical UC channel ID and seeds
  -- the existing WebSub + fallback runtime without changing the X connector.
  for r in
    select * from (values
      ('Sun TV','UCBnxEdpoZwstJqC1yZpOjRA','@suntv','MEDIA_LIBRARY'),
      ('Ayngaran','UCGjn3ZbkkNcQaj00qwJ0DYQ','@ayngaraninternational','MEDIA_LIBRARY'),
      ('Saina Movies','UCeM3IXubMXTH3LdsMQ3VAhw','@sainamoviesofficial','MEDIA_LIBRARY'),
      ('Muzik247','UChRi1dpwnsZcIo1LSwzY0Iw','@muzik247','MUSIC_LABEL'),
      ('Anand Audio','UCLtCejNl8eAg4PO_9lf2TIg','@anandaudio','MUSIC_LABEL'),
      ('DBeatsMusicWorld','UCp8WoMOdQrSSPAJmQTGbNTw',null::text,'MUSIC_LABEL'),
      ('Saregama Music','UC_A7K2dXFsTMAciGmnNxy-Q','@saregamamusic','MUSIC_LABEL')
    ) as v(display_name, channel_id, handle, source_role)
  loop
    perform * from public.register_youtube_source(
      r.channel_id,
      r.display_name,
      r.handle,
      'UU' || substring(r.channel_id from 3),
      1::smallint,
      r.source_role
    );
  end loop;

  -- The other approved OTT providers already have Tier-1 registry coverage.
  -- ManoramaMAX is the remaining gap. Register its official first-party root
  -- as an inactive identity: no parser profile means no connector traffic yet.
  select s.id
    into v_source
  from public.sources s
  where lower(s.display_name) = lower('ManoramaMAX')
  order by s.active desc, s.created_at
  limit 1;

  if v_source is null then
    insert into public.sources (
      display_name,
      authority_tier,
      source_role,
      territory,
      languages,
      active,
      notes
    ) values (
      'ManoramaMAX',
      1,
      'OTT_PLATFORM',
      'IN',
      array['ml']::text[],
      true,
      'v0.2.3 approved first-party OTT provider; root identity remains inactive until a parser profile is verified'
    )
    returning id into v_source;
  else
    update public.sources
       set authority_tier = 1,
           source_role = 'OTT_PLATFORM',
           active = true,
           updated_at = now()
     where id = v_source;
  end if;

  select source_identity_id
    into v_identity
  from public.attach_source_identity(
    v_source,
    'WEB',
    'manoramamax.com',
    null,
    'https://www.manoramamax.com/',
    'FIRST_PARTY_HTML',
    'MANUAL',
    'PUBLIC_WEB',
    jsonb_build_object(
      'schemaVersion', 1,
      'onboardingWave', 'v0.2.3',
      'authorityVerified', true,
      'activationBlocked', 'parser_profile_required'
    ),
    false
  );
end
$$;

commit;
