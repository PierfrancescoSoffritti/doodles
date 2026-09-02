export class EventBus {
	constructor() { this.listeners = new Map(); }
	on(type, fn) {
		if (!this.listeners.has(type)) this.listeners.set(type, new Set());
		this.listeners.get(type).add(fn);
		return () => this.listeners.get(type).delete(fn);
	}
	emit(type, payload) {
		const set = this.listeners.get(type);
		if (set) for (const fn of set) fn(payload);
	}
}

export const bus = new EventBus();

export const Events = {
	NOTE: 'note',                 // { freq, position?, velocity, layer }
	DISCOVER: 'discover',         // { id, title, subtitle }
	TOGGLE_TIME: 'toggleTime',    // { fast }
	KEY_CHANGE: 'keyChange',      // { root, mode }
	EVENT_START: 'eventStart',    // { name }
	EVENT_END: 'eventEnd',        // { name }
	RIPPLE: 'ripple',             // { x, z, size, hue }
	PRESS_START: 'pressStart',    // {}
	PRESS_END: 'pressEnd',        // { duration }
	TOAST: 'toast',               // { text, sub }
};
