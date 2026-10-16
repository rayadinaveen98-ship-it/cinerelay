// Reproducible, public NON-SECRET release provenance for the static console.
// Cloudflare's Git build sets CF_PAGES_COMMIT_SHA, GitHub Actions sets GITHUB_SHA.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const raw = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || '';
const sha = /^[a-f\d]{40}$/i.test(raw) ? raw.toLowerCase() : null;
const branch = process.env.CF_PAGES_BRANCH || process.env.GITHUB_REF_NAME || null;
const payload = {
  app: 'cinerelay-operator-console',
  commit: sha,
  source: process.env.CF_PAGES_COMMIT_SHA ? 'cloudflare-git'
    : process.env.GITHUB_SHA ? 'github-actions' : 'local-unverified',
  branch,
  builtAt: new Date().toISOString(),
};
const publicDir = join(process.cwd(), 'public');
mkdirSync(publicDir, { recursive: true });
writeFileSync(join(publicDir, 'release-info.json'), JSON.stringify(payload,null,2)+'\n','utf8');
console.log(`Generated nonsecret CineRelay release manifest: ${sha ?? 'unverified local build'}`);
