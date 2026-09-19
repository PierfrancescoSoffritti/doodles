import { damp, smoothstep } from '../core/Utils.js';
import { fallFaceRun, RIVER_STRIDE as S, RV } from '../world/gen/Rivers.js';

// Two audible falls plus a spare voice for transitions. A voice stays at its
// waterfall until silent, so switching neighbours never sweeps a roar across you.
export class WaterfallAmbience {
	constructor(engine, rivers) {
		this.engine = engine;
		this.timer = 0;
		this.falls = rivers.flatMap(r => r.falls.map(f => {
			const area = Math.sqrt(f.w * f.drop), size = area / (area + 40);
			// The generated lip sample carries the same hydraulic speed used by the water.
			const speed = Math.max(0, r.data?.[f.i * S + RV.SPEED] ?? 3);
			const flow = speed / (speed + 2);
			const run = fallFaceRun(f.drop) * 0.75;
			return {
				x: f.x + f.dx * run, y: f.bottom + f.drop * 0.25, z: f.z + f.dz * run,
				radius: (100 + size * 260) * (0.65 + flow * 0.6), refDistance: 18 + size * 32,
				level: (0.035 + size * 0.17) * flow, seed: f.seed, speed,
				bodyCutoff: 350 + flow * 650, sprayCutoff: 1600 + flow * 1700,
				sprayGain: 0.1 + flow * 0.25,
			};
		}));
		this.voices = Array.from({ length: 3 }, () => {
			const panner = engine.makePanner({ x: 0, y: 0, z: 0 });
			panner.rolloffFactor = 1.5;
			panner.connect(engine.layerBus);
			const out = engine.ctx.createGain(); out.gain.value = 0; out.connect(panner);
			// The original wind's low rush and brighter spray, now located in the world.
			const body = engine.createNoise({ dest: out, cutoff: 500, q: 0.7, gain: 1 });
			const spray = engine.createNoise({ dest: out, cutoff: 2600, q: 2.5, gain: 0.25 });
			return { panner, out, body, spray, fall: null, level: 0, target: 0 };
		});
	}

	update(dt, shared) {
		const now = this.engine.now, p = shared.camera.position;
		this.timer -= dt;
		if (this.timer <= 0) {
			this.timer = 0.4;
			const exposure = 1 - smoothstep(0.08, 0.45, shared.caveAmount || 0);
			const choices = this.falls.map(fall => {
				const distance = Math.hypot(fall.x - p.x, fall.y - p.y, fall.z - p.z);
				const target = fall.level * exposure * (1 - smoothstep(fall.radius * 0.55, fall.radius, distance));
				const attenuation = fall.refDistance / (fall.refDistance + 1.5 * Math.max(0, distance - fall.refDistance));
				// Slight preference for current sources prevents chatter between equally loud falls.
				const retained = this.voices.some(v => v.fall === fall && v.target > 0);
				return { fall, target, score: target * attenuation * (retained ? 1.15 : 1) };
			}).filter(c => c.target > 0).sort((a, b) => b.score - a.score).slice(0, 2);
			for (const voice of this.voices) voice.target = 0;
			for (const choice of choices) {
				let voice = this.voices.find(v => v.fall === choice.fall);
				if (!voice) {
					voice = this.voices.find(v => v.level < 0.00001 && v.target === 0 && !choices.some(c => c.fall === v.fall));
					if (!voice) continue;
					voice.out.gain.cancelScheduledValues(now);
					voice.out.gain.setValueAtTime(0, now);
					voice.level = 0; voice.fall = choice.fall;
					voice.panner.refDistance = choice.fall.refDistance;
					this.engine.setPannerPosition(voice.panner, choice.fall);
					voice.body.filter.frequency.setTargetAtTime(choice.fall.bodyCutoff, now, 0.3);
					voice.spray.filter.frequency.setTargetAtTime(choice.fall.sprayCutoff, now, 0.3);
					voice.spray.gain.gain.setTargetAtTime(choice.fall.sprayGain, now, 0.3);
				}
				voice.target = choice.target;
			}
		}
		for (const voice of this.voices) {
			voice.level = damp(voice.level, voice.target, 3, dt);
			const phase = voice.fall?.seed || 0;
			const swell = 0.9 + 0.1 * Math.sin(now * 0.7 + phase) * Math.sin(now * 0.23 + phase);
			voice.out.gain.setTargetAtTime(voice.level * swell, now, 0.1);
		}
	}
}
