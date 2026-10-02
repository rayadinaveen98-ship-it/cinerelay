begin;

do $$
declare
  v_source uuid;
  v_identity uuid;
  r record;
begin
  for r in
    select * from (values
      ('T-Series Apna Punjab','UCcvNYxWXR_5TjVK7cSCdW-g','@apnapunjab',array['pa']::text[],'T_SERIES_APNA_PUNJAB'),
      ('T-Series Bangla','UCPH9W_9ZDQ1gemcCaIxOvCw','@officialtseriesbangla',array['bn']::text[],'T_SERIES_BANGLA'),
      ('T-Series Haryanvi','UC3Zva7aW8lJUFZQYnC-XyHg','@tseriesharyanvi',array['hi']::text[],'T_SERIES_HARYANVI'),
      ('T-Series Rajasthani','UCkPipkv-8UZ2saO2TjE8AWA','@t-seriesrajasthani5759',array['raj','hi']::text[],'T_SERIES_RAJASTHANI'),
      ('T-Series Regional','UCy2fvV-mH_4AcIgqnLg9uDw','@tseriesregional',array['hi','mr','gu','bn','raj']::text[],'T_SERIES_REGIONAL')
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
        'Source Expansion Wave 2 Batch 17: official T-Series regional music / film-music publisher.'
      ) returning id into v_source;
    elsif not exists (
      select 1 from public.sources s
      where s.id=v_source
        and s.active=true
        and s.authority_tier=1
        and s.source_role='MUSIC_LABEL'
    ) then
      raise exception 'wave2_batch17_parent_source_requires_review:%', r.source_name;
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
        'expansionWave','wave2-batch17',
        'lane',r.lane,
        'canonicalChannelIdVerified',true,
        'ownershipVerified',true,
        'webSubRole','ACCELERATOR',
        'fallbackAuthoritative',true,
        'evidenceRole','FIRST_PARTY_MUSIC_LABEL',
        'regionalPublisher',true,
        'tSeriesOfficialDirectoryListed',true
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
