do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('Mammootty Kampany','UC6wkoCUd5gIYTDK6YUfI7Rw','@MammoottyKampany','PRODUCTION_HOUSE'),
      ('Nadiadwala Grandson Entertainment','UC7bd9i-yWpUOhvC72fATxrQ','@NadiadwalaGrandson','PRODUCTION_HOUSE'),
      ('Madras Talkies','UCXvSFDtBkDs9UJkPaPXOzCg','@madrastalkies','PRODUCTION_HOUSE'),
      ('Maddock Films','UC-LOdiPoxninevJ0DkleCLg','@MaddockFilms','PRODUCTION_HOUSE'),
      ('Zee Studios','UC3jMepkLKF8y4iiwWmAB3RA','@zeestudiosofficial','PRODUCTION_HOUSE'),
      ('Pen Movies','UC3ar28GS6o1p0m_wabfk2zw','@penmovies','PRODUCTION_HOUSE'),
      ('Panorama Studios','UC47fJuLOxYsOOq5R3adUXQA',null,'PRODUCTION_HOUSE'),
      ('Balaji Motion Pictures','UCSHLoG-bXj1aVA2T5y8t84A','@BalajiMotionPictures','PRODUCTION_HOUSE'),
      ('Tips Films','UCqXO3ktBw0D0sw1z5hZFeDg','@tipsfilms','PRODUCTION_HOUSE'),
      ('Pooja Entertainment','UCw_qKx4QAhnrhuOEwhah8ew','@PoojaEntertainmentOfficial','PRODUCTION_HOUSE')
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
