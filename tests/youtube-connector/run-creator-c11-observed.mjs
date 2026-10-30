import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const r=await read('research/creator-intelligence/c11-public-activity-results.json');
const d=await read('apps/web/src/data/creator-public-activity-2026-10-30.json');
const pilot=await read('apps/web/src/data/creator-official-pilot-2026-10-30.json');
const view=await readFile('apps/web/src/pages/CreatorPilotReviewPage.tsx','utf8');
let n=0;
function test(name,fn){fn();n++;console.log('PASS creator C11 data: '+name)}
test('real one-shot API report contains exactly 20 successful inactive channel audits',()=>{
 assert.equal(r.status,'COMPLETED');
 assert.equal(r.usedRequests,21);
 assert.equal(r.channelResults.length,20);
 assert.equal(r.monitoringEnabled,false);
 assert.equal(r.metricsEnabled,false);
 assert.ok(r.channelResults.every(x=>x.status==='PUBLIC_UPLOADS_OBSERVED'));
});
test('research display copy exactly preserves API timestamp, observation scope, and expiry',()=>{
 assert.equal(d.kind,'CINERELAY_C11_PUBLIC_ACTIVITY_SNAPSHOT');
 assert.equal(d.observedAt,r.observedAt);
 assert.equal(d.expiresAt,r.expiresAt);
 assert.equal(d.channels.length,20);
 assert.equal(d.sourceRun,'https://github.com/rayadinaveen98-ship-it/cinerelay/actions/runs/41036715214');
 assert.equal(Date.parse(d.expiresAt)-Date.parse(d.observedAt),30*86400000);
});
test('all 20 identity joins are exact; public video IDs and dates are valid',()=>{
 const ids=new Set(pilot.channels.map(x=>x.channelId));
 assert.equal(ids.size,20);
 assert.equal(new Set(d.channels.map(x=>x.channelId)).size,20);
 for(const c of d.channels){
  assert.ok(ids.has(c.channelId));
  assert.match(c.channelId,/^UC[A-Za-z0-9_-]{22}$/);
  assert.equal(c.status,'PUBLIC_UPLOADS_OBSERVED');
  assert.ok(c.latestPublicVideos.length<=3);
  assert.match(c.videoCountPublic,/^\d+$/);
  assert.ok(c.subscriberCountApprox===null||/^\d+$/.test(c.subscriberCountApprox));
  for(const v of c.latestPublicVideos){
   assert.match(v.videoId,/^[a-zA-Z0-9_-]{11}$/);
   assert.ok(v.publishedAt===null||Number.isFinite(Date.parse(v.publishedAt)));
  }
 }
});
test('current dataset stores 60 public video references and no views, likes or comments',()=>{
 assert.equal(d.channels.reduce((n,x)=>n+x.latestPublicVideos.length,0),60);
 const flat=JSON.stringify(d);
 assert.ok(!flat.includes('"viewCount"'));
 assert.ok(!flat.includes('"likeCount"'));
 assert.ok(!flat.includes('"commentCount"'));
 assert.ok(!flat.includes('"engagementScore"'));
 assert.ok(!flat.includes('"revenue"'));
});
test('real observed latest public uploads cover 13 within 30 days, 3 in 31-90, 4 older',()=>{
 const observed=Date.parse(d.observedAt),count={last30:0,within31to90:0,olderThan90:0};
 for(const c of d.channels){
  const latest=Math.max(...c.latestPublicVideos.map(x=>Date.parse(x.publishedAt)).filter(Number.isFinite));
  assert.ok(Number.isFinite(latest)&&latest<=observed);
  const days=(observed-latest)/86400000;
  if(days<=30)count.last30++;
  else if(days<=90)count.within31to90++;
  else count.olderThan90++;
 }
 assert.deepEqual(count,{last30:13,within31to90:3,olderThan90:4});
});
test('operator UI discloses dated snapshot, expiry and absence of automatic activation',()=>{
 assert.ok(view.includes('fetchConsoleOverview'));
 assert.ok(view.includes('evidenceExpired'));
 assert.ok(view.includes('activity.expiresAt'));
 assert.ok(view.includes('Public subscriber count (rounded by YouTube)'));
 assert.ok(view.includes('one-time public upload and subscriber metadata check'));
 assert.ok(!view.includes('YOUTUBE_API_KEY'));
 assert.ok(!view.includes('updateCreatorMonitoring'));
 assert.ok(!view.includes('supabase.functions.invoke('));
});
console.log('PASS CineRelay C11: '+n+' actual public-activity evidence contracts');
