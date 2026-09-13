import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeCheckpoint, decodeCheckpoint } from '../../js/world/fauna/LumenCheckpoint.js?v=stable-30-20';

test('checkpoint record reservation handles tiny recycled buffers and large records without truncation', () => {
 const shared = { text: '\ud800✨', value: -0 }, lakes = [{ id: 1 }];
 const graph = { shared, alias: shared, lake: lakes[0], map: new Map([[shared, shared]]), set: new Set([shared]) };
 graph.self = graph;
 const cases = [null, undefined, 42, true, false, '', {}, [], new Map(), new Set(), graph,
  { values: [NaN, Infinity, -Infinity, -0, Number.MIN_VALUE, Number.MAX_VALUE] },
  Array.from({ length: 70000 }, (_, i) => i / 7),
  { strings: Array.from({ length: 2000 }, (_, i) => 'field-' + i) }];
 for (const value of cases) {
  const compact = encodeCheckpoint(value, lakes);
  for (const capacity of [1, 16, 262144, 1048576]) {
   const reusable = encodeCheckpoint(value, lakes, new ArrayBuffer(capacity));
   assert.deepEqual(new Uint8Array(reusable, 0, compact.byteLength), new Uint8Array(compact));
   assert.deepEqual(decodeCheckpoint(reusable, lakes), value);
  }
 }
 const restored = decodeCheckpoint(encodeCheckpoint(graph, lakes, new ArrayBuffer(1)), lakes);
 assert.equal(restored.self, restored); assert.equal(restored.shared, restored.alias);
 assert.equal(restored.lake, lakes[0]); assert.equal(restored.map.get(restored.shared), restored.shared);
 assert.ok(restored.set.has(restored.shared));
});
