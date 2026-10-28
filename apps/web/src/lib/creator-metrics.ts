// Pure presentation math. Never approximate bigint counters before computing
// a growth delta; previous observation is NOT a reconstructed hourly datapoint.
export type PublicPoint={
 observedAt:string;viewCount:string|null;likeCount:string|null;commentCount:string|null;
};
export function formatPublicCounter(value:string|null):string{
 if(value===null)return 'Unavailable';
 if(!/^\d+$/.test(value))throw new Error('Invalid public counter');
 return BigInt(value).toLocaleString('en-IN');
}
export function observedGrowth(samples:readonly PublicPoint[]):{
 delta:string|null;perHour:string|null;
 elapsedHours:number|null;adjustment:boolean;
 from:string|null;to:string|null;
}{
 const ordered=samples.filter(x=>x.viewCount!==null).slice()
   .sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
 if(ordered.length<2)return {delta:null,perHour:null,elapsedHours:null,adjustment:false,from:null,to:null};
 const a=ordered[ordered.length-2],b=ordered[ordered.length-1];
 const ms=Date.parse(b.observedAt)-Date.parse(a.observedAt);
 if(!Number.isSafeInteger(ms)||ms<=0||!a.viewCount||!b.viewCount||
   !/^\d+$/.test(a.viewCount)||!/^\d+$/.test(b.viewCount)){
   return {delta:null,perHour:null,elapsedHours:null,adjustment:false,from:null,to:null};
 }
 const diff=BigInt(b.viewCount)-BigInt(a.viewCount);
 if(diff<0n)return {delta:null,perHour:null,elapsedHours:ms/3600000,
   adjustment:true,from:a.observedAt,to:b.observedAt};
 const hourly=(diff*3_600_000n+BigInt(Math.floor(ms/2)))/BigInt(ms);
 return {delta:diff.toString(),perHour:hourly.toString(),elapsedHours:ms/3600000,
   adjustment:false,from:a.observedAt,to:b.observedAt};
}
export function creatorChartPoints(samples:readonly PublicPoint[],width=540,height=170):string{
 const pts=samples.filter(x=>x.viewCount!==null && /^\d+$/.test(x.viewCount??''))
   .slice().sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
 if(pts.length<2 || width<=0 || height<=0)return '';
 const from=Date.parse(pts[0].observedAt),to=Date.parse(pts[pts.length-1].observedAt);
 if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from)return '';
 const vals=pts.map(p=>BigInt(p.viewCount!));
 const min=vals.reduce((a,b)=>a<b?a:b),max=vals.reduce((a,b)=>a>b?a:b);
 return pts.map((p,i)=>{
   const t=Date.parse(p.observedAt),x=Math.round(10+(width-20)*(t-from)/(to-from));
   const ratio=max===min?5000n:((vals[i]-min)*10000n)/(max-min);
   const y=Math.round(height-10-(height-20)*Number(ratio)/10000);
   return `${x},${y}`;
 }).join(' ');
}
