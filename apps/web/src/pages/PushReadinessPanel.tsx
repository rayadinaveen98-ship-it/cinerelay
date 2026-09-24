import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../lib/supabase';

const PushReadinessSchema = z.object({
  activeFcmDevices: z.number().int().nonnegative(),
  activeDeviceUsers: z.number().int().nonnegative(),
  activeFollows: z.number().int().nonnegative(),
  activeFollowUsers: z.number().int().nonnegative(),
  pushReadyUsers: z.number().int().nonnegative(),
  canonicalDevelopingEvents: z.number().int().nonnegative(),
  highPriorityDevelopingEvents: z.number().int().nonnegative(),
  developingTargetUsers: z.number().int().nonnegative(),
  outbox: z.object({
    pending: z.number().int().nonnegative(),
    deferred: z.number().int().nonnegative(),
    sent: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    suppressed: z.number().int().nonnegative(),
  }),
});

type PushReadiness = z.infer<typeof PushReadinessSchema>;

async function fetchPushReadiness(): Promise<PushReadiness> {
  const { data, error } = await supabase.functions.invoke('cinerelay-console-api', { body: { action: 'operations' } });
  if (error) throw error;
  return PushReadinessSchema.parse((data as { pushReadiness?: unknown } | null)?.pushReadiness);
}

export function PushReadinessPanel() {
  const query = useQuery({ queryKey: ['push-readiness'], queryFn: fetchPushReadiness, refetchInterval: 30_000 });

  if (query.isPending) {
    return <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-400">Loading push readiness…</section>;
  }
  if (query.isError) {
    return <section className="rounded-3xl border border-red-900 bg-red-950/20 p-6 text-sm text-red-300">Push readiness unavailable: {query.error.message}</section>;
  }

  const data = query.data;
  const blockedReason = data.activeFcmDevices === 0
    ? 'Real-device proof is blocked because there is no active FCM target.'
    : data.pushReadyUsers === 0
      ? 'An FCM target exists, but no device user also has an active entity follow.'
      : data.developingTargetUsers === 0
        ? 'Push plumbing is ready, but no active canonical DEVELOPING event currently targets a device + follow user.'
        : 'A device + follow user currently targets an active canonical DEVELOPING event; the next naturally eligible alert can exercise the real-device path.';

  const blocked = data.activeFcmDevices === 0 || data.pushReadyUsers === 0 || data.developingTargetUsers === 0;

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">Push readiness</p>
          <h2 className="mt-2 text-xl font-semibold">Real-device alert path</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">Read-only operational counts. Raw newsroom signals remain excluded from the alert outbox; this panel measures readiness for canonical event alerts only.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${blocked ? 'border-amber-900 bg-amber-950/40 text-amber-300' : 'border-emerald-900 bg-emerald-950/40 text-emerald-300'}`}>{blocked ? 'PROOF BLOCKED' : 'TARGET READY'}</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReadinessMetric label="Active FCM devices" value={data.activeFcmDevices} critical={data.activeFcmDevices === 0} />
        <ReadinessMetric label="Device users" value={data.activeDeviceUsers} critical={data.activeDeviceUsers === 0} />
        <ReadinessMetric label="Active follows" value={data.activeFollows} critical={data.activeFollows === 0} />
        <ReadinessMetric label="Device + follow users" value={data.pushReadyUsers} critical={data.pushReadyUsers === 0} />
        <ReadinessMetric label="Developing events" value={data.canonicalDevelopingEvents} />
        <ReadinessMetric label="High/critical developing" value={data.highPriorityDevelopingEvents} />
        <ReadinessMetric label="Developing target users" value={data.developingTargetUsers} critical={data.developingTargetUsers === 0} />
        <ReadinessMetric label="Failed pushes" value={data.outbox.failed} critical={data.outbox.failed > 0} />
      </div>

      <div className={`mt-5 rounded-2xl border p-4 text-sm ${blocked ? 'border-amber-900/60 bg-amber-950/20 text-amber-200' : 'border-emerald-900/60 bg-emerald-950/20 text-emerald-200'}`}>{blockedReason}</div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
        <span>Push outbox pending {data.outbox.pending}</span>
        <span>deferred {data.outbox.deferred}</span>
        <span>sent {data.outbox.sent}</span>
        <span>suppressed {data.outbox.suppressed}</span>
      </div>
    </section>
  );
}

function ReadinessMetric({ label, value, critical = false }: { label: string; value: number; critical?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${critical ? 'border-amber-900/60 bg-amber-950/20' : 'border-zinc-800 bg-zinc-950/70'}`}><p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p><p className={`mt-2 text-2xl font-semibold ${critical ? 'text-amber-300' : 'text-zinc-100'}`}>{value}</p></div>;
}
