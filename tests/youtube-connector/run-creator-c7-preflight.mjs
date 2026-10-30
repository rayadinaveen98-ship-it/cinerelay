import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditC7Pilot} from '../../scripts/creator-intelligence/audit-c7-pilot.mjs';
import {runC2Verification} from '../../scripts/creator-intelligence/verify-c2-channels.mjs';

const A='UCaaaaaaaaaaaaaaaaaaaaaa',B='UCbbbbbbbbbbbbbbbbbbbbbb';
const C='UCcccccccccccccccccccccc',D='UCdddddddddddddddddddddd';
const time='2026-10-28T16:00:00Z';
const observedAt='2026-10-28T12:00:00Z';
const expiry='2026-11-27T12:00:00.000Z';
const candidate=(name,handle,tier,locale)=>({name,listedHandle:handle,locale,
  niche:'Educational creator',sourceUrl:'https://example.org/source',provisionalSizeTier:tier,
  verified:false,trackingEnabled:false,officialChannelId:null});
const pool={candidates:[
  candidate('Alpha','@alphaaa','MICRO_10K_100K','te'),
  candidate('Beta','@betaaaa','LARGE_1M_10M','te'),
  candidate('Gamma','@gammaaa','NANO_LT10K','kn'),
  candidate('Delta','@deltaaa','MID_100K_1M','mr')]};
const existing={channelIds:[B]};
const verified=(c,id,status='OFFICIAL_ID_FOUND_REVIEW_PENDING')=>({
  candidateName:c.name,listedHandle:c.listedHandle,trackingEnabled:false,status,
  officialChannelId:id,officialChannelTitle:'Official '+c.name,uploadsPlaylistId:'UU'+id.slice(2)});
const base=()=>({kind:'CINERELAY_CREATOR_C2_VERIFICATION',observedAt,expiresAt:expiry,
  status:'COMPLETED',maxRequests:20,attempted:4,usedRequests:4,totalCandidates:4,
  idSnapshotCount:1,rows:[verified(pool.candidates[0],A),
    verified(pool.candidates[1],B,'EXISTING_ID_DUPLICATE'),
    verified(pool.candidates[2],C),verified(pool.candidates[3],D)]});
let n=0;
function test(label,fn){fn();n++;console.log('PASS creator C7: '+label)}

test('official IDs yield a diverse human review queue, NOT automatic creator activation',()=>{
  const out=auditC7Pilot({pool,existing,verification:base(),at:time});
  assert.equal(out.status,'AWAITING_OPERATOR_REVIEW');
  assert.deepEqual(out.reviewQueue.map(x=>x.locale),['kn','te','mr']);
  assert.equal(out.counts.officialIdsResolved,4);
  assert.equal(out.counts.alreadyInCineRelay,1);
  assert.equal(out.reviewQueue.length,3);
  assert.ok(out.reviewQueue.every(x=>x.trackingEnabled===false&&x.reviewRequired&&x.liveDedupeRequired));
  assert.equal(out.gates.productionCollectionAuthorized,false);
  assert.equal(out.gates.youtubeDerivedMetricsPermissionVerified,false);
  assert.equal(out.safeguards.noCrossChannelComparison,true);
});

test('the same UC ID behind different handles is quarantined, not counted twice',()=>{
  const input=base();input.rows[2]=verified(pool.candidates[2],A);
  const out=auditC7Pilot({pool,existing,verification:input,at:time});
  assert.equal(out.counts.cohortCollisions,2);
  assert.equal(out.reviewQueue.length,1);
  assert.deepEqual(out.cohortCollisionHandles,['@alphaaa','@gammaaa']);
  assert.equal(out.reviewQueue[0].officialChannelId,D);
});

test('outdated public verification expires and cannot generate review candidates',()=>{
  const out=auditC7Pilot({pool,existing,verification:base(),at:'2026-11-28T00:00:00Z'});
  assert.equal(out.status,'BLOCKED_EXPIRED_VERIFICATION');
  assert.deepEqual(out.reviewQueue,[]);
});

test('provider mismatches, activation flags and dishonest duplicates fail closed',()=>{
  const badId=base();badId.rows[0].officialChannelId='malformed';
  assert.throws(()=>auditC7Pilot({pool,existing,verification:badId,at:time}),/Invalid official/);
  const enabled=base();enabled.rows[0].trackingEnabled=true;
  assert.throws(()=>auditC7Pilot({pool,existing,verification:enabled,at:time}),/activated/);
  const mismatch=base();mismatch.rows[0].status='EXISTING_ID_DUPLICATE';
  assert.throws(()=>auditC7Pilot({pool,existing,verification:mismatch,at:time}),/duplicate classification/);
  const extra=base();extra.rows.push(verified(pool.candidates[0],A));
  assert.throws(()=>auditC7Pilot({pool,existing,verification:extra,at:time}),/too many rows/);
});

test('invalid request budget, forged report or future observation cannot unlock',()=>{
  assert.throws(()=>auditC7Pilot({pool,existing,verification:base(),at:time,maxReview:11}),/1–10/);
  const forged=base();forged.usedRequests=21;
  assert.throws(()=>auditC7Pilot({pool,existing,verification:forged,at:time}),/integrity mismatch/);
  assert.throws(()=>auditC7Pilot({pool,existing,verification:base(),at:'2026-10-28T10:00:00Z'}),/observation or expiry/);
});

const read=async path=>JSON.parse(await readFile('research/creator-intelligence/'+path,'utf8'));
const [realPool,realExisting]=await Promise.all([
  read('c2-verification-input-20.json'),read('c2-existing-youtube-ids-2026-10-28.json')]);
// Offline blocked report generated without provider credentials or real API data.
const realVerification=await runC2Verification({
 pool:realPool,existing:realExisting,apiKey:'',at:observedAt,
 fetcher:()=>{throw Error('No YouTube API call permitted in C19');},
});
test('synthetic C2 missing-key report stays blocked without real API access',()=>{
  const out=auditC7Pilot({pool:realPool,existing:realExisting,verification:realVerification,at:time});
  assert.equal(out.status,'BLOCKED_MISSING_API_KEY');
  assert.equal(out.counts.attempted,0);
  assert.equal(out.counts.researchCandidates,20);
  assert.equal(out.reviewQueue.length,0);
  assert.equal(out.gates.productionCollectionAuthorized,false);
});
console.log('PASS CineRelay C7: '+n+' safety and pilot-readiness contracts');
