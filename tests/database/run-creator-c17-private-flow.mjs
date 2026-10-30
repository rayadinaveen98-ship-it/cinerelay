// C17: actual C16 HTTP flow with REAL disposable Supabase Postgres RPC/TTL.
// Provider and operator identity are simulated. No credentials, external APIs or production DB.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {runC16ManualActivityRequest} from '../../supabase/functions/cinerelay-creator-activity-ingest/flow.mjs';

const a='UC'+'x'.repeat(22),b='UC'+'w'.repeat(22),c='UC'+'v'.repeat(22);
const targets=[a,b,c],method='creatorC14.oneShotPublicActivity';
if(process.env.GITHUB_ACTIONS!=='true'||process.env.CINERELAY_C17_EPHEMERAL_TEST!=='true')
 throw Error('REFUSED: C17 only runs in explicit ephemeral GitHub CI');
if(!['127.0.0.1','localhost'].includes(process.env.PGHOST||'127.0.0.1')||
 (process.env.PGPORT||'54322')!=='54322')
 throw Error('REFUSED: remote PostgreSQL connection forbidden');
const env={...process.env,PGPASSWORD:'postgres',PGHOST:'127.0.0.1',PGPORT:'54322'};
let command='psql',args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
 '-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres'];
if(spawnSync('psql',['--version'],{stdio:'ignore'}).status!==0){
 if(spawnSync('docker',['--version'],{stdio:'ignore'}).status!==0)
  throw Error('C17 needs local psql or Docker');
 command='docker';
 args=['exec','-i','supabase_db_cinerelay','psql','-X','-q','-A','-t',
 '-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'];
}
function sql(text){
 return execFileSync(command,[...args,'-c',text],{
  env,encoding:'utf8',timeout:16000,maxBuffer:24000,
 }).trim();
}
const lit=v=>"'"+String(v).replaceAll("'","''")+"'";
const db=q=>sql('set role service_role; '+q);
const list=targets.map(lit).join(',');
const receipts=()=>{
 const [n,u]=sql('select count(*)::text || \'|\' || coalesce(sum(units),0)::text '+
  'from public.connector_quota_usage where method='+lit(method)+';').split('|');
 return [Number(n),Number(u)];
};
const sources=()=>Number(sql('select count(*) from public.source_identities;'));
function stored(channel){
 const raw=db('select channel_id || \'|\' || coalesce(subscriber_count::text,\'hidden\')'+
  ' || \'|\' || public_video_count::text || \'|\' || jsonb_array_length(recent_public_uploads)::text '+
  ' || \'|\' || round(extract(epoch from (expires_at-observed_at))/86400)::text '+
  'from public.creator_intelligence_activity_observations where channel_id='+lit(channel)+';');
 if(!raw)return null;
 const [id,sub,vid,up,days]=raw.split('|');
 return {id,sub,vid,up:Number(up),days:Number(days)};
}
function clean(){
 sql('delete from public.creator_intelligence_activity_observations where channel_id in ('+list+');');
 sql('with doomed as (delete from public.creator_intelligence_activity_claims '+
  'where channel_id in ('+list+') returning quota_receipt_id) '+
  'delete from public.connector_quota_usage q using doomed d '+
  'where q.id=d.quota_receipt_id and q.method='+lit(method)+';');
}
const makeRequest=id=>new Request('http://localhost:54321/functions/v1/cinerelay-creator-activity-ingest',{
 method:'POST',headers:{authorization:'Bearer TEST_OPERATOR',
  'x-cinerelay-audit-intent':'ONE_SHOT_PUBLIC_ACTIVITY','content-type':'application/json'},
 body:JSON.stringify({channelId:id}),
});
const config={enabled:true,atomicEnabled:true,hasServerCredentials:true,
 dailyLimit:10000,reserve:2000,allowlist:targets.join(','),
 allowUntil:new Date(Date.now()+86400000).toISOString()};
let calls=0,finalized=0,forceError=false;
const deps={
 now:()=>new Date().toISOString(),
 activeOperator:async()=>true, // simulated auth, not proof of a hosted operator session
 claim:async(id,limit,reserve)=>JSON.parse(db(
  'select public.creator_c14_claim_and_reserve_activity('+
  [lit(id),limit,reserve].join(',')+')::text;')),
 provider:async(methodName,params)=>{
  calls++;
  if(methodName==='channels'){
   assert.ok(targets.includes(params.id));
   if(params.id===c&&forceError)return {status:403,body:{secret:'NOT_FOR_RESPONSE'}};
   return {status:200,body:{items:[{
    id:params.id,contentDetails:{relatedPlaylists:{uploads:'UU'+params.id.slice(2)}},
    statistics:{hiddenSubscriberCount:params.id===b,
     subscriberCount:params.id===b?'990000':'12300',videoCount:'24'},
   }]}};
  }
  assert.equal(methodName,'playlistItems');assert.equal(params.maxResults,'3');
  return {status:200,body:{items:[
   {contentDetails:{videoId:'aaaaaaaaaaa',videoPublishedAt:'2026-10-29T09:00:00Z'}},
   {contentDetails:{videoId:'bbbbbbbbbbb',videoPublishedAt:'2026-10-28T09:00:00Z'}},
  ]}};
 },
 save:async row=>{
  assert.ok(targets.includes(row.channel_id));
  const columns=['channel_id','observed_at','expires_at','subscriber_count',
   'subscribers_hidden','public_video_count','recent_public_uploads'];
  const values=[lit(row.channel_id),lit(row.observed_at),lit(row.expires_at),
   row.subscriber_count===null?'null':lit(row.subscriber_count),
   row.subscribers_hidden?'true':'false',lit(row.public_video_count),
   lit(JSON.stringify(row.recent_public_uploads))+'::jsonb'];
  const updates=columns.filter(x=>x!=='channel_id').map(x=>x+'=excluded.'+x).join(',');
  const query='insert into public.creator_intelligence_activity_observations ('+
   columns.join(',')+') values ('+values.join(',')+') on conflict (channel_id) do update set '+
   updates+' returning channel_id;';
  return db(query)===row.channel_id;
 },
 finalize:async(id,token,receipt,succeeded,status)=>{
  finalized++;
  return db('select public.creator_c14_finalize_activity_claim('+
   [lit(id),lit(token)+'::uuid',receipt,succeeded?'true':'false',status].join(',')+');')==='t';
 },
};
if(sql('select current_database()')!=='postgres')
 throw Error('REFUSED: unexpected database');
for(const table of ['creator_intelligence_activity_claims','creator_intelligence_activity_observations']){
 assert.equal(sql('select count(*) from public.'+table+' where channel_id in ('+list+');'),'0',
  'CI fixture IDs must be absent');
}
const before=receipts(),beforeSources=sources();
try{
 const disabled=await runC16ManualActivityRequest(makeRequest(a),{...config,enabled:false},deps);
 assert.equal(disabled.status,503);assert.deepEqual(receipts(),before);
 const unauthorized=await runC16ManualActivityRequest(makeRequest(a),config,{
  ...deps,activeOperator:async()=>false});
 assert.equal(unauthorized.status,403);assert.deepEqual(receipts(),before);

 const good=await runC16ManualActivityRequest(makeRequest(a),config,deps);
 const result=await good.json();
 assert.equal(good.status,200);assert.equal(result.state,'PRIVATE_TTL_STORED');
 assert.equal(result.monitoringEnabled,false);assert.equal(result.comparisonsEnabled,false);
 assert.equal(result.providerRequestsReserved,2);
 assert.equal(calls,2);assert.equal(finalized,1);
 assert.deepEqual(receipts(),[before[0]+1,before[1]+2]);
 assert.deepEqual(stored(a),{id:a,sub:'12300',vid:'24',up:2,days:28});
 assert.equal(sql('select state from public.creator_intelligence_activity_claims '+
  'where channel_id='+lit(a)+';'),'SUCCEEDED');

 const repeat=await runC16ManualActivityRequest(makeRequest(a),config,deps);
 assert.equal(repeat.status,409);assert.equal(calls,2);
 assert.deepEqual(receipts(),[before[0]+1,before[1]+2]);

 const hidden=await runC16ManualActivityRequest(makeRequest(b),config,deps);
 assert.equal(hidden.status,200);assert.equal(stored(b).sub,'hidden');
 assert.equal(stored(b).up,2);
 assert.deepEqual(receipts(),[before[0]+2,before[1]+4]);

 forceError=true;
 const failure=await runC16ManualActivityRequest(makeRequest(c),config,deps);
 assert.equal(failure.status,503);
 const failureBody=await failure.json();
 assert.equal(failureBody.error,'CHANNEL_PROVIDER_FAILURE');
 assert.equal(JSON.stringify(failureBody).includes('NOT_FOR_RESPONSE'),false);
 assert.equal(stored(c),null);
 assert.equal(sql('select state from public.creator_intelligence_activity_claims '+
  'where channel_id='+lit(c)+';'),'FAILED');
 assert.deepEqual(receipts(),[before[0]+3,before[1]+6]);
 assert.equal(finalized,3);assert.equal(sources(),beforeSources);
 console.log('PASS C17: HTTP handler with real local C14 claims/quota, real C12 private '+
  'TTL writes, redacted hidden subs, replay lock, failed provider finalization, no source changes');
}finally{
 clean();
 assert.deepEqual(receipts(),before,'C17 must remove temporary receipts');
 assert.equal(stored(a),null);assert.equal(stored(b),null);assert.equal(stored(c),null);
}
