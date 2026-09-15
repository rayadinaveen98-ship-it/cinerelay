import { useQuery } from '@tanstack/react-query';
import { fetchConsoleOperations } from '../lib/console-api';

function fmt(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : '—';
}

function pill(value: string, danger = false) {
  return `inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${danger ? 'border-red-900 bg-red-950/50 text-red-300' : 'border-zinc-700 bg-zinc-900 text-zinc-300'}`;
}

export function OperationsPage() {
  const query = useQuery({ queryKey: ['console-operations'], queryFn: fetchConsoleOperations, refetchInterval: 30_000 });
  if (query.isPending) return <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 text-zinc-400">Loading source registry and operations…</section>;
  if (query.isError) return <section className="rounded-3xl border border-red-900 bg-red-950/20 p-6 text-red-300">{query.error.message}</section>;

  const data = query.data;
  const deadJobs = data.jobs.recent.filter((job) => job.state === 'DEAD_LETTER');
  const gapSources = data.registry.filter((entry) => (entry.youtube?.fallback_gap_count ?? 0) > 0);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">Operations</p><h1 className="mt-2 text-2xl font-semibold">Source registry & health</h1></div>
          <p className="text-xs text-zinc-500">Updated {new Date(data.generatedAt).toLocaleString()}</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Source identities" value={data.registry.length} />
          <Metric label="Discovery gaps" value={gapSources.length} critical={gapSources.length > 0} />
          <Metric label="Dead-letter jobs" value={deadJobs.length} critical={deadJobs.length > 0} />
          <Metric label="Scheduler jobs" value={data.scheduler.length} />
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold">Official source registry</h2>
        <div className="mt-4 space-y-4">
          {data.registry.map((entry) => {
            const degraded = entry.health?.health_state && entry.health.health_state !== 'HEALTHY';
            return <article key={entry.identity.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="font-semibold text-zinc-100">{entry.source?.display_name ?? entry.identity.platform_identity_id ?? entry.identity.id}</h3><p className="mt-1 text-sm text-zinc-500">{entry.identity.platform} · {entry.identity.connector_type} · {entry.identity.access_mode}</p></div>
                <span className={pill(entry.health?.health_state ?? 'UNKNOWN', Boolean(degraded))}>{entry.health?.health_state ?? 'UNKNOWN'}</span>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <Info label="Authority" value={entry.source ? `Tier ${entry.source.authority_tier}${entry.source.source_role ? ` · ${entry.source.source_role}` : ''}` : '—'} />
                <Info label="Channel / identity" value={entry.youtube?.channel_id ?? entry.identity.platform_identity_id ?? '—'} />
                <Info label="Last discovery check" value={fmt(entry.youtube?.last_fallback_check_at)} />
                <Info label="Next discovery check" value={fmt(entry.youtube?.next_fallback_check_at)} />
                <Info label="Latest item" value={entry.youtube?.latest_known_video_id ?? '—'} />
                <Info label="Discovery gap count" value={String(entry.youtube?.fallback_gap_count ?? 0)} critical={(entry.youtube?.fallback_gap_count ?? 0) > 0} />
                <Info label="Last WebSub" value={fmt(entry.youtube?.last_websub_at)} />
                <Info label="WebSub lease" value={entry.subscription ? `${entry.subscription.state} · gen ${entry.subscription.generation}` : '—'} />
              </div>
              {entry.health?.last_error_code && <div className="mt-4 rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 text-sm text-amber-200"><strong>{entry.health.last_error_code}</strong>{entry.health.last_error_message ? ` — ${entry.health.last_error_message}` : ''}</div>}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-500"><span>Last success {fmt(entry.health?.last_success_at)}</span><span>Last item {fmt(entry.health?.last_item_at)}</span><span>Lease expires {fmt(entry.subscription?.expires_at)}</span><span>Renew after {fmt(entry.subscription?.renew_after)}</span></div>
            </article>;
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-semibold">Scheduler</h2>
          <div className="mt-4 space-y-3">{data.scheduler.map((job) => <div key={String(job.job_id)} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-zinc-200">{job.job_name}</p><span className={pill(job.latest_status ?? 'NO RUN', job.latest_status != null && job.latest_status !== 'succeeded')}>{job.latest_status ?? 'NO RUN'}</span></div><p className="mt-2 text-xs text-zinc-500">{job.schedule} · latest {fmt(job.latest_start_at)} · {job.active ? 'active' : 'disabled'}</p></div>)}</div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-semibold">YouTube quota</h2>
          <p className="mt-1 text-xs text-zinc-500">Recorded quota day {data.quota.usageDay ?? '—'}</p>
          <div className="mt-4 space-y-3">{data.quota.methods.map((item) => <div key={`${item.provider}:${item.quotaBucket}:${item.method}`} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"><div><p className="text-sm text-zinc-200">{item.method}</p><p className="mt-1 text-xs text-zinc-500">{item.provider} · {item.quotaBucket}</p></div><div className="text-right"><p className="font-semibold">{item.units} units</p><p className="text-xs text-zinc-500">{item.requests} requests</p></div></div>)}</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-semibold">Recent WebSub telemetry</h2>
          <div className="mt-4 max-h-[420px] space-y-3 overflow-auto pr-1">{data.receipts.length === 0 ? <p className="text-sm text-zinc-500">No WebSub receipts yet.</p> : data.receipts.map((receipt, index) => <div key={`${receipt.provider}:${receipt.external_key}:${index}`} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"><div className="flex flex-wrap items-center gap-2"><span className={pill(receipt.status, receipt.status === 'REJECTED' || receipt.status === 'FAILED')}>{receipt.status}</span><span className="text-xs text-zinc-500">{receipt.provider}</span></div><p className="mt-2 break-all text-xs text-zinc-400">{receipt.external_key}</p><p className="mt-2 text-xs text-zinc-500">{fmt(receipt.received_at)}{receipt.error_message ? ` · ${receipt.error_message}` : ''}</p></div>)}</div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-semibold">Recent worker jobs</h2>
          <div className="mt-4 max-h-[420px] space-y-3 overflow-auto pr-1">{data.jobs.recent.slice(0, 40).map((job, index) => <div key={`${job.job_type}:${job.created_at}:${index}`} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm text-zinc-200">{job.job_type}</p><span className={pill(job.state, job.state === 'DEAD_LETTER' || job.state === 'RETRY_WAIT')}>{job.state}</span></div><p className="mt-2 text-xs text-zinc-500">attempt {job.attempt_count}/{job.max_attempts} · created {fmt(job.created_at)}</p>{job.last_error && <p className="mt-2 text-xs text-red-300">{job.last_error}</p>}</div>)}</div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, critical = false }: { label: string; value: number; critical?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${critical ? 'border-red-800 bg-red-950/30' : 'border-zinc-800 bg-zinc-950/70'}`}><p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}

function Info({ label, value, critical = false }: { label: string; value: string; critical?: boolean }) {
  return <div><p className="text-xs uppercase tracking-wider text-zinc-600">{label}</p><p className={`mt-1 break-words ${critical ? 'text-red-300' : 'text-zinc-300'}`}>{value}</p></div>;
}
