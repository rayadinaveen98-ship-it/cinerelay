do $$
begin
  if exists (select 1 from cron.job where jobname = 'cinerelay-x-profile-poll-canary') then
    perform cron.unschedule('cinerelay-x-profile-poll-canary');
  end if;
end;
$$;
