import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clearReviewOverride,
  fetchReviewBootstrap,
  mergeEvents,
  reclassifyEvent,
  resolveReviewItem,
  searchReviewEntities,
  suppressEvent,
  type ReviewItem,
} from '../lib/review-api';

function fmt(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : '—';
}

function sourceTrustLabel(item: ReviewItem) {
  const source = item.source;
  if (!source) return 'Unknown source trust';
  const tier = Number.isFinite(source.authorityTier) ? `Tier ${source.authorityTier}` : 'Tier unknown';
  const role = source.sourceRole?.replaceAll('_', ' ') ?? 'Role unknown';
  return `${tier} · ${role} · ${source.platform}`;
}

function ReviewItemCard({ item }: { item: ReviewItem }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [reason, setReason] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'MOVIE' | 'SERIES' | 'SEASON'>('MOVIE');
  const entitySearch = useQuery({
    queryKey: ['review-entity-search', search],
    queryFn: () => searchReviewEntities(search),
    enabled: search.trim().length >= 2,
  });

  const resolve = useMutation({
    mutationFn: () => resolveReviewItem({
      rawItemId: item.resolution.raw_item_id,
      reason,
      ...(selectedEntityId ? { entityId: selectedEntityId } : {
        newEntityName: newName,
        newEntityType: newType,
        primaryLanguage: 'te',
        countryCode: 'IN',
      }),
    }),
    onSuccess: async () => {
      setReason('');
      setSearch('');
      setNewName('');
      setSelectedEntityId('');
      await queryClient.invalidateQueries({ queryKey: ['review-bootstrap'] });
      await queryClient.invalidateQueries({ queryKey: ['console-overview'] });
    },
  });

  const clear = useMutation({
    mutationFn: () => clearReviewOverride(item.resolution.raw_item_id, reason),
    onSuccess: async () => {
      setReason('');
      await queryClient.invalidateQueries({ queryKey: ['review-bootstrap'] });
    },
  });

  const canResolve = reason.trim().length >= 3 && Boolean(selectedEntityId || newName.trim());

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-zinc-500">
            <span>{item.resolution.resolution_state}</span><span>•</span><span>score {item.resolution.score}</span><span>•</span><span>{item.source?.name ?? 'Unknown source'}</span>
          </div>
          <h3 className="mt-2 font-semibold text-zinc-100">{item.rawItem?.raw_title ?? 'Untitled source item'}</h3>
          <p className="mt-1 text-xs text-zinc-500">{item.resolution.engine_version}</p>
        </div>
        {item.rawItem?.canonical_url && <a href={item.rawItem.canonical_url} target="_blank" rel="noreferrer" className="text-sm text-amber-400 hover:text-amber-300">Open evidence ↗</a>}
      </div>

      <div className="mt-4 rounded-xl border border-amber-900/60 bg-amber-950/20 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-300">
          <span>Raw / unresolved signal</span><span>•</span><span>{sourceTrustLabel(item)}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">Canonical identity and event trust are not established yet. Review the source authority, evidence and title before binding or creating an entity.</p>
        <div className="mt-3 grid gap-3 text-xs text-zinc-400 sm:grid-cols-2">
          <div><span className="block uppercase tracking-wide text-zinc-600">Source published</span><span className="mt-1 block text-zinc-300">{fmt(item.rawItem?.published_at)}</span></div>
          <div><span className="block uppercase tracking-wide text-zinc-600">CineRelay first seen</span><span className="mt-1 block text-zinc-300">{fmt(item.rawItem?.first_seen_at)}</span></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
          {item.source?.handle && <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-2.5 py-1">{item.source.handle}</span>}
          {item.source?.connectorType && <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-2.5 py-1">{item.source.connectorType}</span>}
          {item.source?.accessMode && <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-2.5 py-1">{item.source.accessMode}</span>}
        </div>
      </div>

      {item.rawItem?.raw_text && <details className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"><summary className="cursor-pointer text-sm text-zinc-300">Source text</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{item.rawItem.raw_text}</p></details>}

      {item.override && <div className="mt-4 rounded-xl border border-blue-900/60 bg-blue-950/20 p-3 text-sm text-blue-200">Current override: <strong>{item.override.entity?.canonical_name ?? item.override.entity_id}</strong> · {item.override.active ? 'active' : 'inactive'} · {item.override.reason}</div>}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-sm font-medium text-zinc-200">Bind to existing entity</p>
          <input value={search} onChange={(event) => { setSearch(event.target.value); setSelectedEntityId(''); }} placeholder="Search movie / series" className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500" />
          {entitySearch.data?.items.length ? <div className="mt-2 max-h-44 space-y-2 overflow-auto">{entitySearch.data.items.map((entity) => <button key={entity.id} type="button" onClick={() => setSelectedEntityId(entity.id)} className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${selectedEntityId === entity.id ? 'border-amber-500 bg-amber-950/20 text-amber-200' : 'border-zinc-800 bg-zinc-950 text-zinc-300'}`}><strong>{entity.canonical_name}</strong><span className="ml-2 text-xs text-zinc-500">{entity.entity_type}</span></button>)}</div> : null}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-sm font-medium text-zinc-200">Or create missing entity</p>
          <input value={newName} onChange={(event) => { setNewName(event.target.value); setSelectedEntityId(''); }} placeholder="Canonical title" className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500" />
          <select value={newType} onChange={(event) => setNewType(event.target.value as 'MOVIE' | 'SERIES' | 'SEASON')} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"><option value="MOVIE">Movie</option><option value="SERIES">Series</option><option value="SEASON">Season</option></select>
        </div>
      </div>

      <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required audit reason — what evidence justifies this correction?" className="mt-4 min-h-20 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={!canResolve || resolve.isPending} onClick={() => resolve.mutate()} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-40">{resolve.isPending ? 'Applying…' : 'Resolve & reprocess'}</button>
        {item.override?.active && <button disabled={reason.trim().length < 3 || clear.isPending} onClick={() => clear.mutate()} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 disabled:opacity-40">Clear override</button>}
      </div>
      {(resolve.isError || clear.isError) && <p className="mt-3 text-sm text-red-300">{(resolve.error ?? clear.error)?.message}</p>}
    </article>
  );
}

function EventActions({ eventTypes }: { eventTypes: Array<{ code: string; family: string }> }) {
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState('');
  const [targetEventId, setTargetEventId] = useState('');
  const [eventType, setEventType] = useState(eventTypes[0]?.code ?? 'PROJECT_ANNOUNCED');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const action = useMutation({
    mutationFn: async (kind: 'suppress' | 'reclassify' | 'merge') => {
      if (kind === 'suppress') return suppressEvent(eventId, reason);
      if (kind === 'reclassify') return reclassifyEvent(eventId, eventType, reason);
      return mergeEvents(eventId, targetEventId, reason);
    },
    onSuccess: async (_data, kind) => {
      setResult(`${kind} completed and audited`);
      setReason('');
      await queryClient.invalidateQueries({ queryKey: ['review-bootstrap'] });
      await queryClient.invalidateQueries({ queryKey: ['console-feed'] });
      await queryClient.invalidateQueries({ queryKey: ['event-detail'] });
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of eventTypes) {
      const list = map.get(item.family) ?? [];
      list.push(item.code);
      map.set(item.family, list);
    }
    return [...map.entries()];
  }, [eventTypes]);

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-semibold">Audited canonical-event actions</h2>
      <p className="mt-2 text-sm text-zinc-500">Use canonical event UUIDs from the live feed/detail screen. Merge is intentionally restricted to events belonging to the same entity.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <input value={eventId} onChange={(event) => setEventId(event.target.value)} placeholder="Event UUID to act on / merge from" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
        <input value={targetEventId} onChange={(event) => setTargetEventId(event.target.value)} placeholder="Merge target event UUID (merge only)" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
        <select value={eventType} onChange={(event) => setEventType(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
          {grouped.map(([family, codes]) => <optgroup key={family} label={family}>{codes.map((code) => <option key={code} value={code}>{code.replaceAll('_', ' ')}</option>)}</optgroup>)}
        </select>
        <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required audit reason" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={!eventId || reason.trim().length < 3 || action.isPending} onClick={() => action.mutate('suppress')} className="rounded-lg border border-red-800 px-4 py-2 text-sm text-red-300 disabled:opacity-40">Suppress</button>
        <button disabled={!eventId || reason.trim().length < 3 || action.isPending} onClick={() => action.mutate('reclassify')} className="rounded-lg border border-amber-700 px-4 py-2 text-sm text-amber-300 disabled:opacity-40">Reclassify</button>
        <button disabled={!eventId || !targetEventId || reason.trim().length < 3 || action.isPending} onClick={() => action.mutate('merge')} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 disabled:opacity-40">Merge into target</button>
      </div>
      {result && <p className="mt-3 text-sm text-emerald-300">{result}</p>}
      {action.isError && <p className="mt-3 text-sm text-red-300">{action.error.message}</p>}
    </section>
  );
}

export function ReviewWorkflow() {
  const query = useQuery({ queryKey: ['review-bootstrap'], queryFn: () => fetchReviewBootstrap(100), refetchInterval: 30_000 });
  if (query.isPending) return <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 text-zinc-400">Loading review queue…</section>;
  if (query.isError) return <section className="rounded-3xl border border-red-900 bg-red-950/20 p-6 text-red-300">{query.error.message}</section>;

  const data = query.data;
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">P3.5 review</p><h2 className="mt-2 text-xl font-semibold">Unresolved & ambiguous intelligence</h2></div><p className="text-xs text-zinc-500">Current queue only · updated {fmt(data.generatedAt)}</p></div>
        <p className="mt-3 text-sm leading-6 text-zinc-400">Corrections create durable overrides, teach the source candidate scope, enqueue the normal intelligence worker, and write an immutable audit action. Historical unresolved rows do not count once a newer resolution exists.</p>
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"><p className="text-xs uppercase tracking-wide text-zinc-500">Current review items</p><p className="mt-1 text-3xl font-semibold">{data.items.length}</p></div>
      </section>

      <section className="space-y-4">
        {data.items.length === 0 ? <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-500">No unresolved or ambiguous current items.</div> : data.items.map((item) => <ReviewItemCard key={item.resolution.raw_item_id} item={item} />)}
      </section>

      <EventActions eventTypes={data.eventTypes} />

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold">Recent operator audit trail</h2>
        <div className="mt-4 max-h-[420px] space-y-3 overflow-auto">{data.audit.length === 0 ? <p className="text-sm text-zinc-500">No operator actions yet.</p> : data.audit.map((row) => <div key={row.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"><div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-zinc-500"><span>{row.action_type.replaceAll('_', ' ')}</span><span>•</span><span>{row.target_type}</span><span>•</span><span>{fmt(row.created_at)}</span></div><p className="mt-2 text-sm text-zinc-300">{row.reason ?? 'No reason supplied'}</p>{row.target_id && <p className="mt-1 break-all text-xs text-zinc-600">{row.target_id}</p>}</div>)}</div>
      </section>
    </div>
  );
}
