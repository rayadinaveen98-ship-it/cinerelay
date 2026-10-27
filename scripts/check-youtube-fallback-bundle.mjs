#!/usr/bin/env node
/**
 * CineRelay deployment-native YouTube fallback behavioral guard.
 *
 * Read ONLY the exact minified worker JS produced by CI, locate the pure fallback
 * health decision by its stable validation text, and exercise that decision without
 * running the Edge function or importing Supabase/Deno dependencies.
 *
 * Protects against stale bundled logic silently reintroducing a source-wide
 * DEGRADED state when authoritative polling succeeds but WebSub is delayed.
 * The WebSub warning code must remain visible and retain 5-minute fallback.
 *
 * This tests the bundle supplied as an argument, NOT the hosted Supabase runtime.
 * Hosted deployment/hash parity is an independent release acceptance step.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const bundlePath = process.argv[2];
if (!bundlePath || process.argv.length !== 3) {
  console.error('Usage: node scripts/check-youtube-fallback-bundle.mjs edge-deploy/youtube-fallback-worker/index.js');
  process.exit(2);
}

const code = await readFile(bundlePath, 'utf8');
const ast = ts.createSourceFile(bundlePath, code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
const matches = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.body) {
    const body = node.body.getText(ast);
    if (body.includes('recoveredUploadCount must be a non-negative integer')) {
      matches.push(node.getText(ast));
    }
  }
  ts.forEachChild(node, visit);
}
visit(ast);

assert.equal(matches.length, 1,
  `Expected exactly one deployment-bundled YouTube fallback health decision; found ${matches.length}. Refuse packaging an unchecked worker.`);

const decide = vm.runInNewContext(`(${matches[0]})`, Object.create(null), { timeout: 1000 });
assert.equal(typeof decide, 'function');

const quiet = decide({ gapExceededWindow: false, recoveredUploadCount: 0, existingErrorCode: null });
assert.equal(quiet.degraded, false, 'A quiet source is not unhealthy solely due to no callback');
assert.equal(quiet.errorCode, undefined);

const recovered = decide({ gapExceededWindow: false, recoveredUploadCount: 1, existingErrorCode: null });
assert.equal(recovered.degraded, false,
  'Successful authoritative fallback must not mark entire ingestion source DEGRADED');
assert.equal(recovered.errorCode, 'WEBSUB_MISSED_DELIVERY',
  'Keep WebSub accelerator diagnostic when authoritative polling recovers an upload');
assert.match(recovered.errorMessage ?? '', /WebSub/,
  'The WebSub warning must explain what remains impaired');

const persistent = decide({ gapExceededWindow: false, recoveredUploadCount: 0, existingErrorCode: 'WEBSUB_MISSED_DELIVERY' });
assert.equal(persistent.degraded, false,
  'Persisted WebSub-only warning must not re-degrade an otherwise healthy fallback');
assert.equal(persistent.errorCode, 'WEBSUB_MISSED_DELIVERY',
  'Do not blanket erase the WebSub warning');

const gap = decide({ gapExceededWindow: true, recoveredUploadCount: 2, existingErrorCode: 'WEBSUB_MISSED_DELIVERY' });
assert.equal(gap.degraded, true,
  'Unbounded missing-upload discovery must still degrade source reliability');
assert.equal(gap.errorCode, 'FALLBACK_WINDOW_GAP');

assert.throws(
  () => decide({ gapExceededWindow: false, recoveredUploadCount: -1 }),
  /recoveredUploadCount must be a non-negative integer/
);

console.log('PASS deployment-native youtube-fallback-worker health semantics: 6 guards');
