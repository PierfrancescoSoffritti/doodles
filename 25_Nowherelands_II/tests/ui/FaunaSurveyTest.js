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
