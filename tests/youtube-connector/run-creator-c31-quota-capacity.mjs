import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {DEFAULT_ASSUMPTIONS,forecastCreatorQuota,creatorCapacityScenarios,parseC31Args}
 from '../../scripts/creator-intelligence/c31-offline-quota-capacity.mjs';

let n=0;
function test(label,callback){callback();n++;console.log('PASS C31: '+label);}
const [pilot,hourly,daily]=creatorCapacityScenarios();
test('20-channel pilot budget is exactly 20 general and 8 video-stats calls/day',()=>{
 assert.equal(pilot.forecast.generalRead.playlistRequestUnitsPerDay,20);
 assert.equal(pilot.forecast.generalRead.totalPlannedUnits,1220);
 assert.equal(pilot.forecast.generalRead.headroomUnits,6780);
 assert.equal(pilot.forecast.videoStats.requestsPerSweep,2);
 assert.equal(pilot.forecast.videoStats.totalPlannedUnits,8);
 assert.equal(pilot.forecast.videoStats.headroomUnits,8992);
});
test('1,000 per-channel hourly playlist polling clearly fails general-read',()=>{
 assert.equal(hourly.forecast.generalRead.playlistRequestUnitsPerDay,24000);
 assert.equal(hourly.forecast.generalRead.totalPlannedUnits,25200);
 assert.equal(hourly.forecast.generalRead.headroomUnits,-17200);
 assert.equal(hourly.forecast.generalRead.fitsAssumedQuota,false);
 assert.equal(hourly.forecast.videoStats.totalPlannedUnits,1440);
 assert.equal(hourly.forecast.fitsBothAssumedBuckets,false);
});
test('1,000 daily playlist checks can fit assumed quota while stats use independent bucket',()=>{
 assert.equal(daily.forecast.generalRead.playlistRequestUnitsPerDay,1000);
 assert.equal(daily.forecast.generalRead.headroomUnits,5800);
 assert.equal(daily.forecast.videoStats.requestsPerSweep,60);
 assert.equal(daily.forecast.videoStats.totalPlannedUnits,1440);
 assert.equal(daily.forecast.videoStats.headroomUnits,7560);
 assert.equal(daily.forecast.fitsBothAssumedBuckets,true);
});
test('fits assumed budgets NEVER grants actual Google Cloud verification or collection',()=>{
 for(const {forecast} of creatorCapacityScenarios()){
  assert.equal(forecast.evidence,'HYPOTHETICAL_ONLY');
  assert.equal(forecast.actualGoogleCloudAllocationVerified,false);
  assert.equal(forecast.actualGoogleCloudUsageVerified,false);
  assert.equal(forecast.cinema185SourceTrafficMeasured,false);
  assert.equal(forecast.liveProviderCallsMade,0);
  assert.equal(forecast.safeToEnableCollection,false);
  assert.equal(forecast.liveCreatorPilotAuthorized,false);
  assert.equal(forecast.monitoringEnabled,false);
  assert.equal(forecast.comparisonEnabled,false);
 }
});
test('already-used units, other workloads and reserves always reduce available capacity',()=>{
 const x=forecastCreatorQuota({...DEFAULT_ASSUMPTIONS,
  existingCinemaGeneralReadUnits:5000,otherGeneralReadUnits:1000,
  generalAlreadyConsumed:1000,statsAlreadyConsumed:8000});
 assert.equal(x.generalRead.totalPlannedUnits,8000);
 assert.equal(x.generalRead.headroomUnits,0);
 assert.equal(x.videoStats.headroomUnits,-440);
 assert.equal(x.fitsBothAssumedBuckets,false);
});
test('conservative video batch rounding and separate quota are exact',()=>{
 const x=forecastCreatorQuota({...DEFAULT_ASSUMPTIONS,activelyObservedVideos:51,
  statsChecksPerVideoPerDay:3,conservativeVideosPerBatch:50});
 assert.equal(x.videoStats.requestsPerSweep,2);
 assert.equal(x.videoStats.totalPlannedUnits,6);
 const z=forecastCreatorQuota({...DEFAULT_ASSUMPTIONS,
  activelyObservedVideos:0,statsChecksPerVideoPerDay:24,channels:0});
 assert.equal(z.videoStats.totalPlannedUnits,0);
 assert.equal(z.generalRead.playlistRequestUnitsPerDay,0);
});
test('invalid quota assumptions, overflow, wrong batch and surprise keys are refused',()=>{
 const cases=[
  {...DEFAULT_ASSUMPTIONS,channels:-1},
  {...DEFAULT_ASSUMPTIONS,channels:1.5},
  {...DEFAULT_ASSUMPTIONS,channels:Number.MAX_SAFE_INTEGER,playlistChecksPerChannelPerDay:24},
  {...DEFAULT_ASSUMPTIONS,conservativeVideosPerBatch:51},
  {...DEFAULT_ASSUMPTIONS,conservativeVideosPerBatch:0},
  {...DEFAULT_ASSUMPTIONS,statsDailyLimit:10,statsReserveUnits:11},
  {...DEFAULT_ASSUMPTIONS,generalReserveUnits:10001},
  {...DEFAULT_ASSUMPTIONS,fakeLiveAuthorization:true}
 ];
 for(const x of cases)assert.throws(()=>forecastCreatorQuota(x));
 const missing={...DEFAULT_ASSUMPTIONS};delete missing.channels;
 assert.throws(()=>forecastCreatorQuota(missing));
});
test('CLI safely parses manual scenario but refuses unsupported flags or huge unsafe values',()=>{
 const o=parseC31Args(['--channels=20','--activelyObservedVideos=60',
  '--statsChecksPerVideoPerDay=4']);
 assert.equal(o.input.channels,20);
 assert.equal(o.input.statsChecksPerVideoPerDay,4);
 for(const flags of [['--creatorKey=abc'],['--channels=-1'],['--channels=10','--channels=20'],
  ['--channels=9007199254740992'],['--channels=01'],['--pilot','--channels=1']])
  assert.throws(()=>parseC31Args(flags));
});
test('CLI never interprets a hypothetical pass as authority for live provider calls',()=>{
 const path='scripts/creator-intelligence/c31-offline-quota-capacity.mjs';
 const result=spawnSync(process.execPath,[path,
  '--channels=1000','--playlistChecksPerChannelPerDay=24'],{encoding:'utf8',timeout:12000});
 assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).generalRead.headroomUnits,-17200);
 const blocked=spawnSync(process.execPath,[path,'--pilot'],{encoding:'utf8',timeout:12000});
 assert.equal(blocked.status,2,blocked.stderr);
 assert.equal(JSON.parse(blocked.stdout).safeToEnableCollection,false);
});
test('planner does not fetch, store snapshots, read credentials, or call cloud SDKs',()=>{
 const code=readFileSync('scripts/creator-intelligence/c31-offline-quota-capacity.mjs','utf8');
 assert.ok(code.includes('estimateCreatorDiscoveryBudget'));
 assert.ok(!/\bfetch\s*\(|createClient\s*\(|process\.env|execFileSync|spawnSync|\bDeno\.|googleapis\.com|YOUTUBE_API_KEY/.test(code));
});
console.log('PASS CineRelay C31: '+n+' quota forecasting and no-live-release tests');
