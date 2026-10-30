/**
 * CineRelay C18: read-only public YouTube API data release safety check.
 *
 * "audit" checks the tracked working tree for regressions; it does not claim
 * historical Git objects, backups, quotas or user approvals are fixed.
 * "release" returns exit code 2 until manual release blockers are resolved.
 * No data files are opened and no public API credentials are accessed.
 */
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const KNOWN_API_DATA_PATHS=Object.freeze([
 'research/creator-intelligence/c2-official-id-results.json',
 'apps/web/src/data/creator-official-pilot-2026-10-30.json',
]);
export const PUBLIC_PAGE_REVIEW_PATHS=Object.freeze([
 'apps/web/src/data/creator-preliminary-page-evidence-2026-10-28.json',
]);
export const MANUAL_RELEASE_GATES=Object.freeze([
 {
  code:'HISTORICAL_GIT_REFS_UNREMEDIATED',
  meaning:'C11 historical branch / PR #109 and retained commit objects remain subject to deletion and cache/fork review. C2/C10 older API data also need retention review.',
 },
 {
  code:'GOOGLE_PROJECT_QUOTA_NOT_VERIFIED',
  meaning:'Google Cloud YouTube Data API actual project quota and external usage must be checked in the Cloud Console; the internal quota ledger is not authoritative.',
 },
 {
  code:'HOSTED_STORAGE_BACKUP_RETENTION_NOT_VERIFIED',
  meaning:'C12/C14 TTL, Supabase backups/PITR/logs/exports and deletion-on-request must be reviewed in hosted staging before enabling ingest.',
 },
 {
  code:'HOSTED_STAGING_AND_EDITORIAL_APPROVAL_PENDING',
  meaning:'No authorized independent hosted staging, no editorial admission and no approved creator monitoring or derived comparisons.',
 },
]);
const has=(array,p)=>array.includes(p);
export function unsafeNewPath(path){
 if(!path||typeof path!=='string')return false;
 if(has(KNOWN_API_DATA_PATHS,path)||has(PUBLIC_PAGE_REVIEW_PATHS,path))return false;
 if(path==='research/creator-intelligence/c11-public-activity-results.json')return true;
 if(/^apps\/web\/src\/data\/creator-(?:public-activity|subscribers|metrics|stats|channel-statistics)(?:-|\.)(?:.*)\.(?:json|jsonl|ndjson)$/i.test(path))return true;
 if(/^research\/creator-intelligence\/(?:c\d+-)?(?:public-activity|channel-statistics|creator-metrics|youtube-api-response).*\.(:?json|jsonl|ndjson)$/i.test(path))return true;
 if(/^research\/creator-intelligence\/c\d+-(?:public|official)-.*(?:results|snapshots)\.(?:json|jsonl|ndjson)$/i.test(path))return true;
 if(/(?:^|\/)(?:youtube-api-key|youtube-provider-response|creator-public-activity-dump)\.(?:json|jsonl|ndjson)$/i.test(path))return true;
 return false;
}
export function auditTrackedPaths(paths){
 if(!Array.isArray(paths))throw Error('C18 expected tracked file paths');
 const unique=[...new Set(paths)];
 const forbidden=unique.filter(unsafeNewPath).sort();
 const legacy=KNOWN_API_DATA_PATHS.filter(p=>unique.includes(p));
 const pageEvidence=PUBLIC_PAGE_REVIEW_PATHS.filter(p=>unique.includes(p));
 const report={
  kind:'CINERELAY_C18_TRACKED_SOURCE_RETENTION_AUDIT',
  trackedFiles:unique.length,
  unsafeNewPaths:forbidden,
  legacyApiDataPaths:legacy,
  publicPageReviewPaths:pageEvidence,
  sourceRegressionPassed:forbidden.length===0,
  releaseReady:false,
  releaseBlockers:[
   ...(legacy.length?[{code:'LEGACY_TRACKED_API_DATA',count:legacy.length}]:[]),
   ...MANUAL_RELEASE_GATES.map(({code})=>({code})),
  ],
 };
 return report;
}
export function testReleaseDecision(report){
 return report.sourceRegressionPassed&&report.releaseBlockers.length===0;
}
function tracked(){
 const output=execFileSync('git',['ls-files','-z'],{
  encoding:'utf8',maxBuffer:8*1024*1024,timeout:12000,
 });
 return output.split('\0').filter(Boolean);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const arg=process.argv[2]??'--audit';
 if(!['--audit','--release'].includes(arg)){
  console.error('Usage: node scripts/creator-intelligence/c18-retention-gate.mjs --audit|--release');
  process.exitCode=64;
 }else{
  const report=auditTrackedPaths(tracked());
  console.log(JSON.stringify({
   status:report.sourceRegressionPassed?'NO_NEW_RAW_API_SNAPSHOT_PATHS':'NEW_RAW_API_SNAPSHOT_PATHS_DETECTED',
   releaseReady:testReleaseDecision(report),
   ...report,
  },null,2));
  if(!report.sourceRegressionPassed)process.exitCode=1;
  else if(arg==='--release'&&!testReleaseDecision(report))process.exitCode=2;
 }
}
