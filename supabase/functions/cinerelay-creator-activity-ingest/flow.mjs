/**
 * C16 testable HTTP request flow. All external capabilities are injected.
 *
 * Production supplies real Supabase Auth, atomic C14 Postgres RPCs, official
 * public YouTube API and expiring C12 private DB. Tests inject fake capabilities
 * and do not require any real API credentials or production access.
 */
import {authorizedTarget,validChannelId,parseC13Channel,parseC13Uploads,createC13Record} from './logic.mjs';

const response=(status,body)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json','cache-control':'no-store'},
});
const failure=(status,error)=>response(status,{ok:false,error});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAIM_STATES=new Set(['BLOCKED_ACTIVE_OR_COOLDOWN','BLOCKED_RECENT_PUBLIC_OBSERVATION']);
const LIMIT_BYTES=512;
const MAX_CONFIG_LIMIT=10000;

/**
 * @param {Request} request
 * @param {{
 *   enabled:boolean,atomicEnabled:boolean,hasServerCredentials:boolean,
 *   dailyLimit:number,reserve:number,allowlist:string,allowUntil:string
 * }} config
 * @param {{
 *   now:()=>string,
 *   activeOperator:(request:Request)=>Promise<boolean>,
 *   claim:(channelId:string,dailyLimit:number,reserve:number)=>Promise<any>,
 *   provider:(method:string,params:Record<string,string>)=>Promise<{status:number,body:unknown}>,
 *   save:(record:Record<string,unknown>)=>Promise<boolean>,
 *   finalize:(channelId:string,claimToken:string,receiptId:number,success:boolean,status:number)=>Promise<boolean>
 * }} deps
 */
export async function runC16ManualActivityRequest(request,config,deps){
 if(request.method!=='POST')return failure(405,'METHOD_NOT_ALLOWED');
 // No operation on production without BOTH manually enabled gates.
 if(!config.enabled)return failure(503,'C13_MANUAL_AUDIT_DISABLED');
 if(!config.atomicEnabled)return failure(503,'C14_ATOMIC_CLAIM_DISABLED');
 if(!config.hasServerCredentials)return failure(503,'C13_SERVER_SECRETS_UNAVAILABLE');
 const limit=config.dailyLimit,reserve=config.reserve;
 if(!Number.isSafeInteger(limit)||limit<2||limit>MAX_CONFIG_LIMIT||
  !Number.isSafeInteger(reserve)||reserve<1000||reserve>=limit)
  return failure(503,'C13_PROJECT_QUOTA_NOT_VERIFIED');
 let permitted=false;
 try{permitted=await deps.activeOperator(request)===true;}catch{return failure(503,'OPERATOR_AUTH_UNAVAILABLE');}
 if(!permitted)return failure(403,'ACTIVE_OPERATOR_REQUIRED');
 if(request.headers.get('x-cinerelay-audit-intent')!=='ONE_SHOT_PUBLIC_ACTIVITY')
  return failure(400,'EXPLICIT_ONE_SHOT_INTENT_REQUIRED');

 let raw='';
 try{
  // Independently enforce the 512-byte cap, even for chunked bodies.
  if(Number(request.headers.get('content-length')||0)>LIMIT_BYTES)
   return failure(413,'REQUEST_TOO_LARGE');
  raw=await request.text();
  if(new TextEncoder().encode(raw).length>LIMIT_BYTES)
   return failure(413,'REQUEST_TOO_LARGE');
 }catch{return failure(400,'INVALID_BODY');}
 let body;
 try{body=JSON.parse(raw);}catch{return failure(400,'INVALID_JSON');}
 if(!body||typeof body!=='object'||Array.isArray(body)||
  Object.keys(body).length!==1||!validChannelId(body.channelId))
  return failure(400,'CHANNEL_ID_ONLY');

 const channelId=body.channelId;
 const checkedAt=deps.now();
 if(!authorizedTarget(channelId,config.allowlist,checkedAt,config.allowUntil))
  return failure(403,'CHANNEL_NOT_IN_TIME_LIMITED_AUDIT_SCOPE');

 // C14 claim and quota reservation is a single Postgres transaction.
 let claim;
 try{claim=await deps.claim(channelId,limit,reserve);}catch{return failure(503,'C14_CLAIM_UNAVAILABLE');}
 if(!claim||typeof claim!=='object')return failure(503,'C14_CLAIM_UNAVAILABLE');
 if(CLAIM_STATES.has(claim.state))return failure(409,'C14_CHANNEL_ALREADY_CLAIMED_OR_RECENT');
 if(claim.state==='BLOCKED_QUOTA_RESERVE')return failure(429,'C14_QUOTA_RESERVE_EXHAUSTED');
 const receiptId=claim.quotaReceiptId,claimToken=claim.claimToken;
 if(claim.state!=='CLAIMED'||!Number.isSafeInteger(receiptId)||receiptId<=0||
  typeof claimToken!=='string'||!UUID.test(claimToken))
  return failure(503,'C14_INVALID_CLAIM_RECEIPT');

 // Once quota has been reserved, we ALWAYS attempt token-bound finalization.
 // Only a true finalize result may return success to the caller.
 let status=503,stage='PUBLIC_AUDIT_FAILED',record=null;
 try{
  const channelResponse=await deps.provider('channels',{
   part:'statistics,contentDetails',id:channelId,
   fields:'items(id,contentDetails(relatedPlaylists(uploads)),statistics(subscriberCount,hiddenSubscriberCount,videoCount))',
  });
  if(channelResponse.status!==200){
   status=channelResponse.status;
   stage='CHANNEL_PROVIDER_FAILURE';
  }else{
   const channel=parseC13Channel(channelResponse.body,channelId);
   const playlistResponse=await deps.provider('playlistItems',{
    part:'contentDetails',playlistId:channel.uploads,maxResults:'3',
    fields:'items(contentDetails(videoId,videoPublishedAt))',
   });
   if(playlistResponse.status!==200){
    status=playlistResponse.status;
    stage='PLAYLIST_PROVIDER_FAILURE';
   }else{
    const observedAt=deps.now();
    const videos=parseC13Uploads(playlistResponse.body,observedAt);
    record=createC13Record(channelId,channel,videos,observedAt);
    if(await deps.save(record)===true){
     status=200;stage='PRIVATE_TTL_STORED';
    }else{
     status=503;stage='PRIVATE_STORE_FAILED';
    }
   }
  }
 }catch{
  status=503;stage='PUBLIC_AUDIT_FAILED';
 }

 let finalized=false;
 try{
  finalized=(await deps.finalize(channelId,claimToken,receiptId,
   stage==='PRIVATE_TTL_STORED',status))===true;
 }catch{finalized=false;}
 if(!finalized)return failure(503,'C14_CLAIM_FINALIZATION_FAILED');
 if(stage!=='PRIVATE_TTL_STORED')return failure(503,stage);

 return response(200,{
  ok:true,state:'PRIVATE_TTL_STORED',channelId,
  observedAt:record.observed_at,expiresAt:record.expires_at,
  providerRequestsReserved:2,monitoringEnabled:false,comparisonsEnabled:false,
 });
}
