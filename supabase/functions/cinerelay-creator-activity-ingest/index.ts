import {createClient} from '@supabase/supabase-js';
import {authorizedTarget,validChannelId,parseC13Channel,parseC13Uploads,createC13Record} from './logic.mjs';

// C13: human-triggered PRIVATE public-metadata audit, not monitoring.
// No cron, no client key, no UI action, no Git or external analytics retention.
// Defaults to OFF unless operator + allowlist + expiry + budget all agree.
const url=Deno.env.get('SUPABASE_URL');
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const youtubeKey=Deno.env.get('YOUTUBE_API_KEY');
const enabled=Deno.env.get('CINERELAY_C13_ACTIVITY_INGEST_ENABLED')==='true';
const allowlist=Deno.env.get('CINERELAY_C13_ALLOWED_CHANNEL_IDS')??'';
const allowUntil=Deno.env.get('CINERELAY_C13_ALLOWED_UNTIL')??'';
const dailyLimit=Number(Deno.env.get('CINERELAY_C13_VERIFIED_GENERAL_READ_DAILY_LIMIT')??'0');
const existingReserve=Number(Deno.env.get('CINERELAY_C13_GENERAL_READ_RESERVE')??'0');
const admin=url&&serviceKey?createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const ID=/^UC[A-Za-z0-9_-]{22}$/;
const json=(status:number,body:Record<string,unknown>)=>
 new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const fail=(status:number,code:string)=>json(status,{ok:false,error:code});
async function activeOperator(request:Request):Promise<boolean>{
 const token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!admin||!token)return false;
 const {data,error}=await admin.auth.getUser(token);
 if(error||!data.user)return false;
 const user=await admin.from('operator_users').select('user_id').eq('user_id',data.user.id)
   .eq('active',true).maybeSingle();
 return !user.error&&Boolean(user.data);
}
async function provider(method:'channels'|'playlistItems',params:Record<string,string>):Promise<{status:number;body:unknown}>{
 if(!youtubeKey)throw Error('C13_PROVIDER_KEY_UNAVAILABLE');
 const address=new URL('https://www.googleapis.com/youtube/v3/'+method);
 for(const [name,value] of Object.entries(params))address.searchParams.set(name,value);
 address.searchParams.set('key',youtubeKey);
 const response=await fetch(address.toString(),{
  method:'GET',headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});
 // NEVER return or print provider error bodies, URLs, headers or secret values.
 return {status:response.status,body:response.ok?await response.json():null};
}

Deno.serve(async(request:Request):Promise<Response>=>{
 if(request.method!=='POST')return fail(405,'METHOD_NOT_ALLOWED');
 // Never allow any provider call while the feature flag is off.
 if(!enabled)return fail(503,'C13_MANUAL_AUDIT_DISABLED');
 if(!admin||!youtubeKey||!url||!serviceKey)return fail(503,'C13_SERVER_SECRETS_UNAVAILABLE');
 if(!Number.isSafeInteger(dailyLimit)||dailyLimit<2||dailyLimit>10000||
    !Number.isSafeInteger(existingReserve)||existingReserve<1000||
    existingReserve>=dailyLimit)return fail(503,'C13_PROJECT_QUOTA_NOT_VERIFIED');
 if(!(await activeOperator(request)))return fail(403,'ACTIVE_OPERATOR_REQUIRED');
 if(request.headers.get('x-cinerelay-audit-intent')!=='ONE_SHOT_PUBLIC_ACTIVITY')
  return fail(400,'EXPLICIT_ONE_SHOT_INTENT_REQUIRED');
 if(Number(request.headers.get('content-length')??0)>512)return fail(413,'REQUEST_TOO_LARGE');
 let body:unknown;
 try{
  // Body-limit enforcement is independent of Content-Length (chunked uploads).
  const raw=await request.text();
  if(new TextEncoder().encode(raw).length>512)return fail(413,'REQUEST_TOO_LARGE');
  body=JSON.parse(raw);
 }catch{return fail(400,'INVALID_JSON');}
 if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).length!==1)return fail(400,'CHANNEL_ID_ONLY');
 const channelId=(body as Record<string,unknown>).channelId;
 if(!validChannelId(channelId)||typeof channelId!=='string'||!ID.test(channelId)||
   !authorizedTarget(channelId,allowlist,new Date().toISOString(),allowUntil))
   return fail(403,'CHANNEL_NOT_IN_TIME_LIMITED_AUDIT_SCOPE');

 // A manual audit must not silently become a frequently repeating collector.
 const recent=await admin.from('creator_intelligence_activity_observations')
   .select('observed_at').eq('channel_id',channelId).limit(1).maybeSingle();
 if(recent.error)return fail(503,'C13_PRIVATE_STORAGE_UNAVAILABLE');
 if(recent.data&&Number.isFinite(Date.parse(recent.data.observed_at))&&
     Date.now()-Date.parse(recent.data.observed_at)<86400000)
  return fail(409,'C13_ALREADY_AUDITED_IN_24_HOURS');

 // Atomic quota reservation is committed BEFORE either of the two YouTube
 // calls. This uses locally recorded usage and is NOT a Google quota guarantee.
 const reservation=await admin.rpc('creator_c13_reserve_public_activity_quota',{
   p_daily_limit:dailyLimit,p_existing_reserve:existingReserve});
 if(reservation.error)return fail(503,'C13_QUOTA_RESERVATION_UNAVAILABLE');
 const quotaId=reservation.data===null?null:Number(reservation.data);
 if(quotaId===null)return fail(429,'C13_QUOTA_RESERVE_EXHAUSTED');
 if(!Number.isSafeInteger(quotaId)||quotaId<1)return fail(503,'C13_QUOTA_RECEIPT_INVALID');

 let status=503,stage='PROVIDER_NOT_COMPLETE',observedAt:string|undefined;
 try{
  const first=await provider('channels',{
   part:'statistics,contentDetails',id:channelId,
   fields:'items(id,contentDetails(relatedPlaylists(uploads)),statistics(subscriberCount,hiddenSubscriberCount,videoCount))'});
  if(first.status!==200){status=first.status;stage='CHANNEL_PROVIDER_FAILURE';return fail(503,stage);}
  const channel=parseC13Channel(first.body,channelId);
  const second=await provider('playlistItems',{
   part:'contentDetails',playlistId:channel.uploads,maxResults:'3',
   fields:'items(contentDetails(videoId,videoPublishedAt))'});
  if(second.status!==200){status=second.status;stage='PLAYLIST_PROVIDER_FAILURE';return fail(503,stage);}
  observedAt=new Date().toISOString();
  const sample=parseC13Uploads(second.body,observedAt);
  const row=createC13Record(channelId,channel,sample,observedAt);
  const saved=await admin.from('creator_intelligence_activity_observations')
     .upsert(row,{onConflict:'channel_id'}).select('channel_id').single();
  if(saved.error||saved.data?.channel_id!==channelId){
   stage='PRIVATE_STORE_FAILED';status=503;return fail(503,stage);
  }
  stage='PRIVATE_TTL_STORED';status=200;
  return json(200,{ok:true,state:stage,
    channelId,observedAt,expiresAt:row.expires_at,
    providerRequestsReserved:2,monitoringEnabled:false,comparisonsEnabled:false});
 }catch{
  // Any provider schema/timeout/DB exception fails closed; no raw JSON in
  // application logs, public HTTP errors, Git or analytics tables.
  stage='PUBLIC_AUDIT_FAILED';status=503;
  return fail(503,stage);
 }finally{
  // Non-sensitive quota audit only; even a failed provider attempt remains
  // charged. If this update fails, we intentionally do not refund quota.
  await admin.from('connector_quota_usage').update({
    response_status:status,
    metadata:{purpose:'CINERELAY_C13',state:stage,noSensitiveApiData:true},
  }).eq('id',quotaId).eq('quota_bucket','GENERAL_READ')
     .eq('method','creatorC13.oneShotPublicActivity');
 }
});
