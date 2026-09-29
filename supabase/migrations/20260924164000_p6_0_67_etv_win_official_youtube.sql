do $$
begin
  perform * from public.register_youtube_source(
    'UCuqXCrh7-m1kHfc82w88jaw',
    'ETV Win Originals',
    '@EtvwinOriginals',
    'UU' || substring('UCuqXCrh7-m1kHfc82w88jaw' from 3),
    1::smallint,
    'OTT_PLATFORM'
  );
end $$;
