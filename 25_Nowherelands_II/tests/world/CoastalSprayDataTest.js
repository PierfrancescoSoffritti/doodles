import test from 'node:test';
import assert from 'node:assert/strict';
import { coastalEmitters } from '../../js/world/CoastalSprayData.js';

function fixture(sample, refined = sample) {
	const res = 25, cell = 8, size = (res - 1) * cell, spawn = { x: 37, z: -19 };
	const height = new Float32Array(res * res);
	for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) height[z * res + x] = sample(x * cell - size / 2, z * cell - size / 2);
	return [{ res, cell, size, spawn, height }, { height: (x, z) => refined(x + spawn.x, z + spawn.z) }];
}

test('spray starts on the refined sea contour and launches toward the sea', () => {
	const [world, hm] = fixture((x, z) => x + z * 0.3, (x, z) => x + z * 0.3 + 2);
	const emitters = coastalEmitters(world, hm);
	assert.ok(emitters.length > 5);
	for (const a of emitters) {
		assert.ok(Math.abs(hm.height(a.x, a.z)) < 0.1);
		assert.ok(hm.height(a.x + a.nx * 20, a.z + a.nz * 20) < -1);
		assert.ok(hm.height(a.x - a.nx * 20, a.z - a.nz * 20) > 1);
		assert.ok(Math.abs(Math.hypot(a.nx, a.nz) - 1) < 1e-6);
		assert.ok(a.strength > 0 && a.strength <= 1);
	}
});

test('beaches, inland depressions above sea level, and uniform sea have no cliff spray', () => {
	for (const sample of [x => x * 0.04, (x, z) => 30 + (x * x + z * z) * 0.002, () => -30]) {
		assert.deepEqual(coastalEmitters(...fixture(sample)), []);
	}
});

test('a coarse contour that terrain refinement removes cannot emit floating spray', () => {
	assert.deepEqual(coastalEmitters(...fixture(x => x, () => 20)), []);
});


test('cliff-shaped lake beds and river corridors do not emit ocean spray', () => {
	for (const fields of [{ _water: 12 }, { _water: 0, _riverDist: 20, _riverWidth: 12 }]) {
		const [world, hm] = fixture(x => x);
		Object.assign(hm, fields);
		assert.deepEqual(coastalEmitters(world, hm), []);
	}
});
