import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';

const get=p=>readFile(p,'utf8');
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS C10/C19: '+name);}
await test('historical C10 API-derived identity bundle no longer exists in source tree',async()=>{
 await assert.rejects(access('apps/web/src/data/creator-official-pilot-2026-10-30.json'),
  e=>e.code==='ENOENT');
 await assert.rejects(access('research/creator-intelligence/c2-official-id-results.json'),
  e=>e.code==='ENOENT');
});
await test('the 94 lead research pool survives unchanged as provisional discovery',async()=>{
 const research=JSON.parse(await get('apps/web/src/data/creator-research-2026-10-27.json'));
 assert.equal(research.leads.length,94);
 assert.ok(research.leads.every(x=>x.apiVerified===false&&x.metricsEnabled===false&&x.monitoringEnabled===false));
});
await test('protected pilot screen uses fresh C19 identities instead of hardcoded real API IDs',async()=>{
 const page=await get('apps/web/src/pages/CreatorPilotReviewPage.tsx');
 const app=await get('apps/web/src/App.tsx');
 assert.ok(page.includes('fetchConsoleOverview'));
 assert.ok(page.includes('fetchCreatorPilotIdentities'));
 assert.ok(page.includes('fetchCreatorPilotActivity'));
 assert.ok(page.includes('enabled:guard.isSuccess'));
 assert.ok(page.includes('Awaiting fresh official verification'));
 assert.ok(page.includes('Date.parse(x.expiresAt)>clock'));
 assert.ok(!page.includes('creator-official-pilot-2026-10-30.json'));
 assert.ok(app.includes("path: '/creators/pilot'"));
 assert.ok(app.includes('component: CreatorPilotReviewPage'));
});
await test('historical first-party page matches no longer assert the expired API verification is fresh',async()=>{
 const page=await get('apps/web/src/pages/CreatorResearchPage.tsx');
 const preliminary=JSON.parse(await get('apps/web/src/data/creator-preliminary-page-evidence-2026-10-28.json'));
 assert.equal(preliminary.apiVerified,false);
 assert.equal(preliminary.matches.length,3);
 assert.ok(page.includes('Historical page match · fresh API status unknown'));
 assert.ok(!page.includes('newlyVerifiedIds'));
 assert.ok(!page.includes('creator-official-pilot-2026-10-30.json'));
});
await test('server-only, expiring C19 identity read has no admission or activation',async()=>{
 const migration=await get('supabase/migrations/20261030190000_creator_intelligence_c19_private_identity_evidence.sql');
 const endpoint=await get('supabase/functions/cinerelay-creator-intelligence-api/index.ts');
 const client=await get('apps/web/src/lib/creator-intelligence-api.ts');
 assert.ok(migration.includes("interval '28 days'"));
 assert.ok(migration.includes('enable row level security'));
 assert.ok(migration.includes('from public,anon,authenticated'));
 assert.ok(migration.includes('to service_role'));
 assert.ok(migration.includes("'cinerelay-c19-identity-evidence-ttl'"));
 assert.ok(endpoint.includes("if(body.action==='pilotIdentities')return await pilotIdentities()"));
 assert.ok(endpoint.includes(".gt('expires_at',now)"));
 assert.ok(endpoint.includes("monitoringAuthorized:false,comparisonsAuthorized:false"));
 assert.ok(client.includes("return invokeCreator({action:'pilotIdentities'},VerifiedIdentities)"));
 assert.ok(client.includes('monitoringEnabled:z.literal(false)'));
});
console.log('PASS C19: '+count+' historical C10 migration/review safety tests');
