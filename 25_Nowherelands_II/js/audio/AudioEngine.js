import { bus, Events } from '../core/EventBus.js';
import { clamp01, damp } from '../core/Utils.js';

// Web Audio graph: voices -> layer gains -> master -> compressor -> analyser -> out.
// Every voice also sends to a shared convolution reverb built from procedurally generated noise.
export class AudioEngine {
	constructor() {
		const Ctx = window.AudioContext || window.webkitAudioContext;
		this.ctx = new Ctx({ latencyHint: 'interactive' });
		const ctx = this.ctx;

		this.master = ctx.createGain();
		this.master.gain.value = 0.0001;
		// ambient layers go through a bus that ducks when the player makes a sound
		this.layerBus = ctx.createGain();
		this.layerBus.gain.value = 1;
		this.playerBus = ctx.createGain();
		this.playerBus.gain.value = 1.35;
		this.playerBus.connect(this.master);
		this.compressor = ctx.createDynamicsCompressor();
		this.compressor.threshold.value = -18;
		this.compressor.knee.value = 20;
		this.compressor.ratio.value = 4;
		this.compressor.attack.value = 0.01;
		this.compressor.release.value = 0.35;
		this.analyser = ctx.createAnalyser();
		this.analyser.fftSize = 1024;
		this.analyser.smoothingTimeConstant = 0.6;
		this.layerBus.connect(this.master);
		this.master.connect(this.compressor);
		this.compressor.connect(this.analyser);
		this.analyser.connect(ctx.destination);

		this.reverb = ctx.createConvolver();
		this.reverb.buffer = this.buildImpulse(4.5, 3.2);
		this.reverbGain = ctx.createGain();
		this.reverbGain.gain.value = 0.75;
		this.reverb.connect(this.reverbGain);
		this.reverbGain.connect(this.master);

		this.delay = ctx.createDelay(2);
		this.delay.delayTime.value = 0.42;
		this.delayFeedback = ctx.createGain();
		this.delayFeedback.gain.value = 0.32;
		this.delayFilter = ctx.createBiquadFilter();
		this.delayFilter.type = 'lowpass';
		this.delayFilter.frequency.value = 1800;
		this.delay.connect(this.delayFilter);
		this.delayFilter.connect(this.delayFeedback);
		this.delayFeedback.connect(this.delay);
		this.delayFilter.connect(this.master);

		this.noiseBuffer = this.buildNoise(2);
		this.freq = new Uint8Array(this.analyser.frequencyBinCount);
		this.analysis = { bass: 0, mid: 0, high: 0, level: 0, attack: 0 };
		this._raw = { bass: 0, mid: 0, high: 0, level: 0 };
		this.noteEnv = 0;

		this.recorder = null;
		this.recordDest = null;

		bus.on(Events.NOTE, (n) => { this.noteEnv = Math.min(1, this.noteEnv + (n.velocity || 0.3) * 1.2); });
	}

	get now() { return this.ctx.currentTime; }

	async resume() {
		await this.ctx.resume();
		this.master.gain.setTargetAtTime(0.9, this.now, 1.5);
	}

	createLayerGain(initial = 0) {
		const g = this.ctx.createGain();
		g.gain.value = initial;
		g.connect(this.layerBus);
		return g;
	}

	// Make room for a player sound: dip the ambient layers, then let them swell back.
	duck(amount = 0.4, seconds = 1.4) {
		const t = this.now;
		const g = this.layerBus.gain;
		g.cancelScheduledValues(t);
		g.setValueAtTime(g.value, t);
		g.linearRampToValueAtTime(amount, t + 0.04);
		g.linearRampToValueAtTime(1, t + seconds);
	}

	buildImpulse(seconds, decay) {
		const ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * seconds);
		const buffer = ctx.createBuffer(2, len, rate);
		for (let c = 0; c < 2; c++) {
			const d = buffer.getChannelData(c);
			let lp = 0;
			const pre = Math.floor(rate * 0.02);
			for (let i = 0; i < len; i++) {
				const t = i / len;
				const env = Math.pow(1 - t, decay) * (i < pre ? i / pre : 1);
				lp = lp * 0.72 + (Math.random() * 2 - 1) * 0.28;
				d[i] = lp * env * (1 + 0.3 * Math.sin(i * 0.0007 + c));
			}
		}
		return buffer;
	}

	buildNoise(seconds) {
		const rate = this.ctx.sampleRate, len = Math.floor(rate * seconds);
		const buffer = this.ctx.createBuffer(1, len, rate);
		const d = buffer.getChannelData(0);
		for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
		return buffer;
	}

	makePanner(position) {
		const p = this.ctx.createPanner();
		p.panningModel = 'HRTF';
		p.distanceModel = 'inverse';
		p.refDistance = 65;
		p.maxDistance = 3000;
		p.rolloffFactor = 1.1;
		this.setPannerPosition(p, position);
		return p;
	}

	setPannerPosition(p, position) {
		if (p.positionX) {
			p.positionX.value = position.x; p.positionY.value = position.y; p.positionZ.value = position.z;
		} else p.setPosition(position.x, position.y, position.z);
	}

	updateListener(position, forward, up) {
		const l = this.ctx.listener, t = this.now;
		if (l.positionX) {
			l.positionX.setTargetAtTime(position.x, t, 0.05);
			l.positionY.setTargetAtTime(position.y, t, 0.05);
			l.positionZ.setTargetAtTime(position.z, t, 0.05);
			l.forwardX.setTargetAtTime(forward.x, t, 0.05);
			l.forwardY.setTargetAtTime(forward.y, t, 0.05);
			l.forwardZ.setTargetAtTime(forward.z, t, 0.05);
			l.upX.setTargetAtTime(up.x, t, 0.05);
			l.upY.setTargetAtTime(up.y, t, 0.05);
			l.upZ.setTargetAtTime(up.z, t, 0.05);
		} else {
			l.setPosition(position.x, position.y, position.z);
			l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
		}
	}

	// Route a voice output to destination, reverb send, delay send and optional panner.
	route(node, { dest, position = null, reverb = 0.5, delay = 0 }) {
		let out = node;
		if (position) {
			const panner = this.makePanner(position);
			node.connect(panner);
			out = panner;
		}
		out.connect(dest || this.master);
		if (reverb > 0) {
			const send = this.ctx.createGain();
			send.gain.value = reverb;
			out.connect(send);
			send.connect(this.reverb);
		}
		if (delay > 0) {
			const send = this.ctx.createGain();
			send.gain.value = delay;
			out.connect(send);
			send.connect(this.delay);
		}
	}

	// A detuned multi-oscillator pad/pluck voice with ADSR and filter envelope.
	playTone({ freq, time = this.now, duration = 1, velocity = 0.4, type = 'triangle', detune = 7, voices = 3,
		attack = 0.04, release = 0.6, cutoff = 1600, cutoffEnv = 1.8, q = 0.8, position = null, reverb = 0.5, delay = 0, dest = null, layer = 'misc', octaveLayer = 0 }) {
		const ctx = this.ctx;
		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.Q.value = q;
		filter.frequency.setValueAtTime(Math.min(cutoff * cutoffEnv, 18000), time);
		filter.frequency.exponentialRampToValueAtTime(Math.max(cutoff, 40), time + attack + 0.25);

		const env = ctx.createGain();
		env.gain.setValueAtTime(0.0001, time);
		env.gain.exponentialRampToValueAtTime(Math.max(velocity, 0.001), time + attack);
		env.gain.setValueAtTime(Math.max(velocity, 0.001), time + attack + duration);
		env.gain.exponentialRampToValueAtTime(0.0001, time + attack + duration + release);

		filter.connect(env);
		const end = time + attack + duration + release + 0.1;
		const count = Math.max(1, voices);
		for (let i = 0; i < count; i++) {
			const osc = ctx.createOscillator();
			osc.type = type;
			osc.frequency.value = freq;
			osc.detune.value = count === 1 ? 0 : (i - (count - 1) / 2) * detune;
			osc.connect(filter);
			osc.start(time);
			osc.stop(end);
		}
		if (octaveLayer > 0) {
			const sub = ctx.createOscillator();
			sub.type = 'sine';
			sub.frequency.value = freq * 2;
			const g = ctx.createGain();
			g.gain.value = octaveLayer;
			sub.connect(g); g.connect(filter);
			sub.start(time); sub.stop(end);
		}
		this.route(env, { dest, position, reverb, delay });
		this.emitNote(freq, position, velocity, layer, time);
	}

	// FM bell: carrier modulated by a decaying modulator.
	playBell({ freq, time = this.now, velocity = 0.25, ratio = 3.01, index = 2.2, decay = 3.5, position = null, reverb = 0.9, delay = 0.2, dest = null, layer = 'bells' }) {
		const ctx = this.ctx;
		const carrier = ctx.createOscillator();
		carrier.type = 'sine';
		carrier.frequency.value = freq;
		const mod = ctx.createOscillator();
		mod.type = 'sine';
		mod.frequency.value = freq * ratio;
		const modGain = ctx.createGain();
		modGain.gain.setValueAtTime(freq * index, time);
		modGain.gain.exponentialRampToValueAtTime(freq * 0.05, time + decay * 0.5);
		mod.connect(modGain);
		modGain.connect(carrier.frequency);

		const env = ctx.createGain();
		env.gain.setValueAtTime(0.0001, time);
		env.gain.exponentialRampToValueAtTime(velocity, time + 0.008);
		env.gain.exponentialRampToValueAtTime(0.0001, time + decay);
		carrier.connect(env);
		mod.start(time); carrier.start(time);
		mod.stop(time + decay + 0.1); carrier.stop(time + decay + 0.1);
		this.route(env, { dest, position, reverb, delay });
		this.emitNote(freq, position, velocity, layer, time);
	}

	// Short pitched thump.
	playKick({ time = this.now, velocity = 0.4, freq = 55, decay = 0.28, dest = null }) {
		const ctx = this.ctx;
		const osc = ctx.createOscillator();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(freq * 2.6, time);
		osc.frequency.exponentialRampToValueAtTime(freq, time + 0.06);
		const env = ctx.createGain();
		env.gain.setValueAtTime(0.0001, time);
		env.gain.exponentialRampToValueAtTime(velocity, time + 0.006);
		env.gain.exponentialRampToValueAtTime(0.0001, time + decay);
		osc.connect(env);
		osc.start(time); osc.stop(time + decay + 0.05);
		this.route(env, { dest, reverb: 0.15 });
	}

	// One-shot filtered noise tick.
	playNoiseBurst({ time = this.now, velocity = 0.1, cutoff = 4000, duration = 0.06, dest = null }) {
		const ctx = this.ctx;
		const src = ctx.createBufferSource();
		src.buffer = this.noiseBuffer;
		const filter = ctx.createBiquadFilter();
		filter.type = 'highpass';
		filter.frequency.value = cutoff;
		const env = ctx.createGain();
		env.gain.setValueAtTime(0.0001, time);
		env.gain.exponentialRampToValueAtTime(velocity, time + 0.004);
		env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
		src.connect(filter); filter.connect(env);
		src.start(time, Math.random()); src.stop(time + duration + 0.02);
		this.route(env, { dest, reverb: 0.25 });
	}

	// Looping filtered noise source; returns handles for live control.
	createNoise({ dest = null, cutoff = 600, q = 0.9, gain = 0 }) {
		const ctx = this.ctx;
		const src = ctx.createBufferSource();
		src.buffer = this.noiseBuffer;
		src.loop = true;
		const filter = ctx.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.value = cutoff;
		filter.Q.value = q;
		const g = ctx.createGain();
		g.gain.value = gain;
		src.connect(filter); filter.connect(g); g.connect(dest || this.master);
		src.start();
		return { src, filter, gain: g };
	}

	emitNote(freq, position, velocity, layer, time) {
		const delayMs = Math.max(0, (time - this.now) * 1000);
		const payload = { freq, position: position ? { x: position.x, y: position.y, z: position.z } : null, velocity, layer };
		if (delayMs < 5) bus.emit(Events.NOTE, payload);
		else setTimeout(() => bus.emit(Events.NOTE, payload), delayMs);
	}

	update(dt) {
		this.analyser.getByteFrequencyData(this.freq);
		const avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += this.freq[i]; return s / (b - a) / 255; };
		const raw = this._raw;
		raw.bass = avg(1, 9);
		raw.mid = avg(9, 48);
		raw.high = avg(48, 220) * 2.2;
		raw.level = avg(1, 120);
		const an = this.analysis;
		const calib = { bass: [0.72, 3.2], mid: [0.45, 2.6], high: [0.3, 2.4], level: [0.3, 2.6] };
		for (const k of ['bass', 'mid', 'high', 'level']) {
			const target = clamp01((raw[k] - calib[k][0]) * calib[k][1]);
			an[k] = target > an[k] ? damp(an[k], target, 18, dt) : damp(an[k], target, 4, dt);
		}
		this.noteEnv = damp(this.noteEnv, 0, 5, dt);
		an.attack = this.noteEnv;
	}

	toggleRecording() {
		if (this.recorder && this.recorder.state === 'recording') {
			this.recorder.stop();
			return false;
		}
		if (!window.MediaRecorder) return false;
		if (!this.recordDest) {
			this.recordDest = this.ctx.createMediaStreamDestination();
			this.compressor.connect(this.recordDest);
		}
		const chunks = [];
		this.recorder = new MediaRecorder(this.recordDest.stream);
		this.recorder.ondataavailable = (e) => chunks.push(e.data);
		this.recorder.onstop = () => {
			const blob = new Blob(chunks, { type: this.recorder.mimeType || 'audio/webm' });
			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = 'nowherelands-' + new Date().toISOString().replace(/[:.]/g, '-') + '.webm';
			a.click();
			setTimeout(() => URL.revokeObjectURL(a.href), 5000);
		};
		this.recorder.start();
		return true;
	}
}
