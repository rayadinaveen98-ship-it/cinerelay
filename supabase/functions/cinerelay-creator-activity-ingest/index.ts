import {createClient} from '@supabase/supabase-js';
import {runC16ManualActivityRequest} from './flow.mjs';

// Manual, operator-initiated, non-recurring public YouTube activity observation.
// No live deployment or enable flags in C16. Provider keys stay server-only.
const url=Deno.env.get('SUPABASE_URL');
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const youtubeKey=Deno.env.get('YOUTUBE_API_KEY');
const config={
 enabled:Deno.env.get('CINERELAY_C13_ACTIVITY_INGEST_ENABLED')==='true',
 atomicEnabled:Deno.env.get('CINERELAY_C14_ATOMIC_CLAIM_ENABLED')==='true',
 hasServerCredentials:Boolean(url&&serviceKey&&youtubeKey),
 dailyLimit:Number(Deno.env.get('CINERELAY_C13_VERIFIED_GENERAL_READ_DAILY_LIMIT')??'0'),
 reserve:Number(Deno.env.get('CINERELAY_C13_GENERAL_READ_RESERVE')??'0'),
 allowlist:Deno.env.get('CINERELAY_C13_ALLOWED_CHANNEL_IDS')??'',
 allowUntil:Deno.env.get('CINERELAY_C13_ALLOWED_UNTIL')??'',
};
const admin=url&&serviceKey?
 createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;

async function activeOperator(request:Request):Promise<boolean>{
 const token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!admin||!token)return false;
 const auth=await admin.auth.getUser(token);
 if(auth.error||!auth.data.user)return false;
 const operator=await admin.from('operator_users').select('user_id')
  .eq('user_id',auth.data.user.id).eq('active',true).maybeSingle();
 return !operator.error&&Boolean(operator.data);
}
async function provider(method:string,params:Record<string,string>):
 Promise<{status:number;body:unknown}>{
 if(!youtubeKey||!['channels','playlistItems'].includes(method))
  throw Error('C16_PROVIDER_UNAVAILABLE');
 const address=new URL('https://www.googleapis.com/youtube/v3/'+method);
 for(const [name,value] of Object.entries(params))address.searchParams.set(name,value);
 address.searchParams.set('key',youtubeKey);
 const response=await fetch(address.toString(),{
  method:'GET',headers:{accept:'application/json'},
  signal:AbortSignal.timeout(12000),
 });
 // Never expose the URL/key, provider error body or response headers.
 return {status:response.status,body:response.ok?await response.json():null};
}
Deno.serve((request:Request)=>runC16ManualActivityRequest(request,config,{
 now:()=>new Date().toISOString(),
 activeOperator,
 claim:async(channelId:string,limit:number,reserve:number)=>{
  if(!admin)throw Error('C16_DB_UNAVAILABLE');
  const receipt=await admin.rpc('creator_c14_claim_and_reserve_activity',{
   p_channel_id:channelId,p_daily_limit:limit,p_existing_reserve:reserve,
  });
  if(receipt.error)throw Error('C16_CLAIM_REJECTED');
  return receipt.data;
 },
 provider,
 save:async(row:Record<string,unknown>)=>{
  if(!admin)throw Error('C16_DB_UNAVAILABLE');
  const result=await admin.from('creator_intelligence_activity_observations')
   .upsert(row,{onConflict:'channel_id'}).select('channel_id').single();
  return !result.error&&result.data?.channel_id===row.channel_id;
 },
 finalize:async(channelId:string,claimToken:string,receiptId:number,
   succeeded:boolean,status:number)=>{
  if(!admin)throw Error('C16_DB_UNAVAILABLE');
  const result=await admin.rpc('creator_c14_finalize_activity_claim',{
   p_channel_id:channelId,p_claim_token:claimToken,
   p_quota_receipt_id:receiptId,p_succeeded:succeeded,p_response_status:status,
  });
  return !result.error&&result.data===true;
 },
}));
