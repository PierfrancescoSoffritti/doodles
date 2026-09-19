import { RIVER_STRIDE as S, RV, RIVER_KIND } from '../world/gen/Rivers.js';
import { clamp01, smoothstep } from '../core/Utils.js';
import { WaterfallAmbience } from './WaterfallAmbience.js?v=waterfall-audio-2';

// Fast water has its own rush even without visible foam. The response keeps
// increasing beyond ordinary river speeds instead of clipping at 3 units/second.
export function riverSound(speed, width, foam) {
	const flow = Math.max(0, speed) / (Math.max(0, speed) + 4);
	const rush = flow * flow, size = Math.max(0, width) / (Math.max(0, width) + 30);
	const aeration = clamp01(foam), body = (0.6 + size * 0.4) * (0.75 + aeration * 0.25);
	return {
		energy: [(flow * 0.15 + rush * 2.4) * body, (flow * 0.1 + rush * 2.8) * (0.6 + aeration * 0.4)],
		cutoff: [350 + flow * 900, 1200 + flow * 2200],
	};
}

// Three reusable spatial voices; changes crossfade and run through the existing ducked
// ambient bus. No sound starts before the normal Enter gesture creates the audio engine.
export class WatersideAmbience {
	constructor(engine, hm, features) {
		this.engine = engine; this.hm = hm; this.features = features; this.timer = 0;
		this.waterfalls = new WaterfallAmbience(engine, hm.world.rivers);
		this.voices = [420, 1800, 3900].map(cutoff => {
			const panner = engine.makePanner({ x: 0, y: 0, z: 0 }); panner.refDistance = 24; panner.rolloffFactor = 1.5; panner.connect(engine.layerBus);
			return { ...engine.createNoise({ dest: panner, cutoff, q: 0.6, gain: 0 }), panner, amount: 0, position: null };
		});
	}
	update(dt, shared) {
		this.waterfalls.update(dt, shared);
		this.timer -= dt;
		const p = shared.camera.position;
		if (this.timer <= 0) {
			this.timer = 0.4;
			const choices = [null, null, null], scores = [0, 0, 0];
			for (const index of this.hm.rivers.segmentsIn(p.x - 170, p.z - 170, p.x + 170, p.z + 170)) {
				const r = this.hm.world.rivers[this.hm.rivers.segRiver[index]], d = r.data, a = this.hm.rivers.segIndex[index] * S, b = a + S;
				if (d[a + RV.KIND] === RIVER_KIND.LIP) continue; // the dedicated fall voice covers this gap
				// Locate the sound at the nearest part of the reach, including long segments.
				const dx = d[b + RV.X] - d[a + RV.X], dz = d[b + RV.Z] - d[a + RV.Z];
				const along = clamp01(((p.x - d[a + RV.X]) * dx + (p.z - d[a + RV.Z]) * dz) / (dx * dx + dz * dz || 1));
				const s = this.hm.rivers.at(index, along);
				const speed = d[a + RV.SPEED] + (d[b + RV.SPEED] - d[a + RV.SPEED]) * along;
				const fade = d[a + RV.FADE] + (d[b + RV.FADE] - d[a + RV.FADE]) * along;
				const dist = Math.hypot(s.x - p.x, s.z - p.z, s.wl - p.y), strength = 1 / (1 + dist * dist / 1600);
				const profile = riverSound(speed, s.w, s.foam), reach = (1 - smoothstep(100, 170, dist)) * (1 - clamp01(fade));
				for (let j = 0; j < 2; j++) {
					const energy = profile.energy[j] * reach;
					if (strength * energy > scores[j]) { scores[j] = strength * energy; choices[j] = { x: s.x, y: s.wl, z: s.z, energy, cutoff: profile.cutoff[j] }; }
				}
				if (s.foam < 0.2 && s.wl < 600 && strength > scores[2]) { scores[2] = strength; choices[2] = { x: s.x - s.dz / (Math.hypot(s.dx, s.dz) || 1) * s.w * 0.6, y: s.wl + 3, z: s.z + s.dx / (Math.hypot(s.dx, s.dz) || 1) * s.w * 0.6, energy: 0.25 }; }
			}
			for (const shore of this.features.query(this.features.shoreCells, p.x - 100, p.z - 100, p.x + 100, p.z + 100)) {
				const score = 0.3 / (1 + Math.hypot(shore.x - p.x, shore.z - p.z) / 30);
				if (score > scores[1]) { scores[1] = score; choices[1] = { x: shore.x, y: shore.level, z: shore.z, energy: 0.18 + shore.fetch * 0.2 }; }
				if (score > scores[2] && shore.fetch < 0.6) { scores[2] = score; choices[2] = { x: shore.x, y: shore.level + 3, z: shore.z, energy: 0.3 }; }
			}
			if(shared.caveAmount>.4) {
				choices.fill(null);
				const q=shared.caveColumn;
				if(q && q.water>-1e5) {choices[0]={x:p.x,y:q.water,z:p.z,energy:.48};choices[1]={x:p.x+4,y:q.water,z:p.z+4,energy:.32};}
			}
			this.voices.forEach((voice, j) => {
				voice.amount = choices[j] ? choices[j].energy * [0.14, 0.055, 0.028][j] : 0;
				voice.filter.frequency.setTargetAtTime(choices[j]?.cutoff ?? [420, 1800, 3900][j], this.engine.now, 0.35);
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
