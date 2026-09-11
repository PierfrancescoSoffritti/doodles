// A voiced membrane: rounded harmonics, a little beating in the upper partials,
// and two slow breath swells. No sawtooth buzz or sub-bass-only fundamental.
export const RAY_PHRASES = {
 contact: { duration: 5.2, attack: 0.34, release: 1.25 },
 acknowledgment: { duration: 2.6, attack: 0.2, release: 0.72 },
};
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
export function rayEnvelope(time, phrase = 'contact') {
 const spec = RAY_PHRASES[phrase] || RAY_PHRASES.contact;
 if (time <= 0 || time >= spec.duration) return 0;
 const body = 0.86 + 0.14 * Math.sin(Math.PI * time / spec.duration) ** 2;
 const breath = 1 - 0.14 * Math.exp(-(((time / spec.duration - 0.54) / 0.12) ** 2));
 return smooth(time / spec.attack) * smooth((spec.duration - time) / spec.release) * body * breath;
}

export function synthesizeVeilRay({ sampleRate = 44100, frequency = 180, phrase = 'contact', size = 1, identity = 0 } = {}) {
 const spec = RAY_PHRASES[phrase] || RAY_PHRASES.contact;
 const samples = new Float32Array(Math.ceil(spec.duration * sampleRate));
 const hz = Math.max(120, Math.min(420, frequency / Math.max(0.7, size) ** 0.22));
 let phase = 0, shimmer = 0, noise = 0, random = 917 + Math.floor(Math.abs(identity) * 997), peak = 0;
 for (let i = 0; i < samples.length; i++) {
  const t = i / sampleRate, u = t / spec.duration;
  const pitch = phrase === 'acknowledgment'
   ? 0.96 + 0.13 * smooth(u / 0.48) - 0.035 * smooth((u - 0.65) / 0.35)
   : 0.94 + 0.06 * smooth(u / 0.24) - 0.045 * smooth((u - 0.62) / 0.38);
  const vibrato = 1 + 0.0022 * Math.sin(t * Math.PI * 2 * 3.6 + identity) * smooth(t / 0.8);
  phase += Math.PI * 2 * hz * pitch * vibrato / sampleRate;
  shimmer += Math.PI * 2 * hz * pitch * 2.006 / sampleRate;
  const opening = Math.sin(Math.PI * u) ** 2;
  // The upper body opens gently while the fundamental keeps the sound rounded.
  const tone = Math.sin(phase) * 0.6 + Math.sin(phase * 2) * (0.24 + opening * 0.08)
   + Math.sin(phase * 3) * 0.14 + Math.sin(phase * 4) * 0.035 + Math.sin(phase * 5) * 0.025
   + Math.sin(shimmer + 0.5) * 0.045;
  random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
  noise += ((random / 2147483648 - 1) - noise) * 0.12;
  const value = (tone + noise * 0.018) * rayEnvelope(t, phrase);
  samples[i] = value; peak = Math.max(peak, Math.abs(value));
 }
 const gain = 0.82 / Math.max(peak, 0.001);
 for (let i = 0; i < samples.length; i++) samples[i] *= gain;
 return samples;
}
