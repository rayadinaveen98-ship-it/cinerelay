import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=async path=>JSON.parse(await readFile(path,'utf8'));
const pilot=await read('apps/web/src/data/creator-official-pilot-2026-10-30.json');
const research=await read('apps/web/src/data/creator-research-2026-10-27.json');
const preliminary=await read('apps/web/src/data/creator-preliminary-page-evidence-2026-10-28.json');
const existing=await read('research/creator-intelligence/c2-existing-youtube-ids-2026-10-28.json');
let n=0;
function test(name,fn){fn();n++;console.log('PASS creator C10: '+name)}
test('official pilot has exactly 20 distinct YouTube API identities from a completed real run',()=>{
 assert.equal(pilot.kind,'CINERELAY_C10_OFFICIAL_API_IDENTITY_REVIEW');
 assert.equal(pilot.verification,'YOUTUBE_DATA_API_V3_CHANNELS_LIST_FOR_HANDLE');
 assert.equal(pilot.verifiedAt,'2026-10-30T09:27:42.049Z');
 assert.equal(pilot.channels.length,20);
 assert.equal(new Set(pilot.channels.map(x=>x.channelId)).size,20);
 assert.equal(new Set(pilot.channels.map(x=>x.listedHandle.toLowerCase())).size,20);
 assert.equal(pilot.sourceWorkflow,'https://github.com/rayadinaveen98-ship-it/cinerelay/actions/runs/41033581343');
});
test('every official ID matches a valid independent uploads playlist and has source provenance',()=>{
 for(const c of pilot.channels){
  assert.match(c.channelId,/^UC[A-Za-z0-9_-]{22}$/);
  assert.equal(c.uploadsPlaylistId,'UU'+c.channelId.slice(2));
  assert.ok(c.officialChannelTitle.trim());
  assert.ok(c.listedHandle.startsWith('@'));
  assert.ok(c.sourceUrl.startsWith('https://'));
  assert.equal(c.identityState,'OFFICIAL_API_ID_VERIFIED_REVIEW_PENDING');
 }
});
test('identity verification is never operator approval or ingestion authorization',()=>{
 assert.equal(pilot.productionDuplicateCountAtAudit,0);
 assert.equal(pilot.productionDedupeExistingCount,185);
 assert.ok(pilot.channels.every(x=>!x.operatorApproved&&!x.monitoringEnabled&&!x.metricsEnabled));
 assert.equal(new Set(pilot.channels.map(x=>x.operatorApproved)).size,1);
 assert.ok(pilot.channels.every(x=>!('subscriberCount' in x)&&!('viewCount' in x)));
});
test('no known collision with historical 185 UC IDs; admission still requires fresh dedupe',()=>{
 const prior=new Set(existing.channelIds);
 assert.equal(prior.size,185);
 assert.ok(pilot.channels.every(x=>!prior.has(x.channelId)));
});
test('full pilot includes smaller creators and distinct local-language cohorts',()=>{
 const byLocale=Object.fromEntries([...new Set(pilot.channels.map(x=>x.locale))].map(k=>
  [k,pilot.channels.filter(x=>x.locale===k).length]));
 assert.deepEqual(byLocale,{te:14,kn:3,mr:3});
 const byTier=Object.fromEntries([...new Set(pilot.channels.map(x=>x.sizeTierProvisional))].map(k=>
  [k,pilot.channels.filter(x=>x.sizeTierProvisional===k).length]));
 assert.deepEqual(byTier,{NANO_LT10K:4,MICRO_10K_100K:6,MID_100K_1M:5,LARGE_1M_10M:5});
});
test('the three earlier preliminary first-party matches now have matching actual C2 official IDs',()=>{
 assert.equal(preliminary.matches.length,3);
 for(const p of preliminary.matches){
  const official=pilot.channels.find(x=>x.channelId===p.officialChannelId);
  assert.ok(official,'Preliminary first-party ID must match real official API output');
  assert.equal(official.listedHandle.toLowerCase(),p.listedHandle.toLowerCase());
 }
});
test('research pool is unchanged and the verified pilot is a separate immutable snapshot',()=>{
 assert.equal(research.leads.length,94);
 assert.ok(research.leads.every(x=>x.apiVerified===false&&x.metricsEnabled===false&&x.monitoringEnabled===false));
 assert.ok(pilot.channels.every(x=>x.identityState==='OFFICIAL_API_ID_VERIFIED_REVIEW_PENDING'));
});
const page=await readFile('apps/web/src/pages/CreatorPilotReviewPage.tsx','utf8');
const archived=await readFile('apps/web/src/pages/CreatorResearchPage.tsx','utf8');
const app=await readFile('apps/web/src/App.tsx','utf8');
test('operator gated route is read only, archived matches are reconciled',()=>{
 assert.ok(page.includes('fetchConsoleOverview'));
 assert.ok(page.includes('if(guard.isError)') || page.includes('if(auth.isError)'));
 assert.ok(app.includes("path: '/creators/pilot'"));
 assert.ok(app.includes('component: CreatorPilotReviewPage'));
 assert.ok(archived.includes('newlyVerifiedIds.has(p.officialChannelId)'));
 assert.ok(!page.includes('YOUTUBE_API_KEY'));
 assert.ok(!page.includes('fetchCreatorComparison('));
 assert.ok(!page.includes('fetchCreatorDetail('));
 assert.ok(!page.includes('monitoringEnabled:true'));
});
console.log('PASS CineRelay C10: '+n+' official verified pilot identity tests');
