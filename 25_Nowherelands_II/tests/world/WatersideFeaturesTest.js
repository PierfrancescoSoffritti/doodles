import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld } from '../../js/world/gen/WorldGen.js';
import { WatersideFeatures } from '../../js/world/WatersideFeatures.js';
import { RIVER_STRIDE as S, RV, sectionArea, bedProfile } from '../../js/world/gen/Rivers.js';
import { riverHabitat } from '../../js/world/gen/ChannelMorphology.js';

globalThis.location = { search: '?seed=umbra' };
globalThis.matchMedia = () => ({ matches: false });
const { Heightmap } = await import('../../js/world/Heightmap.js');

test('a gravel island leaves two wet channels and reduces the flowing section area', () => {
	assert.ok(bedProfile(0, 0, 1) < 0);
	assert.ok(bedProfile(-0.6, 0, 1) > 0.6 && bedProfile(0.6, 0, 1) > 0.6);
	assert.ok(sectionArea(60, 3, 0, 1) < sectionArea(60, 3, 0, 0) * 0.85);
});

test('fern, willow and lily recruitment respects forest, elevation, depth and current', () => {
	assert.ok(riverHabitat(3, 0, 0, 50, 0.9).fern > riverHabitat(3, 0, 0, 50, 0.05).fern * 10);
	assert.equal(riverHabitat(-1, 0, 0, 50).willow, 0);
	assert.equal(riverHabitat(3, 0, 0, 900).willow, 0);
	assert.equal(riverHabitat(-1, 1, 0, 50).lily, 0);
	assert.ok(riverHabitat(-1, 0, 0, 50, 0.5, 0.1).lily > 0.8);
});

test('generated wood is supported, finite and uniquely assigned across chunk boundaries', () => {
	const world = generateWorld('umbra', null, { res: 512 });
	const hm = new Heightmap('umbra', world), features = new WatersideFeatures(hm, 'umbra');
	const logs = features.items.filter(f => f.type === 'fallen');
	assert.ok(logs.length >= 70, 'wooded reaches should recruit more than occasional single trunks');
	const lengths = logs.map(f => Math.hypot(f.b[0] - f.a[0], f.b[2] - f.a[2]));
	assert.ok(lengths.some(l => l < 25) && lengths.some(l => l > 100), 'include smaller trees and mature forest giants');
	assert.ok(logs.some(f => f.radius < 1) && logs.some(f => f.radius > 4), 'trunk diameters must vary with tree size');
	assert.ok(logs.filter(a => logs.some(b => a !== b && a.river === b.river && Math.abs(a.sample - b.sample) <= 2)).length > logs.length * 0.25, 'windthrow should include groups');
	assert.ok(features.items.some(f => f.type === 'roots'));
	for (const f of features.items) {
		assert.ok([...f.a, ...f.b, f.radius].every(Number.isFinite));
		assert.ok(f.radius > 0);
	}
	for (const f of logs) {
		assert.ok(Math.abs(f.a[1] - hm.height(f.a[0], f.a[2])) < f.radius + 0.1, 'root end must rest on the bank');
		assert.ok(hm.forestDensity(f.a[0], f.a[2]) >= 0.18, 'fallen trees must originate at woodland edges');
		const length = Math.hypot(f.b[0] - f.a[0], f.b[2] - f.a[2]);
		let wet = false;
		for (let q = 1, probes = Math.max(6, Math.ceil(length / 6)); q < probes; q++) {
			const t = q / probes, p = f.a.map((v, k) => v + (f.b[k] - v) * t), radius = f.radius * (1 + (f.taper - 1) * t);
			assert.ok(hm.height(p[0], p[2]) <= p[1] + radius * 0.3 + 1e-6, 'long trunks must clear intervening terrain');
			wet ||= hm.depthAt(p[0], p[2]) > 0.15;
		}
		assert.ok(wet, 'fallen river trees must reach the channel');
	}
	const seen = new Set();
	for (const key of features.cells.keys()) {
		const [cx, cz] = key.split(',').map(Number);
		for (const f of features.query(features.cells, cx * 256, cz * 256, (cx + 1) * 256, (cz + 1) * 256)) { assert.ok(!seen.has(f)); seen.add(f); }
	}
	assert.equal(seen.size, features.items.length);
	for (const r of world.rivers) assert.ok(r.wakes.every(Number.isFinite));
	let exposed = 0;
	for (const r of world.rivers) for (let i = 2; i < r.count - 2; i++) {
		const o = i * S;
		if (r.data[o + RV.BAR] < 0.95) continue;
		if (hm.depthAt(r.data[o], r.data[o + 1]) < 0) exposed++;
	}
	assert.ok(exposed > 5, 'bar islands must actually rise through the rendered water');
	const repeated = new WatersideFeatures(new Heightmap('umbra', generateWorld('umbra', null, { res: 512 })), 'umbra');
	assert.deepEqual(repeated.items, features.items, 'the wood plan must reproduce for the same seed');
	// A forest field alone is insufficient: nearby standing-tree habitat must be
	// dry and gentle enough to support a stand. None of these may recruit wood.
	for (const setting of ['bare', 'isolated', 'submerged', 'cliff']) {
		const empty = { items: [] }, wakes = [];
		const mock = {
			_water: 10, _slope: 0, waterLevel: 0,
			sample() { this._water = setting === 'submerged' ? 20 : 10; this._slope = setting === 'cliff' ? 1 : 0; return 15; },
			habitat: () => ({ forest: setting === 'bare' ? 0 : 0.8, alt: 1, coast: 0 }),
			forestDensity: () => setting === 'isolated' ? 0 : 0.8,
		};
		const river = world.rivers.find(r => r.count > 20 && r.data[8 * S + RV.KIND] === 0 && r.data[8 * S + RV.WL] > 2 && r.data[8 * S + RV.WL] < 700);
		const copy = { ...river, data: river.data.slice() }; copy.data[8 * S + RV.WL] = 10;
		WatersideFeatures.prototype.fallen.call(empty, mock, copy, 8, 1, { next: () => 0 }, f => empty.items.push(f), wakes);
		assert.equal(empty.items.length, 0, `${setting} banks must not recruit fallen trees`);
		assert.equal(wakes.length, 0);
	}
});
