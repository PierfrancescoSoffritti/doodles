import { Layer } from './Layer.js';
import { damp } from '../../core/Utils.js';

export class Wind extends Layer {
	constructor(engine) {
		super(engine, 'wind', { unlocked: true, level: 1 });
		this.noise = engine.createNoise({ dest: this.out, cutoff: 500, q: 0.7, gain: 1 });
		this.noise2 = engine.createNoise({ dest: this.out, cutoff: 2600, q: 2.5, gain: 0.25 });
		this.snowMuffle = 0;
		this.cutoff = 500;
		this.targetCutoff = 500;
		this.timer = 0;
		this.amount = 0;
	}

	update(dt, p) {
		this.timer -= dt;
		if (this.timer <= 0) { this.targetCutoff = p.snow > 0.3 ? 160 + Math.random() * 220 : 250 + Math.random() * 900; this.timer = 4 + Math.random() * 8; }
		this.cutoff = damp(this.cutoff, this.targetCutoff, 0.3, dt);
		this.noise.filter.frequency.setTargetAtTime(this.cutoff + (p.storm || 0) * 600, this.engine.now, 0.3);
		this.noise2.gain.gain.setTargetAtTime(0.25 * (1 - p.snow * 0.9), this.engine.now, 0.5);
		// snow: a slow, low swell of air rather than a hiss
		const swell = 0.5 + 0.5 * Math.sin(this.engine.now * 0.09) * Math.sin(this.engine.now * 0.031 + 1.0);
		const wanted = 0.02 + (p.wind || 0) * 0.045 + (p.storm || 0) * 0.1 + p.snow * (0.025 + 0.045 * swell) + p.speed * 0.05 + p.altitude * 0.04 + p.turn * 0.16 + p.wading * 0.12;
		this.targetCutoff = p.wading > 0.5 ? 220 : this.targetCutoff;
		this.amount = damp(this.amount, wanted, 0.6, dt);
		this.level = this.amount;
		super.update(dt, p);
	}
}
