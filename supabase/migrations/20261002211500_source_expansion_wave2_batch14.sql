begin;

do $$
declare
  v_source uuid;
  v_identity uuid;
  r record;
begin
  -- First-party music labels with independently resolved canonical YouTube IDs.
  for r in
    select * from (values
      ('Sony Music India','UC56gTxNs4f9xZ7Pa2i5xNzg','@SonyMusicIndia',array['hi','en']::text[],'SONY_MUSIC_INDIA_MAIN'),
      ('Sony Music Malayalam','UCpJmCkjsJbqIBdvTRx2zt-w','@sonymusicmalayalamofficial',array['ml']::text[],'SONY_MUSIC_MALAYALAM'),
      ('Times Music','UCo07fumrTn1w4AxcU4j_uDw','@timesmusicindia',array['hi','en']::text[],'TIMES_MUSIC_MAIN'),
      ('DM - Desi Melodies','UC783dnzJqf2ghHp_pFLYbGA','@desimelodies',array['pa','hi']::text[],'DESI_MELODIES_MAIN')
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
        'Source Expansion Wave 2 Batch 14: verified first-party Indian music / film-music publisher.'
      ) returning id into v_source;
    elsif not exists (
      select 1 from public.sources s
      where s.id=v_source and s.active=true and s.authority_tier=1 and s.source_role='MUSIC_LABEL'
    ) then
      raise exception 'wave2_batch14_parent_source_requires_review:%', r.source_name;
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
        'expansionWave','wave2-batch14',
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

  -- Jio Studios is a first-party film/content studio and distributor.
  select s.id into v_source
  from public.sources s
  where lower(s.display_name)=lower('Jio Studios')
  order by s.active desc, s.created_at
  limit 1;

  if v_source is null then
    insert into public.sources (
      display_name, authority_tier, source_role, territory, languages, active, notes
    ) values (
      'Jio Studios', 1, 'PRODUCTION_HOUSE', 'IN', array['hi','ta','te','mr','en']::text[], true,
      'Source Expansion Wave 2 Batch 14: verified first-party film/content studio and distributor.'
    ) returning id into v_source;
  elsif not exists (
    select 1 from public.sources s
    where s.id=v_source and s.active=true and s.authority_tier=1 and s.source_role='PRODUCTION_HOUSE'
  ) then
    raise exception 'wave2_batch14_parent_source_requires_review:Jio Studios';
  end if;

  select source_identity_id into v_identity
  from public.attach_source_identity(
    v_source,
    'YOUTUBE',
    'UCcXQd6kHKm0b41x8zMVMmMg',
    '@jiostudios',
    'https://www.youtube.com/channel/UCcXQd6kHKm0b41x8zMVMmMg',
    'YOUTUBE_WEBSUB',
    'PUSH',
    'WEBHOOK',
    jsonb_build_object(
      'schemaVersion',1,
      'expansionWave','wave2-batch14',
      'lane','JIO_STUDIOS_FIRST_PARTY',
      'canonicalChannelIdVerified',true,
      'ownershipVerified',true,
      'webSubRole','ACCELERATOR',
      'fallbackAuthoritative',true,
      'evidenceRole','FIRST_PARTY_STUDIO'
    ),
    true
  );

  perform public.seed_source_identity_runtime(v_identity, 'UU' || substring('UCcXQd6kHKm0b41x8zMVMmMg' from 3));
end
$$;

commit;
