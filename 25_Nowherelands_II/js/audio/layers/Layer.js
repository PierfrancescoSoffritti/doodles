import { damp } from '../../core/Utils.js';

export class Layer {
	constructor(engine, name, { unlocked = false, level = 1 } = {}) {
		this.engine = engine;
		this.name = name;
		this.unlocked = unlocked;
		this.level = level;          // designed loudness
		this.multiplier = 1;         // conductor-driven (stillness, events)
		this.current = 0;
		this.out = engine.createLayerGain(0);
	}
	unlock() { this.unlocked = true; }
	get target() { return this.unlocked ? this.level * this.multiplier : 0; }
	update(dt, params) {
		this.current = damp(this.current, this.target, 0.8, dt);
		this.out.gain.setTargetAtTime(this.current, this.engine.now, 0.1);
	}
	onStep(step, time, dur, scale, params) {}
	onKeyChange(scale, time) {}
}
