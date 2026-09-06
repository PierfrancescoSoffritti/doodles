import { bus, Events } from '../core/EventBus.js';
import { damp } from '../core/Utils.js';

// Celestial/musical events. Weather evolves independently in WeatherModel.
const CATALOG = [
	{ name: 'aurora', weight: 2, duration: [50, 80], toast: 'lights in the north' },
	{ name: 'meteors', weight: 2, duration: [18, 30], toast: 'falling stars' },
	{ name: 'eclipse', weight: 1, duration: [30, 40], toast: 'the moon goes dark' },
	{ name: 'hum', weight: 1.5, duration: [35, 50], toast: 'the ground hums' },
];

export class EventDirector {
	constructor(shared) {
		this.shared = shared;
		this.active = null;
		this.remaining = 0;
		this.timer = 70 + Math.random() * 30;
		this.first = true;
		this.elapsed = 0;
		this.clock = 0;
		this.targets = { aurora: 0, eclipse: 0, hum: 0, meteors: 0 };
		this.last = null;
	}

	pick() {
		const pool = CATALOG.filter((c) => c.name !== this.last);
		const total = pool.reduce((s, c) => s + c.weight, 0);
		let r = Math.random() * total;
		for (const c of pool) { r -= c.weight; if (r <= 0) return c; }
		return pool[0];
	}

	start(ev) {
		this.active = ev;
		this.last = ev.name;
		this.remaining = ev.duration[0] + Math.random() * (ev.duration[1] - ev.duration[0]);
		this.targets[ev.name] = 1;
		this.elapsed = 0;
		bus.emit(Events.EVENT_START, { name: ev.name });
		bus.emit(Events.TOAST, { text: ev.toast });
		if (ev.name === 'eclipse' && this.shared.conductor) this.shared.conductor.eclipseShift(true);
		if (ev.name === 'aurora' && this.shared.conductor) this.shared.conductor.brighten();
	}

	end() {
		const ev = this.active;
		this.targets[ev.name] = 0;
		bus.emit(Events.EVENT_END, { name: ev.name });
		if (ev.name === 'eclipse' && this.shared.conductor) this.shared.conductor.eclipseShift(false);
		this.active = null;
		this.timer = 50 + Math.random() * 90;
	}

	update(dt) {
		this.clock += dt;
		if (this.active) {
			this.remaining -= dt;
			this.elapsed += dt;
			if (this.remaining <= 0) this.end();
		} else {
			this.timer -= dt;
			if (this.timer <= 0) { this.start(this.first ? CATALOG[0] : this.pick()); this.first = false; }
		}
		const s = this.shared.state;
		for (const k of Object.keys(this.targets)) {
			const rate = k === 'eclipse' ? 0.25 : (k === 'meteors' ? 3 : 0.4);
			s[k] = damp(s[k] || 0, this.targets[k], rate, dt);
		}
	}
}
