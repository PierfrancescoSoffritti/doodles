import { RIVER_STRIDE as S, RV } from '../world/gen/Rivers.js';

// Three reusable spatial voices; changes crossfade and run through the existing ducked
// ambient bus. No sound starts before the normal Enter gesture creates the audio engine.
export class WatersideAmbience {
	constructor(engine, hm, features) {
		this.engine = engine; this.hm = hm; this.features = features; this.timer = 0;
		this.voices = [420, 1800, 3900].map(cutoff => {
			const panner = engine.makePanner({ x: 0, y: 0, z: 0 }); panner.refDistance = 24; panner.rolloffFactor = 1.5; panner.connect(engine.layerBus);
			return { ...engine.createNoise({ dest: panner, cutoff, q: 0.6, gain: 0 }), panner, amount: 0, position: null };
		});
	}
	update(dt, shared) {
		this.timer -= dt;
		const p = shared.camera.position;
		if (this.timer <= 0) {
			this.timer = 0.4;
			const choices = [null, null, null], scores = [0, 0, 0];
			for (const index of this.hm.rivers.segmentsIn(p.x - 170, p.z - 170, p.x + 170, p.z + 170)) {
				const s = this.hm.rivers.at(index, 0.5), r = this.hm.world.rivers[this.hm.rivers.segRiver[index]], speed = r.data[this.hm.rivers.segIndex[index] * S + RV.SPEED];
				const dist = Math.hypot(s.x - p.x, s.z - p.z, s.wl - p.y), strength = 1 / (1 + dist * dist / 1600);
				for (let j = 0; j < 2; j++) {
					const energy = j === 0 ? Math.min(1, speed / 9) * (0.25 + 0.75 * s.foam) : Math.min(1, speed / 3) * (0.3 + 0.7 * s.foam);
					if (strength * energy > scores[j]) { scores[j] = strength * energy; choices[j] = { x: s.x, y: s.wl, z: s.z, energy }; }
				}
				if (s.foam < 0.2 && s.wl < 600 && strength > scores[2]) { scores[2] = strength; choices[2] = { x: s.x - s.dz / (Math.hypot(s.dx, s.dz) || 1) * s.w * 0.6, y: s.wl + 3, z: s.z + s.dx / (Math.hypot(s.dx, s.dz) || 1) * s.w * 0.6, energy: 0.25 }; }
			}
			for (const shore of this.features.query(this.features.shoreCells, p.x - 100, p.z - 100, p.x + 100, p.z + 100)) {
				const score = 0.3 / (1 + Math.hypot(shore.x - p.x, shore.z - p.z) / 30);
				if (score > scores[1]) { scores[1] = score; choices[1] = { x: shore.x, y: shore.level, z: shore.z, energy: 0.18 + shore.fetch * 0.2 }; }
				if (score > scores[2] && shore.fetch < 0.6) { scores[2] = score; choices[2] = { x: shore.x, y: shore.level + 3, z: shore.z, energy: 0.3 }; }
			}
			this.voices.forEach((voice, j) => {
				voice.amount = choices[j] ? choices[j].energy * [0.14, 0.055, 0.028][j] : 0;
				if (choices[j]) { const target = choices[j], now = this.engine.now; for (const axis of ['x', 'y', 'z']) voice.panner['position' + axis.toUpperCase()].setTargetAtTime(target[axis], now, 0.35); }
			});
		}
		const t = this.engine.now;
		this.voices.forEach((voice, i) => {
			const swell = 0.75 + 0.25 * Math.sin(t * [0.8, 2.1, 0.45][i] + i) * Math.sin(t * 0.37);
			voice.gain.gain.setTargetAtTime(voice.amount * swell, t, 0.25);
		});
	}
}
