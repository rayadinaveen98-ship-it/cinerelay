create table if not exists public.operator_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.operator_users enable row level security;

revoke all on table public.operator_users from public, anon, authenticated;
grant select, insert, update, delete on table public.operator_users to service_role;

comment on table public.operator_users is
  'Allowlist for authenticated CineRelay internal-console operators. Browser clients have no direct table privileges; console Edge Functions validate Auth JWTs and query this table with service-role privileges.';
