begin;

do $$
declare
  v_source uuid;
  v_identity uuid;
  r record;
begin
  -- Existing reviewed ZEE5 OTT parents. Batch 11 only strengthens them with
  -- independently resolved canonical YouTube identities; it does not create
  -- parallel OTT brands when an incompatible parent already exists.
  for r in
    select * from (values
      ('ZEE5','UCXOgAl4w-FQero1ERbGHpXQ','@zee5',array['hi','te','ta','ml','kn','mr','bn','en']::text[],'ZEE5_NATIONAL_OTT'),
      ('ZEE5 Telugu','UCVjaSUMfHkPcmJr5SKLVDTg',null::text,array['te','en']::text[],'ZEE5_TELUGU_OTT')
    ) as v(source_name, channel_id, handle, languages, lane)
  loop
    select s.id into v_source
    from public.sources s
    where lower(s.display_name)=lower(r.source_name)
    order by s.active desc, s.created_at
    limit 1;

    if v_source is null or not exists (
      select 1 from public.sources s
      where s.id=v_source and s.active=true and s.authority_tier=1 and s.source_role='OTT_PLATFORM'
    ) then
      raise exception 'wave2_batch11_parent_source_requires_review:%', r.source_name;
    end if;

    select source_identity_id into v_identity
    from public.attach_source_identity(
      v_source,
      'YOUTUBE',
      r.channel_id,
      r.handle,
      'https://www.youtube.com/channel/' || r.channel_id,
      'YOUTUBE_WEBSUB',
      'PUSH',
      'WEBHOOK',
      jsonb_build_object(
        'schemaVersion',1,
        'expansionWave','wave2-batch11',
        'lane',r.lane,
        'canonicalChannelIdVerified',true,
        'ownershipVerified',true,
        'webSubRole','ACCELERATOR',
        'fallbackAuthoritative',true,
        'evidenceRole','FIRST_PARTY_OTT'
      ),
      true
    );
    perform public.seed_source_identity_runtime(v_identity, 'UU' || substring(r.channel_id from 3));
  end loop;

  -- New first-party music-label parents. Existing same-name sources must
  -- already have the reviewed Tier-1 music-label shape or migration aborts.
  for r in
    select * from (values
      ('T-Series','UCq-Fj5jknLsUf-MWSy4_brA','@tseries',array['hi','en']::text[],'T_SERIES_MAIN'),
      ('Zee Music Company','UCFFbwnve3yF62-tVXkTyHqg','@zeemusiccompany',array['hi','en']::text[],'ZEE_MUSIC_COMPANY_MAIN')
    ) as v(source_name, channel_id, handle, languages, lane)
  loop
    select s.id into v_source
    from public.sources s
    where lower(s.display_name)=lower(r.source_name)
    order by s.active desc, s.created_at
    limit 1;

    if v_source is null then
      insert into public.sources (
        display_name, authority_tier, source_role, territory, languages, active, notes
      ) values (
        r.source_name, 1, 'MUSIC_LABEL', 'IN', r.languages, true,
        'Source Expansion Wave 2 Batch 11: verified first-party Indian music label / film-music publisher.'
      ) returning id into v_source;
    elsif not exists (
      select 1 from public.sources s
      where s.id=v_source and s.active=true and s.authority_tier=1 and s.source_role='MUSIC_LABEL'
    ) then
      raise exception 'wave2_batch11_parent_source_requires_review:%', r.source_name;
    end if;

    select source_identity_id into v_identity
    from public.attach_source_identity(
      v_source,
      'YOUTUBE',
      r.channel_id,
      r.handle,
      'https://www.youtube.com/channel/' || r.channel_id,
      'YOUTUBE_WEBSUB',
      'PUSH',
      'WEBHOOK',
      jsonb_build_object(
        'schemaVersion',1,
        'expansionWave','wave2-batch11',
        'lane',r.lane,
        'canonicalChannelIdVerified',true,
        'ownershipVerified',true,
        'webSubRole','ACCELERATOR',
        'fallbackAuthoritative',true,
        'evidenceRole','FIRST_PARTY_MUSIC_LABEL'
      ),
      true
    );
    perform public.seed_source_identity_runtime(v_identity, 'UU' || substring(r.channel_id from 3));
  end loop;

  -- Applause Entertainment is a first-party content/IP studio producing and
  -- commissioning series, films and documentaries across major Indian OTTs.
  select s.id into v_source
  from public.sources s
  where lower(s.display_name)=lower('Applause Entertainment')
  order by s.active desc, s.created_at
  limit 1;

  if v_source is null then
    insert into public.sources (
      display_name, authority_tier, source_role, territory, languages, active, notes
    ) values (
      'Applause Entertainment', 1, 'PRODUCTION_HOUSE', 'IN', array['hi','en']::text[], true,
      'Source Expansion Wave 2 Batch 11: verified first-party content/IP creation studio.'
    ) returning id into v_source;
  elsif not exists (
    select 1 from public.sources s
    where s.id=v_source and s.active=true and s.authority_tier=1 and s.source_role='PRODUCTION_HOUSE'
  ) then
    raise exception 'wave2_batch11_parent_source_requires_review:Applause Entertainment';
  end if;

  select source_identity_id into v_identity
  from public.attach_source_identity(
    v_source,
    'YOUTUBE',
    'UCcO8c5xCPYHQtst3X56ufsQ',
    null,
    'https://www.youtube.com/channel/UCcO8c5xCPYHQtst3X56ufsQ',
    'YOUTUBE_WEBSUB',
    'PUSH',
    'WEBHOOK',
    jsonb_build_object(
      'schemaVersion',1,
      'expansionWave','wave2-batch11',
      'lane','APPLAUSE_STUDIO',
      'canonicalChannelIdVerified',true,
      'ownershipVerified',true,
      'webSubRole','ACCELERATOR',
      'fallbackAuthoritative',true,
      'evidenceRole','FIRST_PARTY_STUDIO'
    ),
    true
  );
  perform public.seed_source_identity_runtime(v_identity, 'UU' || substring('UCcO8c5xCPYHQtst3X56ufsQ' from 3));
end
$$;

commit;
