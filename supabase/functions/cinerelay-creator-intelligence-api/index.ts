import { createClient } from '@supabase/supabase-js';

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
    return json(400,{error:'UNKNOWN_ACTION'});
  }catch{return json(503,{error:'CREATOR_DASHBOARD_UNAVAILABLE'});}
});
