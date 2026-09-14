import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const roots = ['package.json','tsconfig.base.json','packages/domain','packages/contracts','packages/youtube-connector','packages/source-fixtures','tests/benchmark','tests/youtube-connector','scripts','supabase/config.toml','supabase/migrations','supabase/functions','.github/workflows'];
const allowed = new Set(['.ts','.mjs','.json','.sql','.toml','.yml','.yaml','.xml']); const failures = [];
async function visit(path) { const info = await stat(path); if (info.isDirectory()) { if (path.endsWith('/dist') || path.endsWith('/node_modules')) return; for (const entry of await readdir(path)) await visit(resolve(path, entry)); return; } const extension = path.slice(path.lastIndexOf('.')); if (!allowed.has(extension)) return; const text = await readFile(path, 'utf8'); if (!text.endsWith('\n')) failures.push(`${path}: missing final newline`); text.split('\n').forEach((line, index) => { if (/\s+$/.test(line) && line.length > 0) failures.push(`${path}:${index + 1}: trailing whitespace`); if (line.includes('\t')) failures.push(`${path}:${index + 1}: tab character`); }); }
for (const root of roots) await visit(resolve(root)); assert.deepEqual(failures, [], failures.join('\n')); console.log('Repository hygiene checks passed.');
