import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const feedWorker = await readFile(new URL('../../supabase/functions/feed-poll-worker/index.ts', import.meta.url), 'utf8');
const processWorker = await readFile(new URL('../../supabase/functions/process-raw-item-worker/index.ts', import.meta.url), 'utf8');

const explicitFeedPayloads = feedWorker.match(/p_payload:\s*\{\s*rawItemId,\s*sourceIdentityId\s*\}/g) ?? [];
assert.equal(explicitFeedPayloads.length, 2, 'new and changed feed entries must enqueue sourceIdentityId explicitly');

assert.match(processWorker, /if \(!rawItemId\) throw new Error\('invalid_job_payload'\)/,
  'PROCESS_RAW_ITEM must require rawItemId');
assert.match(processWorker, /const rawSourceIdentityId =/,
  'PROCESS_RAW_ITEM must derive source identity from the authoritative raw row');
assert.match(processWorker, /if \(payloadSourceIdentityId && payloadSourceIdentityId !== rawSourceIdentityId\) throw new Error\('source_identity_mismatch'\)/,
  'PROCESS_RAW_ITEM must reject a conflicting caller-supplied source identity');
assert.match(processWorker, /const sourceIdentityId = payloadSourceIdentityId \|\| rawSourceIdentityId/,
  'PROCESS_RAW_ITEM must remain backward-compatible with minimal rawItemId-only jobs');

console.log('feed processing job contract: PASS');
