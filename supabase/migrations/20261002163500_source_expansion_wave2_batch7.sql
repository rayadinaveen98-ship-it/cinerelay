begin;

do $$
declare
  r record;
  v_source uuid;
  v_identity uuid;
begin
  -- Wave 2 Batch 7 adds independently verified first-party production,
  -- distribution, and OTT publishers. These brands own/commission the content
  -- they publish, so they enter as Tier-1 primary evidence sources.
  for r in
    select * from (values
      ('Junglee Pictures','UCTSewLhQ8JEhgPCT6N_YyJA','@jungleepictures','PRODUCTION_HOUSE',array['hi','en']::text[],'PRODUCTION_MAIN'),
      ('Surinder Films','UC_IXqII-SVm7QNRwreq32dg','@surinderfilms','PRODUCTION_HOUSE',array['bn']::text[],'PRODUCTION_MAIN'),
      ('SVF Entertainment','UC2GXNqco-k7fwg2SMM6SAzQ','@svfsocial','PRODUCTION_HOUSE',array['bn']::text[],'PRODUCTION_MAIN'),
      ('Eskay Movies','UCZxu0dMOx9JpYsWkyDwunAQ','@EskayMoviesOnline','PRODUCTION_HOUSE',array['bn']::text[],'PRODUCTION_MAIN'),
      ('Dev Entertainment Ventures','UCYBAnESPQtjTWSYsVxN9hJA','@devplofficial','PRODUCTION_HOUSE',array['bn']::text[],'PRODUCTION_MAIN'),
      ('Hoichoi','UC70iTGCj0G5vnpqqO46zQHA','@hoichoi','OTT_PLATFORM',array['bn']::text[],'OTT_ORIGINALS'),
      ('Addatimes','UCM1PRBGrQws4TUWH6P_OJUw','@addatimes','OTT_PLATFORM',array['bn']::text[],'OTT_ORIGINALS')
    ) as v(source_name, channel_id, handle, source_role, languages, lane)
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
        r.source_role,
        'IN',
        r.languages,
        true,
        'Source Expansion Wave 2 Batch 7: independently verified first-party rights-owning/commissioning publisher.'
      ) returning id into v_source;
    else
      -- Never silently re-tier or re-role an existing reviewed source.
      if not exists (
        select 1
        from public.sources s
        where s.id = v_source
          and s.active = true
          and s.authority_tier = 1
          and s.source_role = r.source_role
      ) then
        raise exception 'wave2_batch7_parent_source_requires_review:%', r.source_name;
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
        'expansionWave', 'wave2-batch7',
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
