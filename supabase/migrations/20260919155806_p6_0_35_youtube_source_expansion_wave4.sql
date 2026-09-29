do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('Lyca Productions','UCA7gwgLgmCZ8DSmdf2bhb8g','@lycaproductions','PRODUCTION_HOUSE'),
      ('AGS Entertainment','UC9WXzTgk10ncJX1eOxHElCg','@agsentertainment','PRODUCTION_HOUSE'),
      ('JioHotstar Tamil','UC8lPjTzRiG37n1Q2kpz3Rfg','@jiohotstartamil','OTT_PLATFORM'),
      ('Mango Music','UCWqyzn3cDkRDh3kRGWrIQwA','@mangomusic','MUSIC_LABEL'),
      ('Tips Telugu','UC2V5vzgmEmoiWqXfM2jN5_w','@TipsTelugu','MUSIC_LABEL'),
      ('Tips Tamil','UC48pE7QE4NZFTCsHT-IRxJw','@tipstamil','MUSIC_LABEL'),
      ('Saregama Tamil','UCzee67JnEcuvjErRyWP3GpQ','@SaregamaTamil','MUSIC_LABEL'),
      ('Saregama Malayalam','UCoRF8GByEjmM_yHwUGIDGyQ','@saregamamalayalam','MUSIC_LABEL'),
      ('Zee Music South','UCLsSLka8jODBozvi5VTQeaQ','@zeemusicsouth','MUSIC_LABEL'),
      ('Annapurna Studios','UCKA8af7IMMItFjqrYO9KgfQ','@annapurnastudios','PRODUCTION_HOUSE'),
      ('Junglee Music Telugu','UCSXwEK86-OWEn_QF65X7c7Q','@jungleemusictelugu','MUSIC_LABEL'),
      ('Lahari Music','UCnSqxrSfo1sK4WZ7nBpYW1Q','@laharimusicindia','MUSIC_LABEL'),
      ('SriBalajiMovies','UCoy3dQzEdq1y2zMnT4pdj3Q','@sribalajimovies','MEDIA_LIBRARY'),
      ('Geetha Arts Music','UCDV5PLFWEgBW0Sx4p1wmXSA','@geethaartsmusic','MUSIC_LABEL')
    ) as v(display_name,channel_id,handle,source_role)
  loop
    perform * from public.register_youtube_source(
      r.channel_id,
      r.display_name,
      r.handle,
      'UU' || substring(r.channel_id from 3),
      1::smallint,
      r.source_role
    );
  end loop;
end $$;
