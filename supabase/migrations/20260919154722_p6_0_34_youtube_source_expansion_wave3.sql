do $$
declare
  v_source uuid;
  v_identity uuid;
begin
  -- Existing first-party source organizations: attach YouTube without duplicating the source.
  select id into v_source from public.sources where lower(display_name)=lower('Netflix India') and active order by created_at limit 1;
  if v_source is null then raise exception 'p6_0_34_missing_source:Netflix India'; end if;
  select source_identity_id into v_identity from public.attach_source_identity(v_source,'YOUTUBE','UCZSNzBgFub_WWil6TOTYwAg','@NetflixIndiaOfficial','https://www.youtube.com/channel/UCZSNzBgFub_WWil6TOTYwAg','YOUTUBE_WEBSUB','PUSH','WEBHOOK','{"schemaVersion":1,"onboardingWave":"P6.0.34","authorityVerified":true}'::jsonb,true);
  perform public.seed_source_identity_runtime(v_identity,'UUZSNzBgFub_WWil6TOTYwAg');

  select id into v_source from public.sources where lower(display_name)=lower('Prime Video India') and active order by created_at limit 1;
  if v_source is null then raise exception 'p6_0_34_missing_source:Prime Video India'; end if;
  select source_identity_id into v_identity from public.attach_source_identity(v_source,'YOUTUBE','UC4zWG9LccdWGUlF77LZ8toA','@PrimeVideoIN','https://www.youtube.com/channel/UC4zWG9LccdWGUlF77LZ8toA','YOUTUBE_WEBSUB','PUSH','WEBHOOK','{"schemaVersion":1,"onboardingWave":"P6.0.34","authorityVerified":true}'::jsonb,true);
  perform public.seed_source_identity_runtime(v_identity,'UU4zWG9LccdWGUlF77LZ8toA');

  select id into v_source from public.sources where lower(display_name)=lower('Sony LIV') and active order by created_at limit 1;
  if v_source is null then raise exception 'p6_0_34_missing_source:Sony LIV'; end if;
  select source_identity_id into v_identity from public.attach_source_identity(v_source,'YOUTUBE','UCOQNJjhXwvAScuELTT_i7cQ','@SonyLIV','https://www.youtube.com/channel/UCOQNJjhXwvAScuELTT_i7cQ','YOUTUBE_WEBSUB','PUSH','WEBHOOK','{"schemaVersion":1,"onboardingWave":"P6.0.34","authorityVerified":true}'::jsonb,true);
  perform public.seed_source_identity_runtime(v_identity,'UUOQNJjhXwvAScuELTT_i7cQ');

  select id into v_source from public.sources where lower(display_name)=lower('Sun NXT') and active order by created_at limit 1;
  if v_source is null then raise exception 'p6_0_34_missing_source:Sun NXT'; end if;
  select source_identity_id into v_identity from public.attach_source_identity(v_source,'YOUTUBE','UCials1wQnEN_NykYZr1048w','@SunNXT','https://www.youtube.com/channel/UCials1wQnEN_NykYZr1048w','YOUTUBE_WEBSUB','PUSH','WEBHOOK','{"schemaVersion":1,"onboardingWave":"P6.0.34","authorityVerified":true}'::jsonb,true);
  perform public.seed_source_identity_runtime(v_identity,'UUials1wQnEN_NykYZr1048w');

  -- Brand-new first-party source organizations.
  perform public.register_youtube_source('UCLbdVvreihwZRL6kwuEUYsA','Think Music India','@thinkmusicofficial','UULbdVvreihwZRL6kwuEUYsA',1::smallint,'MUSIC_LABEL','{}'::uuid[]);
  perform public.register_youtube_source('UCnJjcn5FrgrOEp5_N45ZLEQ','T-Series Telugu','@TseriesTelugu','UUnJjcn5FrgrOEp5_N45ZLEQ',1::smallint,'MUSIC_LABEL','{}'::uuid[]);
  perform public.register_youtube_source('UCarJoVXH0T2pdtcHBu9J8Bw','Hombale Films','@hombalefilms','UUarJoVXH0T2pdtcHBu9J8Bw',1::smallint,'PRODUCTION_HOUSE','{}'::uuid[]);
  perform public.register_youtube_source('UC2DDhRE75LKKPjAxC-zsGRg','JioHotstar Telugu','@JioHotstarTelugu','UU2DDhRE75LKKPjAxC-zsGRg',1::smallint,'OTT_PLATFORM','{}'::uuid[]);
  perform public.register_youtube_source('UCXRLoewrwy4_10PuoMoUBug','PrimeShow Entertainment','@PrimeShowEntertainment','UUXRLoewrwy4_10PuoMoUBug',1::smallint,'PRODUCTION_HOUSE','{}'::uuid[]);
  perform public.register_youtube_source('UC3DOgauBYLQQXdH1siGjfpw','KVN PRODUCTIONS','@kvnproductionsofficial','UU3DOgauBYLQQXdH1siGjfpw',1::smallint,'PRODUCTION_HOUSE','{}'::uuid[]);
  perform public.register_youtube_source('UC17vzygnkDJ2wLlcU4pE-Qg','Sun Pictures','@SunPicturesOffl','UU17vzygnkDJ2wLlcU4pE-Qg',1::smallint,'PRODUCTION_HOUSE','{}'::uuid[]);
  perform public.register_youtube_source('UCbpjEr8lHlnkf1SQ5tnDEYw','Dream Warrior Pictures','@DreamWarriorPictures','UUbpjEr8lHlnkf1SQ5tnDEYw',1::smallint,'PRODUCTION_HOUSE','{}'::uuid[]);
  perform public.register_youtube_source('UCj6rqKA33Ywu2GTFRDxHhnA','2D Entertainment','@2dentertainmentofficial','UUj6rqKA33Ywu2GTFRDxHhnA',1::smallint,'PRODUCTION_HOUSE','{}'::uuid[]);
end
$$;
