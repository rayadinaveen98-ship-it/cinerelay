import {comparePublicVideoObservations,C6_AGE_WINDOWS} from '../../../apps/web/src/lib/creator-comparisons.ts';
import {creatorComparisonApproved} from '../../functions/cinerelay-creator-intelligence-api/comparison-policy.ts';
const now='2026-10-28T13:00:00Z';
const A='UCaaaaaaaaaaaaaaaaaaaaaa',B='UCbbbbbbbbbbbbbbbbbbbbbb';
const publication='2026-10-26T12:00:00Z';
const entry=(n:string,channelId:string,format:'LONG'|'SHORT'|'LIVE'|'UNKNOWN'='LONG',samples:{
 observedAt:string;viewCount:string|null;likeCount:string|null;commentCount:string|null;
}[]=[])=>({videoId:n.repeat(11),channelId,publishedAt:publication,format,samples});
const point=(observedAt:string,viewCount:string|null)=>({observedAt,viewCount,likeCount:null,commentCount:null});
const ok=(condition:boolean,message:string)=>{if(!condition)throw new Error(message);};
Deno.test('C6 locked by default without both server-side permission and audit reference',()=>{
 ok(!creatorComparisonApproved(undefined,undefined),'empty env');
 ok(!creatorComparisonApproved('true',undefined),'flag alone cannot activate');
 ok(!creatorComparisonApproved('false','YT-analytics-approval-20261028'),'reference alone insufficient');
 ok(!creatorComparisonApproved('true','pending'),'placeholder rejected');
 ok(!creatorComparisonApproved('TRUE','YT-analytics-approval-20261028'),'case sensitive');
 ok(creatorComparisonApproved('true','YT-analytics-approval-20261028'),'explicit approval configuration accepted');
});
Deno.test('C6 refuses same video, unknown format, cross-format and invalid IDs',()=>{
 const a=entry('a',A),b=entry('b',B);
 ok(comparePublicVideoObservations(a,a,now).reason==='SAME_VIDEO','same video');
 ok(comparePublicVideoObservations(a,entry('b',B,'UNKNOWN'),now).reason==='FORMAT_UNKNOWN','unknown');
 ok(comparePublicVideoObservations(a,entry('b',B,'SHORT'),now).reason==='FORMAT_MISMATCH','format');
 ok(comparePublicVideoObservations({...a,videoId:'bad'},b,now).reason==='INVALID_INPUT','id');
 ok(comparePublicVideoObservations(a,b,'2026-10-28T13:00:00').reason==='INVALID_INPUT','no zone');
});
Deno.test('C6 matches two factual 24h readings with separate exact observed ages',()=>{
 const a=entry('a',A,'LONG',[point('2026-10-27T11:20:00Z','999')]);
 const b=entry('b',B,'LONG',[point('2026-10-27T13:10:00Z','88')]);
 const out=comparePublicVideoObservations(a,b,now);
 ok(out.comparable&&out.format==='LONG'&&out.completeWindows===1,'one fully observed window');
 const match=out.windows.find(w=>w.key==='24h');
 ok(match?.status==='OBSERVED','24h coverage');
 ok(match?.a?.viewCount==='999'&&match?.b?.viewCount==='88','raw public counters only');
 if(!match?.a||!match.b)throw new Error('Expected two distinct real observations');
 ok(match.a.ageHours!==match.b.ageHours,'no time interpolation');
 ok(out.windows.filter(w=>w.status==='MISSING_BOTH').length===4,'no fabricated backfill');
});
Deno.test('C6 strict tolerance means 24h+3h is not an observed 24-hour reading',()=>{
 const a=entry('a',A,'SHORT',[point('2026-10-27T15:01:00Z','800')]);
 const b=entry('b',B,'SHORT',[point('2026-10-27T12:00:00Z','80')]);
 const w=comparePublicVideoObservations(a,b,now).windows.find(x=>x.key==='24h');
 ok(w?.status==='MISSING_A'&&w.a===null&&w.b?.viewCount==='80','strict ±2h');
});
Deno.test('C6 nearest observation is based on video age, not observation recency',()=>{
 const a=entry('a',A,'LONG',[
  point('2026-10-27T10:30:00Z','100'),point('2026-10-27T12:02:00Z','150'),
  point('2026-10-27T13:00:00Z','190'),
 ]);
 const b=entry('b',B,'LONG',[point('2026-10-27T12:00:00Z','35')]);
 const w=comparePublicVideoObservations(a,b,now).windows.find(x=>x.key==='24h');
 ok(w?.a?.viewCount==='150','closest age wins');
});
Deno.test('C6 missing public view count is not replaced by likes or zero',()=>{
 const a=entry('a',A,'LONG',[point('2026-10-27T12:00:00Z',null)]);
 const b=entry('b',B,'LONG',[point('2026-10-27T12:00:00Z','0')]);
 const w=comparePublicVideoObservations(a,b,now).windows.find(x=>x.key==='24h');
 ok(w?.status==='MISSING_A','view absence distinguished from actual 0');
 ok(w?.b?.viewCount==='0','actual zero kept');
});
Deno.test('C6 reading after now or before 30-day retention cannot appear as real',()=>{
 const a=entry('a',A,'LONG',[point('2026-10-28T14:00:00Z','1000')]);
 const b=entry('b',B,'LONG',[point('2026-10-27T12:00:00Z','10')]);
 const out=comparePublicVideoObservations(a,b,now);
 ok(out.completeWindows===0,'future cannot be used');
 const ancient='2026-09-01T00:00:00Z';
 const old=entry('a',A,'LONG',[point(ancient,'300')]);
 ok(comparePublicVideoObservations(old,b,now).reason==='INVALID_INPUT','predates publication');
});
Deno.test('C6 same published age works independently of UTC versus IST timestamp formatting',()=>{
 const a={...entry('a',A),publishedAt:'2026-10-26T17:30:00+05:30',
   samples:[point('2026-10-27T17:30:00+05:30','900')]};
 const b=entry('b',B,'LONG',[point('2026-10-27T12:00:00Z','500')]);
 ok(comparePublicVideoObservations(a,b,now).completeWindows===1,'offset aware');
});
Deno.test('C6 max 800 samples per video guards against unbounded response memory',()=>{
 const samples=Array.from({length:801},(_,i)=>point('2026-10-27T12:00:00Z',String(i)));
 const out=comparePublicVideoObservations(entry('a',A,'LONG',samples),entry('b',B),now);
 ok(out.reason==='INVALID_INPUT','oversized input rejected');
});
Deno.test('C6 published 6/24/48/72h/7d windows have explicit finite tolerances',()=>{
 ok(C6_AGE_WINDOWS.length===5,'five ages');
 ok(C6_AGE_WINDOWS.every(w=>w.targetHours>0&&w.toleranceHours>0&&w.toleranceHours<w.targetHours),'finite windows');
});
