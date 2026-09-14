begin;

alter extension pg_trgm set schema extensions;

alter function public.activate_connector_subscription(uuid, integer, timestamptz, timestamptz, timestamptz) set search_path = pg_catalog, public, extensions;
alter function public.complete_job(uuid, text) set search_path = pg_catalog, public, extensions;
alter function public.connector_quota_used_today(text, text) set search_path = pg_catalog, public, extensions;
alter function public.deactivate_connector_subscription(uuid) set search_path = pg_catalog, public, extensions;
alter function public.enqueue_job(text, text, jsonb, integer, timestamptz) set search_path = pg_catalog, public, extensions;
alter function public.fail_job(uuid, text, text, integer) set search_path = pg_catalog, public, extensions;
alter function public.lease_jobs(text, text, integer, integer) set search_path = pg_catalog, public, extensions;
alter function public.mark_raw_item_unavailable(uuid, text) set search_path = pg_catalog, public, extensions;
alter function public.record_entity_resolution(uuid, uuid, numeric, text, jsonb, text) set search_path = pg_catalog, public, extensions;
alter function public.record_youtube_websub_delivery(uuid, text, integer, timestamptz) set search_path = pg_catalog, public, extensions;
alter function public.register_youtube_source(text, text, text, text, smallint, text, uuid[]) set search_path = pg_catalog, public, extensions;
alter function public.replace_source_entity_candidates(uuid, uuid[]) set search_path = pg_catalog, public, extensions;
alter function public.set_updated_at() set search_path = pg_catalog, public, extensions;
alter function public.upsert_canonical_event_with_evidence(uuid, uuid, text, text, text, text, jsonb, text, text, uuid) set search_path = pg_catalog, public, extensions;
alter function public.upsert_raw_item_revision(uuid, text, text, timestamptz, text, text, text, text, text, jsonb, text) set search_path = pg_catalog, public, extensions;
alter function public.verification_rank(text) set search_path = pg_catalog, public, extensions;

alter default privileges for role postgres in schema public revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public grant usage, select on sequences to service_role;
alter default privileges for role postgres in schema public grant execute on functions to service_role;

commit;
