begin;

-- Treat the factual destination link as the idempotency boundary. Notes are
-- explanatory metadata and may change between proposal-engine versions.
with ranked as (
  select
    id,
    row_number() over (
      partition by candidate_id, evidence_type, coalesce(evidence_url, '')
      order by observed_at desc, id desc
    ) as rn
  from public.source_discovery_evidence
)
delete from public.source_discovery_evidence e
using ranked r
where e.id = r.id
  and r.rn > 1;

drop index if exists public.source_discovery_evidence_dedupe_uq;
create unique index source_discovery_evidence_dedupe_uq
  on public.source_discovery_evidence (
    candidate_id,
    evidence_type,
    coalesce(evidence_url, '')
  );

select public.refresh_source_officiality_proposals(now());

commit;
