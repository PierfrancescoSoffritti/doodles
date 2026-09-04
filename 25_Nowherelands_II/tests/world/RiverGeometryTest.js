import test from 'node:test';
import assert from 'node:assert/strict';
import { crestShape, crestOffset } from '../../js/world/RiverGeometry.js';
import { RIVER_STRIDE as S, RV } from '../../js/world/gen/Rivers.js';

test('wide riffle crests stay between neighbouring sections without folding', () => {
	const data = new Float32Array(4 * S), river = { data, count: 4 };
	for (let i = 0; i < 4; i++) {
		data[i * S] = [-2, 0, 1, 3][i]; data[i * S + RV.W] = 40;
		data[i * S + RV.KIND] = [0, 1, 2, 0][i]; data[i * S + RV.ALONG] = [0, 2, 3, 5][i];
	}
	const shape = crestShape(river, 1);
	assert.deepEqual(crestShape(river, 2), shape);
	for (let u = -2; u <= 2; u += 0.05) assert.ok(Math.abs(crestOffset(u, ...shape)) <= 1.3);
});
