import {assessCorrectionRisk} from '../../functions/cinerelay-review-api/correction-impact.ts';

const source={id:'source-kappi-cast-caption',canonical_name:'Catch Joel Joseph in Kappi Squad',entity_type:'MOVIE' as const};
const existing={id:'actual-kappi-catalogue',canonical_name:'Kappi Squad',entity_type:'MOVIE' as const};
const rel=[
  {id:'source-release',entity_id:source.id,provider_id:'jiohotstar',territory:'IN',release_type:'POST_THEATRICAL',release_date:'2026-10-15',date_precision:'DAY',state:'UPCOMING'},
  {id:'existing-release',entity_id:existing.id,provider_id:'jiohotstar',territory:'IN',release_type:'POST_THEATRICAL',release_date:'2026-10-15',date_precision:'DAY',state:'UPCOMING'},
];

Deno.test('same-provider Kappi Squad cast promotions collide with existing OTT release',()=>{
  const result=assessCorrectionRisk(source,existing,'SERIES',rel);
  if(result.canAutoApply!==false || result.requiresOperatorReview!==true)
    throw new Error('automatic correction accidentally enabled');
  if(!result.classificationMismatch || !result.targetTypeMismatch)
    throw new Error('source and target MOVIE content-type mismatch for verified SERIES not found');
  if(result.releaseCollisions.length!==1)
    throw new Error('overlapping provider/region/release type must be flagged before merging');
});
Deno.test('Kappi correction must still require manual review with no target',()=>{
  const result=assessCorrectionRisk(source,null,'SERIES',rel);
  if(result.releaseCollisions.length||!result.warnings.some(x=>x.includes('No existing target')))
    throw new Error('missing target improperly treated as safe');
  if(result.canAutoApply!==false)throw new Error('implicit auto apply');
});
Deno.test('distinct provider, region or release type should not claim a record collision',()=>{
  const other={...rel[1],provider_id:'aha',territory:'US'};
  const result=assessCorrectionRisk(source,existing,'MOVIE',[rel[0],other]);
  if(result.releaseCollisions.length)throw new Error('false same-provider release collision');
  if(result.canAutoApply!==false)throw new Error('lack of collision must not enable writes');
});
Deno.test('different type target explicitly highlighted',()=>{
  const series={...existing,entity_type:'SERIES' as const};
  const result=assessCorrectionRisk(source,series,'SERIES',[rel[0]]);
  if(!result.classificationMismatch||result.targetTypeMismatch)
    throw new Error('source MOVIE mismatch / target SERIES valid classification not distinguished');
  if(!result.requiresOperatorReview)throw new Error('operator review disabled');
});
