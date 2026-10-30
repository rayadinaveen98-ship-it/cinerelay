import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
const read=path=>readFile(path,'utf8');
const obsolete=[
 'research/creator-intelligence/c2-official-id-results.json',
 'apps/web/src/data/creator-official-pilot-2026-10-30.json',
];
let n=0;
async function test(name,fn){await fn();n++;console.log('PASS C19: '+name);}
await test('old provider-derived official identities are absent from current tree',async()=>{
 for(const p of obsolete)await assert.rejects(access(p),e=>e.code==='ENOENT');
 const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0');
 assert.ok(obsolete.every(p=>!paths.includes(p)));
});
await test('C2 historical workflow has no Git writes, API secrets or enabled jobs',async()=>{
 const yml=await read('.github/workflows/c2-creator-id-verification.yml');
 assert.ok(yml.includes('if: false'));
 assert.ok(yml.includes('contents: read'));
 assert.ok(!yml.includes('git push'));
 assert.ok(!yml.includes('secrets.YOUTUBE_API_KEY'));
});
await test('C2 legacy CLI is intentionally blocked before any provider calls',async()=>{
 const script=await read('scripts/creator-intelligence/verify-c2-channels.mjs');
 assert.ok(script.includes('C19_C2_CLI_DISABLED_USE_PRIVATE_EXPIRING_IDENTITY_INGEST'));
 assert.ok(!script.includes('writeFile(outputPath'));
 const run=spawnSync(process.execPath,['scripts/creator-intelligence/verify-c2-channels.mjs'],
  {encoding:'utf8',timeout:4000});
 assert.equal(run.status,1);
 assert.ok(run.stderr.includes('C19_C2_CLI_DISABLED'));
});
await test('C10 and C11 tests no longer load real YouTube API identity records',async()=>{
 const a=await read('tests/youtube-connector/run-creator-c10-pilot-review.mjs');
 const b=await read('tests/youtube-connector/run-creator-c11-activity.mjs');
 assert.ok(b.includes('Synthetic test fixtures only'));
 assert.ok(!b.includes("readFile('apps/web/src/data/creator-official-pilot"));
 assert.ok(a.includes('C19'));
});
await test('C19 page, research screen and API never bundle or silently approve expired identities',async()=>{
 const page=await read('apps/web/src/pages/CreatorPilotReviewPage.tsx');
 const research=await read('apps/web/src/pages/CreatorResearchPage.tsx');
 const api=await read('supabase/functions/cinerelay-creator-intelligence-api/index.ts');
 assert.ok(page.includes('Awaiting fresh official verification'));
 assert.ok(page.includes('Date.parse(x.expiresAt)>clock'));
 assert.ok(page.includes('fetchCreatorPilotIdentities'));
 assert.ok(!page.includes("from '../data/creator-official-pilot"));
 assert.ok(!research.includes("from '../data/creator-official-pilot"));
 assert.ok(research.includes('Historical page match · fresh API status unknown'));
 assert.ok(api.includes("if(body.action==='pilotIdentities')return await pilotIdentities()"));
 assert.ok(api.includes(".gt('expires_at',now)"));
 assert.ok(api.includes('operator(request)'));
 assert.ok(api.includes('monitoringAuthorized:false,comparisonsAuthorized:false'));
});
await test('C19 migration preserves read-only identity review and hourly <=28d deletion',async()=>{
 const sql=await read('supabase/migrations/20261030190000_creator_intelligence_c19_private_identity_evidence.sql');
 assert.ok(sql.includes("interval '28 days'"));
 assert.ok(sql.includes('enable row level security'));
 assert.ok(sql.includes('revoke all on public.creator_intelligence_identity_evidence from public,anon,authenticated'));
 assert.ok(sql.includes('grant select,insert,update,delete on public.creator_intelligence_identity_evidence to service_role'));
 assert.ok(sql.includes("'cinerelay-c19-identity-evidence-ttl'"));
 assert.ok(sql.includes('monitoring_enabled boolean not null default false check (monitoring_enabled=false)'));
 assert.ok(sql.includes('review_state text not null default'));
});
await test('release stays blocked until Git history, retention, quotas and hosted review cleared',async()=>{
 const run=spawnSync(process.execPath,
 ['scripts/creator-intelligence/c18-retention-gate.mjs','--release'],
 {encoding:'utf8',timeout:4000});
 assert.equal(run.status,2);
 const result=JSON.parse(run.stdout);
 assert.equal(result.releaseReady,false);
 assert.equal(result.legacyApiDataPaths.length,0);
 assert.ok(result.releaseBlockers.some(x=>x.code==='HISTORICAL_GIT_REFS_UNREMEDIATED'));
});
console.log('PASS CineRelay C19: '+n+' identity-bundle removal and no-regression tests');
