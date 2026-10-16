import {isIdentityOnlyWebArticle,prioritizePendingSuggestions} from '../../../apps/web/src/lib/article-review-utils.ts';

Deno.test('undated or historical operator review is identity-only',()=>{
 const now=new Date('2026-10-16T04:00:00Z');
 for(const item of [
  {first_seen_at:'2026-10-16T03:00:00Z',published_at:null},
  {first_seen_at:'2026-10-01T03:00:00Z',published_at:'2026-10-01T03:00:00Z'},
  {first_seen_at:'2026-10-16T03:00:00Z',published_at:'2026-09-01T03:00:00Z'},
 ]){
  if(!isIdentityOnlyWebArticle(item,now))throw new Error('unsafe identity-only classification');
 }
 if(isIdentityOnlyWebArticle({first_seen_at:'2026-10-16T02:00:00Z',published_at:'2026-10-16T02:00:00Z'},now))throw new Error('fresh published article should not be labelled archival');
});
Deno.test('typed pending candidates sort first, preserving supplied input',()=>{
 const a={rawItem:{first_seen_at:'2026-10-16T03:00:00Z',published_at:null},typedSuggestion:null,id:'manual'};
 const b={rawItem:{first_seen_at:'2026-10-01T03:00:00Z',published_at:null},typedSuggestion:{status:'PENDING'},id:'aspirants'};
 const c={rawItem:{first_seen_at:'2026-10-15T03:00:00Z',published_at:null},typedSuggestion:{status:'PENDING'},id:'diplomat'};
 const d={rawItem:{first_seen_at:'2026-10-16T01:00:00Z',published_at:null},typedSuggestion:{status:'PROMOTED'},id:'old'};
 const original=[a,b,d,c];const result=prioritizePendingSuggestions(original);
 const ids=result.map(x=>x.id).join(',');
 if(ids!=='diplomat,aspirants,manual,old')throw new Error('prioritization wrong: '+ids);
 if(original[0]!==a)throw new Error('input mutated');
});
