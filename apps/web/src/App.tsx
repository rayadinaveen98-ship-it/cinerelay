import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { useAuth } from './auth/AuthProvider';
import { fetchConsoleFeed, fetchConsoleOverview } from './lib/console-api';

function LoadingScreen() {
  return <main className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-300">Loading CineRelay…</main>;
}

function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim());
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send sign-in link');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-950 px-6 text-zinc-100">
      <section className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl shadow-black/30">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">CineRelay</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Intelligence Console</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">Private operator access to source-backed cinema intelligence.</p>
        </div>
        {sent ? (
          <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/30 p-4 text-sm text-emerald-200">Check your email for the secure sign-in link. Access still requires an active CineRelay operator allowlist entry.</div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <label className="block text-sm font-medium text-zinc-300" htmlFor="email">Operator email</label>
            <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-500" placeholder="you@example.com" />
            <button disabled={submitting} className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50">{submitting ? 'Sending…' : 'Send secure sign-in link'}</button>
            {error && <p className="text-sm text-red-300">{error}</p>}
          </form>
        )}
      </section>
    </main>
  );
}

function Shell() {
  const { session, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-400">CineRelay</p><p className="mt-1 text-sm text-zinc-400">Internal Intelligence Console</p></div>
          <div className="flex items-center gap-4 text-sm"><span className="hidden text-zinc-500 sm:inline">{session?.user.email}</span><button onClick={() => void signOut()} className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-300 hover:border-zinc-500 hover:text-white">Sign out</button></div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 md:grid-cols-[220px_1fr]">
        <nav className="space-y-2">
          <Link to="/" className="block rounded-xl px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-900 [&.active]:bg-zinc-900 [&.active]:text-white">Overview</Link>
          <Link to="/feed" className="block rounded-xl px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-900 [&.active]:bg-zinc-900 [&.active]:text-white">Live feed</Link>
          <Link to="/health" className="block rounded-xl px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-900 [&.active]:bg-zinc-900 [&.active]:text-white">System health</Link>
        </nav>
        <Outlet />
      </div>
    </div>
  );
}

function OverviewPage() {
  const overview = useQuery({ queryKey: ['console-overview'], queryFn: fetchConsoleOverview, refetchInterval: 60_000 });
  if (overview.isPending) return <Panel title="Overview"><p className="text-zinc-400">Reading the live CineRelay backend…</p></Panel>;
  if (overview.isError) return <AccessError error={overview.error} />;
  const cards = [['Official sources', overview.data.counts.sources], ['Raw items', overview.data.counts.rawItems], ['Canonical events', overview.data.counts.events], ['Unresolved', overview.data.counts.unresolved]] as const;
  return <div className="space-y-6"><Panel title="Production overview" eyebrow={`Updated ${new Date(overview.data.generatedAt).toLocaleString()}`}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <Metric key={label} label={label} value={value} />)}</div></Panel><Panel title="Operator boundary" eyebrow="Authenticated + allowlisted"><p className="text-sm leading-6 text-zinc-400">Signed in as <span className="text-zinc-200">{overview.data.operator.displayName ?? overview.data.operator.email ?? overview.data.operator.userId}</span>. Privileged database credentials remain server-side.</p></Panel></div>;
}

function FeedPage() {
  const feed = useQuery({ queryKey: ['console-feed'], queryFn: () => fetchConsoleFeed(50), refetchInterval: 30_000 });
  if (feed.isPending) return <Panel title="Live intelligence feed"><p className="text-zinc-400">Loading canonical events and evidence…</p></Panel>;
  if (feed.isError) return <AccessError error={feed.error} />;
  return (
    <Panel title="Live intelligence feed" eyebrow={`Updated ${new Date(feed.data.generatedAt).toLocaleString()}`}>
      {feed.data.items.length === 0 ? <p className="text-sm text-zinc-500">No canonical events yet.</p> : <div className="space-y-3">{feed.data.items.map((item) => (
        <article key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-zinc-500"><span>{item.eventType.replaceAll('_', ' ')}</span><span>•</span><span>{item.verificationState}</span><span>•</span><span>{item.priorityBand}</span><span>•</span><span>{new Date(item.detectedAt).toLocaleString()}</span></div>
          <h2 className="mt-3 text-lg font-semibold text-zinc-100">{item.headline}</h2>
          <p className="mt-1 text-sm text-amber-300">{item.entityName ?? 'Unresolved entity'}</p>
          {item.summary && <p className="mt-3 text-sm leading-6 text-zinc-400">{item.summary}</p>}
          {item.evidence && <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm"><div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-500"><span>Source: <strong className="font-medium text-zinc-300">{item.evidence.sourceName ?? 'Unknown'}</strong></span><span>Evidence: <strong className="font-medium text-zinc-300">{item.evidence.role ?? '—'}</strong></span><span>Published: <strong className="font-medium text-zinc-300">{item.evidence.publishedAt ? new Date(item.evidence.publishedAt).toLocaleString() : '—'}</strong></span></div>{item.evidence.rawTitle && <p className="mt-2 text-zinc-300">{item.evidence.rawTitle}</p>}{item.evidence.canonicalUrl && <a href={item.evidence.canonicalUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-amber-400 hover:text-amber-300">Open official evidence ↗</a>}</div>}
        </article>
      ))}</div>}
    </Panel>
  );
}

function HealthPage() {
  const overview = useQuery({ queryKey: ['console-overview'], queryFn: fetchConsoleOverview, refetchInterval: 30_000 });
  if (overview.isPending) return <Panel title="System health"><p className="text-zinc-400">Loading health state…</p></Panel>;
  if (overview.isError) return <AccessError error={overview.error} />;
  const health = overview.data.health;
  return <Panel title="System health" eyebrow="Real production state"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Healthy" value={health.healthy} /><Metric label="Degraded" value={health.degraded} /><Metric label="Rate limited" value={health.rateLimited} /><Metric label="Budget exhausted" value={health.budgetExhausted} /><Metric label="Discovery gaps" value={health.gapSources} critical={health.gapSources > 0} /></div><p className="mt-5 text-sm leading-6 text-zinc-500">A WebSub miss can degrade accelerator health without implying data loss. Discovery gaps are the correctness alarm.</p></Panel>;
}

function Metric({ label, value, critical = false }: { label: string; value: number; critical?: boolean }) { return <div className={`rounded-2xl border p-5 ${critical ? 'border-red-800 bg-red-950/30' : 'border-zinc-800 bg-zinc-950/70'}`}><p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>; }
function Panel({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6"><div className="mb-5 flex items-end justify-between gap-4"><h1 className="text-xl font-semibold">{title}</h1>{eyebrow && <span className="text-xs text-zinc-500">{eyebrow}</span>}</div>{children}</section>; }
function AccessError({ error }: { error: Error }) { return <Panel title="Console access unavailable"><p className="text-sm leading-6 text-red-300">{error.message}</p><p className="mt-3 text-sm text-zinc-500">Authentication alone is not enough. Your Supabase user must also have an active row in `operator_users`.</p></Panel>; }

const rootRoute = createRootRoute({ component: Shell });
const overviewRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: OverviewPage });
const feedRoute = createRoute({ getParentRoute: () => rootRoute, path: '/feed', component: FeedPage });
const healthRoute = createRoute({ getParentRoute: () => rootRoute, path: '/health', component: HealthPage });
const routeTree = rootRoute.addChildren([overviewRoute, feedRoute, healthRoute]);
const router = createRouter({ routeTree });

declare module '@tanstack/react-router' { interface Register { router: typeof router } }

export function App() {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <SignInScreen />;
  return <RouterProvider router={router} />;
}
