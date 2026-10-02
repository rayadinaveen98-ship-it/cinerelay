begin;

do $$
declare
  v_source uuid;
  v_identity uuid;
  r record;
begin
  -- Deepen the existing Indian Express Entertainment source with official
  -- category RSS feeds. It remains Tier 4 GENERAL_MEDIA: useful for discovery
  -- and corroboration, but never a substitute for first-party confirmation.
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
      'Source Expansion Wave 2: official entertainment RSS from a general-news publisher; discovery/corroboration only.'
    ) returning id into v_source;
  end if;

  for r in select * from (values
    ('https://indianexpress.com/section/entertainment/telugu/feed/','ACTIVE_15M','TELUGU'),
    ('https://indianexpress.com/section/entertainment/tamil/feed/','ACTIVE_15M','TAMIL'),
    ('https://indianexpress.com/section/entertainment/malayalam/feed/','ACTIVE_15M','MALAYALAM'),
    ('https://indianexpress.com/section/entertainment/regional/feed/','ACTIVE_15M','REGIONAL'),
    ('https://indianexpress.com/section/entertainment/web-series/feed/','ACTIVE_15M','WEB_SERIES'),
    ('https://indianexpress.com/section/entertainment/movie-review/feed/','NORMAL_60M','MOVIE_REVIEWS'),
    ('https://indianexpress.com/section/entertainment/bollywood/feed/','ACTIVE_15M','BOLLYWOOD'),
    ('https://indianexpress.com/section/entertainment/bollywood/box-office-collection/feed/','ACTIVE_15M','BOX_OFFICE')
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
        'expansionWave', 'wave2-batch2',
        'feedPurpose', r.feed_purpose,
        'trustPath', 'GENERAL_MEDIA_TIER4'
      ),
      true
    );
    perform public.register_feed_source(v_identity, r.feed_url, 'feed-parser-v1');
  end loop;

  -- Koimoi is a film/entertainment publisher. Keep it Tier 3 TRADE_MEDIA;
  -- its reporting can corroborate stories but does not become first-party truth.
  select id into v_source
  from public.sources
  where lower(display_name) = lower('Koimoi')
  order by active desc, created_at
  limit 1;

  if v_source is null then
    insert into public.sources (
      display_name, authority_tier, source_role, territory, languages, active, notes
    ) values (
      'Koimoi', 3, 'TRADE_MEDIA', 'IN', array['en']::text[], true,
      'Source Expansion Wave 2 Batch 2: verified publisher RSS; trade-media evidence only.'
    ) returning id into v_source;
  end if;

  select source_identity_id into v_identity
  from public.attach_source_identity(
    v_source,
    'RSS',
    null,
    null,
    'https://www.koimoi.com/feed/',
    'RSS_ATOM',
    'ACTIVE_15M',
    'FEED',
    jsonb_build_object(
      'schemaVersion', 1,
      'expansionWave', 'wave2-batch2',
      'feedPurpose', 'GENERAL_ENTERTAINMENT',
      'trustPath', 'TRADE_MEDIA_TIER3'
    ),
    true
  );
  perform public.register_feed_source(v_identity, 'https://www.koimoi.com/feed/', 'feed-parser-v1');

  -- Filmfare official YouTube channel, canonical UC id verified independently.
  select id into v_source
  from public.sources
  where lower(display_name) = lower('Filmfare')
  order by active desc, created_at
  limit 1;

  if v_source is null then
    insert into public.sources (
      display_name, authority_tier, source_role, territory, languages, active, notes
    ) values (
      'Filmfare', 3, 'TRADE_MEDIA', 'IN', array['en','hi']::text[], true,
      'Source Expansion Wave 2 Batch 2: canonical official YouTube identity; interviews and entertainment coverage.'
    ) returning id into v_source;
  end if;

  select source_identity_id into v_identity
  from public.attach_source_identity(
    v_source,
    'YOUTUBE',
    'UC500dYMU9OMJdJKWRqGlhog',
    '@filmfareofficial',
    'https://www.youtube.com/channel/UC500dYMU9OMJdJKWRqGlhog',
    'YOUTUBE_WEBSUB',
    'PUSH',
    'WEBHOOK',
    jsonb_build_object(
      'schemaVersion', 1,
      'expansionWave', 'wave2-batch2',
      'trustPath', 'TRADE_MEDIA_TIER3',
      'canonicalChannelIdVerified', true
    ),
    true
  );
  perform public.seed_source_identity_runtime(v_identity, 'UU' || substring('UC500dYMU9OMJdJKWRqGlhog' from 3));

  -- Cinema Express (The New Indian Express group) official YouTube channel.
  select id into v_source
  from public.sources
  where lower(display_name) = lower('Cinema Express')
  order by active desc, created_at
  limit 1;

  if v_source is null then
    insert into public.sources (
      display_name, authority_tier, source_role, territory, languages, active, notes
    ) values (
      'Cinema Express', 3, 'TRADE_MEDIA', 'IN', array['en','ta']::text[], true,
      'Source Expansion Wave 2 Batch 2: canonical official YouTube identity; interviews, reviews and cinema features.'
    ) returning id into v_source;
  end if;

  select source_identity_id into v_identity
  from public.attach_source_identity(
    v_source,
    'YOUTUBE',
    'UC2MgcperJNAFDQgafrijUnA',
    null,
    'https://www.youtube.com/channel/UC2MgcperJNAFDQgafrijUnA',
    'YOUTUBE_WEBSUB',
    'PUSH',
    'WEBHOOK',
    jsonb_build_object(
      'schemaVersion', 1,
      'expansionWave', 'wave2-batch2',
      'trustPath', 'TRADE_MEDIA_TIER3',
      'canonicalChannelIdVerified', true
    ),
    true
  );
  perform public.seed_source_identity_runtime(v_identity, 'UU' || substring('UC2MgcperJNAFDQgafrijUnA' from 3));
end
$$;

commit;
