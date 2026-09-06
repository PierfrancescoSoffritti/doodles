import { Layer } from './Layer.js';
import { damp } from '../../core/Utils.js';

// Rain you can hear: a soft hiss with a slowly breathing filter and scattered drop ticks.
export class RainLayer extends Layer {
	constructor(engine) {
		super(engine, 'rain', { unlocked: true, level: 1 });
		this.hiss = engine.createNoise({ dest: this.out, cutoff: 1400, q: 0.5, gain: 0.5 });
		this.patter = engine.createNoise({ dest: this.out, cutoff: 4200, q: 1.2, gain: 0.25 });
		this.amount = 0;
		this.dropTimer = 0;
	}

	update(dt, p) {
		this.amount = damp(this.amount, p.rain, 0.8, dt);
		this.level = this.amount * (0.16 + (p.storm || 0) * 0.22) + (p.hail || 0) * 0.12;
		const t = this.engine.now;
		this.hiss.filter.frequency.setTargetAtTime(900 + 700 * Math.sin(t * 0.13) + p.look * 600, t, 0.5);
		if (this.amount > 0.05) {
			this.dropTimer -= dt;
			if (this.dropTimer <= 0) {
				this.dropTimer = 0.03 + Math.random() * 0.16 / this.amount;
				this.engine.playNoiseBurst({ velocity: 0.02 + Math.random() * 0.05 * this.amount + (p.hail || 0) * 0.13, cutoff: p.hail > 0.1 ? 1200 + Math.random() * 1600 : 3000 + Math.random() * 5000, duration: 0.012 + Math.random() * 0.02, dest: this.out });
			}
		}
		super.update(dt, p);
	}
}
