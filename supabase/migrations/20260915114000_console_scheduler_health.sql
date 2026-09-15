begin;

create or replace function public.console_scheduler_health()
returns table (
  job_id bigint,
  job_name text,
  schedule text,
  active boolean,
  latest_status text,
  return_message text,
  latest_start_at timestamptz,
  latest_end_at timestamptz
)
language sql
security definer
set search_path = public, cron
as $$
  select
    j.jobid::bigint as job_id,
    j.jobname::text as job_name,
    j.schedule::text as schedule,
    j.active,
    r.status::text as latest_status,
    r.return_message::text,
    r.start_time as latest_start_at,
    r.end_time as latest_end_at
  from cron.job j
  left join lateral (
    select d.status, d.return_message, d.start_time, d.end_time
    from cron.job_run_details d
    where d.jobid = j.jobid
    order by d.start_time desc
    limit 1
  ) r on true
  where j.jobname like 'cinerelay-%'
  order by j.jobname;
$$;

revoke all on function public.console_scheduler_health() from public, anon, authenticated;
grant execute on function public.console_scheduler_health() to service_role;

comment on function public.console_scheduler_health() is
  'Service-role-only, secret-free operational snapshot of CineRelay cron jobs and their latest run.';

commit;
