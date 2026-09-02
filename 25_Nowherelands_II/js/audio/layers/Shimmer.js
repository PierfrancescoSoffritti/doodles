import { Layer } from './Layer.js';
import { damp } from '../../core/Utils.js';

// High detuned sine cluster with a tremolo whose rate follows the wanderer's proximity.
export class Shimmer extends Layer {
	constructor(engine, scale) {
		super(engine, 'shimmer', { level: 0.5 });
		const ctx = engine.ctx;
		this.trem = ctx.createGain();
		this.trem.gain.value = 0.6;
		this.lfo = ctx.createOscillator();
		this.lfo.frequency.value = 3;
		this.lfoGain = ctx.createGain();
		this.lfoGain.gain.value = 0.4;
		this.lfo.connect(this.lfoGain);
		this.lfoGain.connect(this.trem.gain);
		this.lfo.start();
		engine.route(this.trem, { dest: this.out, reverb: 0.9, delay: 0.3 });

		this.oscs = [];
		const chord = scale.chordDegrees();
		chord.forEach((degree, i) => {
			for (const det of [-9, 9]) {
				const o = ctx.createOscillator();
				o.type = 'sine';
				o.frequency.value = scale.freq(degree, 2);
				o.detune.value = det + i * 2;
				const g = ctx.createGain();
				g.gain.value = 0.16;
				o.connect(g); g.connect(this.trem);
				o.start();
				this.oscs.push({ o, degree });
			}
		});
		this.proximity = 0;
	}

	onKeyChange(scale, time) {
		const chord = scale.chordDegrees();
		this.oscs.forEach(({ o }, i) => {
			const degree = chord[Math.floor(i / 2) % chord.length];
			o.frequency.cancelScheduledValues(time);
			o.frequency.setValueAtTime(o.frequency.value, time);
			o.frequency.exponentialRampToValueAtTime(scale.freq(degree, 2), time + 3);
		});
	}

	update(dt, p) {
		this.proximity = damp(this.proximity, p.wandererProximity, 1.5, dt);
		this.multiplier = 0.25 + this.proximity * 1.2 + p.snow * 0.7;
		this.lfo.frequency.setTargetAtTime(1.5 + this.proximity * 9, this.engine.now, 0.3);
		super.update(dt, p);
	}
}
