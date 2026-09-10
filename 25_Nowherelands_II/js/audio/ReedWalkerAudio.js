import { playReedVoice } from './ReedWalkerVoice.js?v=reed-5';

export const REED_AUDIO = { levels: { rumble: 8, breath: 15 }, refDistance: 30, rolloff: 1.1, range: 180, gain: 10 ** (1 / 20), duck: .58, maxVoices: 3 };

// Reusable game routing: foreground animals bypass ambient ducking, while still
// sharing the game's master level and compressor. Only close encounters duck.
export class ReedWalkerAudio {
 constructor(engine) {
  ensureReedMixHeadroom(engine);
  this.engine = engine; this.volume = 1; this.muted = false; this.voices = new Set();
  this.input = engine.ctx.createGain();
  this.limiter = engine.ctx.createDynamicsCompressor();
  this.limiter.threshold.value = 0; this.limiter.knee.value = 4; this.limiter.ratio.value = 12;
  this.limiter.attack.value = .008; this.limiter.release.value = .18;
  this.out = engine.ctx.createGain(); this.out.gain.value = REED_AUDIO.gain;
  this.input.connect(this.limiter); this.limiter.connect(this.out); this.out.connect(engine.master);
  this.lastDuck = -Infinity;
 }
 play(traits, event, { position = { x: 0, y: 5, z: -20 }, listener = { x: 0, y: 11, z: 0 }, at = this.engine.now, offline = false } = {}) {
  const { engine } = this, ctx = engine.ctx;
  if (!REED_AUDIO.levels[event]) return false;
  if ((!offline && ctx.state !== 'running') || this.muted || this.volume <= 0 || this.voices.size >= REED_AUDIO.maxVoices) return false;
  const distance = Math.hypot(position.x - listener.x, position.y - listener.y, position.z - listener.z);
  if (distance > REED_AUDIO.range) return false;
  const pan = engine.makePanner(position); pan.refDistance = REED_AUDIO.refDistance; pan.rolloffFactor = REED_AUDIO.rolloff;
  const gain = ctx.createGain(); gain.gain.value = REED_AUDIO.levels[event];
  pan.connect(gain); gain.connect(this.input); this.out.gain.setValueAtTime(this.volume * REED_AUDIO.gain, ctx.currentTime); this.voices.add(pan);
  if (distance <= 55 && at - this.lastDuck > 5 && engine.layerBus.gain.value > REED_AUDIO.duck) { engine.duck(REED_AUDIO.duck, 5.5, at); this.lastDuck = at; }
  return playReedVoice(ctx, pan, traits, event, { at, onended: () => { pan.disconnect(); gain.disconnect(); this.voices.delete(pan); } });
 }
 setVolume(value) { this.volume = Math.max(0, Math.min(1.5, value)); this.out.gain.setTargetAtTime(this.muted ? 0 : this.volume * REED_AUDIO.gain, this.engine.now, .04); }
 dispose() { this.out.disconnect(); this.input.disconnect(); this.limiter.disconnect(); for (const pan of this.voices) pan.disconnect(); this.voices.clear(); }
}

// Install once on an engine that hosts Reed walkers. The production compressor
// controls loudness but is not a brick-wall limiter: coincident effects can
// overshoot. This leaves normal samples linear and softens only the top peaks.
export function ensureReedMixHeadroom(engine) {
 if (engine.reedPeakGuard) return;
 const guard = engine.ctx.createWaveShaper();
 guard.curve = Float32Array.from({ length: 8193 }, (_, i) => {
  const x = i / 4096 - 1, a = Math.abs(x);
  return a <= .75 ? x : Math.sign(x) * (.75 + .17 * Math.tanh((a - .75) / .17));
 });
 guard.oversample = '2x';
 engine.compressor.disconnect(engine.analyser); engine.compressor.connect(guard); guard.connect(engine.analyser);
 engine.reedPeakGuard = guard;
}
