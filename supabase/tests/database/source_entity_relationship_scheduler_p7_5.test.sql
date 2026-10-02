begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

select results_eq(
  $$select count(*) from cron.job where jobname='cinerelay-source-relationship-refresh'$$,
  array[1::bigint],
  'P7.5 installs exactly one relationship refresh scheduler job'
);

select results_eq(
  $$select schedule from cron.job where jobname='cinerelay-source-relationship-refresh'$$,
  array['17 */6 * * *'::text],
  'relationship refresh runs every six hours at a staggered minute'
);

select ok(
  (select command like '%"action":"source-relationship-refresh"%' from cron.job where jobname='cinerelay-source-relationship-refresh'),
  'scheduler routes relationship refresh through the authenticated dispatcher'
);

select ok(
  (select active from cron.job where jobname='cinerelay-source-relationship-refresh'),
  'relationship refresh scheduler is active after rollout migration'
);

select * from finish();
rollback;
