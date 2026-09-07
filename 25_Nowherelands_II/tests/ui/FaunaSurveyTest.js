import test from 'node:test';
import assert from 'node:assert/strict';
import { FaunaSurvey } from '../../js/ui/FaunaSurvey.js';

function setup() {
	const survey = Object.create(FaunaSurvey.prototype);
	const branches = Array.from({length: 3}, (_, index) => ({index, state: 'resting', center: {x: index * 1200, y: 20, z: 0}, members: []}));
	const group = {flow: {branches}};
	const creatures = branches.map(b => {
		const c = {kind: 'lumen', group, navigation: b, pos: {...b.center}};
		b.members.push(c); return c;
	});
	const player = {locked: false, keys: new Set(['KeyW']), velocity: {set() {}}, position: {x: 4000, y: 11, z: 3000}};
	survey.shared = {player, heightmap: {height: () => 0}};
	survey.fauna = {model: {creatures}, nearest: () => creatures[0]};
	survey.buttons = {}; survey.detail = {};
	return {survey, player, creatures, branches};
}

test('Next flock works after entering and exploring without selecting a creature', () => {
	const {survey, player, creatures} = setup();
	survey.nextFlock();
	assert.equal(survey.subject, creatures[1]);
	assert.equal(survey.tracking, true);
	assert.equal(survey.fauna.model.observing, true);
	assert.ok(player.position.x > 1200 && player.position.x < 1400);
	assert.equal(player.keys.size, 0);
});

test('Next flock resumes observation after walking away and cycles every flock', () => {
	const {survey, player, creatures} = setup();
	survey.visit('lumen'); survey.tracking = false;
	player.position = {x: 9000, y: 100, z: 9000};
	survey.nextFlock(); assert.equal(survey.subject, creatures[1]);
	assert.ok(player.position.x < 1400);
	survey.nextFlock(); assert.equal(survey.subject, creatures[2]);
	survey.nextFlock(); assert.equal(survey.subject, creatures[0]);
});

test('stale subjects and empty flock branches cannot strand the guide', () => {
	const {survey, creatures, branches} = setup();
	survey.subject = {kind: 'lumen'}; branches[1].members = [];
	survey.nextFlock(); assert.equal(survey.subject, creatures[2]);
});

test('a visit releases captured mouse control before snapping to the new flock', () => {
	const {survey, player, creatures} = setup();
	player.locked = true;
	let released = false;
	const previous = globalThis.document;
	globalThis.document = {exitPointerLock() {released = true;}};
	try {
		survey.nextFlock();
		assert.equal(released, true); assert.equal(survey.pendingVisit, true);
		assert.equal(player.position.x, 4000, 'must wait for pointer lock release');
		player.locked = false; survey.guide(1, true);
		assert.equal(survey.subject, creatures[1]); assert.ok(player.position.x < 1400);
	} finally {if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

function pebbleSetup() {
	const { survey, player } = setup();
	const colonies = ['a', 'b', 'c'].map((id, i) => ({ id, kind: 'hopper', home: { x: i * 450, y: 2, z: 0 }, members: [] }));
	const creatures = colonies.map(group => { const c = { kind: 'hopper', group, pos: { ...group.home } }; group.members.push(c); return c; });
	survey.fauna.model = { groups: new Map(colonies.map(g => [g.id, g])), creatures };
	survey.fauna.nearest = () => creatures[0];
	return { survey, player, colonies, creatures };
}

test('Next colony visits distinct pebble patches and wraps without selecting the nearest animal again', () => {
	const { survey, player, creatures } = pebbleSetup();
	for (const i of [1, 2, 0]) {
		survey.nextColony(); assert.equal(survey.subject, creatures[i]);
		assert.ok(Math.abs(player.position.x - creatures[i].pos.x - 14) < 0.01);
		assert.equal(survey.tracking, true); assert.equal(survey.fauna.model.observing, true);
	}
});

test('Next colony resumes after exploration and ignores stale subjects and empty colonies', () => {
	const { survey, player, colonies, creatures } = pebbleSetup();
	survey.subject = { kind: 'hopper' }; colonies[1].members = []; survey.tracking = false;
	survey.nextColony(); assert.equal(survey.subject, creatures[2]);
	player.position.x = 3000; survey.tracking = false; survey.nextColony();
	assert.equal(survey.subject, creatures[0]); assert.ok(player.position.x < 50);
});

test('a single loaded colony scouts another habitat and visits the newly found animals', () => {
	const { survey, colonies, creatures } = pebbleSetup();
	survey.fauna.model.groups = new Map([[colonies[0].id, colonies[0]]]); survey.fauna.model.creatures = [creatures[0]];
	let searches = 0;
	survey.fauna.findPebbleColony = current => {
		assert.equal(current, colonies[0]); searches++;
		survey.fauna.model.groups.set(colonies[1].id, colonies[1]); survey.fauna.model.creatures.push(creatures[1]); return colonies[1];
	};
	survey.nextColony(); assert.equal(searches, 1); assert.equal(survey.subject, creatures[1]);
});

test('pebble teleport releases pointer lock before moving the observation camera', () => {
	const { survey, player, creatures } = pebbleSetup(); player.locked = true;
	const before = { ...player.position }, previous = globalThis.document; let released = false;
	globalThis.document = { exitPointerLock() { released = true; } };
	try {
		survey.nextColony(); assert.equal(released, true); assert.deepEqual(player.position, before);
		player.locked = false; survey.guide(1, true); assert.equal(survey.subject, creatures[1]); assert.ok(player.position.x < 500);
	} finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
});

test('visiting an underground colony keeps the camera on its cave floor below the mountain', () => {
	const { survey, player, creatures } = pebbleSetup(), c = creatures[0];
	c.ground = 12; c.pos.y = 12.6; c.group.sample = () => ({ ground: 12, water: -4, clearance: 30, cave: true });
	survey.shared.heightmap.height = () => 200; survey.subject = c;
	survey.visit('hopper');
	assert.equal(player.position.y, 17); assert.ok(Math.hypot(player.position.x - c.pos.x, player.position.z - c.pos.z) < 10);
	assert.equal(survey.fauna.model.observing, true);
});

test('Next colony uses the global tour even when several local colonies are loaded', () => {
 const {survey,colonies,creatures}=pebbleSetup();
 const remote={id:'remote-cave',kind:'hopper',home:{x:5000,y:2,z:3000},members:[]};
 const animal={kind:'hopper',group:remote,pos:{...remote.home}};remote.members=[animal];
 survey.fauna.findPebbleColony=current=>{assert.equal(current,colonies[0]);survey.fauna.model.groups.set(remote.id,remote);survey.fauna.model.creatures.push(animal);return remote;};
 survey.nextColony();assert.equal(survey.subject,animal);assert.notEqual(survey.subject,creatures[1]);
 assert.ok(survey.shared.player.position.x>5000);
});
