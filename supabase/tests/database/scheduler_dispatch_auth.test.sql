begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select has_table('public', 'scheduler_credentials', 'scheduler credential table exists');

select has_function(
  'public',
  'verify_scheduler_token',
  array['text'],
  'scheduler token verifier exists'
);

select ok(
  exists (
    select 1
    from vault.decrypted_secrets
    where name = 'cinerelay_scheduler_dispatch_token'
      and length(decrypted_secret) >= 32
  ),
  'scheduler token is generated inside Vault'
);

select ok(
  public.verify_scheduler_token((
    select decrypted_secret
    from vault.decrypted_secrets
    where name = 'cinerelay_scheduler_dispatch_token'
    order by created_at desc
    limit 1
  )),
  'Vault scheduler token verifies'
);

select ok(
  not public.verify_scheduler_token('definitely-not-the-scheduler-token'),
  'incorrect scheduler token is rejected'
);

select ok(
  has_function_privilege(
    'service_role',
    to_regprocedure('public.verify_scheduler_token(text)'),
    'EXECUTE'
  ),
  'service_role can verify scheduler tokens'
);

select ok(
  not has_function_privilege(
    'anon',
    to_regprocedure('public.verify_scheduler_token(text)'),
    'EXECUTE'
  ),
  'anonymous clients cannot call scheduler verifier'
);

select * from finish();
rollback;
