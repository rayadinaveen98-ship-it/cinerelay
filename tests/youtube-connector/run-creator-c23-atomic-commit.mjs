import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runC20IdentityRequest}
 from '../../supabase/functions/cinerelay-creator-identity-verify/flow.mjs';
const read=path=>readFile(path,'utf8');
const sql=await read('supabase/migrations/20261030203000_creator_intelligence_c23_atomic_identity_commit.sql');
const edge=await read('supabase/functions/cinerelay-creator-identity-verify/index.ts');
const flow=await read('supabase/functions/cinerelay-creator-identity-verify/flow.mjs');
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS C23: '+name);}
await test('atomic writer must lock current claim BEFORE upsert and finalize inside the same SQL transaction',()=>{
 const lock=sql.indexOf('where handle_key=v_handle for update');
 const write=sql.indexOf('insert into public.creator_intelligence_identity_evidence');
 const receipt=sql.indexOf('update public.connector_quota_usage',write);
 assert.ok(lock>0&&lock<write&&write<receipt);
 assert.ok(sql.includes("v_claim.retry_after<=v_now"));
 assert.ok(sql.includes("v_claim.claim_token<>p_claim_token"));
 assert.ok(sql.includes("v_claim.quota_receipt_id<>p_quota_receipt_id"));
 assert.ok(sql.includes("v_claim.state<>'IN_FLIGHT'"));
 assert.ok(sql.includes('v_record_count<>1'));
});
await test('writer is service role only and cannot authorize monitoring',()=>{
 assert.ok(sql.includes('security definer'));
 assert.ok(sql.includes('revoke all on function public.creator_c23_commit_verified_identity'));
 assert.ok(sql.includes('from public,anon,authenticated'));
 assert.ok(sql.includes('to service_role'));
 assert.ok(sql.includes("'REVIEW_PENDING'"));
 assert.ok(sql.includes('monitoring_enabled=false,metrics_enabled=false'));
 assert.ok(sql.includes("v_expiry>v_observed+interval '28 days'"));
});
await test('Edge uses ONLY transaction commit RPC for success, without any identity table upsert',()=>{
 assert.ok(edge.includes("admin.rpc('creator_c23_commit_verified_identity'"));
 assert.ok(!edge.includes(".upsert(record,{onConflict:'channel_id'})"));
 assert.ok(!edge.includes("from('creator_intelligence_identity_evidence')"));
 assert.ok(flow.includes('await deps.commit(key,claimToken,quotaReceiptId,record)'));
 assert.ok(flow.includes("if(!finalized)return fail(503,'C20_QUOTA_FINALIZE_FAILED')"));
 assert.ok(flow.includes('deps.finalize(key,claimToken,quotaReceiptId,false,status)'));
});
const config={enabled:true,atomicEnabled:true,hasServerCredentials:true,
 dailyLimit:10000,reserve:2000,
 allowUntil:'2026-10-31T00:00:00Z',
 candidates:[{handle:'@c23test',name:'Synthetic',
  locale:'te',category:'Education',sizeTier:'NANO_LT10K',
  sourceUrl:'https://example.org/c23'}]};
const req=()=>new Request('https://example.org/c23',{method:'POST',
 headers:{'x-cinerelay-identity-intent':'ONE_SHOT_OFFICIAL_IDENTITY'},
 body:JSON.stringify({handle:'@c23test'})});
function deps(override={}){
 const actions=[];
 const d={
 now:()=> '2026-10-30T11:00:00Z',activeOperator:async()=>true,
 claim:async()=>({state:'CLAIMED',
  claimToken:'12345678-1234-4234-a234-123456789abc',quotaReceiptId:7}),
 provider:async()=>({status:200,body:{items:[{id:'UC'+'a'.repeat(22),
  snippet:{title:'Synthetic'},contentDetails:{
   relatedPlaylists:{uploads:'UU'+'a'.repeat(22)}}}]}}),
 commit:async()=>{actions.push('commit');return true;},
 finalize:async()=>{actions.push('finalize');return true;},
 ...override,
 };
 return {d,actions};
}
await test('a denied stale commit can NEVER return success or invoke success finalizer',async()=>{
 const h=deps({commit:async()=>{h.actions.push('commit');return false;}});
 const response=await runC20IdentityRequest(req(),config,h.d);
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,'C23_STALE_OR_REJECTED_IDENTITY_COMMIT');
 assert.deepEqual(h.actions,['commit']);
});
await test('successful commit does not execute the old separate finalizer',async()=>{
 const h=deps();
 const response=await runC20IdentityRequest(req(),config,h.d);
 assert.equal(response.status,200);
 assert.deepEqual(h.actions,['commit']);
});
await test('provider 403 still uses token-bound failure finalizer with no write',async()=>{
 const h=deps({
 provider:async()=>({status:403,body:{secrets:'NEVER_EXPOSED'}}),
 });
 const response=await runC20IdentityRequest(req(),config,h.d);
 assert.equal(response.status,503);
 assert.deepEqual(h.actions,['finalize']);
 assert.ok(!JSON.stringify(await response.json()).includes('NEVER_EXPOSED'));
});
console.log('PASS CineRelay C23: '+count+' transaction atomicity and stale-response safety contracts');
