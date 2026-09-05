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
	assert.ok(logs.length > 5, 'wood should occur throughout the network');
	assert.ok(features.items.some(f => f.type === 'roots'));
	for (const f of features.items) {
		assert.ok([...f.a, ...f.b, f.radius].every(Number.isFinite));
		assert.ok(f.radius > 0);
	}
	for (const f of logs) {
		assert.ok(Math.abs(f.a[1] - hm.height(f.a[0], f.a[2])) < f.radius + 0.1, 'root end must rest on the bank');
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
});
