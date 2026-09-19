import { Layer } from './Layer.js';
import { damp, smoothstep } from '../../core/Utils.js';

export class Wind extends Layer {
	constructor(engine) {
		super(engine, 'wind', { unlocked: true, level: 1 });
		this.noise = engine.createNoise({ dest: this.out, cutoff: 500, q: 0.7, gain: 1 });
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
		// Calm air is silent. Movement and looking around no longer add a hiss;
		// the broad rushing texture now belongs to nearby waterfalls.
		const wanted = smoothstep(0.3, 1.2, p.wind || 0) * 0.016 + (p.storm || 0) * 0.045;
		this.amount = damp(this.amount, wanted, 0.6, dt);
		this.level = this.amount;
		super.update(dt, p);
	}
}
