import { bus, Events } from '../core/EventBus.js';
import { config } from '../core/Config.js';
import { Scale } from './Scale.js';
import { Scheduler } from './Scheduler.js';
import { Drone } from './layers/Drone.js';
import { Arpeggio } from './layers/Arpeggio.js';
import { Bells } from './layers/Bells.js';
import { Bass } from './layers/Bass.js';
import { Wind } from './layers/Wind.js';
import { Shimmer } from './layers/Shimmer.js';
import { Pulse } from './layers/Pulse.js';
import { RainLayer } from './layers/RainLayer.js';
import { clamp01, smoothstep, damp } from '../core/Utils.js';

// Ties the world to the music: picks keys and modes, drives layer parameters from player
// and environment state, and unlocks layers as landmarks are discovered.
export class Conductor {
	constructor(engine) {
		this.engine = engine;
		this.scale = new Scale(50, 'pentMinor');
		this.scheduler = new Scheduler(engine.ctx, config.audio.bpm, config.audio.stepsPerBeat);
		this.layers = {
			drone: new Drone(engine, this.scale),
			wind: new Wind(engine),
			arpeggio: new Arpeggio(engine, this.scale),
			bells: new Bells(engine),
			bass: new Bass(engine),
			shimmer: new Shimmer(engine, this.scale),
			pulse: new Pulse(engine),
			rain: new RainLayer(engine),
		};
		this.params = { cutoff: 600, density: 0.35, brightness: 0.3, speed: 0, altitude: 0, snow: 0, hum: 0, wandererProximity: 0, still: 0, turn: 0, wading: 0, look: 0, rain: 0 };
		this.lastFootstep = 0;
		this.keyTimer = this.randomKeyInterval();
		this.chordTimer = 14;
		this.chordStep = 0;
		this.fast = false;
		this.stillness = 0;

		this.scheduler.onStep((step, time, dur) => {
			for (const l of Object.values(this.layers)) l.onStep(step, time, dur, this.scale, this.params);
		});

		bus.on(Events.DISCOVER, ({ id }) => this.unlock(id));
		bus.on(Events.TOGGLE_TIME, ({ fast }) => { this.fast = fast; this.scheduler.bpm = config.audio.bpm * (fast ? 2 : 1); });
	}

	start() { this.scheduler.start(); }

	randomKeyInterval() { const [a, b] = config.audio.keyChangeEvery; return a + Math.random() * (b - a); }

	unlock(id) {
		const map = { spiral: 'arpeggio', octahedrons: 'bells', timeMonolith: 'bass', wanderer: 'shimmer', mirrors: null };
		const name = map[id];
		if (name && this.layers[name]) this.layers[name].unlock();
		if (id === 'mirrors') this.engine.reverbGain.gain.setTargetAtTime(1.1, this.engine.now, 2);
	}

	modeForSky(moonHeight, sunHeight = -1) {
		if (moonHeight > 0.5) return 'lydian';       // full moonlight is the bright hour
		if (moonHeight > 0.15) return 'pentMajor';
		if (sunHeight > 0.1) return 'dorian';        // the red dwarf's day is moody
		if (sunHeight > -0.05 || moonHeight > 0.0) return 'pentMinor';
		return 'aeolian';
	}

	changeKey(moonHeight) {
		const step = Math.random() < 0.5 ? 7 : 5;
		const dir = Math.random() < 0.5 ? 1 : -1;
		let root = this.scale.root + step * dir;
		if (root > 55) root -= 12;
		if (root < 45) root += 12;
		this.scale.root = root;
		this.scale.mode = this.modeForSky(moonHeight, this.sunHeight);
		this.scale.chordRoot = 0;
		this.chordStep = 0;
		this.chordTimer = 18;
		const t = this.engine.now + 0.05;
		for (const l of Object.values(this.layers)) l.onKeyChange(this.scale, t);
		// a single soft high note marks the modulation without announcing it
		this.engine.playTone({ freq: this.scale.freq(0, 2), time: t + 0.5, duration: 1.5, velocity: 0.07, type: 'sine', voices: 2, detune: 9, attack: 2.5, release: 4, cutoff: 3000, reverb: 1, layer: 'key' });
		bus.emit(Events.KEY_CHANGE, { root, mode: this.scale.mode });
	}

	update(dt, world) {
		const p = this.params;
		const player = world.player;
		const altitude01 = smoothstep(4, 70, player.position.y - world.heightmap.waterLevel);
		const speed01 = clamp01(player.speed / 40);
		const look01 = smoothstep(-0.7, 0.75, player.pitch);
		p.look = damp(p.look, look01, 3, dt);
		p.turn = damp(p.turn, clamp01(Math.abs(player.yawRate) / 3.5), 6, dt);
		p.wading = damp(p.wading, player.wading ? 1 : 0, 2, dt);

		this.stillness = player.speed < 1 && !player.looking ? this.stillness + dt : 0;
		const still = smoothstep(7, 12, this.stillness);
		p.still = still;

		p.altitude = altitude01;
		p.speed = damp(p.speed, speed01, 2, dt);
		// looking up opens the sky and the filter; walking, height and the hum brighten it; water muffles it
		const night = 1 - Math.max(world.moon.intensity, world.sun ? world.sun.intensity : 0);
		this.sunHeight = world.sun ? world.sun.height : -1;
		p.cutoff = (260 + p.look * 2600 + altitude01 * 1200 + p.speed * 700 + p.turn * 900 + world.state.hum * 400) * (1 - p.wading * 0.7) * (1 - night * 0.3);
		p.brightness = 0.3 * altitude01 + 0.7 * p.look;
		p.density = (0.1 + p.speed * 0.75 + (this.fast ? 0.15 : 0)) * (1 - still * 0.85) * (1 - p.rain * 0.45);
		p.cutoff *= 1 - p.rain * 0.3 - p.snow * 0.2;
		this.engine.reverbGain.gain.setTargetAtTime(0.75 + p.rain * 0.5 + p.snow * 0.3 + (this.layers.shimmer.unlocked ? 0 : 0), this.engine.now, 1);
		p.snow = world.state.snowVisible || 0;
		p.rain = world.state.rainVisible || 0;
		p.hum = world.state.hum;
		p.wandererProximity = world.wandererProximity || 0;

		const quiet = 1 - still * 0.8;
		this.layers.arpeggio.multiplier = quiet;
		this.layers.bells.multiplier = 0.3 + 0.7 * quiet;
		this.layers.bass.multiplier = 0.5 + 0.5 * quiet;
		this.layers.drone.multiplier = (world.state.eclipse > 0.5 ? 0.6 : 1) * (1 - p.wading * 0.25);
		this.layers.arpeggio.level = (0.7 + p.look * 0.4) * (1 - night * 0.3);
		this.layers.bells.level = 0.85 + night * 0.3 + p.rain * 0.4;
		this.layers.pulse.level = 0.8 * (1 - p.rain * 0.5 - p.snow * 0.3);
		this.layers.bass.level = 0.9 * (1 - p.rain * 0.3);

		for (const l of Object.values(this.layers)) l.update(dt, p);

		this.keyTimer -= dt;
		if (this.keyTimer <= 0) { this.changeKey(world.moon.height); this.keyTimer = this.randomKeyInterval(); }

		// slow chord motion inside the key: the drone voice-leads, bass and bells follow
		this.chordTimer -= dt;
		if (this.chordTimer <= 0) {
			this.chordTimer = 12 + Math.random() * 14;
			const len = this.scale.length;
			const walk = len === 5 ? [0, 3, 1, 4, 0, 2, 3, 0] : [0, 5, 3, 4, 0, 1, 5, 4];
			this.chordStep = (this.chordStep + 1) % walk.length;
			this.scale.chordRoot = walk[this.chordStep];
			this.layers.drone.setChord(this.scale.chordOn(this.scale.chordRoot).slice(0, 3), this.engine.now + 0.05);
		}
	}

	// Each footstep is a quiet pluck on the current melody note, so walking plays along.
	footstep(inWater) {
		const t = this.scheduler.quantize(2);
		if (t - this.lastFootstep < 0.08) return;
		this.lastFootstep = t;
		const arp = this.layers.arpeggio;
		const degree = arp.degree + (Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? 2 : -2));
		this.engine.playTone({
			freq: this.scale.freq(degree, inWater ? -2 : -1), time: t,
			duration: 0.05, velocity: inWater ? 0.16 : 0.12, type: inWater ? 'sine' : 'triangle', voices: inWater ? 1 : 2, detune: 6,
			attack: 0.004, release: inWater ? 0.7 : 0.35, cutoff: inWater ? 500 : 1500 + this.params.look * 1200, cutoffEnv: 2.5, reverb: inWater ? 0.8 : 0.45, delay: 0.25, layer: 'footstep',
		});
	}

	// the aurora asks for a brighter key
	brighten() {
		const root = this.scale.root;
		this.scale.mode = 'lydian';
		this.scale.chordRoot = 0;
		const t = this.engine.now + 0.05;
		for (const l of Object.values(this.layers)) l.onKeyChange(this.scale, t);
		bus.emit(Events.KEY_CHANGE, { root, mode: 'lydian' });
	}

	// a falling star rings a faint bell
	meteor() {
		const chord = this.scale.chordDegrees();
		this.engine.playBell({ freq: this.scale.freq(chord[Math.floor(Math.random() * chord.length)], 3), velocity: 0.08, ratio: 3.01, index: 1.8, decay: 5, reverb: 1, dest: this.layers.bells.out, layer: 'meteor' });
	}

	// ---- player-triggered sounds (quantized to the grid) ----
	monolithNote(degree, position, charge = 0) {
		const t = this.scheduler.quantize(2);
		const e = this.engine, dest = e.playerBus;
		const freq = this.scale.freq(degree, 1);
		e.duck(0.35 - charge * 0.15, 1.3 + charge);
		e.playTone({
			freq, time: t, position, dest,
			duration: 0.5 + charge * 1.8, velocity: 0.55 + charge * 0.4, type: 'sawtooth', detune: 7, attack: 0.008,
			release: 1.6 + charge * 2.5, cutoff: 2600 + charge * 3000, cutoffEnv: 3, q: 1.4, reverb: 0.8, delay: 0.45, layer: 'monolith', octaveLayer: 0.5,
		});
		e.playBell({ freq: freq * 2, time: t, position, dest, velocity: 0.22 + charge * 0.2, ratio: 2.0, index: 1.4, decay: 2.5 + charge * 2, reverb: 0.9, layer: 'monolith' });
		return t;
	}

	// a slot switched off: a clear descending pluck so the click is never silent
	monolithOff(position) {
		const t = this.scheduler.quantize(2);
		const e = this.engine;
		e.duck(0.5, 0.8);
		e.playTone({ freq: this.scale.freq(0, 0), time: t, position, dest: e.playerBus, duration: 0.08, velocity: 0.45, type: 'triangle', voices: 2, detune: 5, attack: 0.004, release: 0.5, cutoff: 2200, cutoffEnv: 0.35, q: 2, reverb: 0.5, layer: 'monolith' });
		return t;
	}

	octahedronNote(i, position, charge = 0) {
		const t = this.scheduler.quantize(1);
		const degree = this.scale.chordDegrees()[i % 4];
		const e = this.engine, dest = e.playerBus;
		e.duck(0.3, 2.2 + charge);
		e.playTone({
			freq: this.scale.freq(degree, -1), time: t, position, dest,
			duration: 2 + charge * 2, velocity: 0.7 + charge * 0.3, type: 'sawtooth', detune: 9, voices: 3, attack: 0.05,
			release: 3, cutoff: 500 + charge * 1400, cutoffEnv: 3.5, q: 4, reverb: 0.7, layer: 'octahedron',
		});
		e.playBell({ freq: this.scale.freq(degree, 1), time: t, position, dest, velocity: 0.3, ratio: 1.5, index: 2.5, decay: 4 + charge * 2, reverb: 0.9, layer: 'octahedron' });
		return t;
	}

	wandererPhrase(position) {
		const t0 = this.scheduler.quantize(2);
		const dur = this.scheduler.stepDuration / 2;
		const start = Math.floor(Math.random() * this.scale.length);
		this.engine.duck(0.5, 1.6);
		[0, 2, 4].forEach((d, i) => {
			this.engine.playTone({
				freq: this.scale.freq(start + d, 2), time: t0 + i * dur, position, dest: this.engine.playerBus,
				duration: dur * 0.5, velocity: 0.42, type: 'sine', voices: 2, detune: 12, attack: 0.005, release: 1.8, cutoff: 6000, reverb: 0.9, delay: 0.5, layer: 'wanderer', octaveLayer: 0.3,
			});
		});
		return t0;
	}

	timeChime(position, fast) {
		const t0 = this.scheduler.quantize(2);
		const dur = this.scheduler.stepDuration / 3;
		const degrees = fast ? [0, 2, 4, 7] : [7, 4, 2, 0];
		this.engine.duck(0.3, 2.5);
		degrees.forEach((d, i) => this.engine.playBell({ freq: this.scale.freq(d, 1), time: t0 + i * dur, position, dest: this.engine.playerBus, velocity: 0.45, ratio: 2, index: 3, decay: 3.5 }));
	}

	mirrorTouch(position) {
		const t = this.scheduler.quantize(2);
		this.engine.duck(0.5, 1.5);
		this.engine.playBell({ freq: this.scale.freq(this.scale.chordDegrees()[Math.floor(Math.random() * 4)], 3), time: t, position, dest: this.engine.playerBus, velocity: 0.35, ratio: 1.41, index: 4, decay: 6, reverb: 1 });
	}

	eclipseShift(on) {
		this.layers.drone.setOctaveShift(on, this.engine.now);
	}
}
