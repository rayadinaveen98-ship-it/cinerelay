begin;

do $$
declare
  r record;
  v_source uuid;
  v_identity uuid;
begin
  -- Wave 2 Batch 3 is identity-only. Every target brand must already exist in
  -- CineRelay at its reviewed authority tier; this migration never creates or
  -- promotes a source brand.
  for r in
    select * from (values
      ('ManoramaMAX','UCz1ht-a2eKE_s1vMh3OHtIg','@ManoramaMAX','ml','OTT_MAIN'),
      ('Sony LIV','UC-ybzIsgchcx7PHqOSxn5OQ','@SonyLIVTelugu','te','OTT_REGIONAL'),
      ('Sony LIV','UCQmxcMxjYcBM5Pel4qUW2hA','@sonylivtamil','ta','OTT_REGIONAL'),
      ('Sony LIV','UCHu48NlukyWGqjh3DUKcBmA','@SonyLIVMalayalam','ml','OTT_REGIONAL'),
      ('Sun NXT','UCo3J37dmHuiL7L0klvO1KKA','@TeluguSunNXT','te','OTT_REGIONAL'),
      ('Sun NXT','UC26UNezdPZfGkRnxX3fVWGA','@sunnxtmalayalam','ml','OTT_REGIONAL'),
      ('Sun NXT','UCCnC56Bsc1z_R55KdNFq5MA','@SunNXTKannada','kn','OTT_REGIONAL'),
      ('Bollywood Hungama','UColde1DYHBhFE1wTIZECmvA',null::text,'hi','TRADE_MEDIA_VIDEO')
    ) as v(source_name, channel_id, handle, language_code, lane)
  loop
    select s.id
      into v_source
    from public.sources s
    where lower(s.display_name) = lower(r.source_name)
      and s.active = true
    order by s.created_at
    limit 1;

    if v_source is null then
      raise exception 'wave2_batch3_parent_source_missing:%', r.source_name;
    end if;

    select source_identity_id
      into v_identity
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
        'schemaVersion', 1,
        'expansionWave', 'wave2-batch3',
        'language', r.language_code,
        'lane', r.lane,
        'canonicalChannelIdVerified', true,
        'webSubRole', 'ACCELERATOR',
        'fallbackAuthoritative', true
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
