begin;

do $$
declare
  r record;
  v_source uuid;
  v_identity uuid;
begin
  -- Cinema-focused media video lanes. These are reporting/interview/media
  -- publishers, not first-party rights owners, so they remain Tier 3/4.
  for r in
    select * from (values
      ('Telugu Filmnagar','UCintIUOJEktQBfhEI9XXpuw','@telugufilmnagar',3::smallint,'TRADE_MEDIA',array['te','en']::text[],'CINEMA_MEDIA'),
      ('Behindwoods TV','UC8md0UEGj7UbjcZtMjBVrgQ','@behindwoodstv',4::smallint,'GENERAL_MEDIA',array['ta','en']::text[],'MIXED_MEDIA'),
      ('Galatta Plus','UCTTUsQJAdGSd2mMsGGfvzhQ','@galattaplus',3::smallint,'TRADE_MEDIA',array['ta','en']::text[],'CINEMA_MEDIA'),
      ('Cinema Vikatan','UCjF5ecCYXFDvR0UY9GcfnoA','@cinemavikatan',3::smallint,'TRADE_MEDIA',array['ta']::text[],'CINEMA_MEDIA'),
      ('Moviebuff Tamil','UCmAyYoNuOheCdlHnsBsRu3w','@moviebufftamil',3::smallint,'MEDIA_LIBRARY',array['ta']::text[],'LICENSED_MEDIA_LIBRARY')
    ) as v(source_name, channel_id, handle, authority_tier, source_role, languages, lane)
  loop
    select s.id into v_source
    from public.sources s
    where lower(s.display_name)=lower(r.source_name)
    order by s.active desc,s.created_at
    limit 1;

    if v_source is null then
      insert into public.sources(display_name,authority_tier,source_role,territory,languages,active,notes)
      values(
        r.source_name,r.authority_tier,r.source_role,'IN',r.languages,true,
        'Source Expansion Wave 2 Batch 5: independently verified cinema/media publisher; discovery and corroboration only unless separately first-party verified.'
      ) returning id into v_source;
    else
      if not exists (
        select 1 from public.sources s
        where s.id=v_source and s.active=true
          and s.authority_tier=r.authority_tier
          and s.source_role=r.source_role
      ) then
        raise exception 'wave2_batch5_parent_source_requires_review:%', r.source_name;
      end if;
    end if;

    select source_identity_id into v_identity
    from public.attach_source_identity(
      v_source,'YOUTUBE',r.channel_id,r.handle,
      'https://www.youtube.com/channel/'||r.channel_id,
      'YOUTUBE_WEBSUB','PUSH','WEBHOOK',
      jsonb_build_object(
        'schemaVersion',1,
        'expansionWave','wave2-batch5',
        'lane',r.lane,
        'canonicalChannelIdVerified',true,
        'trustPath',case when r.authority_tier=3 then 'TRADE_MEDIA_TIER3' else 'GENERAL_MEDIA_TIER4' end,
        'webSubRole','ACCELERATOR',
        'fallbackAuthoritative',true
      ),
      true
    );
    perform public.seed_source_identity_runtime(v_identity,'UU'||substring(r.channel_id from 3));
  end loop;

  -- General-media RSS sources are Tier 4. They improve discovery and
  -- corroboration but never substitute for first-party confirmation.
  for r in
    select * from (values
      ('NDTV Movies','https://feeds.feedburner.com/ndtvmovies-latest','ACTIVE_15M',array['en','hi']::text[],'MOVIES'),
      ('The Times of India — Entertainment','https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms','ACTIVE_15M',array['en','hi']::text[],'ENTERTAINMENT'),
      ('The Times of India — Entertainment','https://timesofindia.indiatimes.com/rssfeeds/27135454.cms','ACTIVE_15M',array['ta']::text[],'TAMIL'),
      ('The Times of India — Entertainment','https://timesofindia.indiatimes.com/rssfeeds/27135440.cms','ACTIVE_15M',array['te']::text[],'TELUGU'),
      ('The Times of India — Entertainment','https://timesofindia.indiatimes.com/rssfeeds/27135428.cms','ACTIVE_15M',array['ml']::text[],'MALAYALAM'),
      ('The Times of India — Entertainment','https://timesofindia.indiatimes.com/rssfeeds/27135414.cms','ACTIVE_15M',array['kn']::text[],'KANNADA')
    ) as v(source_name, feed_url, poll_class, languages, feed_purpose)
  loop
    select s.id into v_source
    from public.sources s
    where lower(s.display_name)=lower(r.source_name)
    order by s.active desc,s.created_at
    limit 1;

    if v_source is null then
      insert into public.sources(display_name,authority_tier,source_role,territory,languages,active,notes)
      values(
        r.source_name,4,'GENERAL_MEDIA','IN',r.languages,true,
        'Source Expansion Wave 2 Batch 5: official publisher RSS; Tier 4 discovery/corroboration only.'
      ) returning id into v_source;
    else
      if not exists (
        select 1 from public.sources s
        where s.id=v_source and s.active=true
          and s.authority_tier=4
          and s.source_role='GENERAL_MEDIA'
      ) then
        raise exception 'wave2_batch5_parent_source_requires_review:%', r.source_name;
      end if;
    end if;

    select source_identity_id into v_identity
    from public.attach_source_identity(
      v_source,'RSS',null,null,r.feed_url,'RSS_ATOM',r.poll_class,'FEED',
      jsonb_build_object(
        'schemaVersion',1,
        'expansionWave','wave2-batch5',
        'feedPurpose',r.feed_purpose,
        'trustPath','GENERAL_MEDIA_TIER4'
      ),
      true
    );
    perform public.register_feed_source(v_identity,r.feed_url,'feed-parser-v1');
  end loop;
end
$$;

commit;
