/**
 * Creator Intelligence C2 — source-verified public YouTube channel identity audit.
 *
 * STRICTLY read-only with respect to Supabase, subscriptions, and metric collection.
 * 20 requests maximum per invocation, no retries, with an explicit quota stop.
 * Recheck these results before approval: channel handles, ownership and content
 * can change. GitHub output contains public IDs, NOT keys or subscriber counts.
 */
import {pathToFileURL} from 'node:url';

const CHANNEL_ID=/^UC[A-Za-z0-9_-]{22}$/;
const UPLOADS_ID=/^UU[A-Za-z0-9_-]{22}$/;
const HANDLE=/^@[\p{L}\p{M}\p{N}._-]{3,30}$/u;
const MAX_REQUESTS=20;

export function validateC2Inputs(pool,existing) {
  if(!pool || !Array.isArray(pool.candidates) || pool.candidates.length<1 || pool.candidates.length>MAX_REQUESTS){
    throw Error('C2 cohort must contain 1–20 candidates');
  }
  if(!existing || !Array.isArray(existing.channelIds))throw Error('Existing-ID snapshot is required');
  const idSet=new Set();
  for(const id of existing.channelIds){
    if(typeof id!=='string'||!CHANNEL_ID.test(id)||idSet.has(id))throw Error('Invalid or duplicate existing UC identity');
    idSet.add(id);
  }
  const handles=new Set();
  for(const c of pool.candidates){
    if(!c || typeof c.name!=='string'||!c.name.trim()||typeof c.listedHandle!=='string'||!HANDLE.test(c.listedHandle)){
      throw Error('Candidate missing name or valid listed @handle');
    }
    const key=c.listedHandle.toLocaleLowerCase('en-US');
    if(handles.has(key))throw Error('Duplicate handle in C2 cohort');
    handles.add(key);
    if(c.verified!==false||c.trackingEnabled!==false||c.officialChannelId!==null){
      throw Error('Verification must start from an inactive, unverified candidate');
    }
  }
  return idSet;
}
export function evaluateC2Result(candidate,data,existingIds) {
  if(!data || !Array.isArray(data.items))return {status:'MALFORMED_RESPONSE',reason:'Expected YouTube channels.list items'};
  if(data.items.length===0)return {status:'HANDLE_NOT_FOUND',reason:'Official API returned zero channel records'};
  if(data.items.length!==1)return {status:'AMBIGUOUS_RESPONSE',reason:'Expected exactly one official handle match'};
  const ch=data.items[0],id=ch?.id,name=ch?.snippet?.title,uploads=ch?.contentDetails?.relatedPlaylists?.uploads;
  if(typeof id!=='string'||!CHANNEL_ID.test(id)||typeof name!=='string'||!name.trim()
    ||typeof uploads!=='string'||!UPLOADS_ID.test(uploads) || uploads!=='UU'+id.slice(2)){
    return {status:'MALFORMED_RESPONSE',reason:'Official ID, name or uploads playlist invalid'};
  }
  return {status:existingIds.has(id)?'EXISTING_ID_DUPLICATE':'OFFICIAL_ID_FOUND_REVIEW_PENDING',
    reason:existingIds.has(id)?'Already present in CineRelay; do not create duplicate':
      'Official UC ID found; editor must review creator identity and channel activity before activation',
    officialChannelId:id,officialChannelTitle:name.trim(),uploadsPlaylistId:uploads};
}
export async function runC2Verification({pool,existing,apiKey,fetcher=fetch,at=new Date().toISOString(),requestLimit=MAX_REQUESTS}) {
  const existingIds=validateC2Inputs(pool,existing);
  if(!Number.isSafeInteger(requestLimit)||requestLimit<0||requestLimit>MAX_REQUESTS)throw Error('Invalid request limit');
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(at))throw Error('Expected explicit UTC timestamp');
  const limit=Math.min(requestLimit,pool.candidates.length);
  const out={kind:'CINERELAY_CREATOR_C2_VERIFICATION',observedAt:at,
    expiresAt:new Date(Date.parse(at)+30*86400000).toISOString(),
    idSnapshotCount:existingIds.size, totalCandidates:pool.candidates.length,
    attempted:0, quotaBucket:'GENERAL_READ',maxRequests:MAX_REQUESTS,usedRequests:0,
    status:'PENDING',rows:[]};
  if(!apiKey){out.status='BLOCKED_MISSING_GITHUB_API_KEY';return out;}
  let halted=false;
  for(const c of pool.candidates){
    const row={candidateName:c.name,listedHandle:c.listedHandle,
      locale:c.locale,provisionalSizeTier:c.provisionalSizeTier,category:c.niche,
      sourceUrl:c.sourceUrl,trackingEnabled:false};
    if(halted || out.usedRequests>=limit){
      out.rows.push({...row,status:halted?'BLOCKED_UPSTREAM':'NOT_ATTEMPTED',reason:'No additional API calls'});
      continue;
    }
    const url=new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('part','snippet,contentDetails');
    url.searchParams.set('forHandle',c.listedHandle);
    url.searchParams.set('fields','items(id,snippet(title),contentDetails(relatedPlaylists(uploads)))');
    // Never log the complete URL or persist credentials.
    url.searchParams.set('key',apiKey);
    out.usedRequests++;
    out.attempted++;
    try{
      const response=await fetcher(url.toString(),{headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});
      if(!response.ok){
        out.rows.push({...row,status:'API_ERROR',httpStatus:response.status,reason:'API error; credentials and body not recorded'});
        if([401,403,429].includes(response.status))halted=true;
        continue;
      }
      const data=await response.json();
      out.rows.push({...row,...evaluateC2Result(c,data,existingIds)});
    }catch(_e){
      out.rows.push({...row,status:'NETWORK_ERROR',reason:'Transport or parsing failure; no secret or URL recorded'});
    }
  }
  out.status=halted?'HALTED_AUTH_OR_QUOTA':out.usedRequests>=limit && limit<pool.candidates.length?'PARTIAL_LIMIT':'COMPLETED';
  return out;
}

// C19: historical Git-oriented CLI disabled until a separately reviewed,
// server-only expiring writer is available. Exported verification logic remains
// importable for offline mock tests, but invoking this script makes NO API calls.
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  console.error('C19_C2_CLI_DISABLED_USE_PRIVATE_EXPIRING_IDENTITY_INGEST');
  process.exitCode=1;
}
