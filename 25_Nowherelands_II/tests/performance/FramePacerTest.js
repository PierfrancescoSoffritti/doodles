import test from 'node:test';
import assert from 'node:assert/strict';
import { FramePacer } from '../../js/core/FramePacer.js';

test('frame limits preserve elapsed time at 60, 120 and 144 Hz', () => {
	for (const display of [60, 120, 144]) for (const limit of [30, 60]) {
		const pacer = new FramePacer(), accepted = [];
		for (let i = 0; i < display * 10; i++) if (pacer.accept(i * 1000/display, limit)) accepted.push(i * 1000/display);
		assert.ok(Math.abs(accepted.length - limit * 10) <= 1, `${display} Hz / ${limit} fps: ${accepted.length}`);
		assert.ok(Math.max(...accepted.slice(1).map((t, i) => t - accepted[i])) <= 1000/limit + 1000/display + .01);
	}
});
test('changing modes and resuming do not burst through missed frames', () => {
	const pacer = new FramePacer();
	assert.ok(pacer.accept(0, 30)); assert.ok(!pacer.accept(5, 30));
	assert.ok(pacer.accept(10, 60)); assert.ok(pacer.accept(11, 0));
	pacer.reset(); assert.ok(pacer.accept(10000, 60)); assert.ok(!pacer.accept(10001, 60));
	assert.ok(pacer.accept(50000, 60)); assert.ok(!pacer.accept(50001, 60));
});
