import {candidateOwnerGroupKey,distinctCandidateOwnerGroups}
  from '../../functions/cinerelay-review-api/owner-grouping.ts';

Deno.test('two feeds from one Filmibeat-owned source never double-count',()=>{
  const sourceId='feed-filmibeat-source';
  const got=distinctCandidateOwnerGroups([
    {sourceId,corporateOwnerId:'filmibeat-parent'},
    {sourceId,corporateOwnerId:'filmibeat-parent'},
  ]);
  if(got!==1)throw new Error('two Filmibeat identities counted as two independent owners');
});

Deno.test('two separately registered sources with a shared corporate parent remain one group',()=>{
  const count=distinctCandidateOwnerGroups([
    {sourceId:'amazon-official',corporateOwnerId:'amazon-corporate'},
    {sourceId:'prime-video-channel',corporateOwnerId:'amazon-corporate'},
  ]);
  if(count!==1)throw new Error('common corporate owner wrongly corroborated itself');
});

Deno.test('different registered source organizations without known common parents remain distinct',()=>{
  const count=distinctCandidateOwnerGroups([
    {sourceId:'trade-source-one'},
    {sourceId:'producer-two'},
  ]);
  if(count!==2)throw new Error('source organizations collapsed without evidence');
});

Deno.test('standalone hashtag titles and candidate names cannot affect ownership calculation',()=>{
  const count=distinctCandidateOwnerGroups([
    {sourceId:'official-netflix',corporateOwnerId:'netflix'},
  ]);
  if(count!==1)throw new Error('one source miscounted');
  if(candidateOwnerGroupKey('official-netflix',null)!=='source:official-netflix')
    throw new Error('unmapped source id should be retained');
  if(candidateOwnerGroupKey('prime', 'amazon')!=='corp:amazon')
    throw new Error('registered corporate parent should replace source id');
});

Deno.test('empty source identity fails closed',()=>{
  let rejected=false;
  try{candidateOwnerGroupKey('',null)}catch{rejected=true;}
  if(!rejected)throw new Error('missing source ID should not be a valid owner');
});
