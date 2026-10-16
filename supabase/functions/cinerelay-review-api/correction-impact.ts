/**
 * This module ONLY describes correction risk. It never performs a correction.
 * In particular, shared OTT provider/date records cannot be merged blindly,
 * and a mismatched MOVIE/SERIES type must stop an identity merge.
 */
export type CorrectionEntity = {
  id: string;
  canonical_name: string;
  entity_type: 'MOVIE' | 'SERIES';
};
export type CorrectionRelease = {
  id: string;
  entity_id: string;
  provider_id: string;
  territory: string | null;
  release_type: string | null;
  release_date: string | null;
  date_precision: string;
  state: string;
};
export type CorrectionRisk = {
  canAutoApply: false;
  requiresOperatorReview: true;
  classificationMismatch: boolean;
  targetTypeMismatch: boolean;
  releaseCollisions: Array<{sourceReleaseId:string;targetReleaseId:string;providerId:string;territory:string|null}>;
  warnings: string[];
};
export function assessCorrectionRisk(
  source: CorrectionEntity,
  target: CorrectionEntity | null,
  expectedType: 'MOVIE' | 'SERIES',
  releases: CorrectionRelease[],
): CorrectionRisk {
  const classificationMismatch=source.entity_type!==expectedType;
  const targetTypeMismatch=Boolean(target&&target.entity_type!==expectedType);
  const warnings:string[]=[];
  if(classificationMismatch)warnings.push('Source content type differs from the independently reviewed title type');
  if(targetTypeMismatch)warnings.push('Proposed target content type differs from the independently reviewed title type');
  if(target&&target.id===source.id)warnings.push('Source and target are the same entity');
  const incoming=releases.filter(x=>x.entity_id===source.id);
  const existing=target?releases.filter(x=>x.entity_id===target.id):[];
  const releaseCollisions:CorrectionRisk['releaseCollisions']=[];
  for(const from of incoming)for(const into of existing){
    if(from.provider_id===into.provider_id &&
       from.territory===into.territory &&
       from.release_type===into.release_type){
      releaseCollisions.push({
        sourceReleaseId:from.id,targetReleaseId:into.id,
        providerId:from.provider_id,territory:from.territory,
      });
    }
  }
  if(releaseCollisions.length)warnings.push('OTT release provider/territory/type collision: historical states and evidence need reconciliation');
  if(!target)warnings.push('No existing target chosen: verify title and type before creating or changing identity');
  warnings.push('Historical events, claim links, follower references and sent notifications require separate audited handling');
  return {canAutoApply:false,requiresOperatorReview:true,classificationMismatch,targetTypeMismatch,releaseCollisions,warnings};
}
