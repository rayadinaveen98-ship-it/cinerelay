import {
  buildCreatorVideoStatsUrl,
  parseCreatorVideoStats,
  planCreatorMetrics,
} from './creator-intelligence.js';

// Self-contained declaration types: Deno's edge bundler resolves emitted .d.ts
// files via .js imports and cannot safely infer TS-only exports from JS runtime.
export type CreatorC4VideoCandidate = {
  videoId: string;
  channelId: string;
  publishedAt: string;
  lastObservedAt?: string | null;
};
export type CreatorCounterSample = {
  videoId: string;
  observedAt: string;
  viewCount: string | null;
  likeCount: string | null;
  commentCount: string | null;
  expiresAt: string;
};
export type C4StatsResponse = { status: number; body?: unknown };
export type CreatorC4Dependencies = {
  reserveQuota: (videoCount: number) => Promise<number | null>;
  fetchStats: (urlWithoutKey: string) => Promise<C4StatsResponse>;
  persistSamples: (samples: readonly CreatorCounterSample[]) => Promise<void>;
  finalizeQuota: (id: number, responseStatus: number | null, state: string) => Promise<void>;
  observedClock?: () => string;
};
export type CreatorC4Outcome = {
  state: 'NO_DUE_VIDEOS'|'QUOTA_EXHAUSTED'|'COLLECTED'|'EMPTY_PUBLIC_STATS'|
    'HTTP_ERROR'|'TRANSPORT_ERROR'|'BAD_PROVIDER_RESULT'|'PERSIST_FAILED';
  quotaReserved: boolean;
  attemptedVideos: number;
  persistedVideos: number;
  providerFailedVideos: number;
  requestStatus: number | null;
};

/**
 * C4 executes at most ONE public metrics request per explicit operator invocation.
 * It cannot discover/activate channels and does not touch film/event/notification data.
 * A DB reservation must be persisted BEFORE any external YouTube request.
 */
export async function collectOneCreatorMetricsBatch(
  now: string,
  candidates: readonly CreatorC4VideoCandidate[],
  dependencies: CreatorC4Dependencies,
): Promise<CreatorC4Outcome> {
  const plan = planCreatorMetrics({
    videos: candidates, now, dailyQuotaUnits: 1, quotaUsedToday: 0,
    reserveUnits: 0, maxRequestsPerTick: 1, maxVideosPerRequest: 50,
  });
  const ids = plan.batches[0] ?? [];
  const base = {quotaReserved:false,attemptedVideos:ids.length,
    persistedVideos:0,providerFailedVideos:0,requestStatus:null};
  if (ids.length === 0) return {state:'NO_DUE_VIDEOS',...base};

  const reservation = await dependencies.reserveQuota(ids.length);
  if (reservation === null) return {state:'QUOTA_EXHAUSTED',...base};
  if (!Number.isSafeInteger(reservation) || reservation < 1) throw new Error('Bad quota reservation ID');
  const charged = {...base,quotaReserved:true};
  let httpStatus:number|null = null,phase = 'TRANSPORT_ERROR';
  try {
    const response = await dependencies.fetchStats(buildCreatorVideoStatsUrl(ids));
    httpStatus = response.status;
    if(!Number.isInteger(httpStatus) || httpStatus < 100 || httpStatus > 599){
      phase = 'BAD_HTTP_STATUS';
      return {state:'BAD_PROVIDER_RESULT',...charged};
    }
    if(httpStatus !== 200){
      phase = 'UPSTREAM_HTTP_ERROR';
      return {state:'HTTP_ERROR',...charged,requestStatus:httpStatus};
    }
    // Timestamp the observation AFTER the provider response, not at planning.
    const observedAt = (dependencies.observedClock ?? (()=>new Date().toISOString()))();
    let parsed:ReturnType<typeof parseCreatorVideoStats>;
    try { parsed = parseCreatorVideoStats(response.body, observedAt); }
    catch { phase='REJECTED_PROVIDER_SCHEMA'; return {state:'BAD_PROVIDER_RESULT',...charged,requestStatus:httpStatus}; }
    const expected = new Set(ids);
    const returned = new Set([...parsed.counters.map(x=>x.videoId),...parsed.failedVideoIds]);
    if (returned.size !== ids.length || [...returned].some(id=>!expected.has(id))){
      phase='REJECTED_PROVIDER_VIDEO_IDS';
      return {state:'BAD_PROVIDER_RESULT',...charged,requestStatus:httpStatus};
    }
    const milliseconds=Date.parse(observedAt);
    if(!Number.isFinite(milliseconds)){
      phase='BAD_OBSERVATION_CLOCK';
      return {state:'BAD_PROVIDER_RESULT',...charged,requestStatus:httpStatus};
    }
    const expiresAt=new Date(milliseconds+30*86_400_000).toISOString();
    const samples:CreatorCounterSample[] = parsed.counters
      .filter(x=>x.viewCount!==null || x.likeCount!==null || x.commentCount!==null)
      .map(x=>({...x,expiresAt}));
    if(samples.length===0){
      phase='NO_PUBLIC_STATS';
      return {state:'EMPTY_PUBLIC_STATS',...charged,providerFailedVideos:parsed.failedVideoIds.length,requestStatus:httpStatus};
    }
    try { await dependencies.persistSamples(samples); }
    catch { phase='PERSIST_REJECTED'; return {state:'PERSIST_FAILED',...charged,providerFailedVideos:parsed.failedVideoIds.length,requestStatus:httpStatus}; }
    phase='PERSISTED';
    return {state:'COLLECTED',...charged,requestStatus:httpStatus,
      persistedVideos:samples.length,providerFailedVideos:parsed.failedVideoIds.length};
  } catch {
    phase='NETWORK_OR_RUNTIME_FAILURE';
    return {state:'TRANSPORT_ERROR',...charged,requestStatus:httpStatus};
  } finally {
    // Charged whether provider HTTP fails, parser fails or DB refuses storage.
    // Reservation never refunds units. If this audit update fails, caller fails
    // rather than claiming that it completed reliably.
    await dependencies.finalizeQuota(reservation,httpStatus,phase);
  }
}
