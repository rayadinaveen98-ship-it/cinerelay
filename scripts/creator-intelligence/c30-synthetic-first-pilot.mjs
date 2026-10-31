/**
 * C30: a deterministic NO-NETWORK rehearsal of the real C20 identity flow.
 * No Supabase client, no Google API, no credentials, no provider data export.
 * Mock enable flags only satisfy the injected fake test harness, never live flags.
 */
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {runC20IdentityRequest} from '../../supabase/functions/cinerelay-creator-identity-verify/flow.mjs';
import {fromCheckout as c25Audit} from './c25-launch-preflight.mjs';
import {fromCheckout as c29Audit} from './c29-history-worklist.mjs';

const AT='2026-10-31T10:00:00.000Z';
const UNTIL='2026-11-01T10:00:00.000Z';
const HANDLE='@c30synthetic';
const CHANNEL='UC'+'z'.repeat(22);
const CLAIM_TOKEN='12345678-1234-4234-a234-123456789abc';
const candidate=Object.freeze({
 handle:HANDLE,name:'C30 Synthetic Demo (NOT a real creator)',
 locale:'te',category:'Education',sizeTier:'UNVERIFIED',
 sourceUrl:'https://example.invalid/c30-only'
});
const config=Object.freeze({
 enabled:true,atomicEnabled:true,hasServerCredentials:true,
 dailyLimit:10000,reserve:2000,allowUntil:UNTIL,candidates:[candidate]
});
const request=()=>new Request('https://example.invalid/only-in-memory',{
 method:'POST',headers:{'x-cinerelay-identity-intent':'ONE_SHOT_OFFICIAL_IDENTITY'},
 body:JSON.stringify({handle:HANDLE})
});

function harness(scenario){
 const events=[];
 const store=new Map();
 let hasClaim=false,quotaReserved=0,failureFinalizations=0;
 const deps={
  now:()=>AT,
  activeOperator:async()=>{events.push('auth');return scenario!=='unauthorized';},
  claim:async(handle,limit,reserve)=>{
   events.push('claim');
   assert.equal(handle,HANDLE);assert.equal(limit,10000);assert.equal(reserve,2000);
   if(hasClaim)return {state:'BLOCKED_ACTIVE_OR_COOLDOWN'};
   hasClaim=true;quotaReserved++;
   return {state:'CLAIMED',claimToken:CLAIM_TOKEN,quotaReceiptId:300};
  },
  provider:async handle=>{
   events.push('provider');assert.equal(handle,HANDLE);
   if(scenario==='provider-error')
    return {status:403,body:{privateProviderError:'MUST_NEVER_BE_RETURNED'}};
   return {status:200,body:{items:[{
    id:CHANNEL,snippet:{title:'C30 Offline Synthetic Official Channel'},
    contentDetails:{relatedPlaylists:{uploads:'UU'+CHANNEL.slice(2)}}
   }]}};
  },
  commit:async(handle,token,receipt,record)=>{
   events.push('commit');
   assert.equal(handle,HANDLE);assert.equal(token,CLAIM_TOKEN);assert.equal(receipt,300);
   if(scenario==='stale-claim')return false;
   assert.equal(record.channel_id,CHANNEL);
   assert.equal(record.review_state,'REVIEW_PENDING');
   assert.equal(record.monitoring_enabled,false);
   assert.equal(record.metrics_enabled,false);
   assert.equal(record.expires_at,'2026-11-27T10:00:00.000Z');
   store.set(CHANNEL,record);
   return true;
  },
  finalize:async(handle,token,receipt,success,status)=>{
   events.push('finalize');
   assert.equal(handle,HANDLE);assert.equal(token,CLAIM_TOKEN);assert.equal(receipt,300);
   assert.equal(success,false);assert.notEqual(status,200);
   failureFinalizations++;
   return true;
  }
 };
 return {
  deps,events,store,
  get quotaReserved(){return quotaReserved;},
  get failureFinalizations(){return failureFinalizations;}
 };
}
async function runScenario(name){
 const h=harness(name);
 const cfg=name==='feature-off'?{...config,enabled:false}:config;
 const reply=await runC20IdentityRequest(request(),cfg,h.deps);
 const body=await reply.json();
 assert.equal(reply.headers.get('cache-control'),'no-store');
 const expected={
  'feature-off':503,unauthorized:403,success:200,
  'provider-error':503,'stale-claim':503
 };
 assert.equal(reply.status,expected[name]);
 assert.equal(body.monitoringEnabled??false,false);
 assert.equal(body.comparisonsEnabled??false,false);
 assert.ok(!JSON.stringify(body).includes('MUST_NEVER_BE_RETURNED'));
 if(name==='feature-off')assert.deepEqual(h.events,[]);
 if(name==='unauthorized')assert.deepEqual(h.events,['auth']);
 if(name==='success'){
  assert.deepEqual(h.events,['auth','claim','provider','commit']);
  assert.equal(body.reviewState,'REVIEW_PENDING');
  assert.equal(body.expiresAt,'2026-11-27T10:00:00.000Z');
  assert.equal(h.store.size,1);
  assert.equal(h.quotaReserved,1);
  const replay=await runC20IdentityRequest(request(),cfg,h.deps);
  assert.equal(replay.status,409);
  assert.equal(h.events.filter(x=>x==='provider').length,1);
  assert.equal(h.quotaReserved,1);
 }
 if(name==='provider-error'){
  assert.equal(body.error,'YOUTUBE_IDENTITY_PROVIDER_FAILED');
  assert.deepEqual(h.events,['auth','claim','provider','finalize']);
  assert.equal(h.failureFinalizations,1);
  assert.equal(h.store.size,0);
  assert.equal(h.quotaReserved,1);
 }
 if(name==='stale-claim'){
  assert.equal(body.error,'C23_STALE_OR_REJECTED_IDENTITY_COMMIT');
  assert.deepEqual(h.events,['auth','claim','provider','commit']);
  assert.equal(h.failureFinalizations,0);
  assert.equal(h.store.size,0);
  assert.equal(h.quotaReserved,1);
 }
 return {
  name,passed:true,httpStatus:reply.status,steps:h.events,
  mockedProviderCalls:h.events.filter(x=>x==='provider').length,
  simulatedQuotaUnits:h.quotaReserved,
  inMemoryReviewRecords:h.store.size,
  failureFinalizations:h.failureFinalizations
 };
}
export async function runC30SyntheticRehearsal(){
 const c25=c25Audit(),c29=c29Audit();
 assert.equal(c25.safeToRunLivePilot,false);
 assert.equal(c29.safeToRunLivePilot,false);
 const scenarios=[];
 for(const name of ['feature-off','unauthorized','success','provider-error','stale-claim'])
  scenarios.push(await runScenario(name));
 return {
  kind:'CINERELAY_C30_SYNTHETIC_FIRST_CREATOR_REHEARSAL',
  mode:'OFFLINE_SIMULATION_ONLY',
  realProviderCalls:0,realDatabaseWrites:0,realQuotaUnitsUsed:0,
  paidResourcesCreated:0,simulatedIdentityAgeDays:27,
  syntheticRecordsPersisted:0,
  scenarios,passed:scenarios.every(x=>x.passed),
  c25ReleaseBlocked:!c25.safeToRunLivePilot,
  c29ReleaseBlocked:!c29.safeToRunLivePilot,
  safeToRunLivePilot:false,creatorMonitoringEnabled:false,
  creatorMetricsEnabled:false,creatorComparisonsEnabled:false,
  warning:'This is not a live operator-authentication, YouTube quota, hosted TTL, history-remediation or backup-retention test.'
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const mode=process.argv[2]??'--rehearse';
 if(!['--rehearse','--pilot'].includes(mode)){
  console.error('Usage: node scripts/creator-intelligence/c30-synthetic-first-pilot.mjs --rehearse|--pilot');
  process.exitCode=64;
 }else{
  try{
   console.log(JSON.stringify(await runC30SyntheticRehearsal(),null,2));
   if(mode==='--pilot')process.exitCode=2;
  }catch(error){
   console.error('C30_REHEARSAL_FAILED: '+String(error.message??error));
   process.exitCode=1;
  }
 }
}
