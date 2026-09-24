-- P6.0.56: keep the existing deterministic Creator Radar projection fresh.
-- This only refreshes creator/editorial projections; it does not alter factual
-- event verification, canonical data, follows, or notification state.

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'cinerelay-creator-radar'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'cinerelay-creator-radar',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_project_url' order by created_at desc limit 1)
      || '/functions/v1/cinerelay-scheduler-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cinerelay-scheduler-key', (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_scheduler_dispatch_token' order by created_at desc limit 1)
    ),
    body := '{"action":"creator-radar"}'::jsonb,
    timeout_milliseconds := 45000
  ) as request_id;
  $job$
);
