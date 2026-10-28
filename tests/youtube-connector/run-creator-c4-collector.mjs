import assert from 'node:assert/strict';
import {collectOneCreatorMetricsBatch} from '../../packages/youtube-connector/dist/creator-metric-collector.js';
const a='UCaaaaaaaaaaaaaaaaaaaaaa',b='UCbbbbbbbbbbbbbbbbbbbbbb';
const v1='aaaaaaaaaaa',v2='bbbbbbbbbbb',v3='ccccccccccc';
const now='2026-10-28T15:00:00Z';
const candidates=[
 {videoId:v1,channelId:a,publishedAt:'2026-10-28T13:00:00Z'},
 {videoId:v2,channelId:b,publishedAt:'2026-10-28T13:30:00Z'},
];
const make=(overrides={})=>{
 const calls={reserve:[],fetch:[],persist:[],finalize:[]};
 const services={
   reserveQuota:async(n)=>{calls.reserve.push(n);return 66;},
   fetchStats:async(url)=>{calls.fetch.push(url);return {status:200,body:{
     items:[{id:v1,statistics:{viewCount:'1200',likeCount:'12'}},
            {id:v2,statistics:{viewCount:'1450',commentCount:'4'}}],
     summary:{failedVideoIds:[]},
   }};},
   persistSamples:async(rows)=>{calls.persist.push(rows);},
   finalizeQuota:async(...args)=>{calls.finalize.push(args);},
   observedClock:()=>now,
   ...overrides,
 };
 return {calls,services};
};
let n=0;
async function test(label,fn){await fn();n++;console.log('PASS creator C4 '+label);}
await test('one batch is quota-reserved before provider fetch, then saved and finalized',async()=>{
  const {calls,services}=make();
  const result=await collectOneCreatorMetricsBatch(now,candidates,services);
  assert.equal(result.state,'COLLECTED');
  assert.equal(result.persistedVideos,2);
  assert.deepEqual(calls.reserve,[2]);
  assert.equal(calls.fetch.length,1);
  assert.equal(new URL(calls.fetch[0]).pathname,'/youtube/v3/videos:batchGetStats');
  assert.equal(new URL(calls.fetch[0]).searchParams.has('key'),false);
  assert.equal(calls.persist[0][0].likeCount,'12');
  assert.equal(calls.persist[0][0].commentCount,null);
  assert.equal(calls.persist[0][0].expiresAt,'2026-11-27T15:00:00.000Z');
  assert.deepEqual(calls.finalize,[[66,200,'PERSISTED']]);
});
await test('missing quota stops all API and database work',async()=>{
 const {calls,services}=make({reserveQuota:async(n)=>{calls.reserve.push(n);return null;}});
 const result=await collectOneCreatorMetricsBatch(now,candidates,services);
 assert.equal(result.state,'QUOTA_EXHAUSTED');
 assert.equal(result.quotaReserved,false);
 assert.equal(calls.fetch.length,0);
 assert.equal(calls.persist.length,0);
 assert.equal(calls.finalize.length,0);
});
await test('no due videos costs no quota',async()=>{
 const {calls,services}=make();
 const result=await collectOneCreatorMetricsBatch(now,[{...candidates[0],lastObservedAt:'2026-10-28T14:58:00Z'}],services);
 assert.equal(result.state,'NO_DUE_VIDEOS');
 assert.equal(calls.reserve.length,0);
});
await test('HTTP 429 is counted and never retried',async()=>{
 const {calls,services}=make({fetchStats:async(u)=>{calls.fetch.push(u);return {status:429}}});
 const result=await collectOneCreatorMetricsBatch(now,candidates,services);
 assert.equal(result.state,'HTTP_ERROR');assert.equal(result.requestStatus,429);
 assert.equal(calls.fetch.length,1);assert.equal(calls.persist.length,0);
 assert.deepEqual(calls.finalize,[[66,429,'UPSTREAM_HTTP_ERROR']]);
});
await test('transport failure is charged but does not expose secret or retry',async()=>{
 const {calls,services}=make({fetchStats:async(u)=>{calls.fetch.push(u);throw Error('network SECRET_BOGUS_API_KEY');}});
 const result=await collectOneCreatorMetricsBatch(now,candidates,services);
 assert.equal(result.state,'TRANSPORT_ERROR');
 assert.equal(calls.fetch.length,1);
 assert.equal(JSON.stringify(result).includes('SECRET_BOGUS_API_KEY'),false);
 assert.deepEqual(calls.finalize,[[66,null,'NETWORK_OR_RUNTIME_FAILURE']]);
});
await test('provider missing requested videos is a protocol error; no partial misleading save',async()=>{
 const {calls,services}=make({fetchStats:async(u)=>{calls.fetch.push(u);return {status:200,
  body:{items:[{id:v1,statistics:{viewCount:'1'}}],summary:{failedVideoIds:[]}}};}});
 const result=await collectOneCreatorMetricsBatch(now,candidates,services);
 assert.equal(result.state,'BAD_PROVIDER_RESULT');
 assert.equal(calls.persist.length,0);
 assert.deepEqual(calls.finalize,[[66,200,'REJECTED_PROVIDER_VIDEO_IDS']]);
});
await test('provider returned unrelated video rejected before DB save',async()=>{
 const {calls,services}=make({fetchStats:async(u)=>{calls.fetch.push(u);return {status:200,
  body:{items:[{id:v1,statistics:{viewCount:'2'}},{id:v3,statistics:{viewCount:'3'}}],
    summary:{failedVideoIds:[]}}};}});
 const result=await collectOneCreatorMetricsBatch(now,candidates,services);
 assert.equal(result.state,'BAD_PROVIDER_RESULT');assert.equal(calls.persist.length,0);
});
await test('explicit provider failure IDs count but do not create fake zero counters',async()=>{
 const {calls,services}=make({fetchStats:async(u)=>{calls.fetch.push(u);return {status:200,
  body:{items:[{id:v1,statistics:{viewCount:'100'}}],summary:{failedVideoIds:[v2]}}};}});
 const result=await collectOneCreatorMetricsBatch(now,candidates,services);
 assert.equal(result.state,'COLLECTED');assert.equal(result.providerFailedVideos,1);
 assert.equal(calls.persist[0].length,1);
});
await test('no available counters means no DB record',async()=>{
 const {calls,services}=make({fetchStats:async(u)=>({status:200,body:{
   items:[{id:v1,statistics:{}},{id:v2,statistics:{}}],summary:{failedVideoIds:[]}}})});
 const result=await collectOneCreatorMetricsBatch(now,candidates,services);
 assert.equal(result.state,'EMPTY_PUBLIC_STATS');
 assert.equal(calls.persist.length,0);
 assert.deepEqual(calls.finalize,[[66,200,'NO_PUBLIC_STATS']]);
});
await test('DB rejection is charged and not reported as success',async()=>{
 const {calls,services}=make({persistSamples:async(rows)=>{calls.persist.push(rows);throw Error('RLS denied');}});
 const result=await collectOneCreatorMetricsBatch(now,candidates,services);
 assert.equal(result.state,'PERSIST_FAILED');
 assert.equal(result.persistedVideos,0);
 assert.deepEqual(calls.finalize,[[66,200,'PERSIST_REJECTED']]);
});
await test('broken quota-audit finalization propagates, not silent success',async()=>{
 const {services}=make({finalizeQuota:async()=>{throw Error('AUDIT_UPDATE_FAILED');}});
 await assert.rejects(()=>collectOneCreatorMetricsBatch(now,candidates,services),/AUDIT_UPDATE_FAILED/);
});
await test('max 50 videos selected per invocation despite 75 candidates',async()=>{
 const many=Array.from({length:75},(_,i)=>({videoId:i.toString(36).padStart(11,'0'),channelId:i%2?a:b,
  publishedAt:'2026-10-28T11:00:00Z'}));
 const {calls,services}=make({fetchStats:async(u)=>{calls.fetch.push(u);
   return {status:200,body:{items:[],summary:{failedVideoIds:many.slice(0,50).map(x=>x.videoId)}}};}});
 const result=await collectOneCreatorMetricsBatch(now,many,services);
 assert.equal(result.attemptedVideos,50);
 assert.equal(calls.fetch.length,1);
 assert.equal(new URL(calls.fetch[0]).searchParams.get('id').split(',').length,50);
});
console.log('Creator C4 collector: '+n+' checks passed');
