import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSourceRelationshipBootstrap,
  reviewSourceRelationship,
  type SourceRelationshipDecision,
  type SourceRelationshipItem,
  type SourceRelationshipStatus,
} from '../lib/source-relationship-api';

const FILTERS: Array<{ value: 'ALL' | SourceRelationshipStatus; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'STALE', label: 'Stale' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

function statusClass(status: SourceRelationshipStatus) {
  if (status === 'APPROVED') return 'border-emerald-900 bg-emerald-950/30 text-emerald-300';
  if (status === 'REJECTED') return 'border-red-900 bg-red-950/20 text-red-300';
  if (status === 'STALE') return 'border-zinc-700 bg-zinc-900 text-zinc-400';
  return 'border-amber-900 bg-amber-950/20 text-amber-300';
}

function RelationshipCard({ item, busy, onReview }: {
  item: SourceRelationshipItem;
  busy: boolean;
  onReview: (item: SourceRelationshipItem, decision: SourceRelationshipDecision, reason: string, validDays?: number) => void;
}) {
  const [reason, setReason] = useState('');
  const [validDays, setValidDays] = useState(String(item.proposal.recommended_valid_days));
  const proposal = item.proposal;
  const actionable = proposal.status === 'OPEN';
  const rationale = proposal.rationale;

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">P7.5 title/source relationship suggestion</p>
          <h3 className="mt-2 text-lg font-semibold text-zinc-100">{item.source?.display_name ?? 'Unknown source'} → {item.entity?.canonical_name ?? 'Unknown title'}</h3>
          <p className="mt-1 text-xs text-zinc-500">{item.sourceIdentity?.platform ?? 'unknown platform'} · {item.source?.source_role ?? 'unknown role'} · {item.entity?.entity_type ?? 'unknown entity'} · {proposal.relationship}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(proposal.status)}`}>{proposal.status}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Confidence" value={`${(proposal.confidence * 100).toFixed(1)}%`} />
        <Info label="Evidence items" value={String(proposal.evidence_count)} />
        <Info label="Suggested validity" value={`${proposal.recommended_valid_days} days`} />
        <Info label="Last evidence" value={new Date(proposal.last_seen_at).toLocaleString()} />
      </div>

      <div className="mt-4 rounded-xl border border-sky-900/40 bg-sky-950/10 p-4 text-sm leading-6 text-zinc-400">
        <p><strong className="text-zinc-200">Why suggested:</strong> independent canonical-title resolutions from this Tier-1 source. Source-scope resolutions are explicitly excluded so the relationship cannot bootstrap itself.</p>
        <p className="mt-2 text-xs text-zinc-500">Engine {String(rationale.resolutionEngine ?? '—')} · source role {String(rationale.sourceRole ?? '—')} · feedback guard {String(rationale.feedbackLoopGuard ?? '—')}</p>
      </div>

      {item.sourceIdentity && <a href={item.sourceIdentity.canonical_url} target="_blank" rel="noreferrer" className="mt-4 inline-block break-all text-sm text-amber-400 hover:text-amber-300">Open source identity ↗</a>}

      {item.evidence.length > 0 && <details className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-300">Evidence ({item.evidence.length})</summary>
        <div className="mt-3 space-y-3">{item.evidence.map((evidence) => <div key={evidence.raw_item_id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="flex flex-wrap gap-3 text-xs text-zinc-500"><span>resolution {(evidence.resolution_score * 100).toFixed(1)}%</span><span>{new Date(evidence.observed_at).toLocaleString()}</span></div>
          <p className="mt-2 text-sm text-zinc-300">{evidence.rawItem?.raw_title ?? evidence.rawItem?.item_type ?? 'Source item'}</p>
          {evidence.rawItem?.canonical_url && <a href={evidence.rawItem.canonical_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-amber-400 hover:text-amber-300">Open retained evidence ↗</a>}
        </div>)}</div>
      </details>}

      {proposal.review_reason && <p className="mt-4 rounded-xl border border-zinc-800 p-3 text-sm text-zinc-400"><strong className="text-zinc-300">Operator decision:</strong> {proposal.review_reason}</p>}

      {actionable && <div className="mt-5 border-t border-zinc-800 pt-4">
        <p className="text-xs leading-5 text-zinc-500"><strong className="text-zinc-300">Trust boundary:</strong> this proposal does not affect entity resolution until you explicitly approve it. Approval creates a time-bounded resolver prior; rejection stays final unless an operator changes policy later.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
          <label><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Validity</span><select value={validDays} onChange={(event) => setValidDays(event.target.value)} className="input"><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option><option value="120">120 days</option><option value="180">180 days</option></select></label>
          <label><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Operator reason</span><textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} className="input" placeholder="What evidence confirms or rejects this title/source relationship?" /></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={busy || reason.trim().length < 3} onClick={() => onReview(item, 'APPROVE', reason, Number(validDays))} className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-xs font-medium text-emerald-300 disabled:opacity-40">Approve time-bounded relationship</button>
          <button disabled={busy || reason.trim().length < 3} onClick={() => onReview(item, 'REJECT', reason)} className="rounded-lg border border-red-900 bg-red-950/20 px-3 py-2 text-xs text-red-300 disabled:opacity-40">Reject suggestion</button>
        </div>
      </div>}
    </article>
  );
}

export function SourceEntityRelationshipWorkflow() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['source-entity-relationships'], queryFn: () => fetchSourceRelationshipBootstrap(), refetchInterval: 60_000 });
  const [filter, setFilter] = useState<'ALL' | SourceRelationshipStatus>('OPEN');
  const mutation = useMutation({
    mutationFn: reviewSourceRelationship,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['source-entity-relationships'] }),
  });

  const visible = useMemo(() => {
    const items = query.data?.items ?? [];
    return filter === 'ALL' ? items : items.filter((item) => item.proposal.status === filter);
  }, [filter, query.data]);

  function count(status: 'ALL' | SourceRelationshipStatus) {
    if (!query.data) return 0;
    if (status === 'ALL') return Object.values(query.data.summary).reduce((sum, value) => sum + value, 0);
    return query.data.summary[status.toLowerCase() as keyof typeof query.data.summary];
  }

  function review(item: SourceRelationshipItem, decision: SourceRelationshipDecision, reason: string, validDays?: number) {
    mutation.mutate({ proposalId: item.proposal.id, decision, reason: reason.trim(), ...(decision === 'APPROVE' ? { validDays } : {}) });
  }

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400">Source graph maintenance</p><h2 className="mt-2 text-xl font-semibold">Title/source relationship suggestions</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">P7.5 learns possible project coverage from independent canonical-title matches on Tier-1 official sources. <strong className="text-zinc-200">Nothing is activated automatically.</strong> Approved relationships are time bounded because studio, label, and OTT coverage changes over time.</p></div>
        {query.data && <p className="text-xs text-zinc-500">Updated {new Date(query.data.generatedAt).toLocaleString()}</p>}
      </div>

      {query.data && <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Open" value={query.data.summary.open} /><Metric label="Stale" value={query.data.summary.stale} /><Metric label="Approved" value={query.data.summary.approved} /><Metric label="Rejected" value={query.data.summary.rejected} /></div>}
      <div className="mt-4 flex flex-wrap gap-2">{FILTERS.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={`rounded-lg border px-3 py-2 text-xs ${filter === item.value ? 'border-sky-500 bg-sky-950/40 text-sky-200' : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}>{item.label} · {count(item.value)}</button>)}</div>

      {query.isPending && <p className="mt-6 text-sm text-zinc-500">Loading relationship proposals…</p>}
      {query.isError && <p className="mt-6 text-sm text-red-300">{query.error.message}</p>}
      {mutation.isError && <p className="mt-4 text-sm text-red-300">{mutation.error.message}</p>}
      {query.data && <div className="mt-6 space-y-4">{visible.length === 0 ? <p className="text-sm text-zinc-500">No relationship suggestions in this state.</p> : visible.map((item) => <RelationshipCard key={item.proposal.id} item={item} busy={mutation.isPending} onReview={review} />)}</div>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-1 break-words text-sm text-zinc-300">{value}</p></div>;
}
