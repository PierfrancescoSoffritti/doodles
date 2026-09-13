import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../../js/audio/AudioEngine.js?v=stable-30-3';
import { Drone } from '../../js/audio/layers/Drone.js?v=stable-30-3';

test('voice routing retires only after every source and its local tail finish', async () => {
 const engine = Object.create(AudioEngine.prototype);
 const sources = [{}, {}], disconnected = [];
 const nodes = sources.map((source, i) => Object.assign(source, { disconnect: () => disconnected.push(i) }));
 engine.finishVoice(sources, nodes);
 assert.deepEqual(engine.voiceStats, { active: 1, peak: 1, retired: 0 });
 sources[0].onended();
 await new Promise(resolve => setTimeout(resolve, 120));
 assert.deepEqual(disconnected, [], 'one source is still sounding');
 sources[1].onended();
 assert.deepEqual(disconnected, [], 'keep the local filter and HRTF tail');
 await new Promise(resolve => setTimeout(resolve, 120));
 assert.deepEqual(disconnected, [0, 1]);
 assert.deepEqual(engine.voiceStats, { active: 0, peak: 1, retired: 1 });
});

test('drone crossfades disconnect the old modulation edge without disconnecting its replacement', () => {
 const edges = new Set(), disconnected = [];
 const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
 const ctx = {
  createOscillator: () => ({ frequency: {}, detune: {}, connect() {}, start() {}, stop(t) { this.stopAt = t; }, disconnect() { disconnected.push(this); } }),
  createGain: () => ({ gain: param(), connect() {}, disconnect() { disconnected.push(this); } }),
 };
 const drone = Object.assign(Object.create(Drone.prototype), { engine: { ctx }, wobbleGain: { connect: p => edges.add(p), disconnect: p => assert.equal(edges.delete(p), true) } });
 const voice = { cfg: { type: 'sine', detune: 3 }, breath: {}, osc: null };
 drone.spawnOsc(voice, 220, 0, 1);
 const old = voice.osc, oldGain = voice.oscGain;
 drone.spawnOsc(voice, 330, 2, 5);
 assert.equal(old.stopAt, 7.1);
 assert.equal(edges.size, 2, 'both oscillators retain modulation during the fade');
 old.onended();
 assert.deepEqual(disconnected, [old, oldGain]);
 assert.deepEqual([...edges], [voice.osc.detune]);
});
