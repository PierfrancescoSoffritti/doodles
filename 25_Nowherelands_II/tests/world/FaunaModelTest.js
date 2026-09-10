import test from 'node:test';
import assert from 'node:assert/strict';
import { FaunaModel, SPECIES, habitatScore, solveLeg } from '../../js/world/fauna/FaunaModel.js';

const sample = (x, z) => ({ ground: Math.sin(x / 70) * 3 - 0.5, water: 0, slope: 0.05, forest: 0.4, wet: 0.8, foam: 0 });
const make = () => new FaunaModel('fauna-test', { sample });

test('shared fauna species recruit deterministically into suitable habitat', () => {
	const a = make(), b = make();
	for (const kind of Object.keys(SPECIES)) {
		const ga = a.addGroup(kind, kind, 0, 0), gb = b.addGroup(kind, kind, 0, 0);
		assert.ok(ga, kind); assert.deepEqual(ga.home, gb.home);
		assert.deepEqual(ga.members.map(c => [c.id, c.pos, c.voice]), gb.members.map(c => [c.id, c.pos, c.voice]));
		assert.ok(habitatScore(kind, sample(ga.home.x, ga.home.z)) > 0);
	}
});

test('population caps hold and unloaded habitat can regenerate with the same identity', () => {
	const model = make();
	for (let i = 0; i < 20; i++) model.addGroup(String(i), 'lumen', 0, 0);
	assert.equal(model.creatures.length, SPECIES.lumen.cap);
	const home = { ...model.groups.get('0').home };
	model.removeFar({ x: 5000, y: 0, z: 5000 }); assert.equal(model.creatures.length, 0);
	assert.deepEqual(model.addGroup('0', 'lumen', 0, 0).home, home);
});

test('hearing reacts locally, propagates with delay and cannot recursively answer fauna', () => {
	const model = make(), group = model.addGroup('school', 'lumen', 0, 0);
	const source = { ...group.members[0].pos }; let calls = 0; model.onCall = () => calls++;
	model.hear({ position: source, strength: 1, layer: 'fauna:lumen' });
	assert.ok(group.members.every(c => c.callAt === Infinity && c.responseAt === Infinity));
	model.hear({ position: { x: 10000, y: 0, z: 10000 }, strength: 1 });
	assert.ok(group.members.every(c => c.responseAt === Infinity));
	model.step(0.05); group.nextCall = 9999;
	model.hear({ position: source, strength: 1, layer: 'invitation' });
	assert.ok(group.members.some(c => c.responseAt > model.time && c.responseAt < Infinity));
	for (let i = 0; i < 120; i++) { model.hear({ position: source, strength: 1, layer: 'invitation' }); model.step(1 / 30); }
	assert.equal(calls, 1);
});

test('two-segment legs preserve segment length and clamp unreachable feet', () => {
	const hip = { x: 0, y: 7, z: 0 }, bend = { x: 1, y: 0, z: 0 };
	for (const target of [{ x: 1, y: 0, z: 2 }, { ...hip }, { x: 100, y: -100, z: 30 }]) {
		const { knee, foot } = solveLeg(hip, target, 4.5, bend);
		const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
		assert.ok(Math.abs(dist(hip, knee) - 4.5) < 1e-6);
		assert.ok(Math.abs(dist(knee, foot) - 4.5) < 1e-6);
		assert.ok(dist(hip, foot) < 9);
	}
});

test('dedicated walkers and mites are not recruited by the shared fauna model', () => {
 const model = make();
 for (const kind of ['walker', 'mite']) assert.equal(model.addGroup(kind, kind, 0, 0), null);
 assert.equal(model.creatures.length, 0);
 assert.equal(model.groups.size, 0);
});
