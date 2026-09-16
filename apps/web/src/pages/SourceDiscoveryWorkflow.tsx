import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSourceDiscoveryBootstrap,
  reviewSourceCandidate,
  submitSourceCandidate,
  type CandidateKind,
  type CandidateReviewStatus,
  type SourceDiscoveryItem,
} from '../lib/source-discovery-api';

const KINDS: CandidateKind[] = ['PUBLIC_WEB', 'RSS_ATOM', 'YOUTUBE_CHANNEL', 'INSTAGRAM_PROFILE', 'THREADS_PROFILE', 'X_PROFILE', 'OTHER'];

function statusClass(status: string) {
  if (status === 'APPROVED') return 'border-emerald-900 bg-emerald-950/40 text-emerald-300';
  if (status === 'REJECTED' || status === 'DUPLICATE') return 'border-red-900 bg-red-950/30 text-red-300';
  if (status === 'REVIEWING') return 'border-amber-900 bg-amber-950/30 text-amber-300';
  return 'border-zinc-700 bg-zinc-900 text-zinc-300';
}

function CandidateCard({ item, onReview, busy }: {
  item: SourceDiscoveryItem;
  onReview: (item: SourceDiscoveryItem, status: CandidateReviewStatus, reason: string) => void;
  busy: boolean;
}) {
  const [reason, setReason] = useState('');
  const candidate = item.candidate;
  const exact = item.exactRegistryMatches[0];
  const reviewed = ['APPROVED', 'REJECTED', 'DUPLICATE'].includes(candidate.status);

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-zinc-100">{candidate.display_name ?? candidate.candidate_kind.replaceAll('_', ' ')}</h3>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(candidate.status)}`}>{candidate.status}</span>
          </div>
          <a href={candidate.candidate_url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm text-amber-400 hover:text-amber-300">{candidate.candidate_url} ↗</a>
          <p className="mt-2 text-xs text-zinc-500">{candidate.candidate_kind} · {candidate.discovery_method} · confidence {(candidate.confidence * 100).toFixed(0)}% · last seen {new Date(candidate.last_seen_at).toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Info label="Proposed role" value={candidate.proposed_source_role ?? '—'} />
        <Info label="Territory" value={candidate.territory ?? '—'} />
        <Info label="Languages" value={candidate.languages.join(', ') || '—'} />
      </div>

      {item.evidence.length > 0 && <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Evidence</p><div className="mt-2 space-y-2">{item.evidence.map((evidence) => <div key={evidence.id} className="text-sm text-zinc-300"><span className="text-zinc-500">{evidence.evidence_type}: </span>{evidence.evidence_url ? <a href={evidence.evidence_url} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300">{evidence.evidence_url}</a> : evidence.note ?? '—'}{evidence.note && evidence.evidence_url ? <p className="mt-1 text-xs text-zinc-500">{evidence.note}</p> : null}</div>)}</div></div>}

      {exact && <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/20 p-4"><p className="text-sm font-medium text-red-200">Exact existing registry URL match</p><p className="mt-1 text-xs text-red-300/80">{exact.source?.display_name ?? exact.identity.id} · Tier {exact.source?.authority_tier ?? '—'} · {exact.identity.platform} / {exact.identity.connector_type}</p></div>}

      {candidate.review_reason && <div className="mt-4 rounded-xl border border-zinc-800 p-3 text-sm text-zinc-400"><span className="font-medium text-zinc-300">Review reason:</span> {candidate.review_reason}</div>}

      {!reviewed && <div className="mt-5 border-t border-zinc-800 pt-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Operator review reason</label>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500" placeholder="Why should this candidate be approved, rejected, or marked duplicate?" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={busy || reason.trim().length < 3} onClick={() => onReview(item, 'REVIEWING', reason)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 disabled:opacity-40">Mark reviewing</button>
          <button disabled={busy || reason.trim().length < 3} onClick={() => onReview(item, 'APPROVED', reason)} className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300 disabled:opacity-40">Approve candidate</button>
          <button disabled={busy || reason.trim().length < 3} onClick={() => onReview(item, 'REJECTED', reason)} className="rounded-lg border border-red-900 bg-red-950/20 px-3 py-2 text-xs text-red-300 disabled:opacity-40">Reject</button>
          {exact && <button disabled={busy || reason.trim().length < 3} onClick={() => onReview(item, 'DUPLICATE', reason)} className="rounded-lg border border-red-900 px-3 py-2 text-xs text-red-300 disabled:opacity-40">Mark duplicate</button>}
        </div>
      </div>}
    </article>
  );
}

export function SourceDiscoveryWorkflow() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['source-discovery'], queryFn: () => fetchSourceDiscoveryBootstrap(), refetchInterval: 60_000 });
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState<CandidateKind>('PUBLIC_WEB');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('');
  const [territory, setTerritory] = useState('IN');
  const [languages, setLanguages] = useState('');
  const [confidence, setConfidence] = useState('0.70');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: submitSourceCandidate,
    onSuccess: async () => {
      setUrl(''); setDisplayName(''); setRole(''); setLanguages(''); setEvidenceUrl(''); setEvidenceNote(''); setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['source-discovery'] });
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : 'Unable to submit candidate'),
  });

  const reviewMutation = useMutation({
    mutationFn: reviewSourceCandidate,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['source-discovery'] }),
  });

  const counts = useMemo(() => {
    const result = { pending: 0, approved: 0, rejected: 0, duplicate: 0 };
    for (const item of query.data?.items ?? []) {
      if (item.candidate.status === 'PENDING' || item.candidate.status === 'REVIEWING') result.pending += 1;
      if (item.candidate.status === 'APPROVED') result.approved += 1;
      if (item.candidate.status === 'REJECTED') result.rejected += 1;
      if (item.candidate.status === 'DUPLICATE') result.duplicate += 1;
    }
    return result;
  }, [query.data]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsedConfidence = Number(confidence);
    if (!url.trim() || !Number.isFinite(parsedConfidence) || parsedConfidence < 0 || parsedConfidence > 1) {
      setFormError('Provide a valid HTTPS URL and confidence between 0 and 1.');
      return;
    }
    submitMutation.mutate({
      candidateUrl: url.trim(), candidateKind: kind,
      displayName: displayName.trim() || undefined,
      proposedSourceRole: role.trim() || undefined,
      territory: territory.trim() || undefined,
      languages: languages.split(',').map((value) => value.trim()).filter(Boolean),
      confidence: parsedConfidence,
      evidenceType: evidenceUrl.trim() || evidenceNote.trim() ? 'OPERATOR_NOTE' : undefined,
      evidenceUrl: evidenceUrl.trim() || undefined,
      evidenceNote: evidenceNote.trim() || undefined,
    });
  }

  function review(item: SourceDiscoveryItem, status: CandidateReviewStatus, reason: string) {
    const duplicateSourceIdentityId = status === 'DUPLICATE' ? item.exactRegistryMatches[0]?.identity.id : undefined;
    reviewMutation.mutate({ candidateId: item.candidate.id, status, reason: reason.trim(), duplicateSourceIdentityId });
  }

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">P4.3 source discovery</p><h2 className="mt-2 text-xl font-semibold">Candidate review queue</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Candidates are untrusted until reviewed. <strong className="text-zinc-200">Approve does not promote</strong>: it creates no source identity and assigns no authority tier.</p></div>
        {query.data && <p className="text-xs text-zinc-500">Updated {new Date(query.data.generatedAt).toLocaleString()}</p>}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Needs review" value={counts.pending} />
        <Metric label="Approved candidates" value={counts.approved} />
        <Metric label="Rejected" value={counts.rejected} />
        <Metric label="Duplicates" value={counts.duplicate} />
      </div>

      <details className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
        <summary className="cursor-pointer font-medium text-zinc-200">Add candidate manually</summary>
        <form onSubmit={submit} className="mt-5 grid gap-4 lg:grid-cols-2">
          <Field label="Candidate HTTPS URL"><input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="input" placeholder="https://official.example.com/news" /></Field>
          <Field label="Display name"><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input" placeholder="Official studio newsroom" /></Field>
          <Field label="Kind"><select value={kind} onChange={(e) => setKind(e.target.value as CandidateKind)} className="input">{KINDS.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
          <Field label="Proposed role (not authority)"><input value={role} onChange={(e) => setRole(e.target.value)} className="input" placeholder="PRODUCTION_HOUSE / OTT_PLATFORM" /></Field>
          <Field label="Territory"><input value={territory} onChange={(e) => setTerritory(e.target.value)} className="input" placeholder="IN" /></Field>
          <Field label="Languages (comma-separated)"><input value={languages} onChange={(e) => setLanguages(e.target.value)} className="input" placeholder="te, ta, hi, en" /></Field>
          <Field label="Discovery confidence 0–1"><input value={confidence} onChange={(e) => setConfidence(e.target.value)} className="input" inputMode="decimal" /></Field>
          <Field label="Evidence URL"><input type="url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} className="input" placeholder="https://official.example.com/about" /></Field>
          <div className="lg:col-span-2"><Field label="Evidence note"><textarea value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} rows={2} className="input" placeholder="How do we know this candidate is relevant/official?" /></Field></div>
          <div className="lg:col-span-2 flex items-center gap-3"><button disabled={submitMutation.isPending} className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50">{submitMutation.isPending ? 'Saving…' : 'Add candidate'}</button>{formError && <p className="text-sm text-red-300">{formError}</p>}</div>
        </form>
      </details>

      {query.isPending && <p className="mt-6 text-sm text-zinc-500">Loading discovery candidates…</p>}
      {query.isError && <p className="mt-6 text-sm text-red-300">{query.error.message}</p>}
      {reviewMutation.isError && <p className="mt-4 text-sm text-red-300">{reviewMutation.error.message}</p>}
      {query.data && <div className="mt-6 space-y-4">{query.data.items.length === 0 ? <p className="text-sm text-zinc-500">No candidates yet.</p> : query.data.items.map((item) => <CandidateCard key={item.candidate.id} item={item} onReview={review} busy={reviewMutation.isPending} />)}</div>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</span>{children}</label>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-1 break-words text-sm text-zinc-300">{value}</p></div>;
}
