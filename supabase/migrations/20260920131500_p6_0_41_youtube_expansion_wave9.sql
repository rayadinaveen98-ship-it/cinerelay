do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('Potential Studios','UCoU9DW4JJTmaVm7gsiAyK3Q','@potentialstudios','PRODUCTION_HOUSE'),
      ('Sree Gokulam Movies','UC7rP8B90HTEXxQ6ApRVDyVg','@SreeGokulamMovies','PRODUCTION_HOUSE'),
      ('Anto Joseph Film Company','UCAAufdrkoIXtfHQI9QE1tzA','@AntoJosephFilmCompany','PRODUCTION_HOUSE'),
      ('SRT Entertainments','UC4Jn8EVdcJLK6IMWCEwOHRw','@srtentertainments','PRODUCTION_HOUSE'),
      ('Mythri Distributors LLP','UCD9mBTXKz8xBn8_PKw7bK1A','@MythriReleasesoffl','PRODUCTION_HOUSE'),
      ('Million Dollar Studios','UCpXFGF4KCES-ULIoyZwbRzg','@millionoffl','PRODUCTION_HOUSE'),
      ('RS Infotainment','UCUjM7AzodC55Dq6BncrsBjA','@rsinfotainmentindia','PRODUCTION_HOUSE'),
      ('Goodwill Entertainments','UCq6f9bBWaWTHl0FhH167RgA','@goodwillentertainments','PRODUCTION_HOUSE'),
      ('Amal Neerad Productions','UCOzubmwpVZI7gD0Jf7Bk3Aw','@amalneeradproductions5264','PRODUCTION_HOUSE'),
      ('LittleBig Films','UCWjrksVAh6pL0Yl0bFOVJ8w','@LittleBigcinemas','PRODUCTION_HOUSE')
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
