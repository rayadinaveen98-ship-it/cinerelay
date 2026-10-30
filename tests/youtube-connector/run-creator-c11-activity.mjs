import assert from 'node:assert/strict';
import {runC11ActivityAudit,validateC11Input} from '../../scripts/creator-intelligence/audit-c11-activity.mjs';
// Synthetic test fixtures only: no real official YouTube API IDs in Git.
const pilot={kind:'CINERELAY_C10_OFFICIAL_API_IDENTITY_REVIEW',
 verifiedAt:'2026-10-30T09:27:42.049Z',
 channels:Array.from({length:20},(_,i)=>{
  const id='UC'+String.fromCharCode(97+i).repeat(22);
  return {channelId:id,uploadsPlaylistId:'UU'+id.slice(2),
   listedHandle:'@synthetic'+(i+1),identityState:'OFFICIAL_API_ID_VERIFIED_REVIEW_PENDING',
   operatorApproved:false,monitoringEnabled:false,metricsEnabled:false};
 })};
const at='2026-10-30T10:00:00Z';
const videoId='aaaaaaaaaaa';
let tests=0;
async function test(name,fn){await fn();tests++;console.log('PASS creator C11: '+name)}
const fake=async url=>{
 const u=new URL(url);
 if(u.pathname.endsWith('/channels'))return {ok:true,status:200,json:async()=>({items:pilot.channels.map((c,i)=>({
  id:c.channelId,contentDetails:{relatedPlaylists:{uploads:c.uploadsPlaylistId}},
  statistics:i===0?{hiddenSubscriberCount:true,subscriberCount:'1000',videoCount:'2'}:
   {hiddenSubscriberCount:false,subscriberCount:'999000',videoCount:'1234'},
 }))})};
 if(u.pathname.endsWith('/playlistItems'))return {ok:true,status:200,json:async()=>({items:[
  {contentDetails:{videoId,videoPublishedAt:'2026-10-29T12:00:00Z'}},
 ]})};
 throw Error('Unexpected endpoint');
};
await test('exactly 20 valid inactive API IDs allowed',async()=>{
 assert.equal(validateC11Input(pilot).length,20);
 const bad=structuredClone(pilot);bad.channels[0].operatorApproved=true;
 assert.throws(()=>validateC11Input(bad),/Invalid, duplicated, or activated/);
 const duplicate=structuredClone(pilot);duplicate.channels[0].channelId=duplicate.channels[1].channelId;
 assert.throws(()=>validateC11Input(duplicate),/Invalid, duplicated, or activated/);
});
await test('no key spends no quota and cannot pretend activity has been checked',async()=>{
 let count=0;
 const out=await runC11ActivityAudit({pilot,apiKey:'',at,fetcher:async()=>{count++;throw Error('must not fetch')}});
 assert.equal(out.status,'BLOCKED_MISSING_GITHUB_API_KEY');assert.equal(out.usedRequests,0);
 assert.equal(count,0);
});
await test('one batch plus twenty playlist requests; no private metrics and no activation',async()=>{
 let calls=0;
 const result=await runC11ActivityAudit({pilot,apiKey:'SECRET_C11_DO_NOT_LOG',at,fetcher:async(url,opts)=>{
  calls++;assert.equal(opts.headers.accept,'application/json');
  const u=new URL(url);assert.equal(u.origin,'https://www.googleapis.com');
  assert.equal(u.searchParams.get('key'),'SECRET_C11_DO_NOT_LOG');
  if(u.pathname==='/youtube/v3/channels'){assert.equal(u.searchParams.get('id').split(',').length,20);
   assert.equal(u.searchParams.get('part'),'contentDetails,statistics');}
  else {assert.equal(u.pathname,'/youtube/v3/playlistItems');assert.equal(u.searchParams.get('maxResults'),'3');}
  return fake(url);
 }});
 assert.equal(result.status,'COMPLETED');
 assert.equal(calls,21);assert.equal(result.usedRequests,21);
 assert.equal(result.channelResults.length,20);
 assert.equal(result.channelResults[0].subscriberHidden,true);
 assert.equal(result.channelResults[0].subscriberCountApprox,null);
 assert.equal(result.channelResults[1].subscriberCountApprox,'999000');
 assert.equal(result.channelResults[0].latestPublicVideos[0].videoId,videoId);
 assert.ok(result.channelResults.every(x=>x.monitoringEnabled===false&&x.metricsEnabled===false));
 assert.equal(JSON.stringify(result).includes('SECRET_C11_DO_NOT_LOG'),false);
 assert.equal(result.expiresAt,'2026-11-29T10:00:00.000Z');
});
await test('provider quota/auth error prevents all subsequent activity calls',async()=>{
 let calls=0;
 const result=await runC11ActivityAudit({pilot,apiKey:'x',at,fetcher:async(url)=>{
  calls++;if(new URL(url).pathname.endsWith('channels'))return fake(url);
  return {ok:false,status:403};
 }});
 assert.equal(calls,2);assert.equal(result.usedRequests,2);
 assert.equal(result.status,'HALTED_PROVIDER_AUTH_OR_QUOTA');
 assert.ok(result.channelResults.slice(1).every(x=>x.status==='BLOCKED_UPSTREAM'));
});
await test('playlist ID drift blocks just that channel without switching on tracking',async()=>{
 const result=await runC11ActivityAudit({pilot,apiKey:'x',at,fetcher:async(url)=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/channels')){
   const p=await fake(url),d=await p.json();
   d.items[0].contentDetails.relatedPlaylists.uploads='UUzzzzzzzzzzzzzzzzzzzzzz';
   return {ok:true,status:200,json:async()=>d};
  }
  return fake(url);
 }});
 assert.equal(result.channelResults[0].status,'UPLOADS_PLAYLIST_ID_CHANGED');
 assert.equal(result.channelResults[0].latestPublicVideos.length,0);
 assert.equal(result.status,'PARTIAL_EVIDENCE');
});
await test('bad provider schema and unexpected channel IDs fail closed',async()=>{
 const result=await runC11ActivityAudit({pilot,apiKey:'x',at,fetcher:async()=>({ok:true,status:200,json:async()=>({items:[{id:'wrong'}]})})});
 assert.equal(result.status,'BLOCKED_CHANNEL_RESPONSE');
 assert.equal(result.usedRequests,1);
});
await test('hard limits, timestamps, and invalid provider data rejected',async()=>{
 await assert.rejects(()=>runC11ActivityAudit({pilot,apiKey:'x',at,requestLimit:22}),/Request cap/);
 await assert.rejects(()=>runC11ActivityAudit({pilot,apiKey:'x',at:'2026-10-30T15:30:00+05:30'}),/UTC/);
 const out=await runC11ActivityAudit({pilot,apiKey:'x',at,requestLimit:2,fetcher:fake});
 assert.equal(out.usedRequests,2);assert.equal(out.status,'PARTIAL_EVIDENCE');
 assert.equal(out.channelResults.filter(x=>x.status==='NOT_ATTEMPTED_BUDGET').length,19);
});
console.log('PASS CineRelay C11: '+tests+' one-shot public activity audit tests');
