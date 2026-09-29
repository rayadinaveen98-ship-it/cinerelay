do $$
declare
  v_command text;
begin
  if exists (select 1 from cron.job where jobname = 'cinerelay-x-profile-poll-canary') then
    return;
  end if;

  select replace(command, 'youtube-enrichment', 'x-profile-poll')
    into v_command
  from cron.job
  where jobid = 1;

  if v_command is null then
    raise exception 'scheduler_template_missing';
  end if;

  perform cron.schedule(
    'cinerelay-x-profile-poll-canary',
    '* * * * *',
    v_command
  );
end;
$$;
