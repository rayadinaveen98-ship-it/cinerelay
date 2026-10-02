begin;

do $$
declare
  v_source uuid;
  v_identity uuid;
  r record;
begin
  for r in
    select * from (values
      ('Tips Music','UCF8Ar7alYrtOI5SF6b7T0xA','@tipspunjabi',array['pa']::text[],'TIPS_PUNJABI'),
      ('Tips Music','UCTHUx9uIBkpy8Z9OiKzMz0A','@tipsbhojpuri',array['bho','hi']::text[],'TIPS_BHOJPURI'),
      ('Speed Records','UC_wRxe9tOFevlxOfDpRKuMw','@officialspeedharyanvi',array['hi']::text[],'SPEED_HARYANVI'),
      ('Speed Records','UC_oLUu-LxYOn9mDRR9k5x-A','@speedrecordsbhojpuri1',array['bho','hi']::text[],'SPEED_BHOJPURI'),
      ('Times Music','UCoXCrCeyIEU4z6xCAds7utQ','@timesmusicaxom',array['as']::text[],'TIMES_MUSIC_AXOM')
    ) as v(source_name, channel_id, handle, languages, lane)
  loop
    select s.id into v_source
    from public.sources s
    where lower(s.display_name)=lower(r.source_name)
    order by s.active desc, s.created_at
    limit 1;

    if v_source is null or not exists (
      select 1 from public.sources s
      where s.id=v_source
        and s.active=true
        and s.authority_tier=1
        and s.source_role='MUSIC_LABEL'
    ) then
      raise exception 'wave2_batch16_parent_source_requires_review:%', r.source_name;
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
        'expansionWave','wave2-batch16',
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

    perform public.seed_source_identity_runtime(
      v_identity,
      'UU' || substring(r.channel_id from 3)
    );
  end loop;
end
$$;

commit;
