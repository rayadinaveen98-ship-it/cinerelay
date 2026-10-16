/**
 * Read-only check of the REAL CineRelay Cloudflare Pages console.
 * No Cloudflare token, deployment mutation or operator sign-in required.
 * A successful CI build alone does NOT mean a static site was deployed.
 *
 * Usage:
 *   node scripts/verify-live-console.mjs https://existing-console.example.com COMMIT_SHA
 */
const [baseUrl, commit] = process.argv.slice(2);
function fail(reason) { throw new Error('CineRelay production console verification: '+reason); }
if (!baseUrl) fail('supply the verified EXISTING console HTTPS URL');
if (!/^[a-f\d]{40}$/i.test(commit||'')) fail('expected a full 40-character Git commit SHA');
let base;
try { base = new URL(baseUrl); } catch { fail('invalid console URL'); }
if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash)
  fail('console URL must be its HTTPS origin, with no path or credentials');
const get = async (path, expectHtml = false) => {
  const url = new URL(path,base);
  const result = await fetch(url,{headers:{'accept': expectHtml ? 'text/html' : 'application/json'},redirect:'follow',signal:AbortSignal.timeout(15000)});
  if (!result.ok) fail(`${path} returned HTTP ${result.status}`);
  if (new URL(result.url).origin !== base.origin) fail(`${path} redirected away from the console origin`);
  return result;
};
const releaseResponse = await get('/release-info.json');
if (!releaseResponse.headers.get('content-type')?.includes('application/json')) 
  fail('release manifest has unexpected content type (possibly serving HTML fallback)');
let release;
try { release = await releaseResponse.json(); } catch { fail('release manifest is not valid JSON'); }
if (release.app !== 'cinerelay-operator-console') fail('incorrect application identity');
if (release.commit?.toLowerCase() !== commit.toLowerCase()) 
  fail(`deployed commit mismatch; expected ${commit}, got ${release.commit??'missing'}`);
if (!['cloudflare-git','github-actions'].includes(release.source))
  fail('manifest does not identify a verified CI or Git build');
if (!release.builtAt || Number.isNaN(Date.parse(release.builtAt)))
  fail('release manifest is missing build date');
console.log('PASS: live console exact commit',release.commit,'source',release.source);
for (const route of ['/','/feed','/health','/sources']) {
  const response=await get(route,true);
  const html=await response.text();
  if (!response.headers.get('content-type')?.includes('text/html') || !html.includes('id="root"'))
    fail(`${route} is not serving the CineRelay SPA shell`);
  if (!response.headers.get('content-security-policy'))
    fail(`${route} missing declared CSP response header`);
  console.log('PASS: Cloudflare SPA route + CSP',route);
}
console.log('PASS: CineRelay console is LIVE on',base.origin,'at the expected commit');
