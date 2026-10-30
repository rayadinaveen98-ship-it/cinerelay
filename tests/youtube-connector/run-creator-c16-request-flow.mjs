import assert from 'node:assert/strict';
import {runC16ManualActivityRequest} from '../../supabase/functions/cinerelay-creator-activity-ingest/flow.mjs';

const CHANNEL='UCaaaaaaaaaaaaaaaaaaaaaa';
const OTHER='UCbbbbbbbbbbbbbbbbbbbbbb';
const OBSERVED='2026-10-30T11:00:00.000Z';
const EXPIRES_SCOPE='2026-10-31T11:00:00.000Z';
const TOKEN='12345678-1234-4234-a234-123456789abc';
const config={
 enabled:true,atomicEnabled:true,hasServerCredentials:true,
 dailyLimit:10000,reserve:2000,allowlist:CHANNEL,allowUntil:EXPIRES_SCOPE,
};
const fakeChannel=()=>({items:[{
 id:CHANNEL,contentDetails:{relatedPlaylists:{uploads:'UU'+CHANNEL.slice(2)}},
 statistics:{hiddenSubscriberCount:false,subscriberCount:'129000',videoCount:'48'},
}]});
const fakeUploads=()=>({items:[{
 contentDetails:{videoId:'aaaaaaaaaaa',videoPublishedAt:'2026-10-29T09:00:00Z'},
},{contentDetails:{videoId:'bbbbbbbbbbb',videoPublishedAt:'2026-10-28T09:00:00Z'}}]});

function request(channelId=CHANNEL,extra={}){
 return new Request('https://private.example/functions/v1/cinerelay-creator-activity-ingest',{
  method:'POST',
  headers:{authorization:'Bearer TEST_SESSION',
   'content-type':'application/json',
   'x-cinerelay-audit-intent':'ONE_SHOT_PUBLIC_ACTIVITY',
   ...(extra.headers||{})},
  body:extra.body??JSON.stringify({channelId}),
 });
}
function harness(overrides={}){
 const events=[],saved=[];
 let claimed=false;
 const deps={
  now:()=>OBSERVED,
  activeOperator:async()=>{events.push('auth');return true;},
  claim:async(id,limit,reserve)=>{
   events.push('claim');
   assert.equal(id,CHANNEL);assert.equal(limit,10000);assert.equal(reserve,2000);
   if(claimed)return {state:'BLOCKED_ACTIVE_OR_COOLDOWN'};
   claimed=true;
   return {state:'CLAIMED',quotaReceiptId:42,claimToken:TOKEN};
  },
  provider:async(method,params)=>{
   events.push('api:'+method);
   assert.equal(Object.hasOwn(params,'key'),false);
   if(method==='channels'){
    assert.equal(params.id,CHANNEL);
    return {status:200,body:fakeChannel()};
   }
   assert.equal(method,'playlistItems');
   assert.equal(params.playlistId,'UU'+CHANNEL.slice(2));
   assert.equal(params.maxResults,'3');
   return {status:200,body:fakeUploads()};
  },
  commit:async(id,token,receipt,row)=>{
   events.push('commit');assert.equal(id,CHANNEL);assert.equal(token,TOKEN);
   assert.equal(receipt,42);saved.push(row);return true;
  },
  finalize:async(id,token,receipt,success,status)=>{
   events.push('finalize');
   assert.equal(id,CHANNEL);assert.equal(token,TOKEN);assert.equal(receipt,42);
   assert.equal(success,false);assert.notEqual(status,200);return true;
  },
  ...overrides,
 };
 return {deps,events,saved};
}
async function parse(output){
 const body=await output.json();
 assert.equal(output.headers.get('cache-control'),'no-store');
 return {status:output.status,body};
}
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS C16: '+name);}
await test('success performs real HTTP gate, two provider reads, then one atomic C27 commit',async()=>{
 const h=harness();
 const {status,body}=await parse(await runC16ManualActivityRequest(request(),config,h.deps));
 assert.equal(status,200);assert.equal(body.ok,true);
 assert.equal(body.state,'PRIVATE_TTL_STORED');assert.equal(body.providerRequestsReserved,2);
 assert.equal(body.monitoringEnabled,false);assert.equal(body.comparisonsEnabled,false);
 assert.equal(body.expiresAt,'2026-11-27T11:00:00.000Z');
 assert.deepEqual(h.events,['auth','claim','api:channels','api:playlistItems','commit']);
 assert.equal(h.saved.length,1);
 assert.equal(h.saved[0].subscriber_count,'129000');
 assert.equal(h.saved[0].recent_public_uploads.length,2);
 assert.equal(Object.hasOwn(body,'subscriber_count'),false);
 assert.equal(Object.hasOwn(body,'apiKey'),false);
});
await test('both feature flags are independently OFF by default and skip auth/API',async()=>{
 for(const key of ['enabled','atomicEnabled','hasServerCredentials']){
  const h=harness();
  const result=await parse(await runC16ManualActivityRequest(request(),{...config,[key]:false},h.deps));
  assert.equal(result.status,503);assert.equal(h.events.length,0,key);
 }
});
await test('unknown/inactive operator is blocked before quota reservation',async()=>{
 const h=harness({activeOperator:async()=>false});
 const {status,body}=await parse(await runC16ManualActivityRequest(request(),config,h.deps));
 assert.equal(status,403);assert.equal(body.error,'ACTIVE_OPERATOR_REQUIRED');
 assert.deepEqual(h.events,[]);
});
await test('bad explicit intent and revoked or expired channel scope spend zero API quota',async()=>{
 for(const opts of [
  {r:request(CHANNEL,{headers:{'x-cinerelay-audit-intent':'WRONG'}})},
  {r:request(OTHER)},
  {r:request(),cfg:{...config,allowUntil:'2026-10-29T11:00:00Z'}},
  {r:request(),cfg:{...config,allowlist:OTHER}},
 ]){
  const h=harness();
  const {status}=await parse(await runC16ManualActivityRequest(opts.r,opts.cfg??config,h.deps));
  assert.ok(status===400||status===403);
  assert.ok(!h.events.includes('claim'));
 }
});
await test('invalid JSON, wrong shape and oversized chunked body cannot reserve quota',async()=>{
 for(const body of ['not json','[]','{"channelId":"bad"}',
  JSON.stringify({channelId:CHANNEL,extra:'not allowed'}),
  JSON.stringify({channelId:CHANNEL,padding:'x'.repeat(1000)})]){
  const h=harness();
  const {status}=await parse(await runC16ManualActivityRequest(
   request(CHANNEL,{body}),config,h.deps));
  assert.ok(status>=400);
  assert.ok(!h.events.includes('claim'));
 }
});
await test('atomic DB claim denial or quota exhaustion prevents both provider reads',async()=>{
 for(const state of ['BLOCKED_ACTIVE_OR_COOLDOWN',
  'BLOCKED_RECENT_PUBLIC_OBSERVATION','BLOCKED_QUOTA_RESERVE']){
  const h=harness({claim:async()=>{h.events.push('claim');return {state};}});
  const {status}=await parse(await runC16ManualActivityRequest(request(),config,h.deps));
  assert.equal(status,state==='BLOCKED_QUOTA_RESERVE'?429:409);
  assert.deepEqual(h.events,['auth','claim']);
 }
});
await test('duplicate simultaneous requests cannot both spend quota with mocked atomic DB',async()=>{
 const h=harness();
 const [one,two]=await Promise.all([
  runC16ManualActivityRequest(request(),config,h.deps),
  runC16ManualActivityRequest(request(),config,h.deps),
 ]);
 const states=(await Promise.all([parse(one),parse(two)])).map(x=>x.status).sort();
 assert.deepEqual(states,[200,409]);
 assert.equal(h.events.filter(x=>x==='api:channels').length,1);
 assert.equal(h.events.filter(x=>x==='commit').length,1);
 assert.equal(h.events.filter(x=>x==='finalize').length,0);
});
await test('hidden subscriber counts are redacted in private row',async()=>{
 const h=harness({provider:async(method)=>{
  h.events.push('api:'+method);
  if(method==='channels'){
   const data=fakeChannel();data.items[0].statistics.hiddenSubscriberCount=true;
   data.items[0].statistics.subscriberCount='999999';
   return {status:200,body:data};
  }
  return {status:200,body:fakeUploads()};
 }});
 const {status}=await parse(await runC16ManualActivityRequest(request(),config,h.deps));
 assert.equal(status,200);assert.equal(h.saved[0].subscriber_count,null);
});
await test('provider first-request failure does not call playlist/commit, but finalizes failure',async()=>{
 const h=harness({provider:async(method)=>{
  h.events.push('api:'+method);return {status:403,body:{apiError:'SECRET_PROVIDER_ERROR'}};
 }});
 const {status,body}=await parse(await runC16ManualActivityRequest(request(),config,h.deps));
 assert.equal(status,503);assert.equal(body.error,'CHANNEL_PROVIDER_FAILURE');
 assert.deepEqual(h.events,['auth','claim','api:channels','finalize']);
 assert.ok(!JSON.stringify(body).includes('SECRET_PROVIDER_ERROR'));
});
await test('playlist provider failure skips commit, finalizes and never returns provider payload',async()=>{
 const h=harness({provider:async(method)=>{
  h.events.push('api:'+method);
  return method==='channels'?{status:200,body:fakeChannel()}:
   {status:429,body:{detail:'PRIVATE_PROVIDER_TOKEN_SHOULD_NOT_LEAK'}};
 }});
 const {status,body}=await parse(await runC16ManualActivityRequest(request(),config,h.deps));
 assert.equal(status,503);assert.equal(body.error,'PLAYLIST_PROVIDER_FAILURE');
 assert.deepEqual(h.events,['auth','claim','api:channels','api:playlistItems','finalize']);
 assert.ok(!JSON.stringify(body).includes('PRIVATE_PROVIDER_TOKEN_SHOULD_NOT_LEAK'));
});
await test('channel spoofing or invalid playlist items fail closed before commit',async()=>{
 for(const caseName of ['channel','playlist']){
  const h=harness({provider:async(method)=>{
   h.events.push('api:'+method);
   if(method==='channels'){
    const c=fakeChannel();
    if(caseName==='channel')c.items[0].id=OTHER;
    return {status:200,body:c};
   }
   const p=fakeUploads();
   if(caseName==='playlist')p.items[0].contentDetails.videoId='invalid';
   return {status:200,body:p};
  }});
  const {status,body}=await parse(await runC16ManualActivityRequest(request(),config,h.deps));
  assert.equal(status,503);assert.equal(body.error,'PUBLIC_AUDIT_FAILED');
  assert.ok(!h.events.includes('commit'));
  assert.ok(h.events.includes('finalize'));
 }
});
await test('private transaction rejection or thrown error never reports success',async()=>{
 for(const commit of [async()=>false,async()=>{throw Error('private key cannot be leaked')}]){
  const h=harness({commit:async()=>{h.events.push('commit');return commit();}});
  const {status,body}=await parse(await runC16ManualActivityRequest(request(),config,h.deps));
  assert.equal(status,503);
  assert.ok(body.error==='C27_STALE_OR_REJECTED_ACTIVITY_COMMIT'||body.error==='C27_ATOMIC_ACTIVITY_COMMIT_FAILED');
  assert.ok(h.events.includes('commit'));
  assert.ok(!JSON.stringify(body).includes('private key'));
 }
});
await test('failure-only quota finalization rejects errors and never persists public data',async()=>{
 for(const finalize of [async()=>false,async()=>{throw Error('PRIVATE_TOKEN')}]) {
  const h=harness({
   provider:async()=>{h.events.push('api:channels');return {status:403,body:null};},
   finalize:async()=>{h.events.push('finalize');return finalize();}
  });
  const {status,body}=await parse(await runC16ManualActivityRequest(request(),config,h.deps));
  assert.equal(status,503);assert.equal(body.error,'C14_CLAIM_FINALIZATION_FAILED');
  assert.equal(h.saved.length,0);
  assert.ok(!JSON.stringify(body).includes('PRIVATE_TOKEN'));
 }
});

await test('unexpected claim RPC failure remains no-provider and no-public-error-detail',async()=>{
 const h=harness({claim:async()=>{throw Error('DB_SECRET');}});
 const {status,body}=await parse(await runC16ManualActivityRequest(request(),config,h.deps));
 assert.equal(status,503);assert.equal(body.error,'C14_CLAIM_UNAVAILABLE');
 assert.deepEqual(h.events,['auth']);
 assert.ok(!JSON.stringify(body).includes('DB_SECRET'));
});
console.log('PASS CineRelay C16: '+count+' full HTTP decision-path integration scenarios (all simulated)');
