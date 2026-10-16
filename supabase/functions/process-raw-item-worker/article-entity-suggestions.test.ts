import {isOfficialArticleSource,suggestOfficialArticleEntity} from './article-entity-suggestions.ts';

function expectSuggestion(title:string, name:string, type:'MOVIE'|'SERIES', season?:number, date?:string) {
  const got=suggestOfficialArticleEntity(title);
  if(!got || got.proposedName!==name || got.proposedEntityType!==type ||
    got.seasonNumber!==season || got.proposedReleaseDate!==date) {
    throw new Error('mismatched suggestion '+JSON.stringify({title,got,expected:{name,type,season,date}}));
  }
}
Deno.test('Netflix: explicit numbered season goes to SERIES review',()=>{
 expectSuggestion('The Diplomat Season 4: The Drama is Back With More Power Plays and Politics','The Diplomat','SERIES',4);
});
Deno.test('Prime Video India: trailer announces known named season',()=>{
 expectSuggestion('Watch the trailer of Aspirants Season 3 streaming now on Prime Video','Aspirants','SERIES',3);
});
Deno.test('Prime Video India: explicitly named upcoming thriller series',()=>{
 expectSuggestion('Hrithik Roshan’s HRX Films teams up with Prime Video for a new thriller series Storm','Storm','SERIES');
});
Deno.test('official: explicitly quoted film name and full release date are review evidence only',()=>{
 expectSuggestion('Official studio film ‘Sankranthi Star’ releases on November 29, 2026','Sankranthi Star','MOVIE',undefined,'2026-11-29');
 expectSuggestion('Official movie "Another Story" premieres on February 28, 2028','Another Story','MOVIE',undefined,'2028-02-28');
});
Deno.test('calendar: never infer or accept bad date',()=>{
 expectSuggestion('Movie "New Light" releases on September 11','New Light','MOVIE');
 expectSuggestion('Movie "New Light" releases on February 30, 2027','New Light','MOVIE');
 expectSuggestion('Movie "New Light" releases on February 29, 2028','New Light','MOVIE',undefined,'2028-02-29');
 expectSuggestion('Movie "New Light" releases on September 11, 2026','New Light','MOVIE',undefined,'2026-09-11');
});
Deno.test('dangerous headlines remain manual title review',()=>{
 const unsafe=[
  'A New Documentary About Natalee Holloway Recounts Teen’s Infamous Disappearance',
  'Prime Video Presents 2026: 55 new shows, movies & regional content announced',
  '18 patriotic films on Prime Video to watch this Independence Day',
  'How to watch Tu Meri Main Tera Main Tera Tu Meri starring Kartik Aaryan and Ananya Panday',
  "Anil Kapoor's Subedaar now streaming on Prime Video",
  "Bandwaale is streaming now on Prime Video",
  "Watch the trailer of Prime Video’s The Revolutionaries starring to release worldwide on September 11",
  'Everything You Need to Know Season 3: Now Streaming',
  'A New Documentary Season 2: Behind the Story',
  'When Will The Show Season 3: Air?',
  'Some Trailer Season 5: News',
  'New Release Date Season 2: Today',
  'The Diplomat Season 4 New Photos Are Here',
  'Prime Video announces new thriller series launching soon',
  'Film “An Announcement” is coming soon',
  'An Amazing New Season!',
  'The Diplomat',
  'X'.repeat(400),
 ];
 for(const title of unsafe){const x=suggestOfficialArticleEntity(title);if(x)throw new Error('incorrect suggestion '+title+':'+JSON.stringify(x))}
});
Deno.test('strict first party source and item type gate',()=>{
 const official={authorityTier:1,role:'OTT_PLATFORM',platform:'WEB'};
 if(!isOfficialArticleSource(official,'WEB_ARTICLE'))throw new Error('official OTT article blocked');
 if(!isOfficialArticleSource({authorityTier:2,role:'PRODUCTION_HOUSE',platform:'WEB'},'WEB_ARTICLE'))throw new Error('official studio blocked');
 for(const [source,itemType] of [
  [{...official,authorityTier:3},'WEB_ARTICLE'],
  [{...official,platform:'RSS'},'WEB_ARTICLE'],
  [official,'YOUTUBE_VIDEO'],
  [{...official,role:'TRADE_MEDIA'},'WEB_ARTICLE'],
 ] as const){if(isOfficialArticleSource(source,itemType)) throw new Error('unsafe source accepted')}
});
