import {activeCatalogueTitleWarnings,sortActiveCatalogueImpact}
  from '../../functions/cinerelay-review-api/active-catalogue-audit.ts';

Deno.test('known production promotional titles are triaged without any edit',()=>{
  const examples=[
    ['Catch Joel Joseph in Kappi Squad','MOVIE'],
    ['Catch Rinosh George in Kappi Squad','MOVIE'],
    ['Happy Ending Telugu Movie Scenes','MOVIE'],
    ['Hot Takes keep getting hotter 🔥😎 #Awarapan2OnPrime','MOVIE'],
    ['Jailer 2 Super Show!','MOVIE'],
    ['The entertainer everyone’s been waiting for! ❤️ Bethlehem Kudumba Unit','MOVIE'],
    ['The little things that made Bethlehem, Bethlehem. 💛 Bethlehem Kudumba Unit','MOVIE'],
    ['From 60 to 20, love always! ❤️ Hotstar Specials #LoveAlways streaming','SERIES'],
    ['Ee Jagathiki moolam Dhanam ayithe... aah Dhananiki moolam oka VARAM 🔮 This','SERIES'],
    ['Love & Romance | Honeymoon Express Telugu Movie','MOVIE'],
    ['Karmakhya Telugu Movie','MOVIE'],
    ['Month Of Madhu Telugu Movie','MOVIE'],
    ['60-ல் இருந்து 20 வரை ❤️ #HotstarSpecials #LoveAlways streaming','SERIES'],
    ['Amma Dheenamma... Maa BB Fan Pages kuda intha Accurate ga cheppavu ga! 🤯 #Varam streaming','SERIES'],
    ['Love & Cute Romance | Stand Up Rahul Movie Scenes','MOVIE'],
    ['Dongata Telugu Movie','MOVIE'],
    ['Kotha Bangaru Lokam Movie Scenes','MOVIE'],
    ['Midnight Murders Movie Scenes | Kunchacko Boban | Midhun Manuel Thomas','MOVIE'],
    ['Romance | Emoji Movie Scenes | Mahat | Devika | Manasa','MOVIE'],
    ['Sulthan Telugu Movie Scenes | Rashmika Mandanna | Karthi','MOVIE'],
    ['Superstar’s Super Show!','MOVIE'],
    ['The Bloody Valentine (Hindi) | Lokesh Kanagaraj | Wamiqa Gabbi | Sony LIV','MOVIE'],
    ['Watch Anagha Ajith in Kappi Squad','MOVIE'],
    ['Yevadu Telugu Movie','MOVIE'],
  ];
  for(const [name,type] of examples) {
    const warnings=activeCatalogueTitleWarnings(name,type);
    if(warnings.length===0)throw new Error('missing review hint for '+name);
  }
});

Deno.test('real, unconventional, regional and hashtag movie names remain unflagged',()=>{
  for(const name of ['#Love','కాంతార','Catch Me If You Can','Scary Movie','Aasha','Paranthu Po','The Love Hypothesis','VadaChennai']) {
    if(activeCatalogueTitleWarnings(name,'MOVIE').length)
      throw new Error('legitimate title incorrectly auto-flagged: '+name);
  }
  if(activeCatalogueTitleWarnings('Someone in Promo','PERSON').length)
    throw new Error('non-movie entity must not get movie title warning');
});

Deno.test('review queue is ordered by impact, without mutating input or editing records',()=>{
  const rows=[
    {canonical_name:'Caption B',activeEventCount:1,warnings:['caption'],id:'b'},
    {canonical_name:'Caption A',activeEventCount:5,warnings:['caption'],id:'a'},
    {canonical_name:'Caption C',activeEventCount:0,warnings:['caption','hashtag'],id:'c'},
  ];
  const ordered=sortActiveCatalogueImpact(rows);
  if(ordered.map(r=>r.id).join(',')!=='a,b,c')throw new Error('impact order wrong');
  if(rows.map(r=>r.id).join(',')!=='b,a,c')throw new Error('input modified');
});
