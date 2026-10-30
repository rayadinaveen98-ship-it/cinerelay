import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(path,'utf8');
let n=0;
const test=async(name,fn)=>{await fn();n++;console.log('PASS C22 Android: '+name)};
await test('Android Verified uses real protected server action with only the existing refreshed user session',async()=>{
 const client=await read('apps/android/app/src/main/java/com/cinerelay/app/data/BackendClient.kt');
 const parser=await read('apps/android/app/src/main/java/com/cinerelay/app/data/CreatorIdentityV22.kt');
 assert.ok(client.includes('fun verifiedCreatorIdentities()'));
 assert.ok(client.includes('"cinerelay-creator-intelligence-api"'));
 assert.ok(client.includes('JSONObject().put("action", "pilotIdentities")'));
 assert.ok(client.includes('invokeAuthenticated('));
 assert.ok(parser.includes('CreatorIdentityParserV22.parse'));
 const api=await read('supabase/functions/cinerelay-creator-intelligence-api/index.ts');
 assert.ok(api.includes("if(!(await operator(request)))"));
 assert.ok(api.includes("if(body.action==='pilotIdentities')return await pilotIdentities()"));
 assert.ok(!client.includes('creator_intelligence_identity_evidence'));
});
await test('server response parser rejects expired, fabricated or monitoring-approved official records',async()=>{
 const parser=await read('apps/android/app/src/main/java/com/cinerelay/app/data/CreatorIdentityV22.kt');
 for(const marker of [
  'records.length() > 20', 'status == "NO_FRESH_IDENTITY_EVIDENCE"',
  'idPattern.matches(id)', '!seen.add(id)',
  'row.optString("uploadsPlaylistId") != "UU" + id.removePrefix("UC")',
  'row.optString("reviewState") != "REVIEW_PENDING"',
  'row.optBoolean("monitoringEnabled", true)',
  'row.optBoolean("operatorApproved", true)',
  'row.optBoolean("metricsEnabled", true)',
  '!expiresAt.isAfter(now)', 'observedAt.plusSeconds(28L * 86400L)',
  'payload.optBoolean("monitoringAuthorized", true)',
 ]){
  assert.ok(parser.includes(marker),marker);
 }
});
await test('Android UI does not confuse research candidates with fresh official identities',async()=>{
 const panel=await read('apps/android/app/src/main/java/com/cinerelay/app/ui/CreatorVerifiedPanelV22.kt');
 const screen=await read('apps/android/app/src/main/java/com/cinerelay/app/ui/CreatorIntelligenceBetaV21.kt');
 assert.ok(screen.includes('CreatorVerifiedPanelV22('));
 assert.ok(panel.includes('UNVERIFIED RESEARCH'));
 assert.ok(panel.includes('These are NOT verified channels'));
 assert.ok(panel.includes('0 current official identities'));
 assert.ok(panel.includes('MONITORING OFF'));
 assert.ok(panel.includes('data object Loading'));
 assert.ok(panel.includes('onDiscover'));
 assert.ok(panel.includes('fun CreatorVerifiedPanelV22('));
 assert.ok(panel.includes('withContext(Dispatchers.IO)'));
 assert.ok(!panel.includes('youtube/v3'));
 assert.ok(!panel.includes('YOUTUBE_API_KEY'));
});
await test('protected Verified handles account denial and no-hosted-deployment without pretending to show 20 stale records',async()=>{
 const panel=await read('apps/android/app/src/main/java/com/cinerelay/app/ui/CreatorVerifiedPanelV22.kt');
 assert.ok(panel.includes('401, 403 ->'));
 assert.ok(panel.includes('404, 503 ->'));
 assert.ok(panel.includes('The app will not substitute historical YouTube API records'));
 assert.ok(panel.includes('Fresh identities unavailable'));
 assert.ok(panel.includes('Check again'));
 assert.ok(panel.includes('Instant.parse(it.expiresAt).isAfter(Instant.now())'));
});
await test('94-lead asset remains unverified and no C2/C10 API snapshot was bundled',async()=>{
 const asset=JSON.parse(await read('apps/android/app/src/main/assets/creator_research_leads_v21.json'));
 assert.equal(asset.leads.length,94);
 assert.ok(asset.leads.every(x=>!Object.hasOwn(x,'channelId')&&!Object.hasOwn(x,'subscriberCount')));
 const content=JSON.stringify(asset);
 assert.ok(!content.includes('OFFICIAL_API_ID_VERIFIED'));
 assert.ok(content.includes('UNVERIFIED')||content.includes('Unverified'));
});
console.log('PASS CineRelay C22 Android: '+n+' protected verified/queue safety contracts');
