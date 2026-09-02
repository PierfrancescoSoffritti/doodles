import { Layer } from './Layer.js';

// Markov-chain melody: mostly stepwise motion with the occasional leap, gated by density.
export class Arpeggio extends Layer {
	constructor(engine, scale) {
		super(engine, 'arpeggio', { level: 0.9 });
		this.degree = scale.length;
		this.range = scale.length * 2;
		this.lastStep = -1;
	}

	next(scale) {
		const r = Math.random();
		let d = this.degree;
		if (r < 0.34) d += 1;
		else if (r < 0.66) d -= 1;
		else if (r < 0.78) d += 2;
		else if (r < 0.88) d -= 2;
		else if (r < 0.94) d += scale.length === 5 ? 3 : 4;
		else d -= scale.length === 5 ? 3 : 4;
		if (d < 0) d = Math.abs(d) + 1;
		if (d > this.range) d = this.range - (d - this.range) - 1;
		this.degree = d;
		return d;
	}

	onStep(step, time, dur, scale, p) {
		const onBeat = step % 2 === 0;
		const prob = p.density * (onBeat ? 1 : 0.55);
		if (Math.random() > prob || this.current < 0.02) return;
		const degree = this.next(scale);
		const long = Math.random() < 0.25;
		this.engine.playTone({
			freq: scale.freq(degree, 0), time,
			duration: dur * (long ? 2.2 : 0.7), velocity: 0.16 + Math.random() * 0.1 + p.brightness * 0.06,
			type: 'triangle', detune: 5, attack: 0.02, release: 0.9 + p.brightness * 0.6,
			cutoff: 900 + p.cutoff * 1.3, cutoffEnv: 2.5, reverb: 0.6, delay: 0.35, dest: this.out, layer: 'arpeggio', octaveLayer: 0.25,
		});
	}
}
