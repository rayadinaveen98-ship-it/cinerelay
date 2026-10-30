/**
 * C20 pure one-shot official YouTube handle verification request flow.
 * No secret access, network, DB or scheduling. All capabilities are injected.
 */
const HANDLE=/^@[\p{L}\p{M}\p{N}._-]{3,30}$/u;
const UC=/^UC[A-Za-z0-9_-]{22}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIERS=new Set(['NANO_LT10K','MICRO_10K_100K','MID_100K_1M',
 'LARGE_1M_10M','MEGA_10M_PLUS','UNVERIFIED']);
const reply=(code,data)=>new Response(JSON.stringify(data),{
 status:code,headers:{'content-type':'application/json','cache-control':'no-store'},
});
const fail=(status,error)=>reply(status,{ok:false,error});
const bytes=value=>new TextEncoder().encode(value).length;
export function validateReviewedCandidates(value){
 if(!Array.isArray(value)||value.length<1||value.length>20)return null;
 const out=new Map();
 for(const x of value){
  if(!x||typeof x!=='object'||Array.isArray(x)||
   typeof x.handle!=='string'||!HANDLE.test(x.handle)||
   typeof x.name!=='string'||!x.name.trim()||x.name.length>200||
   typeof x.locale!=='string'||!/^[a-z-]{2,20}$/.test(x.locale)||
   typeof x.category!=='string'||!x.category.trim()||x.category.length>100||
   typeof x.sizeTier!=='string'||!TIERS.has(x.sizeTier)||
   typeof x.sourceUrl!=='string'||!/^https:\/\/[^ ]{3,500}$/.test(x.sourceUrl))
   return null;
  const key=x.handle.toLocaleLowerCase('en-US');
  if(out.has(key))return null;
  out.set(key,x);
 }
 return out;
}
export function parseOfficialIdentity(body,handle,source,at){
 if(!HANDLE.test(handle)||!source||!body||!Array.isArray(body.items)||
  body.items.length!==1||!Number.isFinite(Date.parse(at)))
  throw Error('C20_INVALID_PROVIDER_IDENTITY');
 const ch=body.items[0],id=ch?.id,uploads=ch?.contentDetails?.relatedPlaylists?.uploads;
 const title=ch?.snippet?.title;
 if(typeof id!=='string'||!UC.test(id)||uploads!=='UU'+id.slice(2)||
  typeof title!=='string'||!title.trim()||title.trim().length>200)
  throw Error('C20_PROVIDER_IDENTITY_MISMATCH');
 const when=new Date(at).toISOString();
 return {
  channel_id:id,listed_name:source.name.trim(),listed_handle:source.handle,
  official_channel_title:title.trim(),uploads_playlist_id:uploads,
  locale:source.locale,category_provisional:source.category.trim(),
  size_tier_provisional:source.sizeTier,source_url:source.sourceUrl,
  observed_at:when,expires_at:new Date(Date.parse(when)+27*86400000).toISOString(),
  review_state:'REVIEW_PENDING',monitoring_enabled:false,metrics_enabled:false,
 };
}
/**
 * @param {Request} request
 * @param {{enabled:boolean,atomicEnabled:boolean,hasServerCredentials:boolean,
 * dailyLimit:number,reserve:number,allowUntil:string,candidates:unknown}} config
 * @param {{now:()=>string,activeOperator:(req:Request)=>Promise<boolean>,
 * claim:(handle:string,limit:number,reserve:number)=>Promise<any>,
 * provider:(handle:string)=>Promise<{status:number,body:unknown}>,
 * save:(record:any)=>Promise<boolean>,
 * finalize:(handle:string,token:string,receiptId:number,ok:boolean,status:number)=>Promise<boolean>}} deps
 */
export async function runC20IdentityRequest(request,config,deps){
 if(request.method!=='POST')return fail(405,'METHOD_NOT_ALLOWED');
 if(config.enabled!==true||config.atomicEnabled!==true)return fail(503,'C20_MANUAL_IDENTITY_DISABLED');
 if(!config.hasServerCredentials)return fail(503,'C20_SERVER_CREDENTIALS_MISSING');
 if(!Number.isSafeInteger(config.dailyLimit)||config.dailyLimit<2||config.dailyLimit>10000||
  !Number.isSafeInteger(config.reserve)||config.reserve<1000||config.reserve>=config.dailyLimit)
  return fail(503,'C20_QUOTA_NOT_VERIFIED');
 const reviewed=validateReviewedCandidates(config.candidates),now=deps.now();
 const expiry=Date.parse(config.allowUntil);
 if(!reviewed||!Number.isFinite(expiry)||!Number.isFinite(Date.parse(now))||
  expiry<=Date.parse(now)||expiry-Date.parse(now)>7*86400000)
  return fail(503,'C20_REVIEW_SCOPE_UNAVAILABLE');
 let permitted=false;
 try{permitted=(await deps.activeOperator(request))===true;}
 catch{return fail(503,'C20_AUTH_UNAVAILABLE');}
 if(!permitted)return fail(403,'ACTIVE_OPERATOR_REQUIRED');
 if(request.headers.get('x-cinerelay-identity-intent')!=='ONE_SHOT_OFFICIAL_IDENTITY')
  return fail(400,'EXPLICIT_IDENTITY_VERIFICATION_REQUIRED');
 let raw='';
 try{
  if(Number(request.headers.get('content-length')||0)>512)return fail(413,'REQUEST_TOO_LARGE');
  raw=await request.text();
  if(bytes(raw)>512)return fail(413,'REQUEST_TOO_LARGE');
 }catch{return fail(400,'INVALID_REQUEST_BODY');}
 let body;
 try{body=JSON.parse(raw);}catch{return fail(400,'INVALID_JSON');}
 if(!body||typeof body!=='object'||Array.isArray(body)||
  Object.keys(body).length!==1||typeof body.handle!=='string'||!HANDLE.test(body.handle))
  return fail(400,'HANDLE_ONLY');
 const key=body.handle.toLocaleLowerCase('en-US');
 const candidate=reviewed.get(key);
 if(!candidate)return fail(403,'HANDLE_NOT_IN_APPROVED_ONE_SHOT_SCOPE');
 let claim;
 try{claim=await deps.claim(key,config.dailyLimit,config.reserve);}
 catch{return fail(503,'C20_CLAIM_UNAVAILABLE');}
 if(!claim||typeof claim!=='object')return fail(503,'C20_CLAIM_UNAVAILABLE');
 if(['BLOCKED_ACTIVE_OR_COOLDOWN','BLOCKED_FRESH_IDENTITY'].includes(claim.state))
  return fail(409,'IDENTITY_ALREADY_CLAIMED_OR_FRESH');
 if(claim.state==='BLOCKED_QUOTA_RESERVE')return fail(429,'C20_QUOTA_RESERVE_EXHAUSTED');
 const {quotaReceiptId,claimToken}=claim;
 if(claim.state!=='CLAIMED'||!Number.isSafeInteger(quotaReceiptId)||
  quotaReceiptId<=0||typeof claimToken!=='string'||!UUID.test(claimToken))
  return fail(503,'C20_INVALID_QUOTA_RECEIPT');

 let stage='VERIFICATION_FAILED',status=503,record=null;
 try{
  const provider=await deps.provider(candidate.handle);
  if(provider.status!==200){
   stage='YOUTUBE_IDENTITY_PROVIDER_FAILED';status=provider.status;
  }else{
   record=parseOfficialIdentity(provider.body,candidate.handle,candidate,deps.now());
   const saved=await deps.save(record);
   if(saved===true){stage='PRIVATE_IDENTITY_STORED';status=200;}
   else{stage='PRIVATE_IDENTITY_STORE_FAILED';status=503;}
  }
 }catch{
  stage='VERIFICATION_FAILED';status=503;
 }
 let finalized=false;
 try{
  finalized=(await deps.finalize(key,claimToken,quotaReceiptId,
   stage==='PRIVATE_IDENTITY_STORED',status))===true;
 }catch{}
 if(!finalized)return fail(503,'C20_QUOTA_FINALIZE_FAILED');
 if(stage!=='PRIVATE_IDENTITY_STORED')return fail(503,stage);
 return reply(200,{ok:true,state:'PRIVATE_IDENTITY_STORED',
  channelId:record.channel_id,observedAt:record.observed_at,
  expiresAt:record.expires_at,reviewState:'REVIEW_PENDING',
  providerRequestsReserved:1,monitoringEnabled:false,metricsEnabled:false,
  comparisonsEnabled:false});
}
