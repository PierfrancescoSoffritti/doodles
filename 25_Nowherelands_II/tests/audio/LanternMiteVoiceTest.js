import test from 'node:test';
import assert from 'node:assert/strict';
import { lanternSamples, lanternNotes, lanternLight } from '../../js/audio/LanternMiteVoice.js';
import { LanternMiteStudy } from '../../js/world/fauna/LanternMiteStudy.js';

test('all individual calls and replies are repeatable, finite, tapered and below clipping', () => {
 for (const sampleRate of [44100, 48000]) for (const mite of new LanternMiteStudy().mites) for (const reply of [false, true]) {
  const a = lanternSamples(mite, reply, sampleRate), b = lanternSamples(mite, reply, sampleRate);
  assert.deepEqual(a, b);
  let peak = 0, energy = 0;
  for (const v of a) { assert.ok(Number.isFinite(v)); peak = Math.max(peak, Math.abs(v)); energy += v * v; }
  assert.ok(peak > 0.5 && peak < 0.95);
  assert.ok(Math.sqrt(energy / a.length) > 0.1);
  assert.equal(a[0], 0); assert.equal(a.at(-1), 0);
 }
});

test('the double call and single answer share their note timing with distinct light pulses', () => {
 for (const mite of new LanternMiteStudy().mites) for (const reply of [false, true]) {
  const notes = lanternNotes(mite, reply), samples = lanternSamples(mite, reply);
  assert.equal(notes.length, reply ? 1 : 2);
  for (const note of notes) {
   assert.ok(lanternLight(note.at + 0.03, mite, reply) > 0.6);
   const window = samples.slice(Math.floor((note.at + 0.01) * 44100), Math.floor((note.at + 0.06) * 44100));
   assert.ok(Math.sqrt(window.reduce((sum, v) => sum + v * v, 0) / window.length) > 0.15);
  }
  if (!reply) {
   const gap = (notes[0].duration + notes[1].at) / 2;
   assert.equal(lanternLight(gap, mite), 0);
   assert.equal(samples[Math.floor(gap * 44100)], 0);
  }
  assert.equal(lanternLight(1, mite, reply), 0);
 }
});

test('body size and identity vary pitch and rhythm without changing the call vocabulary', () => {
 const mites = new LanternMiteStudy().mites;
 assert.equal(new Set(mites.map(m => lanternNotes(m)[0].frequency)).size, 5);
 assert.equal(new Set(mites.map(m => lanternNotes(m)[1].at)).size, 3);
 assert.ok(lanternNotes({ id: 2, size: 0.14 })[0].frequency < lanternNotes({ id: 2, size: 0.105 })[0].frequency);
});
