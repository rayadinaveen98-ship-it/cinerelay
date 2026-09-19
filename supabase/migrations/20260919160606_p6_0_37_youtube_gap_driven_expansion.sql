do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('aha videoIN','UCmO-jDLU-KUcweCzktuDsbg','@ahatelugu','OTT_PLATFORM'),
      ('JioHotstar Kannada','UCMW3IOCCVOQfP26b3UkU9UA','@JioHotstarKannada-bb12','OTT_PLATFORM'),
      ('Dharma Productions','UCKQKIY2YlI4L5QVg7hhfjrQ','@DharmaMovies','PRODUCTION_HOUSE'),
      ('YRF','UCbTLwN10NoCU4WDzLf1JMOA','@yrf','PRODUCTION_HOUSE'),
      ('Red Chillies Entertainment','UCjJKg01HAP01xCLVhDmnLhw','@RedChilliesEntertainment','PRODUCTION_HOUSE'),
      ('Excel Movies','UCn9BuiRZGR_tPM2GGT4jN-w','@excelmovies','PRODUCTION_HOUSE'),
      ('Sony Pictures India','UCFqyJFbsV-uEcosvNhg0PaQ','@SonyPicturesIndia','PRODUCTION_HOUSE')
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
