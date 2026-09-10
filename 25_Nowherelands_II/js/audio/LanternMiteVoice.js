import { ensureReedMixHeadroom } from './ReedWalkerAudio.js?v=lantern-1';

// Shared timing for the physical voice and the visible light signal.
export function lanternNotes(mite, reply = false) {
 const size = Math.max(0.1, Math.min(0.15, mite.size ?? 0.12));
 const frequency = 820 * Math.pow(0.12 / size, 0.7) * (1 + ((mite.id ?? 0) - 2) * 0.023);
 const gap = 0.225 + ((mite.id ?? 0) % 3) * 0.023;
 return reply
  ? [{ at: 0, frequency: frequency * 1.13, duration: 0.3, level: 0.82 }]
  : [{ at: 0, frequency, duration: 0.2, level: 0.78 }, { at: gap, frequency: frequency * 1.24, duration: 0.28, level: 1 }];
}

export function lanternLight(age, mite, reply = false) {
 return Math.max(0, ...lanternNotes(mite, reply).map(note => {
  const t = age - note.at;
  if (t < 0 || t > note.duration) return 0;
  return note.level * Math.min(1, t / 0.025) * Math.exp(-Math.max(0, t - 0.025) / 0.085)
   * Math.min(1, (note.duration - t) / 0.03);
 }));
}

export function lanternSamples(mite, reply = false, sampleRate = 44100) {
 const notes = lanternNotes(mite, reply);
 const duration = Math.max(...notes.map(n => n.at + n.duration));
 const data = new Float32Array(Math.ceil((duration + 0.01) * sampleRate));
 let seed = 731 + (mite.id ?? 0) * 193, air = 0;
 for (const note of notes) {
  const start = Math.floor(note.at * sampleRate), length = Math.ceil(note.duration * sampleRate);
  for (let i = 0; i < length && start + i < data.length; i++) {
   const t = i / sampleRate;
   seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
   const noise = seed / 2147483648 - 1;
   air += (noise - air) * (1 - Math.exp(-2 * Math.PI * 2300 / sampleRate));
   // A soft hollow fundamental, short inharmonic wood-like modes, and a breath of air.
   const phase = 2 * Math.PI * note.frequency * (t - 0.035 * t * t / note.duration);
   const body = Math.sin(phase) * Math.exp(-t / 0.073)
    + Math.sin(phase * 2.47) * 0.27 * Math.exp(-t / 0.029)
    + Math.sin(phase * 4.13) * 0.075 * Math.exp(-t / 0.016)
    + air * 0.105 * Math.exp(-t / 0.065);
   const envelope = Math.min(1, t / 0.006) ** 2 * Math.min(1, (note.duration - t) / 0.025);
   data[start + i] += body * envelope * note.level * 0.73;
  }
 }
 return data;
}

// Nearby contact notes briefly get room in the ambient bed, like other fauna
// voices. Distant animals do not lower the landscape's sound.
export function lanternAmbientDip(engine, mite, reply, at, listener, scale = 1) {
 if (!listener || Math.hypot(mite.pos.x - listener.x, mite.pos.y - listener.y, mite.pos.z - listener.z) > 5 * scale) return;
 const notes = lanternNotes(mite, reply), duration = Math.max(...notes.map(n => n.at + n.duration));
 const gain = engine.layerBus.gain, level = Math.min(gain.value, 0.32);
 gain.cancelScheduledValues(at); gain.setValueAtTime(gain.value, at);
 gain.linearRampToValueAtTime(level, at + 0.025);
 gain.setValueAtTime(level, at + duration);
 gain.linearRampToValueAtTime(1, at + duration + 0.35);
}

export class LanternMiteAudio {
 constructor(engine, scale = 1) { ensureReedMixHeadroom(engine); this.engine = engine; this.scale = scale; this.voices = new Set(); this.buffers = new Map(); this.played = 0; }

 play(mite, reply = false, at = this.engine.now, listener = null) {
  if (this.voices.size >= 3) return false;
  const ctx = this.engine.ctx, key = `${mite.id}:${mite.size}:${reply}`;
  if (!this.buffers.has(key)) {
   if (this.buffers.size >= 64) this.buffers.delete(this.buffers.keys().next().value);
   const samples = lanternSamples(mite, reply, ctx.sampleRate);
   const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate); buffer.copyToChannel(samples, 0);
   this.buffers.set(key, buffer);
  }
  const source = ctx.createBufferSource(), gain = ctx.createGain(), panner = ctx.createPanner();
  source.buffer = this.buffers.get(key); gain.gain.value = 1.35;
  panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 2 * this.scale;
  panner.rolloffFactor = 1.5; panner.maxDistance = 40 * this.scale;
  this.engine.setPannerPosition(panner, mite.pos);
  source.connect(gain); gain.connect(panner); panner.connect(this.engine.master);
  const voice = { source, gain, panner, colonyId: mite.colonyId }; this.voices.add(voice); this.played++;
  lanternAmbientDip(this.engine, mite, reply, at, listener, this.scale);
  source.onended = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); this.voices.delete(voice); };
  source.start(at);
  return true;
 }

 silence(colonyId = null) {
  const now = this.engine.now;
  for (const voice of this.voices) {
   if (colonyId !== null && voice.colonyId !== colonyId) continue;
   voice.gain.gain.cancelScheduledValues(now);
   voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
   voice.gain.gain.linearRampToValueAtTime(0, now + 0.012);
   voice.source.stop(now + 0.015);
   this.voices.delete(voice);
  }
 }
 dispose() { this.silence(); this.buffers.clear(); }
}
