import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {authorizedTarget,validChannelId,parseC13Channel,parseC13Uploads,createC13Record}
 from '../../supabase/functions/cinerelay-creator-activity-ingest/logic.mjs';
let n=0;
async function test(name,fn){await fn();n++;console.log('PASS C13: '+name)}
const UC='UCaaaaaaaaaaaaaaaaaaaaaa',OTHER='UCbbbbbbbbbbbbbbbbbbbbbb';
const NOW='2026-10-30T11:00:00Z';
const UNTIL='2026-10-31T11:00:00Z';
const fakeChannel={items:[{id:UC,contentDetails:{relatedPlaylists:{uploads:'UU'+UC.slice(2)}},
 statistics:{hiddenSubscriberCount:false,subscriberCount:'10000000000',videoCount:'99'}}]};
const fakeUploads={items:[
 {contentDetails:{videoId:'aaaaaaaaaaa',videoPublishedAt:'2026-10-29T12:00:00Z'}},
 {contentDetails:{videoId:'bbbbbbbbbbb',videoPublishedAt:'2026-10-28T12:00:00Z'}},
]};
await test('stable UC identity required; time-limited explicit audit ID scope only',()=>{
 assert.ok(validChannelId(UC));assert.ok(!validChannelId('UCbad'));
 assert.ok(authorizedTarget(UC,UC+','+OTHER,NOW,UNTIL));
 assert.ok(!authorizedTarget(UC,OTHER,NOW,UNTIL));
 assert.ok(!authorizedTarget(UC,UC,NOW,'2026-10-29T11:00:00Z'));
 assert.ok(!authorizedTarget(UC,UC,NOW,'2026-11-10T11:00:00Z'));
 assert.ok(!authorizedTarget(UC,UC+','+UC,NOW,UNTIL));
 assert.ok(!authorizedTarget(UC,'UCbroken',NOW,UNTIL));
});
await test('official identity and uploads playlist must match target, no name guessing',()=>{
 const c=parseC13Channel(fakeChannel,UC);
 assert.equal(c.uploads,'UU'+UC.slice(2));
 assert.equal(c.subscriberCount,'10000000000');
 const bad=structuredClone(fakeChannel);bad.items[0].id=OTHER;
 assert.throws(()=>parseC13Channel(bad,UC),/MISMATCH/);
 const swapped=structuredClone(fakeChannel);swapped.items[0].contentDetails.relatedPlaylists.uploads='UUwrong';
 assert.throws(()=>parseC13Channel(swapped,UC),/MISMATCH/);
 assert.throws(()=>parseC13Channel({items:[]},UC),/UNEXPECTED/);
});
await test('hidden public subscriber count is null even if provider includes an old count',()=>{
 const hidden=structuredClone(fakeChannel);hidden.items[0].statistics.hiddenSubscriberCount=true;
 assert.equal(parseC13Channel(hidden,UC).subscriberCount,null);
 const bad=structuredClone(fakeChannel);bad.items[0].statistics.videoCount='NAN';
 assert.throws(()=>parseC13Channel(bad,UC),/VIDEO_COUNT/);
});
await test('public playlist items are capped, unique, and have real observations',()=>{
 const rows=parseC13Uploads(fakeUploads,NOW);
 assert.equal(rows.length,2);
 assert.equal(rows[0].publishedAt,'2026-10-29T12:00:00.000Z');
 const dup=structuredClone(fakeUploads);dup.items[1].contentDetails.videoId='aaaaaaaaaaa';
 assert.throws(()=>parseC13Uploads(dup,NOW),/VIDEO_ITEM/);
 const over={items:[...fakeUploads.items,...fakeUploads.items]};
 assert.throws(()=>parseC13Uploads(over,NOW),/PLAYLIST_RESPONSE/);
 const future=structuredClone(fakeUploads);
 future.items[0].contentDetails.videoPublishedAt='2026-11-02T11:00:00Z';
 assert.throws(()=>parseC13Uploads(future,NOW),/VIDEO_ITEM/);
});
await test('database row expires at 28 days, no view/like/comment metrics',()=>{
 const channel=parseC13Channel(fakeChannel,UC);
 const row=createC13Record(UC,channel,parseC13Uploads(fakeUploads,NOW),NOW);
 assert.equal(row.channel_id,UC);
 assert.equal(row.expires_at,'2026-11-27T11:00:00.000Z');
 assert.equal(row.recent_public_uploads.length,2);
 const str=JSON.stringify(row);
 for(const field of ['view_count','like_count','comment_count','api_key','metrics_enabled'])
  assert.ok(!str.includes(field),field);
});
await test('Edge function must fail closed, require operator and quota before provider calls',async()=>{
 const code=await readFile('supabase/functions/cinerelay-creator-activity-ingest/index.ts','utf8');
 const sql=await readFile('supabase/migrations/20261030163000_creator_intelligence_c13_manual_quota.sql','utf8');
 assert.ok(code.includes("CINERELAY_C13_ACTIVITY_INGEST_ENABLED')==='true'"));
 assert.ok(code.includes("if(!(await activeOperator(request)))"));
 assert.ok(code.includes('authorizedTarget('));
 assert.ok(code.includes("ONE_SHOT_PUBLIC_ACTIVITY"));
 assert.ok(code.indexOf("admin.rpc('creator_c13_reserve_public_activity_quota'")<code.indexOf("provider('channels'"));
 assert.ok(code.includes("C13_ALREADY_AUDITED_IN_24_HOURS"));
 assert.ok(code.includes(".upsert(row,{onConflict:'channel_id'})"));
 assert.ok(code.includes("cache-control':'no-store"));
 assert.ok(!code.includes('console.log('));
 assert.ok(!code.includes('console.error('));
 assert.ok(sql.includes('pg_advisory_xact_lock'));
 assert.ok(sql.includes("America/Los_Angeles"));
 assert.ok(sql.includes("v_used + 2 > p_daily_limit - p_existing_reserve"));
 assert.ok(sql.includes('to service_role'));
 assert.ok(!sql.includes('to authenticated'));
});
console.log('PASS C13: '+n+' cases');
