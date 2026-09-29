do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('BHAVANA STUDIOS','UCPvtzpmgq3fraUXl6lLoK3w','@bhavanastudios','PRODUCTION_HOUSE'),
      ('Magic Frames','UCmUODKy5Ilf4TFZmp2ZcUyA','@MagicFramesOfficial','PRODUCTION_HOUSE'),
      ('Weekend Blockbusters','UCSuqUmF828n0ytdR0JcnrIA','@WeekendBlockbustersOfficial','PRODUCTION_HOUSE'),
      ('KRG STUDIOS','UC-BS2WxqT5aQnC7FhxAkJuw',null,'PRODUCTION_HOUSE'),
      ('E4 Entertainment','UCXcgltdMvm3ph4D6u-wku5g','@E4Emovies','PRODUCTION_HOUSE'),
      ('Sathya Jyothi Films','UCdbalkQDqCcOsYG5c4L8TAw','@SathyaJyothiFilms','PRODUCTION_HOUSE'),
      ('Passion Studios','UCDPWa-mWO2ePeErjHcWnHLw','@PassionStudiosOfficial','PRODUCTION_HOUSE'),
      ('SHINE Screens','UCTvj3-woimxixynrEzG1kUA',null,'PRODUCTION_HOUSE'),
      ('Dawn Pictures','UCx71fX-x6GW_QH97qdVyZBg','@Dawn.Pictures','PRODUCTION_HOUSE'),
      ('Prince Pictures','UC6szo4tLpqr8YRZqJ7939aw','@PrincePicturesIndia','PRODUCTION_HOUSE')
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
