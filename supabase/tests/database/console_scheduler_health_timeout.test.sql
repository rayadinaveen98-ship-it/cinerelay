begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select has_function(
 'public','console_scheduler_health',array[]::text[],
 'console scheduler health RPC remains available'
);
select ok(
 position('max(d.runid)' in lower(pg_get_functiondef('public.console_scheduler_health()'::regprocedure))) > 0,
 'scheduler latest runs use one-pass grouped scan'
);
select ok(
 position('lateral' in lower(pg_get_functiondef('public.console_scheduler_health()'::regprocedure))) = 0,
 'scheduler no longer rescans full cron history per job'
);
select ok(
 has_function_privilege('service_role','public.console_scheduler_health()','EXECUTE'),
 'service role may load private scheduler health'
);
select ok(
 not has_function_privilege('anon','public.console_scheduler_health()','EXECUTE'),
 'anon cannot query scheduler health'
);
select ok(
 not has_function_privilege('authenticated','public.console_scheduler_health()','EXECUTE'),
 'ordinary signed-in user cannot execute privileged scheduler RPC'
);
select is(
 (select count(*)::integer from public.console_scheduler_health()),
 (select count(*)::integer from cron.job where jobname like 'cinerelay-%'),
 'all configured CineRelay jobs appear in scheduler health'
);
select * from finish();
rollback;
