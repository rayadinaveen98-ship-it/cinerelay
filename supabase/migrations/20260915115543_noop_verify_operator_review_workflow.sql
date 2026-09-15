do $$
begin
  if to_regclass('public.operator_resolution_overrides') is null then
    raise exception 'operator review workflow missing';
  end if;
end $$;
