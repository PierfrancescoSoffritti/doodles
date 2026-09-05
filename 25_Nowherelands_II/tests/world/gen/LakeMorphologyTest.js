import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeLakeShores } from '../../../js/world/gen/LakeMorphology.js';
import { RIVER_STRIDE as S, RV } from '../../../js/world/gen/Rivers.js';

test('lake sediment fans remain submerged and preserve the dry basin rim', () => {
	const N = 32, cell = 8, size = 248, ids = new Int32Array(N * N).fill(-1), h = new Float32Array(N * N).fill(15), hard = new Float32Array(N * N).fill(0.3), cells = [];
	for (let z = 7; z < 25; z++) for (let x = 7; x < 25; x++) { const k = z * N + x; cells.push(k); ids[k] = 0; h[k] = -4; }
	const data = new Float32Array(2 * S); data[0] = -84; data[S] = -60; data[RV.W] = data[S + RV.W] = 22;
	const lakes = [{ id: 0, level: 5, cells }], before = h.slice();
	const fans = shapeLakeShores(h, lakes, ids, [{ mouthType: 'lake', count: 2, data }], hard, N, cell, size, { noise: () => 0.5 });
	assert.equal(fans.length, 1);
	let raised = 0;
	for (let k = 0; k < h.length; k++) {
		if (ids[k] < 0) assert.equal(h[k], before[k], 'the rim must not move');
		else { assert.ok(h[k] < lakes[0].level - 0.4); if (h[k] > before[k]) raised++; }
	}
	assert.ok(raised > 20, 'a visible shelf should form across multiple cells');
});
