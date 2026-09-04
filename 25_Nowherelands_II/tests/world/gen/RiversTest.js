import test from 'node:test';
import assert from 'node:assert/strict';
import { bedProfile, bankSpread, hydraulicDepth, sectionArea, dischargeFromArea, RIVER_STRIDE as S, RV } from '../../../js/world/gen/Rivers.js';
import { generateWorld } from '../../../js/world/gen/WorldGen.js';

test('bend geometry mirrors with bend direction and deepens the outside', () => {
	for (const bend of [0.2, 0.5, 0.9]) {
		assert.ok(bedProfile(0.65, bend) > bedProfile(-0.65, bend));
		assert.ok(bankSpread(1, bend) < bankSpread(-1, bend));
		if (bend > 0.8) assert.ok(bedProfile(-1, bend) < 0, 'strong bends expose an inner sediment bar');
		for (let u = -1; u <= 1; u += 0.05) assert.ok(Math.abs(bedProfile(u, bend) - bedProfile(-u, -bend)) < 1e-12);
	}
});

test('hydraulic sections accelerate in steeper or narrower channels and slow in pools', () => {
	const q = dischargeFromArea(2e6);
	const speed = (width, slope) => q / sectionArea(width, hydraulicDepth(q, width, slope));
	assert.ok(speed(10, 0.01) > speed(20, 0.01));
	assert.ok(speed(20, 0.05) > speed(20, 0.001));
	const depth = hydraulicDepth(q, 20, 0.01);
	assert.ok(q / sectionArea(25, depth * 1.3) < q / sectionArea(20, depth));
});

test('seeded drainage packs finite geometry and conserved cross-section discharge', () => {
	const world = generateWorld('river-check', null, { res: 512 });
	assert.ok(world.rivers.length > 10);
	let bent = 0, tributaries = 0, lakeMouths = 0, falls = 0;
	for (const river of world.rivers) {
		assert.equal(river.data.length, river.count * S);
		assert.ok(river.data.every(Number.isFinite));
		for (let i = 0; i < river.count; i++) {
			const o = i * S, d = river.data;
			assert.ok(d[o + RV.W] > 0 && d[o + RV.D] > 0 && d[o + RV.SPEED] > 0);
			const q = sectionArea(d[o + RV.W], d[o + RV.D], d[o + RV.BEND]) * d[o + RV.SPEED];
			assert.ok(Math.abs(q - d[o + RV.DISCHARGE]) / q < 1e-6);
			if (Math.abs(d[o + RV.BEND]) > 0.1) bent++;
			if (i) assert.ok(d[o + RV.ALONG] >= d[o - S + RV.ALONG]);
		}
		if (river.toLake >= 0) {
			lakeMouths++;
			const end = (river.count - 1) * S;
			assert.ok(Math.abs(river.data[end + RV.WL] - world.lakes[river.toLake].level) < 0.001);
		}
		for (const fall of river.falls) {
			falls++;
			const d = river.data, lip = fall.i * S, foot = fall.j * S;
			assert.ok(Math.hypot(d[lip] - fall.x, d[lip + 1] - fall.z) < 0.002);
			assert.ok(Math.hypot(d[foot] - fall.x - fall.dx * (fall.run + 1.5), d[foot + 1] - fall.z - fall.dz * (fall.run + 1.5)) < 0.002);
			assert.ok(Math.abs(d[foot + RV.W] - fall.wBottom) < 0.002);
		}
		if (river.mouthType === 'river') {
			tributaries++;
			const d = river.data, end = (river.count - 1) * S;
			assert.ok(d[end + RV.DISCHARGE] / d[end - S + RV.DISCHARGE] < 1.05, 'tributary must not inherit the parent catchment at its last sample');
		}
	}
	assert.ok(bent > 20 && tributaries > 0 && lakeMouths > 0 && falls > 0);
	assert.ok(world.deltas.length > 0);
	for (const delta of world.deltas) {
		const root = world.rivers[delta.river];
		let nearest = 0, distance = Infinity;
		for (let i = 0; i < root.count; i++) {
			const d = Math.hypot(root.data[i * S] - delta.x, root.data[i * S + 1] - delta.z);
			if (d < distance) { nearest = i; distance = d; }
		}
		const incoming = root.data[nearest * S + RV.DISCHARGE];
		const descendants = world.rivers.filter(river => {
			let parent = river;
			while (parent.fromRiver >= 0) parent = world.rivers[parent.fromRiver];
			return parent.id === root.id;
		});
		const outgoing = descendants.reduce((sum, river) => sum + river.data[(river.count - 1) * S + RV.DISCHARGE], 0);
		assert.ok(Math.abs(incoming - outgoing) / incoming < 1e-6, 'delta mouths conserve the incoming discharge');
	}
});
