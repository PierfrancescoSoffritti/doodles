// Exercise real generated foothills and shores, rather than only flat fixtures.
// Usage: node tests/pebble-terrain-audit.mjs [resolution=512] [seed=umbra]
import assert from 'node:assert/strict';
import { generateWorld } from '../js/world/gen/WorldGen.js';
import { FaunaModel } from '../js/world/fauna/FaunaModel.js';
const seed = process.argv[3] || 'umbra'; globalThis.location = { search: '?seed=' + encodeURIComponent(seed) };
const { Heightmap } = await import('../js/world/Heightmap.js');
const world = generateWorld(seed, null, { res: Number(process.argv[2] || 512) }), hm = new Heightmap(seed, world);
const sample = (x, z) => {
	const ground = hm.sample(x, z), water = hm._water, slope = hm._slope, hardness = hm._hardness, foam = hm._foam;
	const hab = hm.habitat(x, z), roof = hm.caves?.surfaceDensity(x, ground, z) > -2;
	return { ground, water, slope, hardness, foam, roof, forest: hab.forest, wet: hab.wet, coast: hab.coast };
};
const reports = [];
for (let i = 0; i < 48; i++) {
	const a = i * 2.39996323, radius = Math.sqrt((i + 1) / 48) * world.size * 0.32;
	const model = new FaunaModel(seed + ':' + i, { sample });
	const group = model.addGroup('audit', 'hopper', Math.cos(a) * radius, Math.sin(a) * radius, 350);
	if (!group) continue;
	const c = group.members[0], origin = { ...c.pos }, states = new Set(); let distance = 0, steps = 0;
	model.listener = { x: origin.x + 4, y: c.ground + 11, z: origin.z };
	for (let j = 0; j < 600; j++) {
		model.step(1 / 30); states.add(c.pebble.state);
		for (const animal of group.members) {
			const s = sample(animal.pos.x, animal.pos.z);
			assert.ok(Object.values(animal.pos).every(Number.isFinite));
			assert.ok(animal.pos.y >= s.ground + 0.5 * animal.size - 0.03, 'stone sank through terrain');
			assert.ok(s.ground > s.water + 0.4, 'animal ran into water');
			if (animal.feet) for (const f of animal.feet) assert.ok(Object.values(f.pos).every(Number.isFinite));
		}
		distance += Math.hypot(c.pos.x - c.prev.x, c.pos.z - c.prev.z); steps = c.pebble.steps;
	}
	const s = sample(origin.x, origin.z);
	reports.push({ colony: i, count: group.members.length, stones: group.stones.length, ground: +s.ground.toFixed(1), clearance: +(s.ground - s.water).toFixed(1), hardness: +s.hardness.toFixed(2), slope: +s.slope.toFixed(2), forest: +s.forest.toFixed(2), wet: +s.wet.toFixed(2), distance: +distance.toFixed(1), steps, escapes: c.pebble.escapes, final: c.pebble.state, states: [...states] });
}
assert.ok(reports.length >= 3, 'failed to find usable real terrain');
assert.ok(reports.filter(r => r.distance > 4).length >= reports.length * 0.75, 'too many animals trapped in habitat');
assert.ok(reports.filter(r => ['rest', 'notice'].includes(r.final)).length >= reports.length * 0.8, 'too many animals fail to hide again');
console.log(JSON.stringify({ seed, resolution: world.res, colonies: reports.length, escaped: reports.filter(r => r.distance > 4).length, hidden: reports.filter(r => ['rest', 'notice'].includes(r.final)).length, reports }, null, 2));
