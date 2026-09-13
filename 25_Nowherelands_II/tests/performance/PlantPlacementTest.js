import test from 'node:test';
import assert from 'node:assert/strict';
import { Random } from '../../js/core/Random.js';
import { spotCandidates, gridCandidates, finishPlacement } from '../../js/world/PlantPlacement.js?v=stable-30-3';

// Original uninterrupted algorithms are the reference, including rejected candidates
// and predicates that consume additional random numbers.
function spots(rnd, ox, oz, size, count, predicate) {
	const out = [];
	for (let i = 0; i < count * 3 && out.length < count; i++) {
		const x = ox + rnd.range(-size / 2, size / 2), z = oz + rnd.range(-size / 2, size / 2);
		if (Math.hypot(x, z) < 14) continue;
		if (predicate(x, z)) out.push({ x, z });
	}
	return out;
}
function grid(rnd, ox, oz, size, spacing, visit) {
	const n = Math.max(1, Math.round(size / spacing)), sp = size / n;
	for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
		const x = ox - size / 2 + (i + rnd.next()) * sp, z = oz - size / 2 + (j + rnd.next()) * sp;
		if (Math.hypot(x, z) < 14) continue;
		visit(x, z);
	}
}

test('batched placement retains accepted points, callback order and random state', () => {
	for (const origin of [0, -500, 2304]) for (const count of [0, 1, 64, 130, 600]) {
		const a = new Random('placement'), b = new Random('placement'), qa = [], qb = [];
		const predicate = (rnd, queries) => (x, z) => { queries.push([x,z]); return rnd.next() < .45; };
		const expected = spots(a, origin, -origin, 256, count, predicate(a, qa));
		assert.deepEqual(finishPlacement(spotCandidates(b, origin, -origin, 256, count, predicate(b, qb))), expected);
		assert.deepEqual(qb, qa); assert.equal(b.next(), a.next());
	}
	for (const spacing of [8, 16, 40, 64]) {
		const a = new Random('grid'), b = new Random('grid'), qa = [], qb = [];
		const visit = (rnd, queries) => (x,z) => queries.push([x,z,rnd.next()]);
		grid(a, 0, 0, 256, spacing, visit(a, qa));finishPlacement(gridCandidates(b, 0, 0, 256, spacing, visit(b, qb)));
		assert.deepEqual(qb, qa); assert.equal(b.next(), a.next());
	}
});

test('placement yields during unsuccessful searches and cancellation stops callbacks', () => {
	let probes = 0, previous = 0, batches = 0;
	const iterator = spotCandidates(new Random('dry'), 1000, 1000, 256, 600, () => { probes++; return false; });
	for (let next; !(next = iterator.next()).done;) {
		assert.ok(probes - previous <= 64); previous = probes; batches++;
		if (batches === 3) { iterator.return(); break; }
	}
	assert.equal(probes, 192);assert.ok(iterator.next().done);assert.equal(probes, 192);
});

test('accepted surface data is copied before scratch fields change at a yield', () => {
	const scratch = { y: 0, wet: 0 }, queries = [];
	const iterator = spotCandidates(new Random('capture'), 1000, -1000, 256, 130, (x,z) => {
		scratch.y = x * .1 + z * .2; scratch.wet = x - z;
		queries.push({x,z,y:scratch.y,wet:scratch.wet});return true;
	}, (x,z) => ({x,z,y:scratch.y,wet:scratch.wet}));
	let result;
	do { result=iterator.next(); scratch.y=NaN;scratch.wet=NaN; } while(!result.done);
	assert.deepEqual(result.value,queries);
});
