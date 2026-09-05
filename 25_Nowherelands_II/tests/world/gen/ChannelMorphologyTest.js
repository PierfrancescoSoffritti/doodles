import test from 'node:test';
import assert from 'node:assert/strict';
import { reachCharacter, bedSequence, riverHabitat, CHANNEL } from '../../../js/world/gen/ChannelMorphology.js';
import { generateWorld } from '../../../js/world/gen/WorldGen.js';
import { RIVER_STRIDE as S, RV, sectionArea } from '../../../js/world/gen/Rivers.js';

test('mountain confinement and roughness replace alluvial migration', () => {
	const floodplain = reachCharacter(0.001, 0.2, 0);
	const mountain = reachCharacter(0.18, 0.8, 0.9);
	assert.equal(floodplain.type, CHANNEL.ALLUVIAL);
	assert.equal(mountain.type, CHANNEL.TORRENT);
	assert.ok(floodplain.mobility > 0.8);
	assert.equal(mountain.mobility, 0);
	assert.ok(mountain.roughness > floodplain.roughness * 1.5);
	const pool = bedSequence(0, 0.2, 0.5), riffle = bedSequence(Math.PI, 0.2, 0);
	assert.ok(pool.depth > riffle.depth * 1.5 && pool.width > riffle.width);
	assert.ok(riffle.riffle > pool.riffle);
});

test('riparian recruitment excludes plants from destructive current and deep water', () => {
	assert.ok(riverHabitat(-0.8, 0.2, 0, 80).aquatic > 0.5);
	assert.equal(riverHabitat(-0.8, 3, 0.8, 80).aquatic, 0);
	assert.equal(riverHabitat(-8, 0.2, 0, 80).aquatic, 0);
	assert.equal(riverHabitat(0.5, 0.2, 0, 900).reed, 0);
	assert.equal(riverHabitat(-1, 0.2, 0, 80).bramble, 0);
	assert.ok(riverHabitat(4, 0.2, 0, 80).bramble > 0.8);
});

for (const seed of ['umbra', 'halcyon']) test(`${seed}: drainage stays downhill with powerful headwaters and varied sections`, () => {
	const world = generateWorld(seed, null, { res: 512 });
	let mountain = 0, minWidth = Infinity, maxWidth = 0, minDepth = Infinity, maxDepth = 0;
	for (const river of world.rivers) {
		const d = river.data;
		assert.ok(d.every(Number.isFinite));
		for (let i = 0; i < river.count; i++) {
			const o = i * S, width = d[o + RV.W], depth = d[o + RV.D], speed = d[o + RV.SPEED];
			if (i) assert.ok(d[o + RV.TRAVEL] >= d[o - S + RV.TRAVEL]);
			if (i) assert.ok(d[o + RV.WL] <= d[o - S + RV.WL] + 0.002, `river ${river.id}, section ${i} runs uphill`);
			assert.ok(Math.abs(sectionArea(width, depth, d[o + RV.BEND]) * speed / d[o + RV.DISCHARGE] - 1) < 1e-6);
			if (d[o + RV.WL] > 160 && speed > 2) mountain++;
			minWidth = Math.min(minWidth, width); maxWidth = Math.max(maxWidth, width);
			minDepth = Math.min(minDepth, depth); maxDepth = Math.max(maxDepth, depth);
		}
	}
	assert.ok(mountain > 100, 'headwaters must visibly carry strong flow');
	assert.ok(maxWidth > minWidth * 8 && maxDepth > minDepth * 8);
});
