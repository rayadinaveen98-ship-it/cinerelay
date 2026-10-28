import assert from 'node:assert/strict';
import {
  CREATOR_YOUTUBE_QUOTA_2026,
  buildCreatorChannelLookupUrl,
  buildCreatorVideoStatsUrl,
  normalizeCreatorHandle,
  assessCreatorChannelLookup,
  parseCreatorVideoStats,
  planCreatorMetrics,
  estimateCreatorDiscoveryBudget,
} from '../../packages/youtube-connector/dist/creator-intelligence.js';

const CHANNEL_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const CHANNEL_B = 'UCbbbbbbbbbbbbbbbbbbbbbb';
const CHANNEL_C = 'UCcccccccccccccccccccccc';
const V1='aaaaaaaaaaa',V2='bbbbbbbbbbb',V3='ccccccccccc',V4='ddddddddddd',V5='eeeeeeeeeee';
let count=0;
function test(label,fn){fn();count++;console.log('PASS creator C1: '+label)}

test('official handle lookup is Unicode-safe, read-only and contains no credential',()=>{
  assert.equal(normalizeCreatorHandle(' creator.telugu '),'@creator.telugu');
  assert.equal(normalizeCreatorHandle('@తెలుగుTech'),'@తెలుగుTech');
  assert.throws(()=>normalizeCreatorHandle('ordinary creator name'),/ambiguous handle/);
  const url=new URL(buildCreatorChannelLookupUrl('creator.telugu'));
  assert.equal(url.origin,'https://www.googleapis.com');
  assert.equal(url.pathname,'/youtube/v3/channels');
  assert.equal(url.searchParams.get('forHandle'),'@creator.telugu');
  assert.equal(url.searchParams.get('part'),'snippet,contentDetails,statistics');
  assert.equal(url.searchParams.has('key'),false);
});
const channelResult={
  items:[{id:CHANNEL_A,snippet:{title:'Verified channel'},
    contentDetails:{relatedPlaylists:{uploads:'UUaaaaaaaaaaaaaaaaaaaaaa'}},
    statistics:{subscriberCount:'12800',hiddenSubscriberCount:false}}]};
test('stable YouTube UC id checked against already-monitored list',()=>{
  const x=assessCreatorChannelLookup(channelResult,[CHANNEL_B]);
  assert.equal(x.state,'VERIFIED_NEW');
  assert.equal(x.channelId,CHANNEL_A);
  assert.equal(x.subscriberCountApprox,'12800');
  assert.equal(assessCreatorChannelLookup(channelResult,[CHANNEL_A]).state,'ALREADY_MONITORED');
  assert.equal(assessCreatorChannelLookup({items:[]},[]).state,'NOT_FOUND');
  assert.equal(assessCreatorChannelLookup({items:[{id:'wrong'}]},[]).state,'REVIEW_REQUIRED');
});
test('private subscriber counts stay unavailable instead of zero',()=>{
  const x=assessCreatorChannelLookup({items:[{...channelResult.items[0],
    statistics:{hiddenSubscriberCount:true}}]},[]);
  assert.equal(x.state,'VERIFIED_NEW');
  assert.equal(x.subscriberHidden,true);
  assert.equal(x.subscriberCountApprox,null);
});
test('public metrics URL uses the dedicated 2026 API without credentials',()=>{
  const url=new URL(buildCreatorVideoStatsUrl([V1,V2]));
  assert.equal(url.pathname,'/youtube/v3/videos:batchGetStats');
  assert.equal(url.searchParams.get('part'),'statistics');
  assert.equal(url.searchParams.get('id'),V1+','+V2);
  assert.equal(url.searchParams.has('key'),false);
  assert.throws(()=>buildCreatorVideoStatsUrl([V1,V1]),/duplicate/);
  assert.throws(()=>buildCreatorVideoStatsUrl([]),/Only 1/);
  assert.throws(()=>buildCreatorVideoStatsUrl(Array.from({length:51},(_,i)=>String(i).padStart(11,'0'))),/Only 1/);
});
test('public counters preserve absent likes/comments and large strings',()=>{
  const stats=parseCreatorVideoStats({items:[
    {id:V1,statistics:{viewCount:'12345678901234567890',likeCount:'14000'}},
    {id:V2,statistics:{viewCount:'0',commentCount:'4'}}
  ],summary:{requestedVideoCount:'3',succeededVideoCount:'2',
    failedVideoCount:'1',failedVideoIds:[V3]}},'2026-10-28T01:00:00Z');
  assert.equal(stats.counters[0].viewCount,'12345678901234567890');
  assert.equal(stats.counters[0].commentCount,null);
  assert.equal(stats.counters[1].likeCount,null);
  assert.equal(stats.counters[1].viewCount,'0');
  assert.deepEqual(stats.failedVideoIds,[V3]);
  assert.throws(()=>parseCreatorVideoStats({items:[{id:V1,statistics:{viewCount:1}}],summary:{failedVideoIds:[]}},'2026-10-28T01:00:00Z'),/Malformed public video counter/);
});
const now='2026-10-28T12:00:00Z';
const base={dailyQuotaUnits:10_000,quotaUsedToday:9_990,reserveUnits:5,maxRequestsPerTick:3,now};
test('fair admission gives distinct channels first even when one has many videos',()=>{
  const videos=[V1,V2,V3,V4].map(id=>({videoId:id,channelId:CHANNEL_A,
    publishedAt:'2026-10-28T04:00:00Z'}));
  videos.push({videoId:V5,channelId:CHANNEL_B,publishedAt:'2026-10-28T11:00:00Z'});
  const plan=planCreatorMetrics({...base,videos,maxVideosPerRequest:2});
  assert.equal(plan.requestedUnits,3);
  assert.equal(plan.quotaBucket,'VIDEO_BATCH_STATS');
  assert.equal(plan.dueVideos,5);
  assert.equal(plan.batches[0].length,2);
  assert.ok(plan.batches[0].includes(V5),'one noisy channel cannot block another');
  assert.equal(plan.deferredDueVideos,0);
});
test('reserved bucket balance cannot be spent and no videos schedule with zero quota',()=>{
  const videos=[{videoId:V1,channelId:CHANNEL_A,publishedAt:'2026-10-28T11:00:00Z'}];
  const out=planCreatorMetrics({...base,quotaUsedToday:9_995,videos});
  assert.equal(out.requestedUnits,0);
  assert.equal(out.deferredDueVideos,1);
  assert.deepEqual(out.batches,[]);
});
test('hourly vs six-hour vs daily cadence and thirty-day expiry',()=>{
  const videos=[
    {videoId:V1,channelId:CHANNEL_A,publishedAt:'2026-10-28T10:00:00Z',lastObservedAt:'2026-10-28T11:30:00Z'}, // not due
    {videoId:V2,channelId:CHANNEL_A,publishedAt:'2026-10-25T00:00:00Z',lastObservedAt:'2026-10-28T07:00:00Z'}, // 6-hour not due
    {videoId:V3,channelId:CHANNEL_A,publishedAt:'2026-10-18T00:00:00Z',lastObservedAt:'2026-10-27T10:00:00Z'}, // 1-day due
    {videoId:V4,channelId:CHANNEL_A,publishedAt:'2026-09-22T00:00:00Z'}, // expired
    {videoId:V5,channelId:CHANNEL_B,publishedAt:'2026-10-29T00:00:00Z'}, // future
  ];
  const out=planCreatorMetrics({...base,videos});
  assert.deepEqual(out.batches,[[V3]]);
  assert.equal(out.ignoredOutsideRetention,1);
});
test('duplicate video ids never lead to duplicate metric requests',()=>{
  const video={videoId:V1,channelId:CHANNEL_A,publishedAt:'2026-10-28T11:00:00Z'};
  const plan=planCreatorMetrics({...base,videos:[video,video]});
  assert.equal(plan.dueVideos,1);
  assert.deepEqual(plan.batches,[[V1]]);
});
test('timestamp inputs must include an explicit timezone to avoid IST/UTC drift',()=>{
  const videos=[{videoId:V1,channelId:CHANNEL_A,publishedAt:'2026-10-28T10:00:00Z'}];
  assert.throws(()=>planCreatorMetrics({...base,now:'2026-10-28T12:00:00',videos}),/ISO datetime/);
  assert.throws(()=>planCreatorMetrics({...base,videos:[{...videos[0],publishedAt:'2026-10-28T10:00:00'}]}),/ISO datetime/);
  assert.equal(planCreatorMetrics({...base,now:'2026-10-28T17:30:00+05:30',videos}).dueVideos,1);
});
test('rate limits and invalid ids are rejected rather than silently rounded',()=>{
  const videos=[{videoId:V1,channelId:CHANNEL_A,publishedAt:'2026-10-28T11:00:00Z'}];
  assert.throws(()=>planCreatorMetrics({...base,videos,maxVideosPerRequest:51}),/Unverified batch size/);
  assert.throws(()=>planCreatorMetrics({...base,videos,reserveUnits:-1}),/nonnegative safe integer/);
  assert.throws(()=>planCreatorMetrics({...base,videos:[{...videos[0],channelId:'bad'}]}),/Invalid video\/channel ID/);
  assert.throws(()=>planCreatorMetrics({...base,videos:[{...videos[0],lastObservedAt:'2026-10-29T00:00:00Z'}]}),/Future lastObservedAt/);
});
test('new channel discovery consumes GENERAL_READ independently of stats',()=>{
  const common={existingGeneralReadUnits:8064,otherGeneralReadUnits:365,
    dailyGeneralReadUnits:10_000,reserveUnits:500,channelLookupRequests:50};
  const canary=estimateCreatorDiscoveryBudget({...common,newChannels:10,
    playlistChecksPerChannelPerDay:24});
  assert.equal(canary.additionalUnits,290);
  assert.equal(canary.safe,true);
  assert.equal(canary.headroom,781);
  const fifty=estimateCreatorDiscoveryBudget({...common,newChannels:50,
    playlistChecksPerChannelPerDay:24});
  assert.equal(fifty.additionalUnits,1250);
  assert.equal(fifty.safe,false);
  assert.equal(fifty.headroom,-179);
  assert.equal(fifty.quotaBucket,'GENERAL_READ');
  assert.equal(CREATOR_YOUTUBE_QUOTA_2026.batchStatsBucket,'VIDEO_BATCH_STATS');
});
console.log(`PASS Creator Intelligence C1: ${count} identity, statistics and quota-admission contracts`);
