import test from 'node:test';
import assert from 'node:assert/strict';
import { riverCurrent } from '../../js/world/RiverFlow.js';
const empty = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

test('banks slow the current and a bend shifts the fast channel to the outside', () => {
	assert.ok(riverCurrent(0, 0, 20, 1, 0, empty)[0] > riverCurrent(0, 9, 20, 1, 0, empty)[0] * 2);
	assert.ok(riverCurrent(0, 5, 20, 1, 0.8, empty)[0] > riverCurrent(0, -5, 20, 1, 0.8, empty)[0]);
	assert.equal(riverCurrent(0, 10, 20, 1, 0.8, empty)[1], 0);
});

test('a rock divides the approaching flow and forms a reversing wake', () => {
	const wakes = [[0, 0, 2], ...empty.slice(1)];
	assert.ok(riverCurrent(-1, 1, 20, 1, 0, wakes)[1] > 0);
	assert.ok(riverCurrent(-1, -1, 20, 1, 0, wakes)[1] < 0);
	assert.ok(riverCurrent(5, 0, 20, 1, 0, wakes)[0] < 0);
	for (let s = -10; s < 30; s++) for (let c = -10; c <= 10; c++) assert.ok(riverCurrent(s, c, 20, 1, 0.5, wakes).every(Number.isFinite));
});
