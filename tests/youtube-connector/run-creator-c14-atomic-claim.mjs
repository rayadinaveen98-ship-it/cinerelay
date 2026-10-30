import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(path,'utf8');
const sql=await read('supabase/migrations/20261030170000_creator_intelligence_c14_atomic_claim.sql');
const edge=await read('supabase/functions/cinerelay-creator-activity-ingest/index.ts');
const c13=await read('supabase/migrations/20261030163000_creator_intelligence_c13_manual_quota.sql');
const c12=await read('supabase/migrations/20261030110000_creator_intelligence_c12_activity_retention.sql');
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS C14: '+name)}
test('one database RPC atomically locks identity and reserves quota before fetch',()=>{
 assert.ok(sql.includes("pg_advisory_xact_lock(hashtext('CINERELAY_C14_ACTIVITY_GLOBAL'))"));
 assert.ok(sql.includes('where channel_id=p_channel_id for update'));
 const reserve=sql.indexOf("insert into public.connector_quota_usage");
 const claim=sql.indexOf("insert into public.creator_intelligence_activity_claims");
 assert.ok(reserve>0&&claim>reserve);
 assert.ok(sql.includes("return jsonb_build_object('state','CLAIMED'"));
 assert.ok(edge.indexOf("admin.rpc('creator_c14_claim_and_reserve_activity'")<
   edge.indexOf("provider('channels'"));
 assert.ok(!edge.includes("admin.rpc('creator_c13_reserve_public_activity_quota'"));
});
test('same channel duplicate and successful recent observation block extra charges',()=>{
 assert.ok(sql.includes("v_claim.retry_after>v_now"));
 assert.ok(sql.includes("'BLOCKED_ACTIVE_OR_COOLDOWN'"));
 assert.ok(sql.includes("observed_at>v_now-interval '24 hours'"));
 assert.ok(sql.includes("'BLOCKED_RECENT_PUBLIC_OBSERVATION'"));
 assert.ok(sql.indexOf("v_claim.retry_after>v_now")<sql.indexOf("insert into public.connector_quota_usage"));
 assert.ok(sql.indexOf("observed_at>v_now-interval '24 hours'")<sql.indexOf("insert into public.connector_quota_usage"));
 assert.ok(edge.includes("C14_CHANNEL_ALREADY_CLAIMED_OR_RECENT"));
});
test('both config gates default off, requiring deliberate server approval',()=>{
 assert.ok(edge.includes("CINERELAY_C13_ACTIVITY_INGEST_ENABLED')==='true'"));
 assert.ok(edge.includes("CINERELAY_C14_ATOMIC_CLAIM_ENABLED')!=='true'"));
 assert.ok(edge.includes('activeOperator(request)'));
 assert.ok(edge.includes('authorizedTarget(channelId,allowlist'));
 assert.ok(edge.includes("ONE_SHOT_PUBLIC_ACTIVITY"));
});
test('success and failure have separate cooldowns and cannot finalize a stolen receipt',()=>{
 assert.ok(sql.includes("claim_token=p_claim_token"));
 assert.ok(sql.includes("quota_receipt_id=p_quota_receipt_id and state='IN_FLIGHT'"));
 assert.ok(sql.includes("interval '24 hours' else interval '15 minutes'"));
 assert.ok(sql.includes("if v_row_count<>1 then return false; end if;"));
 assert.ok(edge.includes("creator_c14_finalize_activity_claim"));
 assert.ok(edge.includes("if(finalized.error||finalized.data!==true)"));
});
test('claims and API observations both expire before 30-day limit',()=>{
 assert.ok(sql.includes("claimed_at + interval '28 days'"));
 assert.ok(sql.includes("'cinerelay-c14-activity-claim-ttl'"));
 assert.ok(sql.includes("expires_at <= now()"));
 assert.ok(c12.includes("interval '29 days'"));
 assert.ok(edge.includes(".upsert(row,{onConflict:'channel_id'})"));
 assert.ok(c13.includes("America/Los_Angeles"));
});
test('service only access, no Git writes, no keys in response',()=>{
 assert.ok(sql.includes('enable row level security'));
 assert.ok(sql.includes('from public,anon,authenticated'));
 assert.ok(sql.includes('to service_role'));
 assert.ok(!edge.includes("console.log(")&&!edge.includes("console.error("));
 assert.ok(!edge.includes("return json(200,{ok:true,...row"));
 assert.ok(!edge.includes("apiKey:youtubeKey"));
 assert.ok(edge.includes("providerRequestsReserved:2"));
 assert.ok(edge.includes("monitoringEnabled:false,comparisonsEnabled:false"));
});
console.log('PASS C14: '+checks+' concurrency and retention safeguard contracts');
