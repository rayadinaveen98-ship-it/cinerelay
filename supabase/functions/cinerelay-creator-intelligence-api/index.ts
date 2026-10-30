import { createClient } from '@supabase/supabase-js';
import { creatorComparisonApproved } from './comparison-policy.ts';

// Read-only operator analytics. Not an extension of cinema event feed or
// a consumer API. No mutations, no public metrics refresh, no quota cost.
const url=Deno.env.get('SUPABASE_URL');
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!url || !serviceKey)throw new Error('Creator operator API environment missing');
const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods':'POST, OPTIONS',
  'cache-control':'no-store',
};
const CHANNEL=/^UC[A-Za-z0-9_-]{22}$/;
const VIDEO=/^[A-Za-z0-9_-]{11}$/;
const crossChannelApproved=creatorComparisonApproved(
  Deno.env.get('CINERELAY_CREATOR_COMPARISONS_APPROVED'),
  Deno.env.get('CINERELAY_YOUTUBE_ANALYTICS_PERMISSION_REFERENCE'),
);
const json=(status:number,body:Record<string,unknown>)=>
  new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json'}});
type DbError={code?:string;message?:string}|null;
function unavailable(error:DbError):Response {
  const missing=error?.code==='42P01'||error?.code==='PGRST205';
  return json(503,{error:missing?'CREATOR_STORAGE_NOT_DEPLOYED':'CREATOR_DASHBOARD_UNAVAILABLE'});
}
async function operator(request:Request):Promise<boolean> {
  const bearer=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!bearer)return false;
  const auth=await admin.auth.getUser(bearer);
  if(auth.error||!auth.data.user)return false;
  const result=await admin.from('operator_users').select('user_id')
    .eq('user_id',auth.data.user.id).eq('active',true).maybeSingle();
  if(result.error)throw result.error;
  return Boolean(result.data);
}
async function overview():Promise<Response>{
  const [channels,videos,samples,active]=await Promise.all([
    admin.from('creator_intelligence_channels')
      .select('channel_id,canonical_title,handle,language_code,niche,verified_at,review_state,monitoring_enabled,metadata_refreshed_at',
        {count:'exact'}).order('canonical_title',{ascending:true}).limit(100),
    admin.from('creator_intelligence_videos').select('video_id',{count:'exact',head:true}),
    admin.from('creator_intelligence_metric_samples').select('video_id',{count:'exact',head:true})
      .gte('observed_at',new Date(Date.now()-30*86400000).toISOString()),
    admin.from('creator_intelligence_channels').select('channel_id',{count:'exact',head:true})
      .eq('monitoring_enabled',true),
  ]);
  const error=channels.error||videos.error||samples.error||active.error;
  if(error)return unavailable(error);
  const rows=channels.data??[];
  const total=channels.count??0,observations=samples.count??0;
  return json(200,{
    generatedAt:new Date().toISOString(),
    state:total===0?'AWAITING_VERIFIED_CHANNELS':observations===0?'AWAITING_SNAPSHOTS':'OBSERVING',
    totals:{channels:total,monitored:active.count??0,videos:videos.count??0,samplesLast30Days:observations},
    hasMoreChannels:total>rows.length,
    channels:rows.map(row=>({
      channelId:row.channel_id,title:row.canonical_title,
      handle:row.handle,language:row.language_code,niche:row.niche,
      verifiedAt:row.verified_at,reviewState:row.review_state,
      monitoringEnabled:row.monitoring_enabled,metadataRefreshedAt:row.metadata_refreshed_at,
    })),
  });
}
async function detail(channelId:string):Promise<Response>{
  if(!CHANNEL.test(channelId))return json(400,{error:'INVALID_CHANNEL_ID'});
  const record=await admin.from('creator_intelligence_channels')
    .select('channel_id,canonical_title,handle,language_code,niche,review_state,monitoring_enabled,verified_at,metadata_refreshed_at')
    .eq('channel_id',channelId).maybeSingle();
  if(record.error)return unavailable(record.error);
  if(!record.data)return json(404,{error:'CREATOR_NOT_FOUND'});
  const videos=await admin.from('creator_intelligence_videos')
    .select('video_id,published_at,content_format')
    .eq('channel_id',channelId).order('published_at',{ascending:false}).limit(10);
  if(videos.error)return unavailable(videos.error);
  const items=videos.data??[],videoIds=items.map(x=>x.video_id);
  if(videoIds.length===0){
    return json(200,{generatedAt:new Date().toISOString(),state:'AWAITING_VIDEOS',
      channel:{channelId:record.data.channel_id,title:record.data.canonical_title,handle:record.data.handle,
        language:record.data.language_code,niche:record.data.niche,reviewState:record.data.review_state,
        monitoringEnabled:record.data.monitoring_enabled,verifiedAt:record.data.verified_at,
        metadataRefreshedAt:record.data.metadata_refreshed_at},
      videos:[],samples:[],samplesTruncated:false});
  }
  // Policy-conservative rolling 30-day window, hard bounded response.
  const observations=await admin.from('creator_intelligence_counter_text')
    .select('video_id,observed_at,view_count,like_count,comment_count')
    .in('video_id',videoIds)
    .gte('observed_at',new Date(Date.now()-30*86400000).toISOString())
    .order('observed_at',{ascending:false}).limit(801);
  if(observations.error)return unavailable(observations.error);
  const rows=observations.data??[],truncated=rows.length>800;
  return json(200,{
    generatedAt:new Date().toISOString(),
    state:rows.length===0?'AWAITING_SNAPSHOTS':'OBSERVING',
    channel:{channelId:record.data.channel_id,title:record.data.canonical_title,handle:record.data.handle,
      language:record.data.language_code,niche:record.data.niche,reviewState:record.data.review_state,
      monitoringEnabled:record.data.monitoring_enabled,verifiedAt:record.data.verified_at,
      metadataRefreshedAt:record.data.metadata_refreshed_at},
    videos:items.map(v=>({videoId:v.video_id,publishedAt:v.published_at,format:v.content_format})),
    samples:rows.slice(0,800).map(s=>({videoId:s.video_id,observedAt:s.observed_at,
      viewCount:s.view_count,likeCount:s.like_count,commentCount:s.comment_count})),
    samplesTruncated:truncated,
  });
}
/**
 * C6 comparison returns ONLY two specific videos and their public cumulative
 * counters. No rankings, scores, inferred growth, or broad scraping.
 * Fail-closed permission check BEFORE any cross-channel DB reads.
 */
async function comparePair(body:Record<string,unknown>):Promise<Response>{
  if(!crossChannelApproved)return json(403,{error:'CROSS_CHANNEL_ANALYTICS_APPROVAL_REQUIRED'});
  const aChannel=body.aChannelId,bChannel=body.bChannelId,
    aVideo=body.aVideoId,bVideo=body.bVideoId;
  if(typeof aChannel!=='string'||!CHANNEL.test(aChannel)||
     typeof bChannel!=='string'||!CHANNEL.test(bChannel)||
     typeof aVideo!=='string'||!VIDEO.test(aVideo)||
     typeof bVideo!=='string'||!VIDEO.test(bVideo)||
     aChannel===bChannel || aVideo===bVideo){
    return json(400,{error:'INVALID_COMPARISON_PAIR'});
  }
  const ids=[aChannel,bChannel],videos=[aVideo,bVideo];
  const [channelsResult,videosResult]=await Promise.all([
    admin.from('creator_intelligence_channels')
      .select('channel_id,canonical_title,monitoring_enabled,review_state,approved_by,approved_at,metadata_refreshed_at')
      .in('channel_id',ids).limit(2),
    admin.from('creator_intelligence_videos')
      .select('video_id,channel_id,published_at,content_format,metadata_refreshed_at')
      .in('video_id',videos).limit(2),
  ]);
  if(channelsResult.error || videosResult.error)
    return unavailable(channelsResult.error||videosResult.error);
  const channels=channelsResult.data??[],records=videosResult.data??[];
  if(channels.length!==2||records.length!==2)
    return json(404,{error:'COMPARISON_RECORDS_NOT_AVAILABLE'});
  const approvedIds=[...new Set(channels.map(c=>c.approved_by).filter((id):id is string=>typeof id==='string'))];
  if(approvedIds.length===0)return json(409,{error:'COMPARISON_OPERATOR_APPROVAL_REVOKED'});
  const approvers=await admin.from('operator_users').select('user_id,active')
    .in('user_id',approvedIds).limit(2);
  if(approvers.error)return unavailable(approvers.error);
  const activeApprovers=new Set((approvers.data??[]).filter(x=>x.active===true).map(x=>x.user_id));
  const fresh=Date.now()-30*86400000;
  if(channels.some(c=>!c.monitoring_enabled||c.review_state!=='APPROVED'||
    !c.approved_at||!c.approved_by||!activeApprovers.has(c.approved_by)||
    !Number.isFinite(Date.parse(c.metadata_refreshed_at))||Date.parse(c.metadata_refreshed_at)<fresh) ||
    records.some(v=>!Number.isFinite(Date.parse(v.metadata_refreshed_at))||
      Date.parse(v.metadata_refreshed_at)<fresh || !Number.isFinite(Date.parse(v.published_at))||
      Date.parse(v.published_at)<fresh)){
    return json(409,{error:'COMPARISON_REVIEW_OR_METADATA_EXPIRED'});
  }
  const ca=channels.find(c=>c.channel_id===aChannel),cb=channels.find(c=>c.channel_id===bChannel);
  const va=records.find(v=>v.video_id===aVideo&&v.channel_id===aChannel),
    vb=records.find(v=>v.video_id===bVideo&&v.channel_id===bChannel);
  if(!ca||!cb||!va||!vb || va.content_format==='UNKNOWN'||vb.content_format==='UNKNOWN'||
    va.content_format!==vb.content_format){
    return json(409,{error:'COMPARISON_FORMAT_OR_IDENTITY_MISMATCH'});
  }
  const samples=await admin.from('creator_intelligence_counter_text')
    .select('video_id,observed_at,view_count,like_count,comment_count')
    .in('video_id',videos)
    .gte('observed_at',new Date(fresh).toISOString())
    .order('observed_at',{ascending:true}).limit(1001);
  if(samples.error)return unavailable(samples.error);
  if((samples.data??[]).length>1000)
    return json(409,{error:'COMPARISON_OBSERVATIONS_TRUNCATED'});
  const s=samples.data??[];
  const payload=(video:typeof va,channel:typeof ca)=>({
    channelId:channel.channel_id,channelTitle:channel.canonical_title,
    videoId:video.video_id,publishedAt:video.published_at,format:video.content_format,
    samples:s.filter(x=>x.video_id===video.video_id).map(x=>({
      observedAt:x.observed_at,viewCount:x.view_count,
      likeCount:x.like_count,commentCount:x.comment_count,
    })),
  });
  return json(200,{
    generatedAt:new Date().toISOString(),
    policy:'YOUTUBE_ANALYTICS_APPROVED_OPERATOR_ONLY',
    a:payload(va,ca),b:payload(vb,cb),
  });
}

/** C12: operator-only, fresh TTL-bounded public activity evidence.
 * Not an analytics, comparison, quota-spending or creator-enrollment endpoint.
 * Query source is service-only security-invoker view returning decimal counters as text.
 */
async function pilotPublicActivity():Promise<Response>{
  const now=new Date().toISOString();
  const rows=await admin.from('creator_intelligence_activity_text')
    .select('channel_id,observed_at,expires_at,subscriber_count,subscribers_hidden,public_video_count,recent_public_uploads')
    .gte('expires_at',now).order('observed_at',{ascending:false}).limit(21);
  if(rows.error)return unavailable(rows.error);
  if((rows.data??[]).length>20)return json(409,{error:'C12_REVIEW_WINDOW_TRUNCATED'});
  const channels=(rows.data??[]).map(item=>({
    channelId:item.channel_id,observedAt:item.observed_at,expiresAt:item.expires_at,
    subscriberCountApprox:item.subscribers_hidden?null:item.subscriber_count,
    subscriberHidden:item.subscribers_hidden,
    videoCountPublic:item.public_video_count,
    latestPublicVideos:item.recent_public_uploads,
  }));
  return json(200,{
    generatedAt:now,
    status:channels.length?'READ_ONLY_OBSERVATIONS':'NO_FRESH_ACTIVITY_DATA',
    channels,
    monitoringAuthorized:false,
    comparisonsAuthorized:false,
  });
}

/** C19: source of truth for official identities is private, expiring evidence.
 * Research browser never bundles C2/C10 API results; no monitoring or admissions.
 */
async function pilotIdentities():Promise<Response>{
 const now=new Date().toISOString();
 const rows=await admin.from('creator_intelligence_identity_evidence')
  .select('channel_id,listed_name,listed_handle,official_channel_title,uploads_playlist_id,locale,category_provisional,size_tier_provisional,source_url,observed_at,expires_at')
  .gt('expires_at',now).lte('observed_at',now)
  .order('observed_at',{ascending:false}).limit(21);
 if(rows.error)return unavailable(rows.error);
 if((rows.data??[]).length>20)return json(409,{error:'C19_REVIEW_WINDOW_EXCEEDS_LIMIT'});
 const channels=(rows.data??[]).map(x=>({
  channelId:x.channel_id,listedName:x.listed_name,listedHandle:x.listed_handle,
  officialChannelTitle:x.official_channel_title,uploadsPlaylistId:x.uploads_playlist_id,
  locale:x.locale,categoryProvisional:x.category_provisional,
  sizeTierProvisional:x.size_tier_provisional,sourceUrl:x.source_url,
  observedAt:x.observed_at,expiresAt:x.expires_at,
  reviewState:'REVIEW_PENDING',operatorApproved:false,
  monitoringEnabled:false,metricsEnabled:false,
 }));
 return json(200,{generatedAt:now,
  status:channels.length?'FRESH_IDENTITIES_REVIEW_PENDING':'NO_FRESH_IDENTITY_EVIDENCE',
  channels,monitoringAuthorized:false,comparisonsAuthorized:false});
}

Deno.serve(async(request:Request):Promise<Response>=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
  try{
    if(!(await operator(request)))return json(403,{error:'ACTIVE_OPERATOR_REQUIRED'});
    let payload:unknown;
    try{payload=await request.json();}catch{return json(400,{error:'INVALID_JSON'});}
    if(!payload||typeof payload!=='object'||Array.isArray(payload))return json(400,{error:'INVALID_REQUEST'});
    const body=payload as Record<string,unknown>;
    if(body.action==='overview')return await overview();
    if(body.action==='channel'&&typeof body.channelId==='string')return await detail(body.channelId);
    if(body.action==='pilotActivity')return await pilotPublicActivity();
    if(body.action==='pilotIdentities')return await pilotIdentities();
    if(body.action==='comparisonStatus')return json(200,{
      enabled:crossChannelApproved,policy:'YouTube cross-channel analytics must be explicitly approved',
    });
    if(body.action==='comparison')return await comparePair(body);
    return json(400,{error:'UNKNOWN_ACTION'});
  }catch{return json(503,{error:'CREATOR_DASHBOARD_UNAVAILABLE'});}
});
