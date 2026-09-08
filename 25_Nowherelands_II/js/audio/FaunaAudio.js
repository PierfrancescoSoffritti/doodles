import { PebbleAudio } from './PebbleAudio.js?v=pebble-audio-10';
// Keep the alarm foreground level separate from ambient creature calls.
const ESCAPE_LEVEL = 1.85;

const VOICES = {
	lumen: { octave: 2, attack: 0.12, length: 1.35, gain: 0.1 },
	hopper: { octave: 0, attack: 0.005, length: 0.48, gain: 0.095 },
};

// A deliberately bounded, reusable mixer. Every voice follows its animal while
// sounding and disconnects all nodes on completion. Startle calls have their own
// foreground bus so ambient ducking cannot hide the player interaction.
export class FaunaAudio {
	constructor(engine, conductor) {
		this.engine = engine; this.conductor = conductor; this.voices = []; this.history = [];
		this.out = engine.ctx.createGain(); this.out.gain.value = 0.85; this.out.connect(engine.layerBus);
		this.escapeOut = engine.ctx.createGain(); this.escapeOut.gain.value = ESCAPE_LEVEL; this.escapeOut.connect(engine.master);
		this.muted = false; this.pebbles = new PebbleAudio(engine);
	}
	pebble(creature,event,context) { this.pebbles.muted=this.muted; return this.pebbles.play(creature,event,context); }
	escape(creature) { return this.call(creature, false, true); }
	call(creature, landing = false, escape = false) {
		if(creature.kind==='hopper')return this.pebble(creature,landing?'settle':'startle');
		const e = this.engine, ctx = e.ctx, spec = escape ? { octave: 2, attack: 0.012, length: 1.6, gain: 0.46 } : VOICES[creature.kind];
		if (ctx.state !== 'running' || this.muted || this.voices.length >= (escape ? 10 : 8)) return false;
		if (this.voices.some(v => v.creature === creature && (!escape || v.escape))) return false;
		// Give a nearby alarm the same space in the mix as a player gesture.
		// This happens only after acceptance: muted/rejected calls never duck music.
		if (escape) e.duck(0.28, 1.8);
		const t = e.now + 0.015, duration = spec.length, end = t + duration;
		const chord = this.conductor.scale.chordDegrees();
		const freq = this.conductor.scale.freq(chord[creature.degree % chord.length], spec.octave) * 2 ** (creature.voice / 1200);
		const envelope = ctx.createGain(), pan = e.makePanner(creature.pos), send = ctx.createGain();
		pan.refDistance = escape ? 40 : 24;
		pan.rolloffFactor = escape ? 1 : 1.5;
		const peak = spec.gain * (landing ? 0.35 : 1);
		envelope.gain.setValueAtTime(0.0001, t);
		envelope.gain.exponentialRampToValueAtTime(peak, t + spec.attack);
		envelope.gain.exponentialRampToValueAtTime(0.0001, end);
		envelope.connect(pan); pan.connect(escape ? this.escapeOut : this.out); pan.connect(send);
		send.gain.value = 0.2; send.connect(e.reverb);
		const nodes = [envelope, pan, send], sources = [];
		const filter = (type, cutoff, q = 0.7, dest = envelope) => {
			const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = cutoff; f.Q.value = q; f.connect(dest); nodes.push(f); return f;
		};
		const tone = (type, hz, gain = 1, dest = envelope) => {
			const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = type; osc.frequency.setValueAtTime(hz, t); g.gain.value = gain;
			osc.connect(g); g.connect(dest); osc.start(t); osc.stop(end + 0.05); nodes.push(osc, g); sources.push(osc); return osc;
		};
		const noise = (gain, cutoff) => {
			const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = e.noiseBuffer; src.loop = true; g.gain.value = gain;
			const f = filter('bandpass', cutoff, 2); src.connect(g); g.connect(f); src.start(t); src.stop(end + 0.05); nodes.push(src, g); sources.push(src);
		};
		switch (creature.kind) {
			case 'lumen': {
				if (escape) {
					// A distinct rising flutter: four full pulses followed by an airy
					// release. Its position stays at take-off so it remains audible.
					const o = tone('sine', freq * 0.62, 0.85);
					const body = tone('triangle', freq * 0.31, 0.18);
					body.frequency.exponentialRampToValueAtTime(freq * 0.8, t + 0.52);
					o.frequency.exponentialRampToValueAtTime(freq * 1.25, t + 0.18);
					o.frequency.exponentialRampToValueAtTime(freq * 0.95, t + 0.3);
					o.frequency.exponentialRampToValueAtTime(freq * 1.6, t + 0.52);
					o.frequency.exponentialRampToValueAtTime(freq * 1.35, end);
					const overtone = tone('sine', freq * 1.27, 0.12);
					overtone.frequency.exponentialRampToValueAtTime(freq * 3.1, t + 0.55);
					for (const [at, gain] of [[0.13,0.4],[0.23,1],[0.35,0.4],[0.49,0.9],[0.63,0.35],[0.8,0.7],[1.0,0.4]])
						envelope.gain.exponentialRampToValueAtTime(peak * gain, t + at);
					envelope.gain.exponentialRampToValueAtTime(0.0001, end);
					noise(0.26, 1700); break;
				}
				const o = tone('sine', freq * 0.8); o.frequency.exponentialRampToValueAtTime(freq * 1.025, t + 0.23); o.frequency.exponentialRampToValueAtTime(freq, end);
				tone('sine', freq * 2.006, 0.16); break;
			}
			case 'hopper': {
				const f = filter('lowpass', 1700);
				const o = tone('triangle', freq * 1.8, 0.8, f); o.frequency.exponentialRampToValueAtTime(freq, t + 0.055);
				tone('sine', freq * 2.7, 0.12, f); noise(0.12, 2100); break;
			}
		}
		const voice = { creature, escape, origin: escape ? { ...creature.pos } : null, pan, send, sendLevel: send.gain.value, end, nodes, sources }; this.voices.push(voice);
		sources[0].onended = () => { for (const n of nodes) n.disconnect(); this.voices = this.voices.filter(v => v !== voice); };
		this.history.push({ kind: creature.kind, id: creature.id, event: escape ? 'escape' : 'call', time: t, freq }); if (this.history.length > 32) this.history.shift();
		return true;
	}
	update() {
		const t = this.engine.now;
  this.pebbles.muted=this.muted;this.pebbles.update();
		this.out.gain.setTargetAtTime(this.muted ? 0 : 0.85, t, 0.12);
		this.escapeOut.gain.setTargetAtTime(this.muted ? 0 : ESCAPE_LEVEL, t, 0.12);
		for (const v of this.voices) {
			v.send.gain.setTargetAtTime(this.muted ? 0 : v.sendLevel, t, 0.12);
			const p = v.origin || v.creature.renderPosition || v.creature.pos;
			for (const axis of ['x', 'y', 'z']) v.pan['position' + axis.toUpperCase()].setTargetAtTime(p[axis], t, 0.06);
		}
	}
	dispose() {
  this.pebbles.dispose();
		for (const voice of this.voices) { for (const source of voice.sources) { try { source.stop(); } catch {} } for (const n of voice.nodes) n.disconnect(); }
		this.voices = []; this.out.disconnect(); this.escapeOut.disconnect();
	}
}
