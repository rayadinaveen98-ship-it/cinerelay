begin;

do $$
declare
  v_source uuid;
  v_identity uuid;
  r record;
begin
  -- Strengthen two existing Tier-1 label parents with official regional lanes.
  for r in
    select * from (values
      ('Think Music India','UC9Z3ZrgSyFA75VQ5HpqSbtA','@thinkmusic_kannada',array['kn']::text[],'THINK_MUSIC_KANNADA'),
      ('Aditya Music','UCo_iDY0qQ4d4ad3zRAZtPsg','@AdityaMusicTamil',array['ta']::text[],'ADITYA_MUSIC_TAMIL')
    ) as v(source_name, channel_id, handle, languages, lane)
  loop
    select s.id into v_source
    from public.sources s
    where lower(s.display_name)=lower(r.source_name)
    order by s.active desc, s.created_at
    limit 1;

    if v_source is null or not exists (
      select 1 from public.sources s
      where s.id=v_source and s.active=true and s.authority_tier=1 and s.source_role='MUSIC_LABEL'
    ) then
      raise exception 'wave2_batch15_parent_source_requires_review:%', r.source_name;
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
        'expansionWave','wave2-batch15',
        'lane',r.lane,
        'languages',r.languages,
        'canonicalChannelIdVerified',true,
        'ownershipVerified',true,
        'webSubRole','ACCELERATOR',
        'fallbackAuthoritative',true,
        'evidenceRole','FIRST_PARTY_MUSIC_LABEL',
        'regionalPublisher',true
      ),
      true
    );
    perform public.seed_source_identity_runtime(v_identity, 'UU' || substring(r.channel_id from 3));
  end loop;

  -- New first-party label parents.
  for r in
    select * from (values
      ('Tips Music','UCJrDMFOdv1I2k8n9oK_V21w','@tipsofficial',array['hi','en']::text[],'TIPS_MUSIC_MAIN'),
      ('Speed Records','UCOsyDsO5tIt-VZ1iwjdQmew','@speedrecords',array['pa','hi']::text[],'SPEED_RECORDS_MAIN'),
      ('Divo Music','UC5rGGthSt-CQue8V0bj1bWg','@divomusicofficial',array['ta','te','ml','kn','en']::text[],'DIVO_MUSIC_SOUTH')
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
        'Source Expansion Wave 2 Batch 15: verified first-party music / film-music publisher.'
      ) returning id into v_source;
    elsif not exists (
      select 1 from public.sources s
      where s.id=v_source and s.active=true and s.authority_tier=1 and s.source_role='MUSIC_LABEL'
    ) then
      raise exception 'wave2_batch15_parent_source_requires_review:%', r.source_name;
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
        'expansionWave','wave2-batch15',
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
end
$$;

commit;
