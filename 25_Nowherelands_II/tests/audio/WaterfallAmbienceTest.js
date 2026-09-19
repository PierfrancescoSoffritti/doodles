import test from 'node:test';
import assert from 'node:assert/strict';
import { WaterfallAmbience } from '../../js/audio/WaterfallAmbience.js';
import { Wind } from '../../js/audio/layers/Wind.js';
import { WatersideAmbience } from '../../js/audio/WatersideAmbience.js';
import { RIVER_STRIDE as S, RV, RIVER_KIND } from '../../js/world/gen/Rivers.js';

function engine() {
	const param = () => ({ value: 0, setTargetAtTime(v) { this.value = v; }, setValueAtTime(v) { this.value = v; }, cancelScheduledValues() {} });
	const gain = () => ({ gain: param(), connect() {} });
	return { now: 0, ctx: { createGain: gain }, layerBus: {}, createLayerGain: gain,
		makePanner: () => ({ connect() {}, positionX: param(), positionY: param(), positionZ: param() }), setPannerPosition(p, f) { p.position = { x: f.x, y: f.y, z: f.z }; },
		createNoise: () => ({ gain: gain(), filter: { frequency: param() } }),
	};
}
const fall = (x = 0, size = 20) => ({ x, z: 0, dx: 0, dz: 1, top: size, bottom: 0, drop: size, w: size, seed: 1 });
function advance(sound, shared, seconds = 6) {
	for (let i = 0; i < seconds * 60; i++) { sound.engine.now += 1 / 60; sound.update(1 / 60, shared); }
}
const at = (x, y = 10, z = 20, caveAmount = 0) => ({ camera: { position: { x, y, z } }, caveAmount });

test('calm wind stays silent despite running, altitude, turning and wading; weather still sounds', () => {
	const wind = new Wind(engine());
	const p = { wind: 0, storm: 0, snow: 0, speed: 1, altitude: 1, turn: 1, wading: 1 };
	advance(wind, p);
	assert.equal(wind.out.gain.value, 0);
	advance(wind, { ...p, wind: 1, storm: 0.8 });
	assert.ok(wind.out.gain.value > 0.03 && wind.out.gain.value < 0.06);
});

test('waterfall rush is local and fades away in caves and beyond its range', () => {
	const sound = new WaterfallAmbience(engine(), [{ falls: [fall()] }]);
	advance(sound, at(0));
	assert.ok(sound.voices.some(v => v.out.gain.value > 0.03));
	advance(sound, at(0, 10, 20, 1));
	assert.ok(sound.voices.every(v => v.out.gain.value < 0.00001));
	advance(sound, at(0));
	assert.ok(sound.voices.some(v => v.out.gain.value > 0.03));
	advance(sound, at(1000));
	assert.ok(sound.voices.every(v => v.out.gain.value < 0.00001));
});

test('larger falls carry farther, and voices use the world coordinates of the falling sheet', () => {
	const sound = new WaterfallAmbience(engine(), [{ falls: [fall(800, 5), fall(1600, 100)] }]);
	assert.ok(sound.falls[1].radius > sound.falls[0].radius);
	assert.ok(sound.falls[1].level > sound.falls[0].level);
	advance(sound, at(1600, 25, 20));
	const voice = sound.voices.find(v => v.target > 0);
	assert.deepEqual(voice.panner.position, { x: 1600, y: 25, z: 12 });
});

test('travelling between falls preserves audible source positions and bounds the voice count', () => {
	const sound = new WaterfallAmbience(engine(), [{ falls: [fall(), fall(25), fall(1000), fall(1025), fall(2000), fall(2025)] }]);
	advance(sound, at(0));
	const old = sound.voices.filter(v => v.target > 0).map(v => [v, v.fall]);
	advance(sound, at(1000), 0.5);
	for (const [voice, source] of old) assert.equal(voice.fall, source, 'old roar fades at its original waterfall');
	advance(sound, at(2000));
	assert.equal(sound.voices.length, 3);
	assert.equal(sound.voices.filter(v => v.target > 0).length, 2);
	assert.ok(sound.voices.filter(v => v.target > 0).every(v => v.fall.x >= 2000));
});

test('a world without waterfalls has no waterfall sound', () => {
	const sound = new WaterfallAmbience(engine(), [{ falls: [] }]);
	advance(sound, at(0));
	assert.ok(sound.voices.every(v => v.out.gain.value === 0));
});

test('equally sized falls get louder, brighter and carry farther with greater lip speed', () => {
	const profile = (speed, width = 20, drop = 20) => {
		const data = new Float32Array(S); data[RV.SPEED] = speed;
		return new WaterfallAmbience(engine(), [{ data, falls: [{ ...fall(0, drop), w: width, i: 0 }] }]).falls[0];
	};
	const slow = profile(1), fast = profile(10), wide = profile(10, 80), tall = profile(10, 20, 80);
	assert.ok(fast.level > slow.level * 2);
	assert.ok(fast.radius > slow.radius && fast.bodyCutoff > slow.bodyCutoff && fast.sprayGain > slow.sprayGain);
	assert.ok(wide.level > fast.level && tall.level > fast.level);
	assert.equal(profile(0).level, 0, 'no moving water means no waterfall rush');
});

function riverScene(speed, endSpeed = speed, kind = RIVER_KIND.FLOW) {
	const data = new Float32Array(S * 2);
	for (let i = 0; i < 2; i++) {
		data[i * S + RV.X] = i * 1000; data[i * S + RV.W] = 30;
		data[i * S + RV.SPEED] = i ? endSpeed : speed;
	}
	data[RV.KIND] = kind;
	const river = { data, falls: [] };
	const hm = { world: { rivers: [river] }, rivers: {
		segmentsIn: () => [0], segRiver: [0], segIndex: [0],
		at: (_index, t) => ({ x: t * 1000, z: 0, wl: 0, w: 30, foam: 0, dx: 1000, dz: 0 }),
	} };
	return new WatersideAmbience(engine(), hm, { query: () => [] });
}

test('fast river reaches rush without foam and keep responding above ordinary current speeds', () => {
	const levels = [0, 1, 4, 8, 16].map(speed => {
		const sound = riverScene(speed); advance(sound, at(10));
		return sound.voices.slice(0, 2).map(v => v.gain.gain.value);
	});
	assert.deepEqual(levels[0], [0, 0]);
	for (let i = 1; i < levels.length; i++) for (let j = 0; j < 2; j++) assert.ok(levels[i][j] > levels[i - 1][j]);
	assert.ok(levels[3][0] > levels[1][0] * 4);
});

test('river rush follows the nearest point and interpolates local speed along long reaches', () => {
	const sound = riverScene(1, 12);
	advance(sound, at(10)); const slow = sound.voices[0].amount;
	assert.equal(sound.voices[0].panner.positionX.value, 10);
	advance(sound, at(990));
	assert.equal(sound.voices[0].panner.positionX.value, 990);
	assert.ok(sound.voices[0].amount > slow * 4);
	advance(sound, at(990, 10, 200));
	assert.equal(sound.voices[0].amount, 0, 'even a returned spatial bucket must fade beyond audible range');
});

test('river voices do not duplicate waterfall gaps or rush through still-water joins', () => {
	const gap = riverScene(12, 12, RIVER_KIND.LIP); advance(gap, at(10));
	assert.ok(gap.voices.every(v => v.amount === 0));
	const joined = riverScene(12); joined.hm.world.rivers[0].data[RV.FADE] = 1; joined.hm.world.rivers[0].data[S + RV.FADE] = 1;
	advance(joined, at(10)); assert.ok(joined.voices.slice(0, 2).every(v => v.amount === 0));
});
