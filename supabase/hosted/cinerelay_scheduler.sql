-- Hosted-only CineRelay scheduler setup.
-- This file is intentionally not under supabase/migrations because it contains
-- the hosted project URL and should not make local CI call production.
-- No secret value is committed: the dispatcher token is read from Vault at run time.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $block$
begin
  if not exists (
    select 1 from vault.secrets where name = 'cinerelay_project_url'
  ) then
    perform vault.create_secret(
      'https://dnqaejljfzwhsainpdxb.supabase.co',
      'cinerelay_project_url',
      'Public URL for the hosted CineRelay Supabase project, used by pg_cron worker dispatch'
    );
  end if;
end;
$block$;

select cron.schedule(
  'cinerelay-youtube-enrichment',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_project_url' order by created_at desc limit 1)
      || '/functions/v1/cinerelay-scheduler-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cinerelay-scheduler-key', (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_scheduler_dispatch_token' order by created_at desc limit 1)
    ),
    body := '{"action":"youtube-enrichment"}'::jsonb,
    timeout_milliseconds := 45000
  ) as request_id;
  $job$
);

select cron.schedule(
  'cinerelay-process-raw-item',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_project_url' order by created_at desc limit 1)
      || '/functions/v1/cinerelay-scheduler-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cinerelay-scheduler-key', (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_scheduler_dispatch_token' order by created_at desc limit 1)
    ),
    body := '{"action":"process-raw-item"}'::jsonb,
    timeout_milliseconds := 45000
  ) as request_id;
  $job$
);

select cron.schedule(
  'cinerelay-youtube-maintenance',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_project_url' order by created_at desc limit 1)
      || '/functions/v1/cinerelay-scheduler-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cinerelay-scheduler-key', (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_scheduler_dispatch_token' order by created_at desc limit 1)
    ),
    body := '{"action":"youtube-maintenance"}'::jsonb,
    timeout_milliseconds := 45000
  ) as request_id;
  $job$
);

-- Legacy worker/action names are retained for compatibility, but this is now the
-- authoritative uploads-playlist discovery path. The worker itself uses 5-minute
-- hot polling for degraded WebSub sources and 15-minute normal polling otherwise.
select cron.schedule(
  'cinerelay-youtube-fallback',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_project_url' order by created_at desc limit 1)
      || '/functions/v1/cinerelay-scheduler-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cinerelay-scheduler-key', (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_scheduler_dispatch_token' order by created_at desc limit 1)
    ),
    body := '{"action":"youtube-fallback"}'::jsonb,
    timeout_milliseconds := 45000
  ) as request_id;
  $job$
);

-- Generic RSS/Atom polling. The scheduler wakes every five minutes, while the
-- worker enforces each source's poll class, conditional HTTP state, per-domain
-- request spacing and backoff before making any network request.
select cron.schedule(
  'cinerelay-feed-poll',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_project_url' order by created_at desc limit 1)
      || '/functions/v1/cinerelay-scheduler-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cinerelay-scheduler-key', (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_scheduler_dispatch_token' order by created_at desc limit 1)
    ),
    body := '{"action":"feed-poll"}'::jsonb,
    timeout_milliseconds := 45000
  ) as request_id;
  $job$
);

-- First-party public newsroom / press-page polling. This is another scheduler
-- heartbeat only: page-poll-worker enforces page-specific due times, conditional
-- validators, parser drift guards, per-domain spacing and backoff.
select cron.schedule(
  'cinerelay-page-poll',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_project_url' order by created_at desc limit 1)
      || '/functions/v1/cinerelay-scheduler-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cinerelay-scheduler-key', (select decrypted_secret from vault.decrypted_secrets where name = 'cinerelay_scheduler_dispatch_token' order by created_at desc limit 1)
    ),
    body := '{"action":"page-poll"}'::jsonb,
    timeout_milliseconds := 45000
  ) as request_id;
  $job$
);
