/**
 * C24: real C20/C23/C19 SQL+HTTP integration test using disposable GitHub CI
 * local Supabase postgres; fake Auth and fake Google channels.list.
 * Explicitly refuses remote DB connections, no credentials, no YouTube calls.
 */
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {runC20IdentityRequest} from '../../supabase/functions/cinerelay-creator-identity-verify/flow.mjs';

if(process.env.GITHUB_ACTIONS!=='true'||
 process.env.CINERELAY_C24_EPHEMERAL_TEST!=='true')
 throw Error('REFUSED: C24 requires explicit ephemeral GitHub CI');
if(!['127.0.0.1','localhost'].includes(process.env.PGHOST||'127.0.0.1')||
 (process.env.PGPORT||'54322')!=='54322'||
 (process.env.PGDATABASE||'postgres')!=='postgres'||
 (process.env.PGUSER||'postgres')!=='postgres')
 throw Error('REFUSED: local Supabase postgres only');
const env={...process.env,
 PGHOST:'127.0.0.1',PGPORT:'54322',PGDATABASE:'postgres',
 PGUSER:'postgres',PGPASSWORD:'postgres'};
let command='psql',args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
 '-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres'];
if(spawnSync('psql',['--version'],{stdio:'ignore'}).status!==0){
 if(spawnSync('docker',['--version'],{stdio:'ignore'}).status!==0)
  throw Error('REFUSED: local psql / Supabase Docker missing');
 command='docker';
 args=['exec','-i','supabase_db_cinerelay','psql','-X','-q','-A','-t',
  '-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'];
}
function sql(query){
 return execFileSync(command,[...args,'-c',query],{
  env,encoding:'utf8',timeout:20000,maxBuffer:25000,
 }).trim();
}
const lit=v=>"'"+String(v).replaceAll("'","''")+"'";
const db=q=>sql('set role service_role; '+q);
const ids=['UC'+'m'.repeat(22),'UC'+'n'.repeat(22),'UC'+'o'.repeat(22)];
const handles=['@c24one','@c24failed','@c24late'];
const method='creatorC20.oneShotIdentity';
const idsSql=ids.map(lit).join(',');
const handlesSql=handles.map(lit).join(',');
const quota=()=>{
 const [count,units]=sql("select count(*)::text||'|'||coalesce(sum(units),0)::text "+
  'from public.connector_quota_usage where method='+lit(method)+';').split('|');
 return [Number(count),Number(units)];
};
const sources=()=>Number(sql('select count(*) from public.source_identities;'));
function state(handle){
 return sql('select state from public.creator_intelligence_handle_claims where handle_key='+
  lit(handle)+';');
}
function identity(id){
 const data=db("select listed_handle||'|'||review_state||'|'||"+
  "monitoring_enabled::text||'|'||metrics_enabled::text||'|'||"+
  "round(extract(epoch from (expires_at-observed_at))/86400)::text "+
  "from public.creator_intelligence_identity_evidence where channel_id="+lit(id)+';');
 if(!data)return null;
 const [handle,review,monitoring,metrics,days]=data.split('|');
 return {handle,review,monitoring,metrics,days:Number(days)};
}
function cleanup(){
 // Synthetic fixture IDs/handles ONLY. No source registry writes or deletes.
 sql('delete from public.creator_intelligence_identity_evidence where channel_id in ('+idsSql+');');
 sql('with removed as (delete from public.creator_intelligence_handle_claims '+
  'where handle_key in ('+handlesSql+') returning quota_receipt_id) '+
  'delete from public.connector_quota_usage q using removed r '+
  'where q.id=r.quota_receipt_id and q.method='+lit(method)+';');
}
assert.equal(sql('select current_database()'),'postgres');
assert.equal(sql('select inet_server_addr() is null or inet_server_addr()::text in '+
 "('127.0.0.1','::1');"),'t');
for(const table of ['creator_intelligence_handle_claims','creator_intelligence_identity_evidence']){
 const predicate=table.endsWith('claims')?'handle_key in ('+handlesSql+')':'channel_id in ('+idsSql+')';
 assert.equal(sql('select count(*) from public.'+table+' where '+predicate+';'),'0',
  'C24 requires uncontaminated fixture IDs');
}
const quotaBefore=quota(),sourcesBefore=sources();
const at=()=>new Date().toISOString();
const candidates=handles.map((handle,i)=>({
 handle,name:'C24 Synthetic Creator '+(i+1),locale:i===0?'te':i===1?'kn':'ml',
 category:'Education',sizeTier:'UNVERIFIED',
 sourceUrl:'https://example.org/c24-offline-review',
}));
const config={enabled:true,atomicEnabled:true,hasServerCredentials:true,
 dailyLimit:10000,reserve:2000,
 allowUntil:new Date(Date.now()+86400000).toISOString(),candidates};
const request=handle=>new Request('http://localhost:54321/functions/v1/cinerelay-creator-identity-verify',{
 method:'POST',headers:{
 authorization:'Bearer C24_FAKE_OPERATOR',
 'x-cinerelay-identity-intent':'ONE_SHOT_OFFICIAL_IDENTITY',
 'content-type':'application/json',
 },body:JSON.stringify({handle}),
});
const providers={calls:0},failHandle=handles[1],lateHandle=handles[2];
let successCommits=0,failureFinalizations=0,staleCommits=0;
const deps={
 now:at,
 activeOperator:async()=>true, // Deliberately FAKE, not hosted JWT proof
 claim:async(handle,limit,reserve)=>JSON.parse(db(
  'select public.creator_c20_claim_and_reserve_identity('+
  [lit(handle),limit,reserve].join(',')+')::text;')),
 provider:async handle=>{
  providers.calls++;
  const i=handles.indexOf(handle);
  assert.ok(i>=0);
  if(handle===failHandle)
   return {status:403,body:{providerSecret:'C24_NEVER_RETURN_TO_BROWSER'}};
  if(handle===lateHandle){
   // Simulate the exact lease-replacement race before old provider returns.
   db('update public.creator_intelligence_handle_claims '+
    'set claim_token=gen_random_uuid() where handle_key='+lit(handle)+';');
  }
  return {status:200,body:{items:[{
   id:ids[i],snippet:{title:'C24 Official Synthetic '+(i+1)},
   contentDetails:{relatedPlaylists:{uploads:'UU'+ids[i].slice(2)}},
  }]}};
 },
 commit:async(handle,token,receipt,record)=>{
  if(handle===lateHandle)staleCommits++;
  const accepted=db('select public.creator_c23_commit_verified_identity('+
   [lit(handle),lit(token)+'::uuid',receipt,
    lit(JSON.stringify(record))+'::jsonb'].join(',')+');')==='t';
  if(accepted)successCommits++;
  return accepted;
 },
 finalize:async(handle,token,receipt,succeeded,status)=>{
  assert.equal(succeeded,false);
  failureFinalizations++;
  return db('select public.creator_c20_finalize_identity('+
   [lit(handle),lit(token)+'::uuid',receipt,
    'false',status].join(',')+');')==='t';
 },
};
try{
 // Missing enable flag and rejected auth must not reserve any unit.
 assert.equal((await runC20IdentityRequest(request(handles[0]),
  {...config,enabled:false},deps)).status,503);
 assert.equal((await runC20IdentityRequest(request(handles[0]),
  config,{...deps,activeOperator:async()=>false})).status,403);
 assert.deepEqual(quota(),quotaBefore);

 const first=await runC20IdentityRequest(request(handles[0]),config,deps);
 const body=await first.json();
 assert.equal(first.status,200,JSON.stringify(body));
 assert.equal(body.state,'PRIVATE_IDENTITY_STORED');
 assert.equal(body.providerRequestsReserved,1);
 assert.equal(body.monitoringEnabled,false);
 assert.equal(body.comparisonsEnabled,false);
 assert.deepEqual(identity(ids[0]),{
  handle:handles[0],review:'REVIEW_PENDING',
  monitoring:'false',metrics:'false',days:27,
 });
 assert.equal(state(handles[0]),'SUCCEEDED');
 assert.deepEqual(quota(),[quotaBefore[0]+1,quotaBefore[1]+1]);

 const replay=await runC20IdentityRequest(request(handles[0]),config,deps);
 assert.equal(replay.status,409,'cooldown prevents duplicate provider reads');
 assert.equal(providers.calls,1);
 assert.deepEqual(quota(),[quotaBefore[0]+1,quotaBefore[1]+1]);

 // One fake provider error: reservation persists and failed finalization occurs.
 const failure=await runC20IdentityRequest(request(failHandle),config,deps);
 const failureBody=await failure.json();
 assert.equal(failure.status,503);
 assert.equal(failureBody.error,'YOUTUBE_IDENTITY_PROVIDER_FAILED');
 assert.ok(!JSON.stringify(failureBody).includes('C24_NEVER_RETURN_TO_BROWSER'));
 assert.equal(identity(ids[1]),null);
 assert.equal(state(failHandle),'FAILED');
 assert.equal(failureFinalizations,1);
 assert.deepEqual(quota(),[quotaBefore[0]+2,quotaBefore[1]+2]);

 // Late response: claim token changed BEFORE commit; no identity visible.
 const late=await runC20IdentityRequest(request(lateHandle),config,deps);
 const lateBody=await late.json();
 assert.equal(late.status,503);
 assert.equal(lateBody.error,'C23_STALE_OR_REJECTED_IDENTITY_COMMIT');
 assert.equal(identity(ids[2]),null);
 assert.equal(state(lateHandle),'IN_FLIGHT');
 assert.equal(staleCommits,1);
 assert.equal(successCommits,1);
 assert.equal(failureFinalizations,1,
  'a stale token must not incorrectly finalize another claim');
 assert.deepEqual(quota(),[quotaBefore[0]+3,quotaBefore[1]+3]);
 assert.equal(sources(),sourcesBefore,'existing cinema source registry changed');
 console.log('PASS C24: real local C19+C20+C23 database-backed HTTP flow, '+
  'one-unit reservation, private 27d review, replay, provider failure, '+
  'late stale-token rejection, no hidden data leaks, no source registry mutation');
}finally{
 cleanup();
 assert.deepEqual(quota(),quotaBefore,'all temporary quota receipts deleted');
 for(const id of ids)assert.equal(identity(id),null);
 for(const handle of handles)assert.equal(state(handle),'');
 assert.equal(sources(),sourcesBefore);
}
