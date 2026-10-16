-- Existing Supabase public-schema defaults grant service_role UPDATE/DELETE
-- at table creation. Revoke explicitly so normal service API access is append-only.
revoke all on table public.operator_producer_evidence_leads from service_role;
grant select,insert on table public.operator_producer_evidence_leads to service_role;
