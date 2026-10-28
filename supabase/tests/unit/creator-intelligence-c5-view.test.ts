import {creatorChartPoints,formatPublicCounter,observedGrowth} from '../../../apps/web/src/lib/creator-metrics.ts';
function equal(a:unknown,b:unknown,label:string){if(a!==b)throw new Error(label+': '+String(a)+' !== '+String(b));}
const point=(viewCount:string|null,observedAt:string,likeCount:string|null=null,commentCount:string|null=null)=>
  ({viewCount,observedAt,likeCount,commentCount});
Deno.test('C5 exact public bigint formatting never rounds 64-bit observations',()=>{
  equal(formatPublicCounter('18446744073709551615'),'1,84,46,74,40,73,70,95,51,615','large number');
  equal(formatPublicCounter(null),'Unavailable','null visibility');
  equal(formatPublicCounter('0'),'0','reported zero');
});
Deno.test('C5 observed growth across an actual 2h gap is average per hour, not an assumed 1h snapshot',()=>{
  const delta=observedGrowth([point('100','2026-10-28T10:00:00Z'),point('500','2026-10-28T12:00:00Z')]);
  equal(delta.delta,'400','delta');
  equal(delta.perHour,'200','average per hour');
  equal(delta.elapsedHours,2,'observed interval');
});
Deno.test('C5 handles out-of-order provider samples without inventing chronology',()=>{
  const delta=observedGrowth([
    point('500','2026-10-28T12:00:00Z'),point('100','2026-10-28T10:00:00Z'),
  ]);
  equal(delta.delta,'400','sort observations');
});
Deno.test('C5 unobserved or hidden views cannot become a fabricated rate',()=>{
  equal(observedGrowth([point(null,'2026-10-28T10:00:00Z')]).delta,null,'unknown views');
  equal(observedGrowth([point('1','2026-10-28T10:00:00Z')]).perHour,null,'one reading');
});
Deno.test('C5 reported view counter decreases are labelled provider adjustments',()=>{
  const delta=observedGrowth([point('900','2026-10-28T10:00:00Z'),point('700','2026-10-28T11:00:00Z')]);
  equal(delta.adjustment,true,'adjustment flag');
  equal(delta.delta,null,'no negative views-growth claim');
});
Deno.test('C5 view line never plots missing or single readings',()=>{
  equal(creatorChartPoints([point(null,'2026-10-28T10:00:00Z')]),'','no fake sample');
  equal(creatorChartPoints([point('15','2026-10-28T10:00:00Z')]),'','one reading not a line');
});
Deno.test('C5 time position reflects actual uneven intervals, not equal slot spacing',()=>{
  const line=creatorChartPoints([
    point('1','2026-10-28T10:00:00Z'),
    point('2','2026-10-28T11:00:00Z'),
    point('3','2026-10-28T14:00:00Z'),
  ],540,170);
  const pts=line.split(' ').map(p=>p.split(',').map(Number));
  if(pts.length!==3 || !(pts[1][0]<275) || pts[0][0]!==10 || pts[2][0]!==530)
    throw new Error('chart positions must follow timestamps');
});
Deno.test('C5 chart remains finite for 64-bit counters and a flat line',()=>{
  const line=creatorChartPoints([
    point('18446744073709551615','2026-10-28T10:00:00Z'),
    point('18446744073709551615','2026-10-28T11:00:00Z'),
  ]);
  if(!line || line.includes('NaN') || line.includes('Infinity'))throw new Error('bad coordinates');
});
