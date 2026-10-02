begin;

do $$
declare
  v_source uuid;
  v_identity uuid;
  r record;
begin
  -- First-party regional / Indian OTT publishers with independently resolved
  -- canonical channel IDs. Existing incompatible parents abort for review.
  for r in
    select * from (values
      ('AAO NXT','UCF10UJGXCkKXRGbm2qjMjYw','@aaonxt',array['or']::text[],'ODIA_OTT'),
      ('EPIC ON','UCUOJBde9-K1CKiOzwO8hQIg',null::text,array['hi','en']::text[],'INDIAN_FACTUAL_OTT')
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
        r.source_name, 1, 'OTT_PLATFORM', 'IN', r.languages, true,
        'Source Expansion Wave 2 Batch 10: verified first-party Indian OTT/original-content publisher.'
      ) returning id into v_source;
    elsif not exists (
      select 1 from public.sources s
      where s.id=v_source and s.active=true and s.authority_tier=1 and s.source_role='OTT_PLATFORM'
    ) then
      raise exception 'wave2_batch10_parent_source_requires_review:%', r.source_name;
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
        'expansionWave','wave2-batch10',
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

  -- Ultra Media is a rights-owning library. Its Ultra Marathi channel also
  -- promotes Ultra Jhakaas, but catalogue uploads must not be treated as OTT
  -- release confirmation on their own.
  select s.id into v_source
  from public.sources s
  where lower(s.display_name)=lower('Ultra Media & Entertainment')
  order by s.active desc, s.created_at
  limit 1;

  if v_source is null then
    insert into public.sources (
      display_name, authority_tier, source_role, territory, languages, active, notes
    ) values (
      'Ultra Media & Entertainment', 1, 'MEDIA_LIBRARY', 'IN', array['mr','hi']::text[], true,
      'Source Expansion Wave 2 Batch 10: first-party rights-owning Marathi/Hindi media library; catalogue evidence only.'
    ) returning id into v_source;
  elsif not exists (
    select 1 from public.sources s
    where s.id=v_source and s.active=true and s.authority_tier=1 and s.source_role='MEDIA_LIBRARY'
  ) then
    raise exception 'wave2_batch10_parent_source_requires_review:Ultra Media & Entertainment';
  end if;

  select source_identity_id into v_identity
  from public.attach_source_identity(
    v_source,
    'YOUTUBE',
    'UCXv0AGtxxRzxJ7lP1M2l4jA',
    '@ultramarathi',
    'https://www.youtube.com/channel/UCXv0AGtxxRzxJ7lP1M2l4jA',
    'YOUTUBE_WEBSUB',
    'PUSH',
    'WEBHOOK',
    jsonb_build_object(
      'schemaVersion',1,
      'expansionWave','wave2-batch10',
      'lane','MARATHI_LIBRARY_OTT_PROMO',
      'canonicalChannelIdVerified',true,
      'ownershipVerified',true,
      'webSubRole','ACCELERATOR',
      'fallbackAuthoritative',true,
      'evidenceRole','RIGHTS_OWNER_LIBRARY'
    ),
    true
  );
  perform public.seed_source_identity_runtime(v_identity, 'UU' || substring('UCXv0AGtxxRzxJ7lP1M2l4jA' from 3));

  -- Attach Disney India to the already-reviewed Walt Disney parent rather
  -- than creating a duplicate regional source brand.
  select s.id into v_source
  from public.sources s
  where lower(s.display_name)=lower('The Walt Disney Company')
    and s.active=true
    and s.authority_tier=1
    and s.source_role='PRODUCTION_HOUSE'
  order by s.created_at
  limit 1;

  if v_source is null then
    raise exception 'wave2_batch10_reviewed_disney_parent_missing';
  end if;

  select source_identity_id into v_identity
  from public.attach_source_identity(
    v_source,
    'YOUTUBE',
    'UCcpyP5B4qeKplEHv6wYnJcw',
    null,
    'https://www.youtube.com/channel/UCcpyP5B4qeKplEHv6wYnJcw',
    'YOUTUBE_WEBSUB',
    'PUSH',
    'WEBHOOK',
    jsonb_build_object(
      'schemaVersion',1,
      'expansionWave','wave2-batch10',
      'lane','DISNEY_INDIA_FIRST_PARTY',
      'canonicalChannelIdVerified',true,
      'ownershipVerified',true,
      'webSubRole','ACCELERATOR',
      'fallbackAuthoritative',true,
      'evidenceRole','FIRST_PARTY_STUDIO'
    ),
    true
  );
  perform public.seed_source_identity_runtime(v_identity, 'UU' || substring('UCcpyP5B4qeKplEHv6wYnJcw' from 3));
end
$$;

commit;
