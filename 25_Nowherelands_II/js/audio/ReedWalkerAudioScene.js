import { AudioEngine } from './AudioEngine.js?v=pebble-audio-10';
import { Conductor } from './Conductor.js?v=pebble-audio-10';
import { WatersideAmbience } from './WatersideAmbience.js';
import { RIVER_STRIDE, RV } from '../world/gen/Rivers.js';
import { ReedWalkerAudio } from './ReedWalkerAudio.js?v=reed-7';

// The real mixer and layer constructors, driven by repeatable representative
// river conditions. It is a listening fixture, not a running world simulation.
export function createReedAudioScene(ctx, { background = 'river', startup = false } = {}) {
 let seed = 17; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
 const engine = new AudioEngine(ctx, random), conductor = new Conductor(engine), audio = new ReedWalkerAudio(engine);
 if (startup) engine.master.gain.setTargetAtTime(.9, 0, 1.5); else engine.master.gain.value = .9;
 const listener = { x: 0, y: 11, z: 0 }; engine.updateListener(listener, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 });
 const busy = background === 'busy', solo = background === 'solo', { layers, scale } = conductor;
 layers.drone.out.gain.value = solo ? 0 : busy ? .18 : .12;
 layers.wind.out.gain.value = solo ? 0 : busy ? .12 : .055;
 layers.rain.out.gain.value = busy ? .2 : 0;
 layers.arpeggio.out.gain.value = busy ? .8 : 0;
 layers.bells.out.gain.value = busy ? .7 : 0;
 const data = new Float32Array(RIVER_STRIDE); data[RV.SPEED] = busy ? 5 : 1.8;
 const hm = { rivers: { segmentsIn: () => [0], segRiver: [0], segIndex: [0], at: () => ({ x: 5, z: -9, wl: 0, foam: busy ? .4 : .06, dx: 1, dz: 0, w: 14 }) }, world: { rivers: [{ data }] } };
 const water = new WatersideAmbience(engine, hm, { query: () => [] });
 water.update(1, { camera: { position: listener }, caveAmount: 0 });
 if (solo) for (const voice of water.voices) { voice.gain.gain.cancelScheduledValues(0); voice.gain.gain.value = 0; }
 function phrase(at) {
  if (!busy) return;
  // Fixed pitches and attacks use the same production voice recipes as the
  // arpeggio/bell layers, so comparison runs have identical musical masking.
  [0, 2, 4, 1, 3, 0].forEach((degree, i) => engine.playTone({ freq: scale.freq(degree, 0), time: at + i * .72, duration: .35, velocity: .2, type: 'triangle', detune: 5, attack: .02, release: 1.1, cutoff: 1700, cutoffEnv: 2.5, reverb: .6, delay: .35, dest: layers.arpeggio.out, layer: 'arpeggio', octaveLayer: .25 }));
  engine.playBell({ freq: scale.freq(2, 1), time: at + 1, velocity: .1, decay: 3, dest: layers.bells.out, reverb: .6, delay: .2 });
 }
 return { engine, conductor, audio, listener, phrase,
  dispose() { audio.dispose(); conductor.dispose(); engine.offNote?.(); if (ctx.close) return ctx.close().catch(() => {}); },
 };
}
