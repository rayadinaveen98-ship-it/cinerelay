import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EVENT_PRIORITIES } from '../packages/domain/dist/index.js';
const readJson = async (relative) => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const taxonomy = await readJson('../packages/contracts/event-taxonomy.v1.json');
const canonicalSchema = await readJson('../packages/contracts/canonical-event.schema.json');
const normalizedSchema = await readJson('../packages/contracts/normalized-raw-item.schema.json');
const migration = await readFile(new URL('../supabase/migrations/20260914123000_core_foundation.sql', import.meta.url), 'utf8');
assert.equal(taxonomy.version, 1, 'event taxonomy version');
const codes = taxonomy.events.map((event) => event.code);
assert.equal(new Set(codes).size, codes.length, 'event taxonomy codes must be unique');
const importanceToBand = { critical: 'CRITICAL', high: 'HIGH', normal: 'NORMAL', low: 'LOW' };
for (const event of taxonomy.events) { assert.equal(EVENT_PRIORITIES[event.code], importanceToBand[event.importance], `domain priority mismatch for ${event.code}`); assert.ok(migration.includes(`('${event.code}'`), `migration is missing event type ${event.code}`); }
assert.deepEqual(Object.keys(EVENT_PRIORITIES).sort(), [...codes].sort(), 'domain event types must exactly match taxonomy');
assert.deepEqual(canonicalSchema.properties.verificationState.enum, ['OFFICIAL', 'CONFIRMED', 'RELIABLE_REPORT', 'DEVELOPING', 'RUMOR'], 'verification state contract changed unexpectedly');
assert.deepEqual(canonicalSchema.properties.priorityBand.enum, ['CRITICAL', 'HIGH', 'NORMAL', 'LOW', 'SUPPRESSED'], 'priority band contract changed unexpectedly');
for (const required of ['sourceIdentityId', 'canonicalUrl', 'itemType', 'contentFingerprint', 'firstSeenAt']) assert.ok(normalizedSchema.required.includes(required), `normalized raw item must require ${required}`);
console.log(`Contract validation passed: ${codes.length} event types aligned across taxonomy, domain and migration.`);
