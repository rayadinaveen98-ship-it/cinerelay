import assert from 'node:assert/strict';
import {runC20IdentityRequest,parseOfficialIdentity,validateReviewedCandidates}
 from '../../supabase/functions/cinerelay-creator-identity-verify/flow.mjs';
const HANDLE='@synthetichandle',ID='UC'+'a'.repeat(22),OTHER='UC'+'b'.repeat(22);
const NOW='2026-10-30T11:45:00.000Z',UNTIL='2026-10-31T11:45:00.000Z';
const TOKEN='00000000-1111-4222-8333-444444444444';
const candidate={handle:HANDLE,name:'Synthetic creator',locale:'te',category:'Education',
 sizeTier:'NANO_LT10K',sourceUrl:'https://example.org/review'};
const cfg={enabled:true,atomicEnabled:true,hasServerCredentials:true,
 dailyLimit:10000,reserve:2000,allowUntil:UNTIL,candidates:[candidate]};
const provider=()=>({items:[{id:ID,snippet:{title:'Synthetic official title'},
 contentDetails:{relatedPlaylists:{uploads:'UU'+ID.slice(2)}}}]});
const req=(handle=HANDLE,extra={})=>new Request('https://example.org/functions/v1/cinerelay-creator-identity-verify',{
 method:'POST',headers:{authorization:'Bearer TEST_OPERATOR',
 'x-cinerelay-identity-intent':'ONE_SHOT_OFFICIAL_IDENTITY',
 ...extra.headers},body:extra.body??JSON.stringify({handle}),
});
function harness(overrides={}){
 const events=[],saved=[];
 let claimed=false;
 const deps={
  now:()=>NOW,
  activeOperator:async()=>{events.push('auth');return true;},
  claim:async(handle,limit,reserve)=>{
   events.push('claim');assert.equal(handle,HANDLE);
   assert.equal(limit,10000);assert.equal(reserve,2000);
   if(claimed)return {state:'BLOCKED_ACTIVE_OR_COOLDOWN'};
   claimed=true;return {state:'CLAIMED',quotaReceiptId:101,claimToken:TOKEN};
  },
  provider:async(handle)=>{events.push('provider');assert.equal(handle,HANDLE);
   return {status:200,body:provider()};},
  save:async row=>{events.push('save');saved.push(row);return true;},
  finalize:async(handle,token,receipt,success,status)=>{
   events.push('finalize');assert.equal(handle,HANDLE);assert.equal(token,TOKEN);
   assert.equal(receipt,101);assert.equal(success,status===200);return true;
  },
  ...overrides,
 };
 return {deps,events,saved};
}
const parse=async r=>({status:r.status,body:await r.json(),cache:r.headers.get('cache-control')});
let n=0;async function test(name,fn){await fn();n++;console.log('PASS C20: '+name);}
await test('only vetted, unique at-most-20 scoped handles are admissible',()=>{
 assert.equal(validateReviewedCandidates([candidate]).size,1);
 assert.equal(validateReviewedCandidates([candidate,{...candidate,handle:'@SYNTHETICHANDLE'}]),null);
 assert.equal(validateReviewedCandidates(Array.from({length:21},(_,i)=>({...candidate,handle:'@handle'+i}))),null);
 assert.equal(validateReviewedCandidates([{...candidate,sizeTier:'INFERRED'}]),null);
 assert.equal(validateReviewedCandidates([{...candidate,sourceUrl:'http://unsafe.test'}]),null);
 assert.equal(validateReviewedCandidates([{...candidate,handle:'@bad/name'}]),null);
});
await test('success checks operator -> quota claim -> ONE provider -> private write -> finalize',async()=>{
 const h=harness(),result=await parse(await runC20IdentityRequest(req(),cfg,h.deps));
 assert.equal(result.status,200);assert.equal(result.cache,'no-store');
 assert.deepEqual(h.events,['auth','claim','provider','save','finalize']);
 assert.equal(result.body.channelId,ID);
 assert.equal(result.body.providerRequestsReserved,1);
 assert.equal(result.body.expiresAt,'2026-11-26T11:45:00.000Z');
 assert.equal(result.body.monitoringEnabled,false);
 assert.equal(result.body.comparisonsEnabled,false);
 assert.equal(h.saved.length,1);
 assert.equal(h.saved[0].listed_handle,HANDLE);
 assert.equal(h.saved[0].official_channel_title,'Synthetic official title');
 assert.equal(h.saved[0].review_state,'REVIEW_PENDING');
 assert.equal(h.saved[0].monitoring_enabled,false);
 assert.equal(h.saved[0].metrics_enabled,false);
});
await test('two OFF-by-default flags and missing server credentials never call auth/provider',async()=>{
 for(const key of ['enabled','atomicEnabled','hasServerCredentials']){
  const h=harness(),res=await parse(await runC20IdentityRequest(req(),{...cfg,[key]:false},h.deps));
  assert.equal(res.status,503);assert.deepEqual(h.events,[]);
 }
});
await test('missing verified quota and invalid/expired allowlist fail before provider',async()=>{
 for(const conf of [
  {...cfg,dailyLimit:0},{...cfg,reserve:999},
  {...cfg,allowUntil:'2026-10-29T11:45:00Z'},
  {...cfg,allowUntil:'2026-11-12T11:45:00Z'},
  {...cfg,candidates:[]},
 ]){
  const h=harness(),res=await parse(await runC20IdentityRequest(req(),conf,h.deps));
  assert.equal(res.status,503);assert.deepEqual(h.events,[]);
 }
});
await test('unauthenticated operator blocks before quota/provider',async()=>{
 const h=harness({activeOperator:async()=>false});
 const res=await parse(await runC20IdentityRequest(req(),cfg,h.deps));
 assert.equal(res.status,403);assert.deepEqual(h.events,[]);
});
await test('bad intent, extra fields, absent handle, unknown handle, oversized payload denied pre-claim',async()=>{
 for(const opts of [
  {request:req(HANDLE,{headers:{'x-cinerelay-identity-intent':'NOT_APPROVED'}})},
  {request:req(HANDLE,{body:'[]'})},
  {request:req(HANDLE,{body:JSON.stringify({handle:HANDLE,activate:true})})},
  {request:req('@nothere')},
  {request:req(HANDLE,{body:JSON.stringify({handle:HANDLE,extra:'x'.repeat(800)})})},
 ]){
  const h=harness(),res=await parse(await runC20IdentityRequest(opts.request,cfg,h.deps));
  assert.ok([400,403,413].includes(res.status));
  assert.ok(!h.events.includes('claim')&& !h.events.includes('provider'));
 }
});
await test('quota rejected, fresh identity or duplicate claim cannot call Google',async()=>{
 for(const state of ['BLOCKED_QUOTA_RESERVE','BLOCKED_FRESH_IDENTITY','BLOCKED_ACTIVE_OR_COOLDOWN']){
  const h=harness({claim:async()=>{h.events.push('claim');return {state};}});
  const result=await parse(await runC20IdentityRequest(req(),cfg,h.deps));
  assert.equal(result.status,state==='BLOCKED_QUOTA_RESERVE'?429:409);
  assert.deepEqual(h.events,['auth','claim']);
 }
});
await test('two racing handler calls produce one provider request with atomic claim dependency',async()=>{
 const h=harness();
 const pair=await Promise.all([runC20IdentityRequest(req(),cfg,h.deps),
  runC20IdentityRequest(req(),cfg,h.deps)]);
 assert.deepEqual(pair.map(x=>x.status).sort(),[200,409]);
 assert.equal(h.events.filter(x=>x==='provider').length,1);
});
await test('official identity must be single item with matching UC and UU and plausible title',async()=>{
 assert.equal(parseOfficialIdentity(provider(),HANDLE,candidate,NOW).channel_id,ID);
 for(const bad of [
  {items:[]},{items:[provider().items[0],provider().items[0]]},
  {items:[{...provider().items[0],id:OTHER}]},
  {items:[{...provider().items[0],contentDetails:{relatedPlaylists:{uploads:'UUwrong'}}}]},
  {items:[{...provider().items[0],snippet:{title:''}}]},
 ]){
  // Another valid UC can be valid for a changed handle, but its wrong playlist must be denied.
  if(bad.items?.[0]?.id===OTHER)bad.items[0].contentDetails={relatedPlaylists:{uploads:'UUinvalid'}};
  assert.throws(()=>parseOfficialIdentity(bad,HANDLE,candidate,NOW));
 }
});
await test('Google error fails closed with quota finalized; provider body never leaked',async()=>{
 const h=harness({provider:async()=>{h.events.push('provider');
  return {status:403,body:{secret:'PRIVATE_PROVIDER_ERROR'}};}});
 const res=await parse(await runC20IdentityRequest(req(),cfg,h.deps));
 assert.equal(res.status,503);assert.equal(res.body.error,'YOUTUBE_IDENTITY_PROVIDER_FAILED');
 assert.deepEqual(h.events,['auth','claim','provider','finalize']);
 assert.ok(!JSON.stringify(res.body).includes('PRIVATE_PROVIDER_ERROR'));
});
await test('malformed provider data or private storage error denies success, still finalizes',async()=>{
 for(const override of [
  {provider:async()=>{throw Error('PRIVATE_TOKEN');}},
  {provider:async()=>({status:200,body:{items:[]}})},
  {save:async()=>false},
  {save:async()=>{throw Error('DB_PRIVATE');}},
 ]){
  const h=harness(override);
  const res=await parse(await runC20IdentityRequest(req(),cfg,h.deps));
  assert.equal(res.status,503);assert.ok(h.events.includes('finalize'));
  assert.ok(!JSON.stringify(res.body).includes('DB_PRIVATE'));
 }
});
await test('finalization must succeed before reporting success',async()=>{
 const h=harness({finalize:async()=>{h.events.push('finalize');return false;}});
 const result=await parse(await runC20IdentityRequest(req(),cfg,h.deps));
 assert.equal(result.status,503);assert.equal(result.body.error,'C20_QUOTA_FINALIZE_FAILED');
 assert.equal(h.saved.length,1);
});
await test('claim RPC error fails before provider without revealing database cause',async()=>{
 const h=harness({claim:async()=>{throw Error('PRIVATE_CREDENTIAL');}});
 const result=await parse(await runC20IdentityRequest(req(),cfg,h.deps));
 assert.equal(result.status,503);assert.equal(result.body.error,'C20_CLAIM_UNAVAILABLE');
 assert.ok(!h.events.includes('provider'));
});
console.log('PASS CineRelay C20: '+n+' mock official identity, quota and write/finalize scenarios');
