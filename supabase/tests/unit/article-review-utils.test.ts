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


import {orderPendingCatalogue,titleNeedsManualCleanup} from '../../../apps/web/src/lib/catalogue-review-utils.ts';

Deno.test('18 pending source examples: ten promotional movie names get review hints; legitimate and series names remain unflagged',()=>{
  const flagged = [
    '#Karmakhya Latest Telugu Full',
    '#Karmakhya Telugu Full',
    '#UglyStory Telugu Full',
    'Aasha OTT release date: Urvashi, Joju George and Aishwarya Lekshmi\'s Malayalam',
    'After King, this top studio',
    'Sharanya Pradeep Byte about Karmakhya Movie❤️‍🔥 #Karmakhya Telugu Full',
    'అమ్మాయి చాలా అందంగా ఉంటుంది ! #MaharajaHostel Telugu',
    'నా కోసం నువ్వు ఏమి చెయ్యలేవా.? #MaharajaHostel Telugu',
    'మీ Permission లేకుండా మిమల్ని Touch చేయొద్దు ! #Euphoria Telugu Full',
    'నాది miss అయింది doctor🤪#MisterMiddleClass',
  ];
  for (const proposed_name of flagged) {
    if (!titleNeedsManualCleanup({proposed_name,proposed_entity_type:'MOVIE'}))
      throw new Error('missed known promotional fragment: '+proposed_name);
  }
  const clean = ['Bahubali 2 The Conclusion','Joe','Mynaa','Paranthu Po','SinghamYamudu2','#Love','కాంతార'];
  for(const proposed_name of clean) {
    if(titleNeedsManualCleanup({proposed_name,proposed_entity_type:'MOVIE'}))
      throw new Error('blocked legitimate/structurally possible name: '+proposed_name);
  }
  for(const proposed_name of ['Aspirants','Storm','The Diplomat']){
    if(titleNeedsManualCleanup({proposed_name,proposed_entity_type:'SERIES'}))
      throw new Error('series falsely labelled noisy: '+proposed_name);
  }
});
Deno.test('review triage is pure and prioritizes suspicious titles without accepting others',()=>{
  const clean={proposed_name:'Joe',proposed_entity_type:'MOVIE' as const,confidence:0.97};
  const noisy={proposed_name:'#Karmakhya Latest Telugu Full',proposed_entity_type:'MOVIE' as const,confidence:0.92};
  const series={proposed_name:'Storm',proposed_entity_type:'SERIES' as const,confidence:0.83};
  const original=[clean,series,noisy];
  const result=orderPendingCatalogue(original);
  if(result[0]!==noisy || result[1]!==clean || result[2]!==series)
    throw new Error('risk ordering unexpected');
  if(original[0]!==clean)throw new Error('input mutated');
});
