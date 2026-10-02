begin;

do $$
declare
  v_source uuid;
  v_identity uuid;
  r record;
begin
  select s.id into v_source
  from public.sources s
  where lower(s.display_name)=lower('ZEE5')
  order by s.active desc, s.created_at
  limit 1;

  if v_source is null or not exists (
    select 1 from public.sources s
    where s.id=v_source
      and s.active=true
      and s.authority_tier=1
      and s.source_role='OTT_PLATFORM'
  ) then
    raise exception 'wave2_batch13_parent_source_requires_review:ZEE5';
  end if;

  for r in
    select * from (values
      ('UCicXylkn7Ztg5wXJLwKJaUg','@zee5hindi235',array['hi']::text[],'ZEE5_HINDI_OTT'),
      ('UCoCeHuiVL9uIirmbjmrM57w','@zee5tamil348',array['ta']::text[],'ZEE5_TAMIL_OTT'),
      ('UCmqkTdYhSNZDS_R_omUKgdQ',null::text,array['kn']::text[],'ZEE5_KANNADA_OTT'),
      ('UCJwISYlGFwkWXLAjwEH-_Zg',null::text,array['mr']::text[],'ZEE5_MARATHI_OTT')
    ) as v(channel_id, handle, languages, lane)
  loop
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
        'expansionWave','wave2-batch13',
        'lane',r.lane,
        'languages',r.languages,
        'canonicalChannelIdVerified',true,
        'ownershipVerified',true,
        'webSubRole','ACCELERATOR',
        'fallbackAuthoritative',true,
        'evidenceRole','FIRST_PARTY_OTT',
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
