import { Layer } from './Layer.js';

export class Bass extends Layer {
	constructor(engine) { super(engine, 'bass', { level: 0.9 }); this.bar = 0; }

	onStep(step, time, dur, scale, p) {
		if (step % 8 !== 0 || this.current < 0.02) return;
		this.bar++;
		const root = scale.chordRoot || 0;
		const degree = this.bar % 4 === 3 ? root + (scale.length === 5 ? 3 : 4) : (this.bar % 4 === 2 && Math.random() < 0.4 ? root + (scale.length === 5 ? 1 : 2) : root);
		this.engine.playTone({
			freq: scale.freq(degree, -2), time,
			duration: dur * 5.5, velocity: 0.42, type: 'sine', voices: 1, attack: 0.35, release: 1.4,
			cutoff: 220, cutoffEnv: 1.2, reverb: 0.15, dest: this.out, layer: 'bass',
		});
		// a faint saw an octave up for definition
		this.engine.playTone({
			freq: scale.freq(degree, -1), time,
			duration: dur * 5, velocity: 0.07, type: 'sawtooth', voices: 2, detune: 4, attack: 0.5, release: 1.2,
			cutoff: 260, reverb: 0.3, dest: this.out, layer: 'bass',
		});
	}
}
