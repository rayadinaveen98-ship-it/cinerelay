begin;

do $$
declare
  r record;
  v_source uuid;
  v_identity uuid;
begin
  -- Wave 2 Batch 4 adds current first-party production/distribution brands
  -- whose official YouTube channels publish owned/original film content.
  -- New parents are Tier 1 because these are the rights-owning publishers,
  -- not trade-media or aggregators.
  for r in
    select * from (values
      ('Gopuram Films','UCowkzSd9XuqmT8cDj4Ilyzw','@GopuramFilms',array['ta']::text[],'PRODUCTION_MAIN'),
      ('Neelam Productions','UCfySW6uJdx9zM8ApGbt0JFw','@neelamproductionsoffl',array['ta']::text[],'PRODUCTION_MAIN'),
      ('YNOT Studios','UCqVDSxEb7MNfYvddpbri4TA','@ynotstudios',array['ta','en']::text[],'PRODUCTION_MAIN'),
      ('V Creations','UClqoU3DHuKFsYCCLXUNUE1g','@KalaippuliSThanuOfficial',array['ta']::text[],'PRODUCTION_MAIN'),
      ('Wayfarer Films','UCqhz8slFDrgzO5qiSLChWMQ',null::text,array['ml']::text[],'PRODUCTION_MAIN'),
      ('VELS Film International','UCMsAo0XUISOL6O1ek_3QWfg',null::text,array['ta']::text[],'PRODUCTION_MUSIC'),
      ('VELS Film International','UCPR9Pu-BhBVhnQy7eYsvo-A','@velssignature',array['ta']::text[],'PRODUCTION_SIGNATURE')
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
        'PRODUCTION_HOUSE',
        'IN',
        r.languages,
        true,
        'Source Expansion Wave 2 Batch 4: independently verified first-party production/distribution publisher.'
      ) returning id into v_source;
    else
      -- Do not silently change an existing reviewed source's authority or role.
      if not exists (
        select 1
        from public.sources s
        where s.id = v_source
          and s.active = true
          and s.authority_tier = 1
          and s.source_role = 'PRODUCTION_HOUSE'
      ) then
        raise exception 'wave2_batch4_parent_source_requires_review:%', r.source_name;
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
        'expansionWave', 'wave2-batch4',
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
