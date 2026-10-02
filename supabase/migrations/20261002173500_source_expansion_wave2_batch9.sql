begin;

do $$
declare
  v_source uuid;
  v_identity uuid;
  r record;
begin
  -- STAGE is a first-party dialect OTT platform. Its official app listing
  -- exposes this canonical YouTube channel, which publishes STAGE Originals.
  select s.id into v_source
  from public.sources s
  where lower(s.display_name) = lower('STAGE')
  order by s.active desc, s.created_at
  limit 1;

  if v_source is null then
    insert into public.sources (
      display_name, authority_tier, source_role, territory, languages, active, notes
    ) values (
      'STAGE', 1, 'OTT_PLATFORM', 'IN', array['hi']::text[], true,
      'Source Expansion Wave 2 Batch 9: first-party Haryanvi/Rajasthani OTT platform and original-content publisher.'
    ) returning id into v_source;
  elsif not exists (
    select 1 from public.sources s
    where s.id=v_source and s.active=true and s.authority_tier=1 and s.source_role='OTT_PLATFORM'
  ) then
    raise exception 'wave2_batch9_parent_source_requires_review:STAGE';
  end if;

  select source_identity_id into v_identity
  from public.attach_source_identity(
    v_source,
    'YOUTUBE',
    'UCxSyYieZnqPksxkYxoPMX_g',
    '@haryanvistageapp',
    'https://www.youtube.com/channel/UCxSyYieZnqPksxkYxoPMX_g',
    'YOUTUBE_WEBSUB',
    'PUSH',
    'WEBHOOK',
    jsonb_build_object(
      'schemaVersion',1,
      'expansionWave','wave2-batch9',
      'lane','HARYANVI_RAJASTHANI_OTT',
      'canonicalChannelIdVerified',true,
      'ownershipVerified',true,
      'webSubRole','ACCELERATOR',
      'fallbackAuthoritative',true
    ),
    true
  );
  perform public.seed_source_identity_runtime(v_identity, 'UU' || substring('UCxSyYieZnqPksxkYxoPMX_g' from 3));

  -- Shemaroo is a rights-owning first-party media library with multiple
  -- official language/movie channels. Keep the parent role MEDIA_LIBRARY so
  -- catalogue uploads are not misrepresented as OTT release confirmation.
  select s.id into v_source
  from public.sources s
  where lower(s.display_name) = lower('Shemaroo Entertainment')
  order by s.active desc, s.created_at
  limit 1;

  if v_source is null then
    insert into public.sources (
      display_name, authority_tier, source_role, territory, languages, active, notes
    ) values (
      'Shemaroo Entertainment', 1, 'MEDIA_LIBRARY', 'IN', array['hi','te','gu']::text[], true,
      'Source Expansion Wave 2 Batch 9: first-party rights-owning cinema/media publisher; catalogue evidence, not OTT release authority.'
    ) returning id into v_source;
  elsif not exists (
    select 1 from public.sources s
    where s.id=v_source and s.active=true and s.authority_tier=1 and s.source_role='MEDIA_LIBRARY'
  ) then
    raise exception 'wave2_batch9_parent_source_requires_review:Shemaroo Entertainment';
  end if;

  for r in
    select * from (values
      ('Shemaroo Movies','UCBOmfqgTZi7yDp4-3Lr_3lA','@shemaroomovies','HINDI_MOVIES'),
      ('Shemaroo Megaplex','UCrbgiUM0ikz4L6zVjzVbyWg','@shemaroomegaplex','MULTI_GENRE_LIBRARY'),
      ('Shemaroo Telugu','UCUKw8_dn_bmxdfdFlv0Xnhw','@shemarootelugu','TELUGU_MOVIES'),
      ('Shemaroo Gujarati','UCRjdhRziOme0OSmUwbnwebg','@shemaroogujarati','GUJARATI_MOVIES'),
      ('Shemaroo Gujarati Natak','UCYGHffkD5HMPf4zx-R5ncBg',null::text,'GUJARATI_NATAK'),
      ('Shemaroo Gujarati Sangeet','UCQb2IrvJ-n-0dEvVSNRWdxQ','@shemaroogujaratimusic1004','GUJARATI_MUSIC')
    ) as v(identity_name, channel_id, handle, lane)
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
        'expansionWave','wave2-batch9',
        'identityName',r.identity_name,
        'lane',r.lane,
        'canonicalChannelIdVerified',true,
        'ownershipVerified',true,
        'webSubRole','ACCELERATOR',
        'fallbackAuthoritative',true,
        'evidenceRole','RIGHTS_OWNER_LIBRARY'
      ),
      true
    );
    perform public.seed_source_identity_runtime(v_identity, 'UU' || substring(r.channel_id from 3));
  end loop;
end
$$;

commit;
