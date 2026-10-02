begin;

do $$
declare
  r record;
  v_source uuid;
  v_identity uuid;
begin
  -- Wave 2 Batch 8 focuses on first-party Indian OTT publishers with
  -- independently verified canonical YouTube channel IDs. These platforms
  -- commission, own, license, or directly distribute the catalogue they
  -- publish, so their official channels are eligible for Tier-1 evidence.
  for r in
    select * from (values
      ('Chaupal','UCH3FAffJyp6RBYLSZsYnKdQ','@ChaupalOTT',array['pa','hi']::text[],'PUNJABI_OTT'),
      ('TarangPlus','UCujyiVE2bbQwzkQX-nGI1yQ','@tarangplus',array['or']::text[],'ODIA_OTT'),
      ('NammaFlix','UCeYxCTD4uwa5zbzw6hSi5sA','@nammaflixofficial',array['kn']::text[],'KANNADA_OTT'),
      ('Lionsgate Play','UCzciyhKgQO2l4RC6fdLrZIg','@lionsgateplayin',array['en','hi','ta']::text[],'PREMIUM_OTT'),
      ('Planet Marathi OTT','UCtBgzRNQFIW8TFifPtgzG9Q','@PlanetMarathiott',array['mr']::text[],'MARATHI_OTT')
    ) as v(source_name, channel_id, handle, languages, lane)
  loop
    select s.id
      into v_source
    from public.sources s
    where lower(s.display_name) = lower(r.source_name)
    order by s.active desc, s.created_at
    limit 1;

    if v_source is null then
      insert into public.sources (
        display_name,
        authority_tier,
        source_role,
        territory,
        languages,
        active,
        notes
      ) values (
        r.source_name,
        1,
        'OTT_PLATFORM',
        'IN',
        r.languages,
        true,
        'Source Expansion Wave 2 Batch 8: independently verified first-party Indian OTT publisher.'
      ) returning id into v_source;
    else
      -- Never silently re-tier or re-role an existing reviewed source.
      if not exists (
        select 1
        from public.sources s
        where s.id = v_source
          and s.active = true
          and s.authority_tier = 1
          and s.source_role = 'OTT_PLATFORM'
      ) then
        raise exception 'wave2_batch8_parent_source_requires_review:%', r.source_name;
      end if;
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
        'expansionWave', 'wave2-batch8',
        'lane', r.lane,
        'canonicalChannelIdVerified', true,
        'ownershipVerified', true,
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
