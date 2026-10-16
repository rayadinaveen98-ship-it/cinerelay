import {RAW_ITEM_SELECT_COLUMNS,reviewedArticleHoldReason} from './reviewed-article-freshness.ts';

const at = new Date('2026-10-16T04:00:00.000Z');
Deno.test('worker SQL selection includes article kind and discovery timestamp',()=>{
  const cols=RAW_ITEM_SELECT_COLUMNS.split(',');
  for(const required of ['item_type','published_at','first_seen_at','canonical_url'])
    if(!cols.includes(required))throw new Error('worker must load '+required);
});
Deno.test('historical Prime Video first-party article cannot create a fresh-looking event on approval',()=>{
  const actual=reviewedArticleHoldReason({operatorOverride:true,itemType:'WEB_ARTICLE',sourcePlatform:'WEB',firstSeenAt:'2026-10-01T10:45:03.438Z',publishedAt:null},at);
  if(actual!=='STALE_DISCOVERY')throw new Error('expected old article to be held, got '+actual);
});
Deno.test('recently discovered article with missing official publication date remains review-only',()=>{
  const actual=reviewedArticleHoldReason({operatorOverride:true,itemType:'WEB_ARTICLE',sourcePlatform:'WEB',firstSeenAt:'2026-10-16T02:00:00Z',publishedAt:null},at);
  if(actual!=='UNCONFIRMED_PUBLICATION_TIME')throw new Error('unknown date should hold: '+actual);
});
Deno.test('even freshly discovered old announcement remains review-only',()=>{
  const actual=reviewedArticleHoldReason({operatorOverride:true,itemType:'WEB_ARTICLE',sourcePlatform:'WEB',firstSeenAt:'2026-10-16T02:00:00Z',publishedAt:'2026-09-01T03:00:00Z'},at);
  if(actual!=='STALE_PUBLICATION')throw new Error('historic publication should hold: '+actual);
});
Deno.test('fresh, timestamped, reviewed official article may use existing event classifier',()=>{
  const actual=reviewedArticleHoldReason({operatorOverride:true,itemType:'WEB_ARTICLE',sourcePlatform:'WEB',firstSeenAt:'2026-10-16T02:00:00Z',publishedAt:'2026-10-16T00:00:00Z'},at);
  if(actual!==null)throw new Error('a genuinely fresh article should not be held: '+actual);
});
Deno.test('unreviewed normal pipeline, RSS and YouTube ingestion are unchanged',()=>{
  for(const value of [
    {operatorOverride:false,itemType:'WEB_ARTICLE',sourcePlatform:'WEB',firstSeenAt:'2026-09-01T02:00:00Z',publishedAt:null},
    {operatorOverride:true,itemType:'RSS_ARTICLE',sourcePlatform:'RSS',firstSeenAt:null,publishedAt:null},
    {operatorOverride:true,itemType:'YOUTUBE_VIDEO',sourcePlatform:'YOUTUBE',firstSeenAt:null,publishedAt:null},
  ]){
    const actual=reviewedArticleHoldReason(value,at);
    if(actual!==null)throw new Error('non-reviewed-web article behavior changed');
  }
});
Deno.test('invalid or future timestamps cannot slip through',()=>{
 for(const value of [
   {firstSeenAt:'invalid',publishedAt:'2026-10-16T00:00:00Z',expected:'UNKNOWN_DISCOVERY_TIME'},
   {firstSeenAt:'2026-10-16T05:00:00Z',publishedAt:'2026-10-16T00:00:00Z',expected:'FUTURE_SOURCE_TIMESTAMP'},
   {firstSeenAt:'2026-10-16T02:00:00Z',publishedAt:'invalid',expected:'UNCONFIRMED_PUBLICATION_TIME'},
   {firstSeenAt:'2026-10-16T02:00:00Z',publishedAt:'2026-10-16T05:00:00Z',expected:'FUTURE_SOURCE_TIMESTAMP'},
 ]){
  const actual=reviewedArticleHoldReason({operatorOverride:true,itemType:'WEB_ARTICLE',sourcePlatform:'WEB',firstSeenAt:value.firstSeenAt,publishedAt:value.publishedAt},at);
  if(actual!==value.expected)throw new Error('timestamp guard mismatch '+JSON.stringify({value,actual}));
 }
});
