-- Hosted migration history marker.
-- The actual raw-item revision conflict fix is intentionally applied later in
-- 20260914222000_raw_item_revision_conflict_fix_ordered.sql so a fresh database
-- cannot have the original youtube_ingestion function overwrite the fix.
select 1;
