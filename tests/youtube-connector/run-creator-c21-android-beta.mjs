import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const r=path=>readFile(path,'utf8');
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS C21 Android: '+name);}
await test('exactly 94 diverse provisional research entries with no API-verified facts',async()=>{
 const j=JSON.parse(await r('apps/android/app/src/main/assets/creator_research_leads_v21.json'));
 assert.equal(j.kind,'CINERELAY_CREATOR_PROVISIONAL_RESEARCH_BETA');
 assert.equal(j.leads.length,94);
 assert.equal(new Set(j.leads.map(x=>x.id)).size,94);
 assert.ok(new Set(j.leads.map(x=>x.locale)).size>=8);
 assert.ok(j.leads.some(x=>x.handle===null));
 for(const x of j.leads){
  assert.ok(x.id&&x.name&&x.locale&&x.source);
  assert.ok(x.source.startsWith('https://'));
  for(const forbidden of ['channelId','apiVerified','subscriberCount','viewCount',
   'videoCount','monitoringEnabled','metricsEnabled','uploadsPlaylistId']){
   assert.equal(Object.hasOwn(x,forbidden),false,forbidden+' in '+x.id);
  }
 }
});
await test('beta does not embed server credentials or creator-metrics fetch calls',async()=>{
 const ui=await r('apps/android/app/src/main/java/com/cinerelay/app/ui/CreatorIntelligenceBetaV21.kt');
 const model=await r('apps/android/app/src/main/java/com/cinerelay/app/ui/CreatorResearchModelV21.kt');
 assert.ok(ui.includes('Awaiting fresh verification'));
 assert.ok(ui.includes('MONITORING OFF'));
 assert.ok(ui.includes('CreatorResearchV21.filter'));
 assert.ok(!ui.includes('YOUTUBE_API_KEY'));
 assert.ok(!ui.includes('SUPABASE_SERVICE_ROLE_KEY'));
 assert.ok(!ui.includes('youtube/v3'));
 assert.ok(!model.includes('subscriberCount'));
});
await test('authenticated Settings opens real Android beta and return path is present',async()=>{
 const settings=await r('apps/android/app/src/main/java/com/cinerelay/app/ui/SettingsV055.kt');
 const main=await r('apps/android/app/src/main/java/com/cinerelay/app/MainActivity.kt');
 assert.ok(settings.includes('onOpenCreatorIntelligence: () -> Unit'));
 assert.ok(settings.includes('title = "Creator Intelligence"'));
 assert.ok(main.includes('creatorBetaVisible ->'));
 assert.ok(main.includes('CreatorIntelligenceBetaV21('));
 assert.ok(main.includes('creatorBetaVisible = true'));
 assert.ok(main.includes('onBack = { creatorBetaVisible = false }'));
});
console.log('PASS CineRelay C21 Android: '+count+' APK UI safety checks');
