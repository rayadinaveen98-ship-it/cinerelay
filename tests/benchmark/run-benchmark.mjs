import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { processBatch, processSingle } from '../../packages/domain/dist/index.js';
const benchmark = JSON.parse(await readFile(new URL('./core-cases.v0.json', import.meta.url), 'utf8'));
let passed = 0;
for (const testCase of benchmark.cases) {
  const context = { entity: testCase.entity, knownEntities: testCase.knownEntities, candidateEntities: testCase.candidateEntities, precondition: testCase.precondition };
  const result = testCase.items ? processBatch(testCase.items.map((entry) => ({ item: { title: entry.title, text: entry.text, url: entry.url }, source: entry.source })), context) : processSingle(testCase.item, testCase.source, context);
  const expected = testCase.expected;
  if (expected.resolutionState) assert.equal(result.items[0]?.resolution.state, expected.resolutionState, `${testCase.id}: resolution`);
  if (expected.canonicalEventCount !== undefined) assert.equal(result.events.length, expected.canonicalEventCount, `${testCase.id}: event count`);
  if (expected.notificationCount !== undefined) assert.equal(result.notifications.length, expected.notificationCount, `${testCase.id}: notification count`);
  if (expected.notificationCountMax !== undefined) assert.ok(result.notifications.length <= expected.notificationCountMax, `${testCase.id}: notification max`);
  if (expected.highPriorityNotification === false) assert.equal(result.notifications.some((event) => event.priorityBand === 'HIGH' || event.priorityBand === 'CRITICAL'), false, `${testCase.id}: high priority notification`);
  if (expected.eventType) assert.equal(result.events[0]?.eventType, expected.eventType, `${testCase.id}: event type`);
  if (expected.verificationState) assert.equal(result.events[0]?.verificationState, expected.verificationState, `${testCase.id}: verification`);
  if (expected.priorityBand) assert.equal(result.events[0]?.priorityBand, expected.priorityBand, `${testCase.id}: priority`);
  if (expected.evidenceCount !== undefined) assert.equal(result.events[0]?.evidence.length, expected.evidenceCount, `${testCase.id}: evidence count`);
  if (expected.structuredData) assert.deepEqual(result.events[0]?.structuredData, expected.structuredData, `${testCase.id}: structured data`);
  const repeated = testCase.items ? processBatch(testCase.items.map((entry) => ({ item: { title: entry.title, text: entry.text, url: entry.url }, source: entry.source })), context) : processSingle(testCase.item, testCase.source, context);
  assert.deepEqual(repeated.events.map((event) => ({ id: event.id, dedupeKey: event.dedupeKey })), result.events.map((event) => ({ id: event.id, dedupeKey: event.dedupeKey })), `${testCase.id}: idempotence`);
  passed += 1; console.log(`PASS ${testCase.id}`);
}
console.log(`\nCineRelay benchmark: ${passed}/${benchmark.cases.length} cases passed.`);
