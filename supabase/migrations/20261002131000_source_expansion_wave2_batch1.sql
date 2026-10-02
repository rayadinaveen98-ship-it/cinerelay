begin;

do $$
declare
  v_source uuid;
  v_identity uuid;
  r record;
begin
  -- Bollywood Hungama: film-focused trade-media feeds. These are Tier 3 evidence
  -- sources and must never be treated as first-party confirmation on their own.
  select id into v_source
  from public.sources
  where lower(display_name) = lower('Bollywood Hungama')
  order by active desc, created_at
  limit 1;

  if v_source is null then
    insert into public.sources (
      display_name, authority_tier, source_role, territory, languages, active, notes
    ) values (
      'Bollywood Hungama', 3, 'TRADE_MEDIA', 'IN', array['en']::text[], true,
      'Source Expansion Wave 2 Batch 1: manually verified official RSS feeds; trade-media evidence only.'
    ) returning id into v_source;
  end if;

  for r in select * from (values
    ('https://www.bollywoodhungama.com/rss/news.xml','ACTIVE_15M','NEWS'),
    ('https://www.bollywoodhungama.com/rss/features.xml','NORMAL_60M','FEATURES'),
    ('https://www.bollywoodhungama.com/rss/movie-review.xml','NORMAL_60M','REVIEWS'),
    ('https://www.bollywoodhungama.com/rss/movie-release-date.xml','ACTIVE_15M','RELEASE_DATES'),
    ('https://www.bollywoodhungama.com/rss/news-bo-special-analysis.xml','NORMAL_60M','BOX_OFFICE')
  ) as v(feed_url, poll_class, feed_purpose)
  loop
    select source_identity_id into v_identity
    from public.attach_source_identity(
      v_source,
      'RSS',
      null,
      null,
      r.feed_url,
      'RSS_ATOM',
      r.poll_class,
      'FEED',
      jsonb_build_object(
        'schemaVersion', 1,
        'expansionWave', 'wave2-batch1',
        'feedPurpose', r.feed_purpose,
        'trustPath', 'TRADE_MEDIA_TIER3'
      ),
      true
    );
    perform public.register_feed_source(v_identity, r.feed_url, 'feed-parser-v1');
  end loop;

  -- Filmibeat: one trade-media brand, language-specific feeds stay separate
  -- identities so ingestion can be monitored and throttled independently.
  select id into v_source
  from public.sources
  where lower(display_name) = lower('Filmibeat')
  order by active desc, created_at
  limit 1;

  if v_source is null then
    insert into public.sources (
      display_name, authority_tier, source_role, territory, languages, active, notes
    ) values (
      'Filmibeat', 3, 'TRADE_MEDIA', 'IN', array['en','te','ta','kn','ml']::text[], true,
      'Source Expansion Wave 2 Batch 1: manually verified publisher RSS feeds; trade-media evidence only.'
    ) returning id into v_source;
  end if;

  for r in select * from (values
    ('https://www.filmibeat.com/rss/feeds/filmibeat-fb.xml','NORMAL_60M','GENERAL'),
    ('https://www.filmibeat.com/rss/feeds/telugu-fb.xml','ACTIVE_15M','TELUGU'),
    ('https://www.filmibeat.com/rss/feeds/tamil-fb.xml','ACTIVE_15M','TAMIL'),
    ('https://www.filmibeat.com/rss/feeds/kannada-fb.xml','ACTIVE_15M','KANNADA'),
    ('https://www.filmibeat.com/rss/feeds/malayalam-fb.xml','ACTIVE_15M','MALAYALAM'),
    ('https://www.filmibeat.com/rss/feeds/ott-fb.xml','ACTIVE_15M','OTT')
  ) as v(feed_url, poll_class, feed_purpose)
  loop
    select source_identity_id into v_identity
    from public.attach_source_identity(
      v_source,
      'RSS',
      null,
      null,
      r.feed_url,
      'RSS_ATOM',
      r.poll_class,
      'FEED',
      jsonb_build_object(
        'schemaVersion', 1,
        'expansionWave', 'wave2-batch1',
        'feedPurpose', r.feed_purpose,
        'trustPath', 'TRADE_MEDIA_TIER3'
      ),
      true
    );
    perform public.register_feed_source(v_identity, r.feed_url, 'feed-parser-v1');
  end loop;

  -- The Indian Express is broad general media, not film trade media, so it is
  -- deliberately Tier 4 even though this identity is the Entertainment feed.
  select id into v_source
  from public.sources
  where lower(display_name) = lower('The Indian Express — Entertainment')
  order by active desc, created_at
  limit 1;

  if v_source is null then
    insert into public.sources (
      display_name, authority_tier, source_role, territory, languages, active, notes
    ) values (
      'The Indian Express — Entertainment', 4, 'GENERAL_MEDIA', 'IN', array['en']::text[], true,
      'Source Expansion Wave 2 Batch 1: entertainment RSS from a general-news publisher; discovery/corroboration evidence.'
    ) returning id into v_source;
  end if;

  select source_identity_id into v_identity
  from public.attach_source_identity(
    v_source,
    'RSS',
    null,
    null,
    'https://indianexpress.com/section/entertainment/feed/',
    'RSS_ATOM',
    'NORMAL_60M',
    'FEED',
    jsonb_build_object(
      'schemaVersion', 1,
      'expansionWave', 'wave2-batch1',
      'feedPurpose', 'ENTERTAINMENT',
      'trustPath', 'GENERAL_MEDIA_TIER4'
    ),
    true
  );
  perform public.register_feed_source(v_identity, 'https://indianexpress.com/section/entertainment/feed/', 'feed-parser-v1');

  -- The Hollywood Reporter India: original interviews/reviews/industry coverage.
  -- Add its canonical YouTube channel as Tier 3 trade media with WebSub + fallback.
  select id into v_source
  from public.sources
  where lower(display_name) = lower('The Hollywood Reporter India')
  order by active desc, created_at
  limit 1;

  if v_source is null then
    insert into public.sources (
      display_name, authority_tier, source_role, territory, languages, active, notes
    ) values (
      'The Hollywood Reporter India', 3, 'TRADE_MEDIA', 'IN', array['en']::text[], true,
      'Source Expansion Wave 2 Batch 1: canonical YouTube identity; original trade-media interviews/reviews/industry coverage.'
    ) returning id into v_source;
  end if;

  select source_identity_id into v_identity
  from public.attach_source_identity(
    v_source,
    'YOUTUBE',
    'UCNIGzoK1vgYYqLSF1MvI-3A',
    null,
    'https://www.youtube.com/channel/UCNIGzoK1vgYYqLSF1MvI-3A',
    'YOUTUBE_WEBSUB',
    'PUSH',
    'WEBHOOK',
    jsonb_build_object(
      'schemaVersion', 1,
      'expansionWave', 'wave2-batch1',
      'trustPath', 'TRADE_MEDIA_TIER3',
      'canonicalChannelIdVerified', true
    ),
    true
  );
  perform public.seed_source_identity_runtime(v_identity, 'UU' || substring('UCNIGzoK1vgYYqLSF1MvI-3A' from 3));
end
$$;

commit;
