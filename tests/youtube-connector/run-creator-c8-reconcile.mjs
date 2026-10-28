import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {reconcileC8LiveIds} from '../../scripts/creator-intelligence/reconcile-c8-live-ids.mjs';

const A='UCaaaaaaaaaaaaaaaaaaaaaa',B='UCbbbbbbbbbbbbbbbbbbbbbb';
const C='UCcccccccccccccccccccccc',D='UCdddddddddddddddddddddd';
const T='2026-10-28T15:55:00Z';
const candidate=(name,handle)=>({name,listedHandle:handle,locale:'kn',
  niche:'Independent education',provisionalSizeTier:'NANO_LT10K',
  sourceUrl:'https://example.org/public-list',verified:false,
  trackingEnabled:false,officialChannelId:null});
const pool={candidates:[candidate('Alpha','@alphaaa'),candidate('Beta','@betaaaa')]};
const existing={channelIds:[B]};
const row=(c,id)=>({candidateName:c.name,listedHandle:c.listedHandle,
  status:'OFFICIAL_ID_FOUND_REVIEW_PENDING',trackingEnabled:false,officialChannelId:id,
  officialChannelTitle:'Official '+c.name,uploadsPlaylistId:'UU'+id.slice(2)});
const verification=()=>({kind:'CINERELAY_CREATOR_C2_VERIFICATION',
  observedAt:'2026-10-28T15:35:00Z',expiresAt:'2026-11-27T15:35:00.000Z',
  idSnapshotCount:1,totalCandidates:2,attempted:2,usedRequests:2,maxRequests:20,
  status:'COMPLETED',rows:[row(pool.candidates[0],A),row(pool.candidates[1],C)]});
const live=()=>({kind:'CINERELAY_C8_LIVE_SOURCE_IDS',
  source:'PUBLIC_SOURCE_IDENTITIES_YOUTUBE_SELECT_ONLY',
  capturedAt:'2026-10-28T15:50:00Z',sourceCount:1,channelIds:[B]});
const firstParty=()=>({apiVerified:false,reviewApproved:false,trackingEnabled:false,
  matches:[{name:'Public page only',listedHandle:'@pageonly',
    officialChannelId:D,firstPartyChannelPage:'https://www.youtube.com/channel/'+D,
    stage:'YOUTUBE_PAGE_ID_FOUND_API_PENDING',approved:false}]});
const arg=()=>({pool,existing,verification:verification(),live:live(),firstParty:firstParty(),at:T});
let n=0;
function test(name,fn){fn();n++;console.log('PASS C8: '+name)}
test('fresh unchanged production IDs allow strictly manual review, not collection',()=>{
  const out=reconcileC8LiveIds(arg());
  assert.equal(out.status,'AWAITING_HUMAN_IDENTITY_REVIEW');
  assert.equal(out.reviewQueue.length,2);
  assert.equal(out.pilot.preliminaryPublicPageMatches,1);
  assert.equal(out.pilot.apiVerifiedRows,2);
  assert.equal(out.gates.productionCollectionAuthorized,false);
  assert.equal(out.gates.creatorOperatorApprovalsPresent,false);
  assert.equal(out.safeguards.noMetricsCollection,true);
  assert.match(out.sourceSnapshot.sortedIdsSha256,/^[a-f0-9]{64}$/);
});
test('stale or future snapshot cannot open human review',()=>{
  const input=arg();input.live.capturedAt='2026-10-28T15:35:00Z';
  assert.equal(reconcileC8LiveIds(input).status,'BLOCKED_STALE_LIVE_SNAPSHOT');
  assert.deepEqual(reconcileC8LiveIds(input).reviewQueue,[]);
  input.live.capturedAt='2026-10-28T16:00:00Z';
  assert.throws(()=>reconcileC8LiveIds(input),/Future source snapshot/);
});
test('new production identity blocks all review even if originally clear',()=>{
  const input=arg();input.live.channelIds.push(A);input.live.sourceCount=2;
  const out=reconcileC8LiveIds(input);
  assert.equal(out.status,'BLOCKED_PRODUCTION_ID_DRIFT');
  assert.equal(out.sourceSnapshot.addedIds,1);
  assert.deepEqual(out.reviewQueue,[]);
  assert.equal(out.gates.liveProductionUcIdDedupeComplete,false);
});
test('missing previous identity also blocks review until human baseline reconciliation',()=>{
  const input=arg();input.live.channelIds=[D];input.live.sourceCount=1;
  const out=reconcileC8LiveIds(input);
  assert.equal(out.sourceSnapshot.addedIds,1);
  assert.equal(out.sourceSnapshot.removedIds,1);
  assert.equal(out.status,'BLOCKED_PRODUCTION_ID_DRIFT');
});
test('forged duplicate or unapproved first-party page evidence is rejected',()=>{
  const input=arg();input.live.channelIds=[B,B];input.live.sourceCount=2;
  assert.throws(()=>reconcileC8LiveIds(input),/duplicate live/);
  input.live=live();input.firstParty.apiVerified=true;
  assert.throws(()=>reconcileC8LiveIds(input),/cannot be treated as API verification/);
  input.firstParty.apiVerified=false;input.firstParty.matches[0].approved=true;
  assert.throws(()=>reconcileC8LiveIds(input),/Invalid or duplicated/);
});
test('quota/auth interruption never grants a queue, even with some verified rows',()=>{
  const input=arg();input.verification.status='HALTED_AUTH_OR_QUOTA';
  const out=reconcileC8LiveIds(input);
  assert.deepEqual(out.reviewQueue,[]);
  assert.equal(out.gates.productionCollectionAuthorized,false);
});
test('current real checked-in report remains blocked with 185 current production identities',async()=>{
  const read=async path=>JSON.parse(await readFile('research/creator-intelligence/'+path,'utf8'));
  const [p,e,v,f,s]=await Promise.all([
    read('c2-verification-input-20.json'),
    read('c2-existing-youtube-ids-2026-10-28.json'),
    read('c2-official-id-results.json'),
    read('c2-first-party-page-identity-matches-2026-10-28.json'),
    read('c8-live-youtube-source-ids-2026-10-28.json')]);
  const result=reconcileC8LiveIds({pool:p,existing:e,verification:v,firstParty:f,live:s,
    at:'2026-10-28T15:55:00Z'});
  assert.equal(result.pilot.researchCandidates,20);
  assert.equal(result.pilot.apiVerifiedRows,0);
  assert.equal(result.pilot.preliminaryPublicPageMatches,3);
  assert.equal(result.pilot.preliminaryNowDuplicate,0);
  assert.equal(result.sourceSnapshot.currentTotal,185);
  assert.equal(result.sourceSnapshot.addedIds,0);
  assert.equal(result.sourceSnapshot.removedIds,0);
  assert.deepEqual(result.reviewQueue,[]);
  assert.equal(result.gates.productionCollectionAuthorized,false);
  console.log('PASS C8: checked-in live-production snapshot still blocked without API verification');
});
console.log('PASS CineRelay C8: '+(n+1)+' reconciliation scenarios');
