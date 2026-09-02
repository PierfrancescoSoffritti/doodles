import { Layer } from './Layer.js';

export class Bells extends Layer {
	constructor(engine) { super(engine, 'bells', { level: 0.85 }); }

	onStep(step, time, dur, scale, p) {
		if (this.current < 0.02) return;
		// raindrop notes: soft, high, scattered
		if (p.rain > 0.05 && Math.random() < p.rain * 0.5) {
			const degree = Math.floor(Math.random() * scale.length * 2);
			this.engine.playTone({ freq: scale.freq(degree, 2), time, duration: 0.03, velocity: 0.05 + Math.random() * 0.06, type: 'sine', voices: 1, attack: 0.003, release: 0.5 + Math.random() * 0.4, cutoff: 5000, reverb: 0.9, delay: 0.3, dest: this.out, layer: 'raindrop' });
		}
		// snow glitter: slow, glassy high tones drifting in and out
		if (p.snow > 0.1 && Math.random() < p.snow * 0.18) {
			const chord = scale.chordDegrees();
			const degree = chord[Math.floor(Math.random() * chord.length)] + (Math.random() < 0.5 ? 0 : scale.length);
			this.engine.playTone({ freq: scale.freq(degree, 2), time, duration: 0.8 + Math.random() * 1.2, velocity: 0.05 + Math.random() * 0.05, type: 'sine', voices: 2, detune: 10, attack: 0.5, release: 2.5, cutoff: 6000, reverb: 1, delay: 0.4, dest: this.out, layer: 'snowglitter' });
		}
		const bar = step % 8;
		const chance = bar === 0 ? 0.55 : (bar === 4 ? 0.3 : 0.08);
		if (Math.random() > chance * (0.6 + p.density)) return;
		const chord = scale.chordDegrees();
		const degree = chord[Math.floor(Math.random() * chord.length)];
		const octave = 2 + (Math.random() < 0.3 ? 1 : 0);
		this.engine.playBell({
			freq: scale.freq(degree, octave), time,
			velocity: 0.09 + Math.random() * 0.08, ratio: Math.random() < 0.5 ? 3.01 : 2.0, index: 1.6 + p.brightness * 1.5,
			decay: 4 + Math.random() * 3, dest: this.out, layer: 'bells',
		});
	}
}
