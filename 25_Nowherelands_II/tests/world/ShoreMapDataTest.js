import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoastOverview, shoreDistance, riverReach } from '../../js/world/ShoreMapData.js';

test('overview preserves coast position, sea depth and elevated lake exclusion', () => {
	const res = 9, height = new Float32Array(res * res), lakeLevel = new Float32Array(res * res).fill(-10000);
	for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) height[z * res + x] = (x - 3.5) * 8;
	lakeLevel[4 * res + 7] = 40;
	const overview = buildCoastOverview({ res, size: 80, height, lakeLevel });
	const at = (x, z, channel) => overview.data[(z * res + x) * 4 + channel];
	assert.equal(at(3, 1, 2), 5);
	assert.equal(at(4, 1, 2), -5);
	assert.equal(at(0, 1, 2), 35);
	assert.equal(at(0, 1, 0), -28);
	assert.equal(at(7, 4, 1), 40);
	assert.equal(at(7, 4, 3), 1);
	assert.equal(at(3, 1, 3), 0);
	assert.ok(overview.data.every(Number.isFinite));
});

test('distance transform remains finite for uniform land and uniform water', () => {
	for (const water of [0, 1]) {
		const data = new Float32Array(8 * 8 * 4);
		for (let i = 2; i < data.length; i += 4) data[i] = water;
		shoreDistance(data, 8, 4);
		riverReach(data, 8, 4);
		assert.ok(data.every(Number.isFinite));
		assert.equal(Math.sign(data[2]), water ? 1 : -1);
		assert.equal(data[3], 0);
	}
});

test('overview memory stays bounded for large worlds and retains their endpoints', () => {
	const res = 600, height = new Float32Array(res * res).fill(-10), lakeLevel = new Float32Array(res * res).fill(-10000);
	height[height.length - 1] = 100;
	const overview = buildCoastOverview({ res, size: 16384, height, lakeLevel });
	assert.equal(overview.res, 512);
	assert.equal(overview.data.byteLength, 4 * 1024 * 1024);
	assert.equal(overview.data.at(-4), 100);
});
