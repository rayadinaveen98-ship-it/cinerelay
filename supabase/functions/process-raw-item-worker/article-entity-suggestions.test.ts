import { isOfficialArticleSource, suggestOfficialArticleEntity } from './article-entity-suggestions.ts';

Deno.test('official Netflix season headline creates a typed SERIES suggestion', () => {
  const actual = suggestOfficialArticleEntity('The Diplomat Season 4: The Drama is Back With More Power Plays and Politics');
  if (!actual || actual.proposedName !== 'The Diplomat' || actual.proposedEntityType !== 'SERIES' || actual.seasonNumber !== 4) {
    throw new Error('expected The Diplomat SERIES season 4 review suggestion');
  }
});
Deno.test('a documentary ABOUT a person never fabricates a movie name', () => {
  const actual = suggestOfficialArticleEntity('A New Documentary About Natalee Holloway Recounts Teen’s Infamous Disappearance');
  if (actual !== null) throw new Error('documentary topic is not a proven film title');
});
Deno.test('generic season marketing text is not treated as a series title', () => {
  for (const headline of [
    'Everything You Need to Know Season 3: Now Streaming',
    'A New Documentary Season 2: Behind the Story',
    'When Will The Show Season 3: Air?',
    'Some Trailer Season 5: News',
    'New Release Date Season 2: Today',
    'The Diplomat Season 4 New Photos Are Here',
  ]) {
    if (suggestOfficialArticleEntity(headline)) throw new Error('unsafe inferred title: ' + headline);
  }
});
Deno.test('only first-party WEB_ARTICLE sources qualify', () => {
  const official = {authorityTier:1, role:'OTT_PLATFORM', platform:'WEB'};
  if (!isOfficialArticleSource(official,'WEB_ARTICLE')) throw new Error('first-party OTT article blocked');
  if (isOfficialArticleSource({...official,authorityTier:3},'WEB_ARTICLE')) throw new Error('trade source admitted');
  if (isOfficialArticleSource({...official,platform:'RSS'},'WEB_ARTICLE')) throw new Error('rss admitted');
  if (isOfficialArticleSource(official,'YOUTUBE_VIDEO')) throw new Error('video admitted');
});
Deno.test('long, ambiguous, or unlabelled headline cannot auto-generate candidates', () => {
  for (const headline of ['','An Amazing New Season!','The Diplomat', 'X'.repeat(400)]) {
    if (suggestOfficialArticleEntity(headline)) throw new Error('unexpected candidate');
  }
});
