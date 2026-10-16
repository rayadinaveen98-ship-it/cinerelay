// Nonblocking, read-only discovery of features in the existing Cloudflare Pages
// build. This is NOT an authenticated browser test and never asserts a release.
const origin = process.argv[2] || 'https://cinerelay-console.pages.dev';
let base;
try { base = new URL(origin); } catch { throw new Error('Invalid console origin'); }
if (base.protocol !== 'https:' || base.pathname !== '/' || base.search || base.hash) throw new Error('Require HTTPS console origin');
const htmlResponse = await fetch(base,{signal:AbortSignal.timeout(15000)});
if(!htmlResponse.ok)throw new Error('Existing console HTML returned '+htmlResponse.status);
const html=await htmlResponse.text();
const paths=[...html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)=["']([^"']+\.js)["']/gi)]
  .map(x=>x[1]);
const unique=[...new Set(paths)].slice(0,16);
console.log('Discovered JS assets:',unique.length);
let body='';
for(const path of unique){
  const url=new URL(path,base);
  if(url.origin!==base.origin)continue;
  const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
  if(!response.ok){console.log('Skipping unavailable script',url.pathname,response.status);continue;}
  const source=await response.text();
  if(source.length>6000000){console.log('Script exceeds probe cap',url.pathname);continue;}
  body+=source;
}
const markers=[
  ['Active catalogue audit UI','activeCatalogueQualityAudit'],
  ['Pending catalogue UI','pendingCatalogueReviewQueue'],
  ['Producer evidence lead form','submitProducerEvidenceLead'],
];
for (const [label,value] of markers){
  const present=body.includes(value);
  console.log(label+': '+(present?'PRESENT in deployed public JS':'NOT found in deployed public JS'));
}
if(unique.length===0)console.log('WARNING: no first-party JS asset paths found; cannot determine current UI revision');
