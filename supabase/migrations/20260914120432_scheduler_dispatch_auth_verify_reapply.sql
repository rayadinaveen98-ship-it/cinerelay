-- Hosted migration-history marker only.
--
-- A verification call through the Supabase migration tool recorded a no-op
-- `select 1` migration named `scheduler_dispatch_auth_verify_reapply` at this
-- hosted version. It intentionally performs no schema change.
select 1;
