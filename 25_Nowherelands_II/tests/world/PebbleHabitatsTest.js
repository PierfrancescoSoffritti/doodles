import test from 'node:test';
import assert from 'node:assert/strict';
import { CaveField } from '../../js/world/caves/CaveField.js';
import { pebbleCaveSampler, pebbleHabitatSites } from '../../js/world/fauna/PebbleHabitats.js';
import { FaunaModel } from '../../js/world/fauna/FaunaModel.js';

const surface = () => ({ ground: 100, water: -4, slope: 0.1, hardness: 0.8, forest: 0.9, wet: 0.95, roof: false });
function fixture(wet = false, height = 25) {
	const points = [0, 40, 80, 120, 160, 200].map(x => ({ x, z: 0, floor: 5, width: 24, height, water: wet ? 20 : -1e6 }));
	const cave = { id: 0, entrance: { x: 0, z: 0, y: 16, path: 0 }, paths: [{ points, wet, surfaceStart: 0 }] };
	const hm = { caves: new CaveField([cave]) };
	return { cave, hm, sample: pebbleCaveSampler(hm, surface, cave, 5) };
}

test('cave colonies use dry passage floors, not the surface overhead, throughout escape and reunion', () => {
	const { sample } = fixture(), model = new FaunaModel('cave-stones', { sample: surface });
	const group = model.addGroup('cave', 'hopper', 90, 0, 12, { sample, habitat: 'cave interior' });
	assert.ok(group && group.members.length >= 3); const c = group.members[0];
	model.listener = { x: c.pos.x + 4, y: c.ground + 11, z: c.pos.z };
	let moved = false;
	for (let i = 0; i < 2100; i++) {
		model.step(1 / 30);
		for (const o of group.members) {
			const s = sample(o.pos.x, o.pos.z);
			assert.ok(s.cave); assert.ok(Math.abs(o.ground - s.ground) < 0.01); assert.ok(o.pos.y < 12);
			assert.ok(s.clearance > 3.5); if (o.speed > 10) moved = true;
		}
	}
	assert.ok(moved); assert.ok(group.members.some(o => o.pebble.reunited));
});

test('submerged cave floors and solid passage walls do not become pebble habitat', () => {
	const { sample } = fixture(true), model = new FaunaModel('wet-stones', { sample: surface });
	assert.equal(model.addGroup('wet', 'hopper', 90, 0, 12, { sample }), null);
	const dry = fixture().sample; assert.ok(!Number.isFinite(dry(100, 80).ground));
});

test('habitat sites explicitly include cave mouths, galleries and elevated lake banks', () => {
	const { cave, hm } = fixture();
	const lakes = [{ id: 1, y: 210, shore: [{ x: 300, z: 0, y: 210, nx: 1, nz: 0 }] }, { id: 2, y: 40, shore: [{ x: 0, z: 0, y: 40, nx: 1, nz: 0 }] }];
	const sites = pebbleHabitatSites({ caves: [cave] }, lakes, hm, surface);
	assert.ok(sites.some(s => s.habitat === 'cave entrance' && s.sample));
	assert.ok(sites.some(s => s.habitat === 'cave interior' && s.sample));
	assert.deepEqual(sites.filter(s => s.habitat === 'mountain lakeshore').map(s => [s.x, s.z]), [[275, 0]]);
});
