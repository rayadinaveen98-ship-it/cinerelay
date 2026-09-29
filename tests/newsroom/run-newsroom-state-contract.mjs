import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('../../supabase/functions/cinerelay-newsroom-api/index.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const start = source.indexOf('function newsroomState(');
const end = source.indexOf('\nfunction evidenceRank', start);

assert.notEqual(start, -1, 'cinerelay-newsroom-api must define newsroomState');
assert.notEqual(end, -1, 'newsroomState extraction boundary must remain discoverable');

const functionSource = source.slice(start, end).trim();
const transpiled = ts.transpileModule(`${functionSource}\nexport { newsroomState };`, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    strict: true,
  },
}).outputText;

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
const { newsroomState } = await import(moduleUrl);

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

await test('conflicting evidence overrides an otherwise official event', async () => {
  assert.equal(newsroomState('OFFICIAL', 1, 1), 'CONFLICT_RUMOR');
});

await test('official canonical event is verified regardless of lower source tier', async () => {
  assert.equal(newsroomState('OFFICIAL', 3, 0), 'VERIFIED');
});

await test('confirmed canonical event is verified', async () => {
  assert.equal(newsroomState('CONFIRMED', 4, 0), 'VERIFIED');
});

await test('reliable report canonical state is developing', async () => {
  assert.equal(newsroomState('RELIABLE_REPORT', 1, 0), 'DEVELOPING');
});

await test('developing canonical state is developing', async () => {
  assert.equal(newsroomState('DEVELOPING', 1, 0), 'DEVELOPING');
});

await test('rumor canonical state is conflict-rumor even from tier 1', async () => {
  assert.equal(newsroomState('RUMOR', 1, 0), 'CONFLICT_RUMOR');
});

await test('unresolved tier 1 first-party source is verified', async () => {
  assert.equal(newsroomState(null, 1, 0), 'VERIFIED');
});

await test('unresolved tier 2 source stays developing', async () => {
  assert.equal(newsroomState(null, 2, 0), 'DEVELOPING');
});

await test('unresolved tier 3 trade media source stays developing', async () => {
  assert.equal(newsroomState(null, 3, 0), 'DEVELOPING');
});

await test('unresolved tier 4 general media source stays unconfirmed', async () => {
  assert.equal(newsroomState(null, 4, 0), 'UNCONFIRMED');
});

await test('missing authority defaults to conflict-rumor rather than false confidence', async () => {
  assert.equal(newsroomState(null, null, 0), 'CONFLICT_RUMOR');
});

console.log(`\nNewsroom trust-state contract: ${passed}/11 passed.`);
