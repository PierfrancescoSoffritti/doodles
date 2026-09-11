import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeVeilRay, rayEnvelope, RAY_PHRASES } from '../../js/audio/VeilRayVoice.js';

test('ray phrases have a sustained body, quiet boundaries, bounded peaks and repeatable samples', () => {
 for (const phrase of Object.keys(RAY_PHRASES)) for (const sampleRate of [22050, 48000]) {
  const options = { phrase, sampleRate, frequency: 180, identity: 0.7, size: 1.1 };
  const a = synthesizeVeilRay(options), b = synthesizeVeilRay(options);
  assert.deepEqual(a, b); assert.equal(a.length, Math.ceil(sampleRate * RAY_PHRASES[phrase].duration));
  let peak = 0, body = 0, n = 0, jump = 0;
  for (let i = 0; i < a.length; i++) {
   assert.ok(Number.isFinite(a[i])); peak = Math.max(peak, Math.abs(a[i]));
   if (i) jump = Math.max(jump, Math.abs(a[i] - a[i - 1]));
   if (i > sampleRate * 0.5 && i < a.length - sampleRate * 0.8) { body += a[i] ** 2; n++; }
  }
  assert.ok(peak > 0.8 && peak < 0.83);
  assert.ok(Math.sqrt(body / n) > 0.3, 'a sustained voice, not only a faint onset');
  assert.ok(jump < 0.12, 'smooth waveform without discontinuities');
  assert.equal(a[0], 0); assert.ok(Math.abs(a.at(-1)) < 0.00001);
 }
});

test('the visual breath follows each phrase and ends exactly with it', () => {
 for (const [phrase, spec] of Object.entries(RAY_PHRASES)) {
  assert.equal(rayEnvelope(-1, phrase), 0); assert.equal(rayEnvelope(0, phrase), 0);
  assert.equal(rayEnvelope(spec.duration, phrase), 0); assert.equal(rayEnvelope(spec.duration + 1, phrase), 0);
  assert.ok(rayEnvelope(spec.duration * 0.3, phrase) > 0.8);
 }
});

test('body size changes vocal pitch while both phrases keep their envelope duration', () => {
 const small = synthesizeVeilRay({ sampleRate: 22050, size: 0.8 }), large = synthesizeVeilRay({ sampleRate: 22050, size: 1.2 });
 const crossings = a => { let n = 0; for (let i = 1; i < a.length; i++) if (a[i] > 0 && a[i - 1] <= 0) n++; return n; };
 assert.equal(small.length, large.length); assert.ok(crossings(small) > crossings(large));
});
