begin;

do $$
declare
  r record;
  v_source uuid;
  v_identity uuid;
begin
  -- Hindustan Times / Live Hindustan are broad publishers, so these feeds are
  -- capped at Tier 4 GENERAL_MEDIA and used for discovery/corroboration only.
  for r in
    select * from (values
      ('Hindustan Times — Entertainment','https://www.hindustantimes.com/feeds/rss/entertainment/rssfeed.xml','ENTERTAINMENT',array['en']::text[]),
      ('Hindustan Times — Entertainment','https://www.hindustantimes.com/feeds/rss/entertainment/telugu-cinema/rssfeed.xml','TELUGU_CINEMA',array['te','en']::text[]),
      ('Hindustan Times — Entertainment','https://www.hindustantimes.com/feeds/rss/entertainment/tamil-cinema/rssfeed.xml','TAMIL_CINEMA',array['ta','en']::text[]),
      ('Hindustan Times — Entertainment','https://www.hindustantimes.com/feeds/rss/entertainment/bollywood/rssfeed.xml','BOLLYWOOD',array['hi','en']::text[]),
      ('Hindustan Times — Entertainment','https://www.hindustantimes.com/feeds/rss/entertainment/hollywood/rssfeed.xml','HOLLYWOOD',array['en']::text[]),
      ('Hindustan Times — Entertainment','https://www.hindustantimes.com/feeds/rss/entertainment/web-series/rssfeed.xml','WEB_SERIES',array['en']::text[]),
      ('Hindustan Times — Entertainment','https://www.hindustantimes.com/feeds/rss/entertainment/music/rssfeed.xml','MUSIC',array['en','hi']::text[]),
      ('Hindustan Times — Entertainment','https://www.hindustantimes.com/feeds/rss/htcity/cinema/rssfeed.xml','CINEMA',array['en','hi']::text[]),
      ('Live Hindustan — Entertainment','https://api.livehindustan.com/feeds/rss/entertainment/rssfeed.xml','HINDI_ENTERTAINMENT',array['hi']::text[]),
      ('Live Hindustan — Entertainment','https://api.livehindustan.com/feeds/rss/videos/entertainment/rssfeed.xml','HINDI_ENTERTAINMENT_VIDEO',array['hi']::text[])
    ) as v(source_name, feed_url, feed_purpose, languages)
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
        'Source Expansion Wave 2 Batch 6: official publisher RSS; Tier 4 discovery/corroboration only.'
      ) returning id into v_source;
    else
      if not exists (
        select 1 from public.sources s
        where s.id=v_source and s.active=true
          and s.authority_tier=4 and s.source_role='GENERAL_MEDIA'
      ) then
        raise exception 'wave2_batch6_parent_source_requires_review:%', r.source_name;
      end if;
    end if;

    select source_identity_id into v_identity
    from public.attach_source_identity(
      v_source,'RSS',null,null,r.feed_url,'RSS_ATOM','ACTIVE_15M','FEED',
      jsonb_build_object(
        'schemaVersion',1,
        'expansionWave','wave2-batch6',
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
