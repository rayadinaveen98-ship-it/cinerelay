import { createClient } from '@supabase/supabase-js';
// @deno-types="../../../packages/youtube-connector/dist/creator-metric-collector.d.ts"
import { collectOneCreatorMetricsBatch } from '../../../packages/youtube-connector/dist/creator-metric-collector.js';
type CreatorMetricVideo = {
  videoId:string; channelId:string; publishedAt:string; lastObservedAt?:string|null;
};

// This function is intentionally NOT scheduled and NOT deployed in C4.
// Requires an explicit verified provider quota and operator-reviewed channels.
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalKey = Deno.env.get('CINERELAY_INTERNAL_ADMIN_SECRET');
const youtubeKey = Deno.env.get('YOUTUBE_API_KEY');
const isEnabled = Deno.env.get('CINERELAY_CREATOR_STATS_ENABLED') === 'true';
const verifiedDailyLimit = Number(Deno.env.get('CINERELAY_CREATOR_VERIFIED_VIDEO_STATS_DAILY_LIMIT') ?? '0');
const quotaReserve = Number(Deno.env.get('CINERELAY_CREATOR_VIDEO_STATS_RESERVE') ?? '100');
const supabase = supabaseUrl && serviceKey
  ? createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
  : null;

function json(status:number,value:Record<string,unknown>):Response {
  return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
}
function authorized(request:Request):boolean {
  const supplied=request.headers.get('x-cinerelay-internal-key') ?? '';
  if(!internalKey || supplied.length!==internalKey.length)return false;
  let difference=0;
  for(let i=0;i<supplied.length;i++)difference|=supplied.charCodeAt(i)^internalKey.charCodeAt(i);
  return difference===0;
}
function validConfig():boolean {
  return Boolean(supabase && youtubeKey && internalKey && supabaseUrl) &&
    Number.isSafeInteger(verifiedDailyLimit) && verifiedDailyLimit>=1 && verifiedDailyLimit<=10000 &&
    Number.isSafeInteger(quotaReserve) && quotaReserve>=0 && quotaReserve<verifiedDailyLimit;
}
type DueRow = {
  video_id:string;channel_id:string;published_at:string;last_observed_at:string|null;
};

Deno.serve(async(request:Request):Promise<Response>=>{
  if(request.method!=='POST')return json(405,{ok:false,error:'METHOD_NOT_ALLOWED'});
  if(!authorized(request))return json(401,{ok:false,error:'UNAUTHORIZED'});
  if(!isEnabled)return json(503,{ok:false,error:'CREATOR_METRICS_DISABLED'});
  if(!validConfig())return json(503,{ok:false,error:'CREATOR_QUOTA_NOT_VERIFIED_OR_CONFIG_MISSING'});
  try {
    const now=new Date().toISOString();
    const {data,error}=await supabase!.rpc('creator_intelligence_metric_candidates',{p_limit:2000});
    if(error || !Array.isArray(data))return json(503,{ok:false,error:'CREATOR_CANDIDATES_UNAVAILABLE'});
    const videos:CreatorMetricVideo[]=(data as DueRow[]).map(x=>({
      videoId:x.video_id,channelId:x.channel_id,
      publishedAt:new Date(x.published_at).toISOString(),
      lastObservedAt:x.last_observed_at ? new Date(x.last_observed_at).toISOString():null,
    }));
    const output=await collectOneCreatorMetricsBatch(now,videos,{
      reserveQuota:async(count)=>{
        const {data,error}=await supabase!.rpc('creator_intelligence_reserve_stats_quota',{
          p_daily_limit:verifiedDailyLimit,p_reserve:quotaReserve,p_video_count:count,
        });
        if(error)throw new Error('CREATOR_QUOTA_RESERVATION_FAILED');
        return data===null?null:Number(data);
      },
      fetchStats:async(urlWithoutKey)=>{
        const url=new URL(urlWithoutKey);
        if(url.origin!=='https://www.googleapis.com' || url.pathname!=='/youtube/v3/videos:batchGetStats'){
          throw new Error('WRONG_PROVIDER_URL');
        }
        url.searchParams.set('key',youtubeKey!);
        // Credential and complete URL are never printed, stored or returned.
        const response=await fetch(url.toString(),{headers:{accept:'application/json'},signal:AbortSignal.timeout(18000)});
        return {status:response.status,body:response.status===200 ? await response.json():undefined};
      },
      persistSamples:async(samples)=>{
        const {error}=await supabase!.from('creator_intelligence_metric_samples').upsert(
          samples.map(x=>({
            video_id:x.videoId,observed_at:x.observedAt,
            view_count:x.viewCount,like_count:x.likeCount,comment_count:x.commentCount,
            quota_bucket:'VIDEO_BATCH_STATS',expires_at:x.expiresAt,
          })),
          {onConflict:'video_id,observed_at',ignoreDuplicates:true},
        );
        if(error)throw new Error('CREATOR_METRIC_SAVE_REJECTED');
      },
      finalizeQuota:async(id,responseStatus,state)=>{
        const {data,error}=await supabase!.from('connector_quota_usage').update({
          response_status:responseStatus,
          metadata:{purpose:'CREATOR_INTELLIGENCE_C4',state},
        }).eq('id',id).eq('quota_bucket','VIDEO_BATCH_STATS')
          .eq('method','videos.batchGetStats').select('id');
        if(error || !data || data.length!==1)throw new Error('CREATOR_QUOTA_AUDIT_FINALIZE_FAILED');
      }
    });
    return json(200,{ok:true,...output});
  }catch{
    return json(503,{ok:false,error:'CREATOR_COLLECTOR_INTERNAL_FAILURE'});
  }
});
