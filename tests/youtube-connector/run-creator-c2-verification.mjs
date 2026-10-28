import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateC2Inputs,evaluateC2Result,runC2Verification} from '../../scripts/creator-intelligence/verify-c2-channels.mjs';
const A='UCaaaaaaaaaaaaaaaaaaaaaa',B='UCbbbbbbbbbbbbbbbbbbbbbb';
const channel=id=>({items:[{id,snippet:{title:'Test creator'},contentDetails:{relatedPlaylists:{uploads:'UU'+id.slice(2)}}}]});
const candidate=(name,handle)=>({name,listedHandle:handle,locale:'te',niche:'Gaming',sourceUrl:'https://example.org/research',
  provisionalSizeTier:'MICRO_10K_100K',officialChannelId:null,verified:false,trackingEnabled:false});
const pool={candidates:[candidate('Small creator','@smallcreator'),candidate('Large creator','@largecreator')]};
const existing={channelIds:[B]};
let n=0;
async function test(title,fn){await fn();n++;console.log('PASS creator C2: '+title)}
await test('stable UC id duplicates despite different display handle',async()=>{
  const x=evaluateC2Result(pool.candidates[0],channel(B),new Set(existing.channelIds));
  assert.equal(x.status,'EXISTING_ID_DUPLICATE');
  assert.equal(x.officialChannelId,B);
});
await test('verified official UC id still requires human review before activation',async()=>{
  const x=evaluateC2Result(pool.candidates[0],channel(A),new Set(existing.channelIds));
  assert.equal(x.status,'OFFICIAL_ID_FOUND_REVIEW_PENDING');
  assert.equal(x.uploadsPlaylistId,'UU'+A.slice(2));
});
await test('bad channel identity and playlist cannot be accepted',async()=>{
  assert.equal(evaluateC2Result(pool.candidates[0],channel('bad'),new Set()).status,'MALFORMED_RESPONSE');
  assert.equal(evaluateC2Result(pool.candidates[0],{items:[]},new Set()).status,'HANDLE_NOT_FOUND');
  assert.equal(evaluateC2Result(pool.candidates[0],{items:[{},{}]},new Set()).status,'AMBIGUOUS_RESPONSE');
});
await test('no key means zero requests and no activation',async()=>{
  let fetches=0;
  const result=await runC2Verification({pool,existing,apiKey:'',fetcher:()=>{fetches++;throw Error('should not happen')}});
  assert.equal(result.status,'BLOCKED_MISSING_GITHUB_API_KEY');
  assert.equal(result.usedRequests,0);assert.equal(fetches,0);
});
await test('real request plan uses only official channels.list, bounded and redacts key from output',async()=>{
  let fetches=0;
  const result=await runC2Verification({pool,existing,apiKey:'SECRET_NEVER_EXPOSE',
    at:'2026-10-28T12:30:00Z',
    fetcher:async(url,options)=>{
      fetches++;
      const q=new URL(url);
      assert.equal(q.pathname,'/youtube/v3/channels');
      assert.equal(q.searchParams.get('forHandle'),pool.candidates[fetches-1].listedHandle);
      assert.equal(q.searchParams.get('part'),'snippet,contentDetails');
      assert.equal(q.searchParams.get('key'),'SECRET_NEVER_EXPOSE');
      assert.equal(options.headers.accept,'application/json');
      return {ok:true,status:200,json:async()=>channel(fetches===1?A:B)};
    }});
  assert.equal(fetches,2);assert.equal(result.usedRequests,2);
  assert.equal(result.status,'COMPLETED');
  assert.equal(result.rows[0].status,'OFFICIAL_ID_FOUND_REVIEW_PENDING');
  assert.equal(result.rows[1].status,'EXISTING_ID_DUPLICATE');
  assert.equal(result.rows.every(x=>x.trackingEnabled===false),true);
  assert.equal(JSON.stringify(result).includes('SECRET_NEVER_EXPOSE'),false);
  assert.equal(result.expiresAt,'2026-11-27T12:30:00.000Z');
});
await test('403 aborts further lookups with no retries or secret disclosure',async()=>{
  let fetches=0;const result=await runC2Verification({pool,existing,apiKey:'SECRET',
    fetcher:async()=>{fetches++;return {ok:false,status:403}}});
  assert.equal(fetches,1);assert.equal(result.status,'HALTED_AUTH_OR_QUOTA');
  assert.equal(result.rows[0].httpStatus,403);assert.equal(result.rows[1].status,'BLOCKED_UPSTREAM');
  assert.equal(JSON.stringify(result).includes('SECRET'),false);
});
await test('request limit and bad inputs rejected, not silently expanded',async()=>{
  assert.throws(()=>validateC2Inputs({candidates:[pool.candidates[0],pool.candidates[0]]},existing),/Duplicate handle/);
  await assert.rejects(()=>runC2Verification({pool,existing,apiKey:'SECRET',requestLimit:21}),/Invalid request limit/);
  await assert.rejects(()=>runC2Verification({pool,existing,apiKey:'SECRET',at:'2026-10-28T12:00:00+05:30'}),/UTC timestamp/);
});
await test('first-party YouTube channel page evidence is explicitly NOT API-approved',async()=>{
  const raw=await readFile('research/creator-intelligence/c2-first-party-page-identity-matches-2026-10-28.json','utf8');
  const existingRaw=await readFile('research/creator-intelligence/c2-existing-youtube-ids-2026-10-28.json','utf8');
  const proof=JSON.parse(raw),ids=new Set(JSON.parse(existingRaw).channelIds),found=new Set();
  assert.equal(proof.apiVerified,false);
  assert.equal(proof.reviewApproved,false);
  assert.equal(proof.trackingEnabled,false);
  assert.equal(proof.matches.length,3);
  for(const x of proof.matches){
    assert.match(x.officialChannelId,/^UC[A-Za-z0-9_-]{22}$/);
    assert.equal(x.firstPartyChannelPage,'https://www.youtube.com/channel/'+x.officialChannelId);
    assert.equal(x.stage,'YOUTUBE_PAGE_ID_FOUND_API_PENDING');
    assert.equal(x.approved,false);
    assert.equal(x.alreadyInExistingSnapshot,false);
    assert.equal(ids.has(x.officialChannelId),false);
    assert.equal(found.has(x.officialChannelId),false);
    found.add(x.officialChannelId);
  }
});
console.log('PASS Creator C2: '+n+' official verification and safety tests');
