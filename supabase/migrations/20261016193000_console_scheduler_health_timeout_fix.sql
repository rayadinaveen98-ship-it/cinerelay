-- Fix production Sources & ops page HTTP 500 / PostgreSQL 57014.
-- The prior scheduler health RPC scanned cron.job_run_details once PER job.
-- With >211k history rows, that timed out for the operator console.
-- Aggregate newest run IDs with ONE scan, then lookup the run by its PK.
-- Preserves existing return shape, order, SECURITY DEFINER and locked grants.
-- No scheduler modifications, history deletions, notifications, or catalogue writes.

create or replace function public.console_scheduler_health()
returns table(
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
as $function$
  with cine_jobs as materialized (
    select j.jobid,j.jobname,j.schedule,j.active
    from cron.job j
    where j.jobname like 'cinerelay-%'
  ),
  most_recent_runs as (
    select d.jobid, max(d.runid) as runid
    from cron.job_run_details d
    join cine_jobs j on j.jobid = d.jobid
    group by d.jobid
  )
  select
    j.jobid::bigint as job_id,
    j.jobname::text as job_name,
    j.schedule::text as schedule,
    j.active,
    d.status::text as latest_status,
    d.return_message::text as return_message,
    d.start_time as latest_start_at,
    d.end_time as latest_end_at
  from cine_jobs j
  left join most_recent_runs mr on mr.jobid = j.jobid
  left join cron.job_run_details d on d.runid = mr.runid
  order by j.jobname
$function$;

-- This is a privileged console-only RPC, never a public or signed-in-user API.
revoke all on function public.console_scheduler_health() from public, anon, authenticated;
grant execute on function public.console_scheduler_health() to service_role;
