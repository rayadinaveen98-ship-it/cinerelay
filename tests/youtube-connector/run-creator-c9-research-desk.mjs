import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=async path=>JSON.parse(await readFile(path,'utf8'));
const src=await read('apps/web/src/data/creator-research-2026-10-27.json');
const preliminary=await read('apps/web/src/data/creator-preliminary-page-evidence-2026-10-28.json');
let tests=0;
function test(label,fn){fn();tests++;console.log('PASS creator C9: '+label)}
test('real research pool has exactly 94 distinct leads, not activated users',()=>{
 assert.equal(src.kind,'CINERELAY_CREATOR_RESEARCH_ONLY_2026_10_27');
 assert.equal(src.leads.length,94);
 assert.equal(new Set(src.leads.map(x=>x.id)).size,94);
 assert.ok(src.leads.every(x=>x.researchStatus==='RESEARCH_ONLY'&&x.apiVerified===false
  &&x.monitoringEnabled===false&&x.metricsEnabled===false&&!('officialChannelId' in x)));
});
test('every lead has source provenance, a nonempty name and valid permitted research metadata',()=>{
 for(const item of src.leads){
  assert.ok(typeof item.name==='string'&&item.name.trim());
  assert.ok(typeof item.category==='string'&&item.category.trim());
  assert.match(item.discoverySourceUrl,/^https:\/\/[^ ]+$/);
  assert.ok(typeof item.locale==='string'&&item.locale.length>0);
  assert.ok(typeof item.provisionalTier==='string');
 }
 assert.equal(new Set(src.leads.map(x=>x.discoverySourceUrl)).size,13);
});
test('listed handle and identity unknown remain distinguishable',()=>{
 const listed=src.leads.filter(x=>x.listedHandle!==null);
 assert.equal(listed.length,44);
 assert.equal(src.leads.filter(x=>x.listedHandle===null).length,50);
 assert.equal(new Set(listed.map(x=>x.listedHandle.toLowerCase())).size,44);
});
test('balanced cohort source is not changed into celebrity-only or Telugu-only',()=>{
 const tiers=Object.fromEntries([...new Set(src.leads.map(x=>x.provisionalTier))]
  .map(t=>[t,src.leads.filter(x=>x.provisionalTier===t).length]));
 assert.deepEqual(tiers,{
  MID_100K_1M:20,MICRO_10K_100K:21,NANO_LT10K:7,
  LARGE_1M_10M:19,UNVERIFIED:21,MEGA_10M_PLUS:6});
 assert.equal(src.leads.filter(x=>x.locale==='te').length,38);
 assert.equal(src.leads.filter(x=>x.locale!=='te').length,56);
 assert.equal(new Set(src.leads.map(x=>x.locale)).size,9);
});
test('preliminary public-page matches are distinct from official YouTube API evidence',()=>{
 assert.equal(preliminary.kind,'CINERELAY_PRELIMINARY_PAGE_EVIDENCE');
 assert.equal(preliminary.apiVerified,false);
 assert.equal(preliminary.reviewApproved,false);
 assert.equal(preliminary.trackingEnabled,false);
 assert.equal(preliminary.matches.length,3);
 const ids=new Set();
 for(const p of preliminary.matches){
  assert.equal(p.approved,false);
  assert.equal(p.stage,'YOUTUBE_PAGE_ID_FOUND_API_PENDING');
  assert.match(p.officialChannelId,/^UC[A-Za-z0-9_-]{22}$/);
  assert.equal(p.firstPartyChannelPage,'https://www.youtube.com/channel/'+p.officialChannelId);
  assert.equal(ids.has(p.officialChannelId),false);
  ids.add(p.officialChannelId);
 }
});
test('research screen is operator-guarded and contains no activation or API collection actions',async()=>{
 const page=await readFile('apps/web/src/pages/CreatorResearchPage.tsx','utf8');
 const app=await readFile('apps/web/src/App.tsx','utf8');
 assert.ok(page.includes('fetchConsoleOverview'));
 assert.ok(page.includes("if(guard.isError)"));
 assert.ok(page.includes("return <ResearchContent/>"));
 assert.ok(app.includes("path: '/creators/research'"));
 assert.ok(app.includes('component: CreatorResearchPage'));
 assert.ok(app.includes('researchRoute, compareRoute'));
 assert.equal(page.includes('fetchCreatorComparison('),false);
 assert.equal(page.includes('fetchCreatorDetail('),false);
 assert.equal(page.includes('fetchCreatorOverview('),false);
 assert.equal(page.includes('YOUTUBE_API_KEY'),false);
});
console.log('PASS CineRelay C9: '+tests+' research desk integrity contracts');
