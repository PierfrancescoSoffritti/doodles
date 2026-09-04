import test from 'node:test';
import assert from 'node:assert/strict';
import { fillLakePinholes } from '../../../js/world/gen/WorldGen.js';

test('tiny enclosed shoals join the basin while high islands and the mainland remain', () => {
	const N = 8, ids = new Int32Array(N * N).fill(-1), h = new Float32Array(N * N).fill(20), levels = new Float32Array(N * N);
	const lake = { level: 10, cells: [] };
	for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) { const k = z * N + x; ids[k] = 0; h[k] = 5; lake.cells.push(k); }
	const shoal = 2 * N + 2, island = 4 * N + 4;
	ids[shoal] = ids[island] = -1; h[shoal] = 10.4; h[island] = 13;
	fillLakePinholes(h, [lake], ids, levels, N);
	assert.equal(ids[shoal], 0); assert.ok(h[shoal] < 10); assert.equal(levels[shoal], 10);
	assert.equal(ids[island], -1); assert.equal(h[island], 13);
	assert.equal(ids[0], -1); assert.equal(h[0], 20);
});
