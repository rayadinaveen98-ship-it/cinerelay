import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';

const file=path=>readFile(path,'utf8');
let cases=0;
async function test(label,fn){await fn();cases++;console.log('PASS creator C12: '+label);}
async function absent(path){
 try{await access(path,constants.F_OK);return false;}catch(error){
  if(error?.code==='ENOENT')return true;
  throw error;
 }
}
await test('previous public YouTube subscriber and recent-video JSON dumps are gone from the branch tip',async()=>{
 assert.equal(await absent('apps/web/src/data/creator-public-activity-2026-10-30.json'),true);
 assert.equal(await absent('research/creator-intelligence/c11-public-activity-results.json'),true);
});
await test('no further one-shot workflow attempts to commit provider responses into Git',async()=>{
 const workflow=await file('.github/workflows/c11-creator-activity-audit.yml');
 assert.ok(workflow.includes('if: false'));
 assert.ok(workflow.includes('contents: read'));
 assert.ok(!workflow.includes('git push'));
 assert.ok(!workflow.includes('secrets.YOUTUBE_API_KEY'));
 assert.ok(!workflow.includes('    schedule:'));
});
await test('C11 CLI defaults to OS temporary path and forbids public research output locations',async()=>{
 const script=await file('scripts/creator-intelligence/audit-c11-activity.mjs');
 assert.ok(script.includes('tmpdir()'));
 assert.ok(script.includes('C12 forbids persisting'));
 assert.ok(!script.includes("||'research/creator-intelligence/c11-public-activity-results.json'"));
});
await test('private activity table uses RLS, excludes direct readers and expires well before day 30',async()=>{
 const sql=await file('supabase/migrations/20261030110000_creator_intelligence_c12_activity_retention.sql');
 assert.ok(sql.includes('enable row level security'));
 assert.ok(sql.includes('from public,anon,authenticated'));
 assert.ok(sql.includes("interval '29 days'"));
 assert.ok(sql.includes("'7 * * * *'"));
 assert.ok(sql.includes('create view public.creator_intelligence_activity_text with (security_invoker = true)'));
 assert.ok(sql.includes('to service_role'));
 assert.ok(!sql.includes('grant select on public.creator_intelligence_activity_text to authenticated'));
});
await test('API responds only to authorized operators with unexpired evidence',async()=>{
 const api=await file('supabase/functions/cinerelay-creator-intelligence-api/index.ts');
 assert.ok(api.includes("if(!(await operator(request)))return json(403"));
 assert.ok(api.includes("if(body.action==='pilotActivity')return await pilotPublicActivity()"));
 assert.ok(api.includes(".gte('expires_at',now)"));
 assert.ok(api.includes(".limit(21)"));
 assert.ok(api.includes("monitoringAuthorized:false"));
 assert.ok(api.includes("comparisonsAuthorized:false"));
 assert.ok(!api.includes('YOUTUBE_API_KEY'));
});
await test('protected React screen renders absence without falling back to Git-stored public counters',async()=>{
 const page=await file('apps/web/src/pages/CreatorPilotReviewPage.tsx');
 const client=await file('apps/web/src/lib/creator-intelligence-api.ts');
 assert.ok(page.includes('fetchCreatorPilotActivity'));
 assert.ok(page.includes('enabled:guard.isSuccess'));
 assert.ok(page.includes('No protected activity report is available'));
 assert.ok(page.includes('Date.parse(freshItem.expiresAt)>Date.now()'));
 assert.ok(!page.includes("from '../data/creator-public-activity-2026-10-30.json'"));
 assert.ok(client.includes("return invokeCreator({action:'pilotActivity'},PilotActivity)"));
 assert.ok(client.includes("comparisonsAuthorized:z.literal(false)"));
});
console.log('PASS CineRelay C12: '+cases+' forward-privacy and private activity contracts');
