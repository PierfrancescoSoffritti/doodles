import test from 'node:test';
import assert from 'node:assert/strict';
import { RIVER_STRIDE as S, RV } from '../../js/world/gen/Rivers.js';

globalThis.location = { search: '?seed=geometry-test' };
globalThis.matchMedia = () => ({ matches: false });
const { Heightmap } = await import('../../js/world/Heightmap.js');

function fixture(bend) {
	const data = new Float32Array(3 * S);
	for (let i = 0; i < 3; i++) {
		const o = i * S;
		data[o + RV.X] = (i - 1) * 40;
		data[o + RV.WL] = 5;
		data[o + RV.W] = 20;
		data[o + RV.D] = 3;
		data[o + RV.BANK] = 1;
		data[o + RV.BEND] = bend;
		data[o + RV.ALONG] = i * 40;
	}
	return new Heightmap('geometry-test', {
		res: 32, cell: 8, size: 248, spawn: { x: 0, z: 0 },
		height: new Float32Array(1024).fill(6), lakeLevel: new Float32Array(1024).fill(-10000),
		rock: new Uint8Array(1024), habitat: new Uint8Array(4096),
		rivers: [{ data, count: 3, falls: [] }],
	});
}

test('runtime terrain deepens the outer channel and broadens the inner bank', () => {
	const hm = fixture(0.8), straight = fixture(0);
	const gap = hm.height(0, -6) - hm.height(0, 6);
	const cobbleGap = straight.height(0, -6) - straight.height(0, 6);
	assert.ok(gap - cobbleGap > 0.5);
	assert.ok(hm.height(0, 13) > hm.height(0, -13));
	assert.ok(hm.depthAt(0, 0) > 2);
	for (let z = -30; z < 30; z += 0.2) assert.ok(Number.isFinite(hm.height(0, z)));
});

test('terrain follows a curved riffle crest across the channel', async () => {
	const { crestShape, crestOffset } = await import('../../js/world/RiverGeometry.js');
	const hm = fixture(0), data = new Float32Array(4 * S);
	for (let i = 0; i < 4; i++) {
		const o = i * S;
		data[o + RV.X] = [-30, 0, 2, 30][i];
		data[o + RV.WL] = i < 2 ? 10 : 9;
		data[o + RV.W] = 20; data[o + RV.D] = 3; data[o + RV.BANK] = 1;
		data[o + RV.KIND] = [0, 1, 2, 0][i]; data[o + RV.ALONG] = [0, 30, 32, 60][i];
	}
	const river = { count: 4, data, falls: [] };
	const stepped = new Heightmap('geometry-test', { ...hm.world, rivers: [river] });
	const [skew, bow] = crestShape(river, 1);
	for (const u of [-0.8, -0.4, 0, 0.4, 0.8]) {
		const offset = crestOffset(u, skew, bow);
		assert.ok(Math.abs(stepped.waterAt(offset + 0.01, u * 10) - 10) < 0.02);
		assert.ok(Math.abs(stepped.waterAt(offset + 1.99, u * 10) - 9) < 0.02);
	}
});

test('cubic terrain interpolation cannot create pits beside a level basin', () => {
	const hm = fixture(0);
	for (let z = 0; z < hm.N; z++) for (let x = 0; x < hm.N; x++) hm.grid[z * hm.N + x] = x < 16 ? 5 : 30;
	for (let x = 3; x < 28; x += 0.05) assert.ok(hm.bicubic(x, 15.5) >= 5 && hm.bicubic(x, 15.5) <= 30);
});

test('a lake feeder cuts through a raised rim across the entire waterfall lip', () => {
	const world = fixture(0).world, ids = new Int32Array(1024).fill(-1), cells = [];
	world.height.fill(25);
	for (let z = 14; z <= 21; z++) for (let x = 7; x <= 12; x++) {
		const k = z * 32 + x; ids[k] = 0; world.height[k] = 5; cells.push(k);
	}
	const data = new Float32Array(2 * S);
	for (let i = 0; i < 2; i++) {
		data[i * S + RV.X] = 4 + i * 10; data[i * S + RV.WL] = 10 - i * 6;
		data[i * S + RV.W] = 20; data[i * S + RV.D] = 3; data[i * S + RV.BANK] = 1;
		data[i * S + RV.KIND] = i ? 4 : 3;
	}
	const hm = new Heightmap('outlet-test', { ...world, lakeId: ids, lakes: [{ id: 0, level: 10, cells }], rivers: [{ data, count: 2, fromLake: 0, falls: [{ x: 4, z: 0, dx: 1, dz: 0, w: 20, top: 10, bottom: 4, drop: 6, run: 3, dTop: 3, dBot: 3, bankTop: 1, bankBot: 1, seed: 0 }] }] });
	const outlet = hm.lakes.outlets.get(0)[0];
	for (const [x, z] of outlet.path) for (const u of [-0.95, -0.5, 0, 0.5, 0.95]) {
		const pz = z + u * outlet.width;
		assert.ok(hm.height(x, pz) < 9.8, 'no dry rim may block the feeder');
		assert.ok(hm.lakes.coverage(0, x, pz) >= -0.001, 'the lake mesh covers the carved feeder');
		assert.equal(hm.waterAt(x - 0.001, pz), 10);
	}
	assert.ok(hm.lakes.coverage(0, 6, 0) < 0, 'the lake stops at the drop');
	assert.ok(hm.height(5, 0) < 8, 'rim repair must leave the spillway open');
	assert.equal(hm.lakes.waveWeight(0, 4, 0), 0, 'wind waves cannot pull the lake away from the brow');
	assert.equal(hm.lakes.carveOutlet(6, 0, 25), 25, 'the feeder must not flatten the waterfall face');
});
