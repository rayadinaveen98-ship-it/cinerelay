create table if not exists public.scheduler_credentials (
  credential_name text primary key,
  token_hash bytea not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

alter table public.scheduler_credentials enable row level security;

revoke all on table public.scheduler_credentials from public, anon, authenticated;
grant select on table public.scheduler_credentials to service_role;

create or replace function public.verify_scheduler_token(p_token text)
returns boolean
language sql
stable
set search_path = pg_catalog, public, extensions
as $function$
  select
    p_token is not null
    and length(p_token) >= 32
    and exists (
      select 1
      from public.scheduler_credentials sc
      where sc.credential_name = 'edge-dispatch'
        and sc.active = true
        and sc.token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
    );
$function$;

revoke all on function public.verify_scheduler_token(text) from public, anon, authenticated;
grant execute on function public.verify_scheduler_token(text) to service_role;

do $block$
declare
  scheduler_token text;
begin
  select decrypted_secret
    into scheduler_token
  from vault.decrypted_secrets
  where name = 'cinerelay_scheduler_dispatch_token'
  order by created_at desc
  limit 1;

  if scheduler_token is null then
    scheduler_token := encode(extensions.gen_random_bytes(32), 'hex');
    perform vault.create_secret(
      scheduler_token,
      'cinerelay_scheduler_dispatch_token',
      'CineRelay database-generated token used only by pg_cron to authenticate scheduler dispatch calls'
    );
  end if;

  insert into public.scheduler_credentials (credential_name, token_hash, active)
  values (
    'edge-dispatch',
    extensions.digest(convert_to(scheduler_token, 'UTF8'), 'sha256'),
    true
  )
  on conflict (credential_name) do update
    set token_hash = excluded.token_hash,
        active = true,
        rotated_at = case
          when public.scheduler_credentials.token_hash is distinct from excluded.token_hash then now()
          else public.scheduler_credentials.rotated_at
        end;
end;
$block$;
