import {createClient} from '@supabase/supabase-js';
import {runC20IdentityRequest} from './flow.mjs';

// OFF by default. Never publish a provider key, service key, reviewed roster
// or raw API response. No cron, no Git output, no consumer UI or admissions.
const url=Deno.env.get('SUPABASE_URL');
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const youtubeKey=Deno.env.get('YOUTUBE_API_KEY');
let candidates:unknown=null;
try{candidates=JSON.parse(Deno.env.get('CINERELAY_C20_REVIEWED_CANDIDATES_JSON')??'null');}
catch{candidates=null;}
const config={
 enabled:Deno.env.get('CINERELAY_C20_IDENTITY_VERIFY_ENABLED')==='true',
 atomicEnabled:Deno.env.get('CINERELAY_C20_ATOMIC_QUOTA_ENABLED')==='true',
 hasServerCredentials:Boolean(url&&serviceKey&&youtubeKey),
 dailyLimit:Number(Deno.env.get('CINERELAY_C20_VERIFIED_GENERAL_READ_DAILY_LIMIT')??'0'),
 reserve:Number(Deno.env.get('CINERELAY_C20_GENERAL_READ_RESERVE')??'0'),
 allowUntil:Deno.env.get('CINERELAY_C20_ALLOWED_UNTIL')??'',
 candidates,
};
const admin=url&&serviceKey?createClient(url,serviceKey,{
 auth:{persistSession:false,autoRefreshToken:false},
}):null;

async function activeOperator(request:Request):Promise<boolean>{
 const token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!admin||!token)return false;
 const user=await admin.auth.getUser(token);
 if(user.error||!user.data.user)return false;
 const verified=await admin.from('operator_users').select('user_id')
  .eq('user_id',user.data.user.id).eq('active',true).maybeSingle();
 return !verified.error&&Boolean(verified.data);
}
async function officialForHandle(handle:string):Promise<{status:number;body:unknown}>{
 if(!youtubeKey)throw Error('C20_PROVIDER_KEY_MISSING');
 const address=new URL('https://www.googleapis.com/youtube/v3/channels');
 address.searchParams.set('part','snippet,contentDetails');
 address.searchParams.set('forHandle',handle);
 address.searchParams.set('fields',
  'items(id,snippet(title),contentDetails(relatedPlaylists(uploads)))');
 address.searchParams.set('key',youtubeKey);
 const result=await fetch(address.toString(),{
  method:'GET',headers:{accept:'application/json'},
  signal:AbortSignal.timeout(12000),
 });
 // Don't return provider error bodies or URLs/keys; don't log them.
 return {status:result.status,body:result.ok?await result.json():null};
}
Deno.serve((request:Request)=>runC20IdentityRequest(request,config,{
 now:()=>new Date().toISOString(),
 activeOperator,
 claim:async(handle:string,limit:number,reserve:number)=>{
  if(!admin)throw Error('C20_PRIVATE_DB_UNAVAILABLE');
  const receipt=await admin.rpc('creator_c20_claim_and_reserve_identity',{
   p_handle:handle,p_daily_limit:limit,p_existing_reserve:reserve,
  });
  if(receipt.error)throw Error('C20_DB_CLAIM_REJECTED');
  return receipt.data;
 },
 provider:officialForHandle,
 commit:async(handle:string,token:string,receiptId:number,record:Record<string,unknown>)=>{
  if(!admin)throw Error('C23_PRIVATE_DB_UNAVAILABLE');
  const result=await admin.rpc('creator_c23_commit_verified_identity',{
   p_handle:handle,p_claim_token:token,
   p_quota_receipt_id:receiptId,p_record:record,
  });
  return !result.error&&result.data===true;
 },
 finalize:async(handle:string,token:string,receiptId:number,
  success:boolean,status:number)=>{
  if(!admin)throw Error('C20_PRIVATE_DB_UNAVAILABLE');
  const result=await admin.rpc('creator_c20_finalize_identity',{
   p_handle:handle,p_token:token,p_receipt_id:receiptId,
   p_success:success,p_status:status,
  });
  return !result.error&&result.data===true;
 },
}));
