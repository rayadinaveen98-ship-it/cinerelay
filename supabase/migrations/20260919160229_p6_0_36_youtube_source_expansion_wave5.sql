do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('Raaj Kamal Films International','UC_gXhnzeF5_XIFn4gx_bocg','@rkfi','PRODUCTION_HOUSE'),
      ('Aashirvad Cinemas','UC_J44kyEsEB8LPlhfm2Xb4g','@AashirvadCinemasOfficial','PRODUCTION_HOUSE'),
      ('Prithviraj Productions','UCH1Gszpy-NmA6ZXZaxhnlwA','@PrithvirajProductions','PRODUCTION_HOUSE'),
      ('Paramvah Studios','UCvBaJ5MfXVKfSiKP2beaNvw','@paramvahstudiosofficial','PRODUCTION_HOUSE'),
      ('Seven Screen Studio','UCVQOvjbw_Fjjscg1d4Y-LVQ',null::text,'PRODUCTION_HOUSE'),
      ('Friday Film House','UCv65_DW-OzwBgJw99zWJy3g',null::text,'PRODUCTION_HOUSE'),
      ('Wunderbar Films','UCIx3RWYwikMlDiJeCEUbfEA','@wunderbarstudios','PRODUCTION_HOUSE')
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
