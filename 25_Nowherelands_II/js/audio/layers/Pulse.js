import { Layer } from './Layer.js';
import { damp } from '../../core/Utils.js';

// A heartbeat that only exists while you move: soft kick on the beat, ticks between, louder the faster you go.
export class Pulse extends Layer {
	constructor(engine) {
		super(engine, 'pulse', { unlocked: true, level: 0.8 });
		this.speed = 0;
	}

	onStep(step, time, dur, scale, p) {
		if (this.current < 0.02) return;
		const e = this.engine;
		const s = this.speed;
		if (step % 4 === 0) {
			e.playKick({ time, velocity: 0.35 + s * 0.35, dest: this.out, freq: scale.freq(0, -3) });
		} else if (step % 2 === 0 && s > 0.6) {
			e.playKick({ time, velocity: 0.12 + s * 0.15, dest: this.out, freq: scale.freq(0, -3) * 1.5, decay: 0.12 });
		}
		if (step % 2 === 1 && Math.random() < 0.35 + s * 0.6) {
			e.playNoiseBurst({ time, velocity: 0.05 + s * 0.12, cutoff: 3500 + s * 4000, duration: 0.05 + s * 0.05, dest: this.out });
		}
	}

	update(dt, p) {
		this.speed = damp(this.speed, p.speed, 3, dt);
		this.multiplier = Math.min(1, this.speed * 1.6) * (1 - p.still);
		super.update(dt, p);
	}
}
