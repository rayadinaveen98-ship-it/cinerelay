begin;

-- Hosted migration-history marker.
--
-- The CineRelay hosted project received the original security-hardening change
-- under this Supabase-generated version before the repository's older, manually
-- named migrations. On a fresh local rebuild this timestamp sorts before the
-- core schema exists, so the executable hardening is intentionally repeated in
-- 20260914221000_security_hardening.sql after all Phase-2 schema migrations.
--
-- Keep this marker so hosted and repository migration histories retain the same
-- version, while fresh databases apply the real idempotent hardening in the
-- correct dependency order.

commit;
