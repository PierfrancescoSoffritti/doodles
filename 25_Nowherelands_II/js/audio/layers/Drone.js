import { Layer } from './Layer.js';
import { damp } from '../../core/Utils.js';

// The ever-present pad. Each voice is a crossfaded pair of oscillators so it never sweeps:
// on a chord or key change every voice moves to the nearest tone of the new chord.
// Voices breathe on their own slow cycles, so the drone is always in slow motion.
const VOICES = [
	{ type: 'sawtooth', gain: 0.32, octave: -1, detune: -5, breathe: 0.041 },
	{ type: 'sawtooth', gain: 0.32, octave: -1, detune: 5, breathe: 0.053 },
	{ type: 'triangle', gain: 0.55, octave: -2, detune: 0, breathe: 0.023 },
	{ type: 'sawtooth', gain: 0.22, octave: 0, detune: 3, breathe: 0.067 },
	{ type: 'sine', gain: 0.3, octave: 0, detune: -3, breathe: 0.031 },
	{ type: 'triangle', gain: 0.18, octave: 1, detune: 7, breathe: 0.079 },
];

export class Drone extends Layer {
	constructor(engine, scale) {
		super(engine, 'drone', { unlocked: true, level: 0.12 });
		const ctx = engine.ctx;
		this.scale = scale;
		this.chord = [0, 2, 4];   // degrees relative to the tonic
		this.octaveShift = 1;

		this.filter = ctx.createBiquadFilter();
		this.filter.type = 'lowpass';
		this.filter.frequency.value = 500;
		this.filter.Q.value = 0.9;
		// The reverb must follow the drone's layer level, including silence.
  this.filter.connect(this.out);
  this.reverbSend=ctx.createGain();this.reverbSend.gain.value=.55;
  this.out.connect(this.reverbSend);this.reverbSend.connect(engine.reverb);

		this.lfo = ctx.createOscillator();
		this.lfo.frequency.value = 0.045;
		this.lfoGain = ctx.createGain();
		this.lfoGain.gain.value = 140;
		this.lfo.connect(this.lfoGain);
		this.lfoGain.connect(this.filter.frequency);
		this.lfo.start();

		this.wobble = ctx.createOscillator();
		this.wobble.frequency.value = 0.31;
		this.wobbleGain = ctx.createGain();
		this.wobbleGain.gain.value = 0;
		this.wobble.connect(this.wobbleGain);
		this.wobble.start();

		this.voices = VOICES.map((cfg, i) => {
			const breath = ctx.createGain();
			breath.gain.value = cfg.gain;
			breath.connect(this.filter);
			const lfo = ctx.createOscillator();
			lfo.frequency.value = cfg.breathe;
			const lfoGain = ctx.createGain();
			lfoGain.gain.value = cfg.gain * 0.35;
			lfo.connect(lfoGain);
			lfoGain.connect(breath.gain);
			lfo.start(ctx.currentTime + i * 0.7);
			const voice = { cfg, breath, degree: this.chord[i % this.chord.length], freq: 0, osc: null, oscGain: null };
			voice.freq = this.targetFreq(voice, voice.degree);
			this.spawnOsc(voice, voice.freq, ctx.currentTime, 0.01);
			return voice;
		});
		this.cutoff = 500;
	}

	targetFreq(voice, degree) { return this.scale.freq(degree, voice.cfg.octave) * this.octaveShift; }

	spawnOsc(voice, freq, time, fade) {
		const ctx = this.engine.ctx;
		const osc = ctx.createOscillator();
		osc.type = voice.cfg.type;
		osc.frequency.value = freq;
		osc.detune.value = voice.cfg.detune;
		this.wobbleGain.connect(osc.detune);
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, time);
		g.gain.exponentialRampToValueAtTime(1, time + fade);
		osc.connect(g);
		g.connect(voice.breath);
		osc.start(time);
		if (voice.osc) {
			const old = voice.osc, oldGain = voice.oscGain;
			oldGain.gain.setValueAtTime(1, time);
			oldGain.gain.exponentialRampToValueAtTime(0.0001, time + fade);
			old.stop(time + fade + 0.1);
		}
		voice.osc = osc;
		voice.oscGain = g;
		voice.freq = freq;
	}

	// Move every voice to the nearest tone of the chord (in log-frequency), crossfading instead of gliding.
	voiceLead(chord, time, fade = 5) {
		this.chord = chord;
		this.voices.forEach((voice, i) => {
			let best = null, bestDist = Infinity;
			for (const d of chord) {
				for (const oct of [-1, 0, 1]) {
					const degree = d + oct * this.scale.length;
					const f = this.targetFreq(voice, degree);
					const dist = Math.abs(Math.log2(f / voice.freq));
					if (dist < bestDist) { bestDist = dist; best = { degree, f }; }
				}
			}
			// the lowest voices stay on the chord root so the harmony has a floor
			if (i < 3) { best = { degree: chord[0], f: this.targetFreq(voice, chord[0]) }; }
			if (Math.abs(Math.log2(best.f / voice.freq)) < 0.001) return;
			voice.degree = best.degree;
			this.spawnOsc(voice, best.f, time + i * 0.35, fade);
		});
	}

	onKeyChange(scale, time) {
		this.scale = scale;
		this.voiceLead(this.chord, time, 7);
	}

	setChord(chord, time) { this.voiceLead(chord, time, 6); }

	setOctaveShift(down, time) {
		this.octaveShift = down ? 0.5 : 1;
		this.voiceLead(this.chord, time, 8);
	}

	update(dt, p) {
		super.update(dt, p);
		this.cutoff = damp(this.cutoff, p.cutoff, 0.7, dt);
		this.filter.frequency.setTargetAtTime(this.cutoff, this.engine.now, 0.2);
		this.wobbleGain.gain.setTargetAtTime(p.hum * 25, this.engine.now, 0.5);
		this.lfoGain.gain.setTargetAtTime(140 + p.hum * 600, this.engine.now, 0.5);
	}
}
