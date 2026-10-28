/**
 * CineRelay C7: offline, read-only creator pilot evidence audit.
 * This is a review queue, NEVER a production activation decision.
 * No network, API key, Supabase, scheduled job, or metrics collector access.
 */
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {validateC2Inputs} from './verify-c2-channels.mjs';

const CHANNEL_ID=/^UC[A-Za-z0-9_-]{22}$/;
const TIERS=['NANO_LT10K','MICRO_10K_100K','MID_100K_1M','LARGE_1M_10M','MEGA_10M_PLUS'];
const ID_STATUSES=new Set(['OFFICIAL_ID_FOUND_REVIEW_PENDING','EXISTING_ID_DUPLICATE']);
const ROW_STATUSES=new Set([...ID_STATUSES,'HANDLE_NOT_FOUND','AMBIGUOUS_RESPONSE','MALFORMED_RESPONSE','API_ERROR','NETWORK_ERROR','BLOCKED_UPSTREAM','NOT_ATTEMPTED']);
const REPORT_STATUSES=new Set(['BLOCKED_MISSING_GITHUB_API_KEY','HALTED_AUTH_OR_QUOTA','PARTIAL_LIMIT','COMPLETED']);

function timestamp(value,label){
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)||!Number.isFinite(Date.parse(value)))
    throw Error('Invalid '+label+': explicit UTC instant required');
  return Date.parse(value);
}

export function auditC7Pilot({pool,existing,verification,at=new Date().toISOString(),maxReview=10}){
  const existingIds=validateC2Inputs(pool,existing);
  if(!Number.isInteger(maxReview)||maxReview<1||maxReview>10)throw Error('Review cap must be 1–10');
  const now=timestamp(at,'audit time');
  if(!verification || verification.kind!=='CINERELAY_CREATOR_C2_VERIFICATION'||
    !REPORT_STATUSES.has(verification.status)||!Array.isArray(verification.rows))throw Error('Invalid official C2 report');
  const seenAt=timestamp(verification.observedAt,'C2 observation time');
  const expiresAt=timestamp(verification.expiresAt,'C2 expiry');
  if(seenAt>now || expiresAt!==seenAt+30*86400000)throw Error('Invalid C2 observation or expiry');
  if(verification.idSnapshotCount!==existingIds.size||verification.totalCandidates!==pool.candidates.length||
    verification.maxRequests!==20 || !Number.isInteger(verification.attempted)||!Number.isInteger(verification.usedRequests)||
    verification.attempted!==verification.usedRequests||verification.attempted<0||verification.usedRequests>20||
    verification.usedRequests>pool.candidates.length)throw Error('C2 report integrity mismatch');
  if(verification.status==='BLOCKED_MISSING_GITHUB_API_KEY'&&
    (verification.attempted!==0||verification.rows.length!==0))throw Error('Blocked C2 report cannot include provider calls');
  if(verification.rows.length>pool.candidates.length)throw Error('C2 report has too many rows');
  if(verification.status==='COMPLETED'&&verification.rows.length!==pool.candidates.length)
    throw Error('Completed C2 report must cover the entire cohort');

  const candidates=new Map(pool.candidates.map(c=>[c.listedHandle.toLowerCase(),c]));
  const observedHandles=new Set();
  const resolved=[];
  for(const row of verification.rows){
    if(!row || typeof row.listedHandle!=='string'||!ROW_STATUSES.has(row.status)||row.trackingEnabled!==false)
      throw Error('Unrecognized or activated C2 result row');
    const handle=row.listedHandle.toLowerCase();
    const candidate=candidates.get(handle);
    if(!candidate || candidate.name!==row.candidateName||observedHandles.has(handle))throw Error('Unexpected or duplicate C2 handle');
    observedHandles.add(handle);
    if(!ID_STATUSES.has(row.status))continue;
    if(typeof row.officialChannelId!=='string'||!CHANNEL_ID.test(row.officialChannelId)||
      typeof row.officialChannelTitle!=='string'||!row.officialChannelTitle.trim()||
      row.uploadsPlaylistId!=='UU'+row.officialChannelId.slice(2))throw Error('Invalid official C2 channel identity');
    const alreadyPresent=existingIds.has(row.officialChannelId);
    if((row.status==='EXISTING_ID_DUPLICATE')!==alreadyPresent)throw Error('Inconsistent existing source-ID duplicate classification');
    resolved.push({name:candidate.name,listedHandle:candidate.listedHandle,
      officialChannelId:row.officialChannelId,officialChannelTitle:row.officialChannelTitle,
      locale:candidate.locale,provisionalSizeTier:candidate.provisionalSizeTier,
      niche:candidate.niche,alreadyPresent});
  }
  const counts=new Map();
  for(const item of resolved)counts.set(item.officialChannelId,(counts.get(item.officialChannelId)||0)+1);
  const collisions=resolved.filter(x=>counts.get(x.officialChannelId)>1).map(x=>x.listedHandle);
  const eligible=resolved.filter(x=>!x.alreadyPresent&&counts.get(x.officialChannelId)===1);
  const tierBuckets=new Map(TIERS.map(t=>[t,[]]));
  for(const item of eligible){
    if(!tierBuckets.has(item.provisionalSizeTier))tierBuckets.set(item.provisionalSizeTier,[]);
    tierBuckets.get(item.provisionalSizeTier).push(item);
  }
  for(const items of tierBuckets.values())items.sort((a,b)=>
    Number(a.locale==='te')-Number(b.locale==='te')||a.listedHandle.localeCompare(b.listedHandle));
  const reviewQueue=[];
  while(reviewQueue.length<maxReview){
    let picked=false;
    for(const tier of tierBuckets.keys()){
      const next=tierBuckets.get(tier).shift();
      if(next){picked=true;reviewQueue.push({...next,reviewRequired:true,liveDedupeRequired:true,trackingEnabled:false});}
      if(reviewQueue.length>=maxReview)break;
    }
    if(!picked)break;
  }
  const expired=now>expiresAt;
  const status=verification.status==='BLOCKED_MISSING_GITHUB_API_KEY'?'BLOCKED_MISSING_API_KEY':
    expired?'BLOCKED_EXPIRED_VERIFICATION':
    verification.status==='HALTED_AUTH_OR_QUOTA'?'BLOCKED_PROVIDER_AUTH_OR_QUOTA':
    reviewQueue.length?'AWAITING_OPERATOR_REVIEW':'BLOCKED_NO_REVIEWABLE_IDS';
  return {
    kind:'CINERELAY_CREATOR_C7_PILOT_PREFLIGHT',auditedAt:at,status,
    sourceReportStatus:verification.status,
    counts:{researchCandidates:pool.candidates.length,attempted:verification.attempted,
      officialIdsResolved:resolved.length,alreadyInCineRelay:resolved.filter(x=>x.alreadyPresent).length,
      cohortCollisions:collisions.length,reviewQueue:expired?0:reviewQueue.length},
    cohortCollisionHandles:collisions,reviewQueue:expired?[]:reviewQueue,
    gates:{c2OfficialIdChecksComplete:verification.status==='COMPLETED',
      c2EvidenceUnexpired:!expired,creatorOperatorApprovalsPresent:false,
      liveProductionUcIdDedupeComplete:false,projectQuotasConfirmed:false,
      youtubeDerivedMetricsPermissionVerified:false,
      productionCollectionAuthorized:false},
    safeguards:{noNetworkRequests:true,noDatabaseWrites:true,noScheduledCollection:true,
      noCreatorActivation:true,noCrossChannelComparison:true},
    nextStep:status==='BLOCKED_MISSING_API_KEY'?'Provision scoped YOUTUBE_API_KEY in GitHub Actions, then manually run the original C2 read-only workflow':
      status==='BLOCKED_EXPIRED_VERIFICATION'?'Re-run C2 verification before any human review':
      status==='BLOCKED_PROVIDER_AUTH_OR_QUOTA'?'Resolve provider authorization or quota and recheck before proceeding':
      reviewQueue.length?'Review each official channel manually, refresh live production UC-ID dedupe and quota evidence; this report never activates monitoring':
      'Resolve additional official channel IDs; never substitute research-only channel names',
  };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const root='research/creator-intelligence/';
  const read=path=>readFile(root+path,'utf8').then(JSON.parse);
  const [pool,existing,verification]=await Promise.all([
    read('c2-verification-input-20.json'),read('c2-existing-youtube-ids-2026-10-28.json'),read('c2-official-id-results.json')]);
  const report=auditC7Pilot({pool,existing,verification});
  // Public identity info only, never keys, provider bodies, or subscriber counters.
  console.log(JSON.stringify(report,null,2));
}
