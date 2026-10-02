begin;

do $$
declare
  v_source uuid;
  v_identity uuid;
  r record;
begin
  for r in
    select * from (values
      ('T-Series Tamil','UCAEv0ANkT221wXsTnxFnBsQ','@tseriestamil',array['ta']::text[],'T_SERIES_TAMIL'),
      ('T-Series Kannada','UCovxnbWKPCA5iJDxa9zbBew','@tserieskannadamusic',array['kn']::text[],'T_SERIES_KANNADA'),
      ('T-Series Malayalam','UCUoj77TIUy9DhLNe5EVmF-A','@tseriesmalayalammusic',array['ml']::text[],'T_SERIES_MALAYALAM'),
      ('T-Series Gujarati','UCev6abkwjdHj_dB3rquFfbQ','@tseriesgujarati',array['gu']::text[],'T_SERIES_GUJARATI'),
      ('T-Series Marathi','UCCo_LMj-m3iGSSuytYq9n6Q','@tseriesmarathi',array['mr']::text[],'T_SERIES_MARATHI')
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
        r.source_name,
        1,
        'MUSIC_LABEL',
        'IN',
        r.languages,
        true,
        'Source Expansion Wave 2 Batch 12: official T-Series regional film-music publisher.'
      ) returning id into v_source;
    elsif not exists (
      select 1
      from public.sources s
      where s.id=v_source
        and s.active=true
        and s.authority_tier=1
        and s.source_role='MUSIC_LABEL'
    ) then
      raise exception 'wave2_batch12_parent_source_requires_review:%', r.source_name;
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
        'expansionWave','wave2-batch12',
        'lane',r.lane,
        'canonicalChannelIdVerified',true,
        'ownershipVerified',true,
        'webSubRole','ACCELERATOR',
        'fallbackAuthoritative',true,
        'evidenceRole','FIRST_PARTY_MUSIC_LABEL',
        'regionalPublisher',true
      ),
      true
    );

    perform public.seed_source_identity_runtime(
      v_identity,
      'UU' || substring(r.channel_id from 3)
    );
  end loop;
end
$$;

commit;
