/**
 * Creator Intelligence C1: pure, NO-NETWORK / NO-DATABASE gate.
 *
 * Public video statistics use the official 2026 videos.batchGetStats endpoint,
 * billed to a SEPARATE quota bucket from channels.list / playlistItems.list.
 * Never schedule jobs or write historical snapshots from this module.
 *
 * Docs: https://developers.google.com/youtube/data/reference/rest/v3/videos/batchGetStats
 *       https://developers.google.com/youtube/data/revision_history
 */
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const DAY_MS = 86_400_000;
const RETENTION_DAYS = 30;

export const CREATOR_YOUTUBE_QUOTA_2026 = Object.freeze({
  asOf: '2026-10-28',
  generalReadBucket: 'GENERAL_READ',
  batchStatsBucket: 'VIDEO_BATCH_STATS',
  defaultGeneralReadDailyUnits: 10_000,
  defaultBatchStatsDailyUnits: 10_000,
  batchGetStatsUnitsPerRequest: 1,
  channelsListUnitsPerRequest: 1,
  playlistItemsListUnitsPerRequest: 1,
  conservativeBatchVideoLimit: 50, // OUR unverified safety cap, not a provider maximum claim
  retentionDays: RETENTION_DAYS,
});

function nonnegative(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(name + ' must be a nonnegative safe integer');
}
function positive(name: string, value: number): void {
  nonnegative(name, value);
  if (value === 0) throw new RangeError(name + ' must be positive');
}
function timestamp(name: string, value: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new RangeError(name + ' must be an ISO datetime');
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new RangeError(name + ' must be a valid datetime');
  return time;
}
function record(x: unknown): Record<string, unknown> | null {
  return x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : null;
}

export function normalizeCreatorHandle(raw: string): string {
  if (typeof raw !== 'string') throw new Error('handle must be text');
  const h = raw.trim().startsWith('@') ? raw.trim() : '@' + raw.trim();
  if (!/^@[\p{L}\p{M}\p{N}._-]{3,30}$/u.test(h)) throw new Error('ambiguous handle; human identity review required');
  return h;
}

export function buildCreatorChannelLookupUrl(rawHandle: string): string {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'snippet,contentDetails,statistics');
  url.searchParams.set('forHandle', normalizeCreatorHandle(rawHandle));
  return url.toString(); // Deliberately excludes private API credentials
}
export type CreatorIdentityAssessment = {
  state: 'VERIFIED_NEW' | 'ALREADY_MONITORED' | 'NOT_FOUND' | 'REVIEW_REQUIRED';
  channelId: string | null;
  title: string | null;
  uploadsPlaylistId: string | null;
  subscriberCountApprox: string | null;
  subscriberHidden: boolean;
  reason: string;
};
/** Caller must obtain the EXACT forHandle result from YouTube. No name guessing. */
export function assessCreatorChannelLookup(
  payload: unknown,
  existingChannelIds: readonly string[],
): CreatorIdentityAssessment {
  const root = record(payload), items = root?.items;
  if (!Array.isArray(items)) throw new Error('Malformed YouTube channels.list response');
  const notFound: CreatorIdentityAssessment = {
    state:'NOT_FOUND', channelId:null, title:null, uploadsPlaylistId:null,
    subscriberCountApprox:null, subscriberHidden:false, reason:'No exact handle match returned',
  };
  if (!items.length) return notFound;
  if (items.length !== 1) throw new Error('Ambiguous handle response');
  const channel = record(items[0]), snippet = record(channel?.snippet),
    details = record(channel?.contentDetails), playlists = record(details?.relatedPlaylists),
    stats = record(channel?.statistics);
  const id = channel?.id, title = snippet?.title, uploads = playlists?.uploads;
  if (typeof id !== 'string' || !CHANNEL_ID.test(id) ||
      typeof title !== 'string' || !title.trim() ||
      typeof uploads !== 'string' || !/^UU[A-Za-z0-9_-]{22}$/.test(uploads)) {
    return { ...notFound, state:'REVIEW_REQUIRED', reason:'Official channel response missing stable ID, title or uploads playlist' };
  }
  const count = stats?.subscriberCount;
  const subscriberCountApprox = typeof count === 'string' && /^\d+$/.test(count) ? count : null;
  const subscriberHidden = stats?.hiddenSubscriberCount === true;
  const duplicate = existingChannelIds.includes(id);
  return {
    state: duplicate ? 'ALREADY_MONITORED' : 'VERIFIED_NEW',
    channelId:id, title:title.trim(), uploadsPlaylistId:uploads,
    subscriberCountApprox: subscriberHidden ? null : subscriberCountApprox,
    subscriberHidden, reason:duplicate?'Already present by stable UC channel ID':'Official handle lookup resolved; still requires operator approval',
  };
}

/** Public-only stats request, returns no secret and has no network side effects. */
export function buildCreatorVideoStatsUrl(videoIds: readonly string[]): string {
  if (!videoIds.length || videoIds.length > CREATOR_YOUTUBE_QUOTA_2026.conservativeBatchVideoLimit) {
    throw new RangeError('Only 1–50 public video IDs permitted per safe batch');
  }
  const ids = new Set<string>();
  for(const id of videoIds){
    if(!VIDEO_ID.test(id) || ids.has(id))throw new Error('Invalid or duplicate YouTube video ID');
    ids.add(id);
  }
  const url = new URL('https://www.googleapis.com/youtube/v3/videos:batchGetStats');
  url.searchParams.set('part','statistics');
  url.searchParams.set('id',[...ids].join(','));
  return url.toString();
}

export type PublicVideoCounter = {
  videoId: string;
  observedAt: string;
  viewCount: string | null;
  likeCount: string | null;
  commentCount: string | null;
  // Never turn omitted / hidden counters into zero.
};
function publicCount(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('Malformed public video counter');
  return value;
}
/** Parse only current public API results; never impute past hourly observations. */
export function parseCreatorVideoStats(payload: unknown, observedAt: string): {
  counters: PublicVideoCounter[];
  failedVideoIds: string[];
} {
  timestamp('observedAt', observedAt);
  const root = record(payload), items = root?.items, summary = record(root?.summary);
  if (!Array.isArray(items) || !summary) throw new Error('Malformed videos.batchGetStats payload');
  // The API may omit an optional failedVideoIds array when every video works.
  const failed = summary.failedVideoIds ?? [];
  if (!Array.isArray(failed)) throw new Error('Malformed failed-video summary');
  const failedVideoIds: string[] = [];
  for (const x of failed) {
    if (typeof x !== 'string' || !VIDEO_ID.test(x)) throw new Error('Invalid failed video ID');
    failedVideoIds.push(x);
  }
  const seen = new Set<string>();
  const counters: PublicVideoCounter[] = [];
  for (const item of items) {
    const video = record(item), id = video?.id;
    if (typeof id !== 'string' || !VIDEO_ID.test(id) || seen.has(id)) throw new Error('Invalid or duplicate video ID');
    seen.add(id);
    const stats = record(video?.statistics);
    if (!stats) throw new Error('Missing statistics part');
    counters.push({videoId:id,observedAt,
      viewCount:publicCount(stats.viewCount),
      likeCount:publicCount(stats.likeCount),
      commentCount:publicCount(stats.commentCount)});
  }
  if (failedVideoIds.some(id=>seen.has(id))) throw new Error('Video cannot both succeed and fail');
  return {counters,failedVideoIds};
}

export type CreatorMetricVideo = {
  videoId:string;
  channelId:string;
  publishedAt:string;
  lastObservedAt?:string | null;
};
export type CreatorMetricPlanInput = {
  videos: readonly CreatorMetricVideo[];
  now: string;
  dailyQuotaUnits: number;
  quotaUsedToday: number;
  reserveUnits: number;
  maxRequestsPerTick: number;
  maxVideosPerRequest?: number;
};
/**
 * Fair, quota-safe admission plan. Every channel gets its oldest overdue video
 * before the next round; a single hyperactive channel cannot crowd out others.
 */
export function planCreatorMetrics(input: CreatorMetricPlanInput): {
  quotaBucket:'VIDEO_BATCH_STATS';
  batches:string[][];
  requestedUnits:number;
  remainingQuotaUnits:number;
  dueVideos:number;
  deferredDueVideos:number;
  ignoredOutsideRetention:number;
} {
  const {videos,now,dailyQuotaUnits,quotaUsedToday,reserveUnits,maxRequestsPerTick}=input;
  for(const [n,v] of Object.entries({dailyQuotaUnits,quotaUsedToday,reserveUnits,maxRequestsPerTick})) nonnegative(n,v);
  const perRequest = input.maxVideosPerRequest ?? 50;
  positive('maxVideosPerRequest',perRequest);
  if (perRequest > CREATOR_YOUTUBE_QUOTA_2026.conservativeBatchVideoLimit) throw new RangeError('Unverified batch size > 50 refused');
  if (reserveUnits > dailyQuotaUnits) throw new RangeError('reserve exceeds quota');
  const at = timestamp('now',now);
  const remainingQuotaUnits = Math.max(0,dailyQuotaUnits-reserveUnits-quotaUsedToday);
  const requestCap = Math.min(maxRequestsPerTick,remainingQuotaUnits);
  const channelQueues = new Map<string,Array<{id:string;overdue:number}>>();
  const seen = new Set<string>();
  let ignoredOutsideRetention=0;
  for(const video of videos) {
    if (!VIDEO_ID.test(video.videoId) || !CHANNEL_ID.test(video.channelId)) throw new Error('Invalid video/channel ID');
    if(seen.has(video.videoId)) continue;
    seen.add(video.videoId);
    const published=timestamp('publishedAt',video.publishedAt),age=at-published;
    if (age<0) continue; // scheduled premieres/private uploads are not public observations
    if(age>RETENTION_DAYS*DAY_MS){ignoredOutsideRetention++;continue;}
    const cadenceMs=age<3*DAY_MS?60*60_000:age<7*DAY_MS?6*60*60_000:DAY_MS;
    const last=video.lastObservedAt == null ? null : timestamp('lastObservedAt',video.lastObservedAt);
    if(last!==null && last>at)throw new Error('Future lastObservedAt refused');
    const overdue = last === null ? at-published : at-last-cadenceMs;
    if(last!==null && overdue<0)continue;
    const q=channelQueues.get(video.channelId)??[];
    q.push({id:video.videoId,overdue});
    channelQueues.set(video.channelId,q);
  }
  for(const q of channelQueues.values())q.sort((a,b)=>b.overdue-a.overdue||a.id.localeCompare(b.id));
  const channelIds=[...channelQueues.keys()].sort((a,b)=>{
    const ap=channelQueues.get(a)?.[0]?.overdue ?? -Infinity, bp=channelQueues.get(b)?.[0]?.overdue ?? -Infinity;
    return bp-ap||a.localeCompare(b);
  });
  const dueVideos=[...channelQueues.values()].reduce((n,q)=>n+q.length,0);
  const selected:string[]=[];
  const maxVideos=requestCap*perRequest;
  while(selected.length<maxVideos) {
    let progressed=false;
    for(const channel of channelIds){
      if(selected.length>=maxVideos)break;
      const item=channelQueues.get(channel)!.shift();
      if(item){selected.push(item.id);progressed=true;}
    }
    if(!progressed)break;
  }
  const batches:string[][]=[];
  for(let i=0;i<selected.length;i+=perRequest)batches.push(selected.slice(i,i+perRequest));
  return {quotaBucket:'VIDEO_BATCH_STATS',batches,requestedUnits:batches.length,
    remainingQuotaUnits,dueVideos,deferredDueVideos:dueVideos-selected.length,ignoredOutsideRetention};
}

export function estimateCreatorDiscoveryBudget(input: {
  newChannels:number;
  channelLookupRequests:number;
  playlistChecksPerChannelPerDay:number;
  existingGeneralReadUnits:number;
  otherGeneralReadUnits:number;
  dailyGeneralReadUnits:number;
  reserveUnits:number;
}): {quotaBucket:'GENERAL_READ';additionalUnits:number;totalProjectedUnits:number;safe:boolean;headroom:number} {
  for(const [name,value] of Object.entries(input))nonnegative(name,value);
  if(input.reserveUnits>input.dailyGeneralReadUnits)throw new RangeError('reserve exceeds quota');
  const additionalUnits=input.channelLookupRequests+input.newChannels*input.playlistChecksPerChannelPerDay;
  const totalProjectedUnits=input.existingGeneralReadUnits+input.otherGeneralReadUnits+additionalUnits;
  const headroom=input.dailyGeneralReadUnits-input.reserveUnits-totalProjectedUnits;
  if(!Number.isSafeInteger(additionalUnits)||!Number.isSafeInteger(totalProjectedUnits))throw new RangeError('quota arithmetic overflow');
  return {quotaBucket:'GENERAL_READ',additionalUnits,totalProjectedUnits,safe:headroom>=0,headroom};
}
