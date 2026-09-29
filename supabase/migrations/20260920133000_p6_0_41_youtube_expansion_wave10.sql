do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('JioHotstar Malayalam','UCA09ogM92UefGEHtSZy5zkw','@JioHotstarMalayalam','OTT_PLATFORM'),
      ('Think Studios Official','UCKVncifiBs1yeFn7Wx5lHOA','@thinkstudiosofficial','PRODUCTION_HOUSE'),
      ('Wayfarer Films Music','UChIOdOWPI0neC5acqgJXh5g','@Wayfarerfilmsmusic','MUSIC_LABEL')
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
