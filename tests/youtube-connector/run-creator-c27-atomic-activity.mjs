import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runC16ManualActivityRequest} from '../../supabase/functions/cinerelay-creator-activity-ingest/flow.mjs';
const read=p=>readFile(p,'utf8');
const sql=await read('supabase/migrations/20261030223000_creator_intelligence_c27_atomic_public_activity.sql');
const index=await read('supabase/functions/cinerelay-creator-activity-ingest/index.ts');
const flow=await read('supabase/functions/cinerelay-creator-activity-ingest/flow.mjs');
let n=0;function test(label,fn){fn();n++;console.log('PASS C27: '+label);}
test('claim row lock and fresh clock must precede any private activity write',()=>{
 const a=sql.indexOf('where channel_id=p_channel_id for update;');
 const b=sql.indexOf('v_checked_at:=clock_timestamp();');
 const c=sql.indexOf('v_claim.retry_after<=v_checked_at');
 const d=sql.indexOf('insert into public.creator_intelligence_activity_observations');
 const e=sql.indexOf('update public.creator_intelligence_activity_claims',d);
 const f=sql.indexOf('update public.connector_quota_usage',e);
 assert.ok(a>0&&b>a&&c>b&&d>c&&e>d&&f>e);
 assert.ok(sql.includes('v_claim.claim_token<>p_claim_token'));
 assert.ok(sql.includes('v_claim.quota_receipt_id<>p_quota_receipt_id'));
});
test('two-unit receipt is validated and success finalized inside one transaction',()=>{
 assert.ok(sql.includes("method='creatorC14.oneShotPublicActivity'"));
 assert.ok(sql.includes('units=2 and response_status is null'));
 assert.ok(sql.includes("return true;"));
 assert.ok(sql.includes('response_status=200'));
 assert.ok(sql.includes('creator_c27_receipt_commit_failed'));
});
test('private audit cannot be invoked by unprivileged users or smuggle monitoring fields',()=>{
 assert.ok(sql.includes('security definer'));
 assert.ok(sql.includes('from public,anon,authenticated'));
 assert.ok(sql.includes('to service_role'));
 assert.ok(sql.includes('jsonb_object_keys(p_record))<>7'));
 assert.ok(sql.includes("'recent_public_uploads'"));
 assert.ok(!sql.includes("monitoring_enabled=true"));
});
test('production Edge has no direct C12 upsert and only atomic success path',()=>{
 assert.ok(index.includes("admin.rpc('creator_c27_commit_public_activity'"));
 assert.ok(!index.includes(".upsert(row,{onConflict:'channel_id'})"));
 assert.ok(!index.includes("from('creator_intelligence_activity_observations')"));
 assert.ok(flow.includes('await deps.commit(channelId,claimToken,receiptId,record)'));
 assert.ok(flow.includes('deps.finalize(channelId,claimToken,receiptId,false,status)'));
 assert.ok(flow.includes('C27_STALE_OR_REJECTED_ACTIVITY_COMMIT'));
});
const id='UC'+'k'.repeat(22),token='12345678-1234-4234-a234-123456789abc';
const config={
 enabled:true,atomicEnabled:true,hasServerCredentials:true,dailyLimit:10000,
 reserve:2000,allowlist:id,allowUntil:'2026-10-31T00:00:00Z'};
const request=()=>new Request('https://example.test/audit',{method:'POST',headers:{
 'x-cinerelay-audit-intent':'ONE_SHOT_PUBLIC_ACTIVITY'},body:JSON.stringify({channelId:id})});
const calls=[];
const deps={
 now:()=> '2026-10-30T11:00:00Z',
 activeOperator:async()=>true,
 claim:async()=>({state:'CLAIMED',claimToken:token,quotaReceiptId:9}),
 provider:async(method)=>{
  if(method==='channels')return {status:200,body:{items:[{
   id,contentDetails:{relatedPlaylists:{uploads:'UU'+id.slice(2)}},
   statistics:{hiddenSubscriberCount:false,subscriberCount:'14',videoCount:'2'}}]}};
  return {status:200,body:{items:[]}};
 },
 commit:async()=>{calls.push('commit');return false;},
 finalize:async()=>{calls.push('finalize');return true;},
};
let status;
status=await runC16ManualActivityRequest(request(),config,deps);
test('stale atomic denial never calls old finalizer or succeeds',()=>{
 assert.equal(status.status,503);
 assert.deepEqual(calls,['commit']);
});
const err=await status.json();
test('stale atomic denial reveals no provider/private records',()=>{
 assert.equal(err.error,'C27_STALE_OR_REJECTED_ACTIVITY_COMMIT');
 assert.ok(!('subscriberCount' in err));
});
console.log('PASS CineRelay C27: '+n+' atomic activity and rejection checks');
