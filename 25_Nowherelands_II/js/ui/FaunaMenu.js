import { FaunaSurvey } from './FaunaSurvey.js?v=fauna-menu-2';
import { ReedSurvey } from './ReedSurvey.js?v=fauna-menu-2';
import { BirdSurvey } from './BirdSurvey.js?v=fauna-menu-2';
import { LanternMiteSurvey } from './LanternMiteSurvey.js?v=fauna-menu-2';
import { config } from '../core/Config.js';

const FAUNA = [
	{ id: 'lumen', name: 'Lumen shoal', habitat: 'Living lights along the shores', next: 'Visit another flock' },
	{ id: 'hopper', name: 'Pebble hoppers', habitat: 'Watchful stones in rocky colonies', next: 'Visit another colony' },
	{ id: 'ray', name: 'Veil rays', habitat: 'Drifting veils over quiet lakes', next: 'Visit another lake' },
	{ id: 'reed', name: 'Reed walkers', habitat: 'Gentle families in the shallows', next: 'Visit another family' },
	{ id: 'bird', name: 'Birds', habitat: 'Colorful neighbors in the trees', next: 'Visit another group' },
	{ id: 'mite', name: 'Lantern mites', habitat: 'Tiny lights in the old forest', next: 'Visit another colony' },
];

// Reuse the habitat-aware tour cameras without mounting their inspection panels.
// Only the selected guide runs, so two tours can never compete for the camera.
export class FaunaMenu {
	constructor(shared) {
		this.shared = shared;
		this.controllers = new Map();
		this.buttons = new Map();
		this.homes = { bird: new Map(), mite: new Map() };
		this.panel = document.createElement('aside');
		this.panel.id = 'fauna-menu';
		this.panel.className = 'fauna-guide fauna-menu';
		this.panel.setAttribute('aria-labelledby', 'fauna-menu-title');
		this.panel.innerHTML = '<header><div class="fauna-guide-kicker">NOWHERELANDS</div><h2 id="fauna-menu-title">Meet the fauna</h2><p>Choose a creature to visit its home.</p></header>';
		const list = document.createElement('nav');
		list.className = 'fauna-menu-list';
		list.setAttribute('aria-label', 'Fauna');
		for (const entry of FAUNA) {
			const button = document.createElement('button');
			button.type = 'button';
			button.setAttribute('aria-pressed', 'false');
			button.dataset.fauna = entry.id;
			button.innerHTML = `<span class="fauna-menu-name">${entry.name}</span><span class="fauna-menu-habitat">${entry.habitat}</span><span class="fauna-menu-arrow" aria-hidden="true">→</span>`;
			button.onclick = () => this.visit(entry.id);
			this.buttons.set(entry.id, button);
			list.append(button);
		}
		this.panel.append(list);
		this.detail = document.createElement('p');
		this.detail.className = 'fauna-menu-detail';
		this.detail.textContent = 'Six kinds of company, one world to explore.';
		this.panel.append(this.detail);
		const actions = document.createElement('div');
		actions.className = 'fauna-menu-actions';
		this.next = document.createElement('button');
		this.next.type = 'button';
		this.next.textContent = 'Visit another group';
		this.next.hidden = true;
		this.next.onclick = () => this.visit(this.kind, true);
		const explore = document.createElement('button');
		explore.type = 'button';
		explore.className = 'fauna-menu-explore';
		explore.textContent = 'Explore here';
		explore.onclick = () => this.explore();
		actions.append(this.next, explore);
		this.panel.append(actions);
		const help = document.createElement('small');
		help.textContent = config.isTouch ? 'Drag to look · tap to play a note' : 'WASD to move · N to play a note · Esc for fauna';
		this.panel.append(help);
		this.toggle = document.createElement('button');
		this.toggle.type = 'button';
		this.toggle.className = 'fauna-menu-toggle';
		this.toggle.textContent = 'Fauna';
		this.toggle.setAttribute('aria-controls', this.panel.id);
		this.toggle.onclick = () => {
			if (shared.player.locked) document.exitPointerLock();
			this.setOpen(!this.open);
		};
		document.body.append(this.panel, this.toggle);
		this.setOpen(true);
		document.addEventListener('pointerlockchange', () => {
			if (shared.player.locked) { this.stop(); this.setOpen(false); }
			else if (shared.player.enabled) this.setOpen(true);
		});
		document.addEventListener('keydown', event => {
			if (event.code === 'Escape' && shared.player.enabled && !shared.player.locked) {
				this.setOpen(true);
				(this.buttons.get(this.kind) || this.toggle).focus();
			}
		});
		const params = new URLSearchParams(location.search);
		const initial = params.has('reeds') ? 'reed' : params.has('birds') ? 'bird' : params.has('mites') ? 'mite' : params.get('fauna');
		if (FAUNA.some(entry => entry.id === initial)) this.visit(initial, false, false);
	}

	setOpen(open) {
		this.open = open;
		this.panel.hidden = !open;
		this.panel.inert = !open;
		this.toggle.setAttribute('aria-expanded', String(open));
		this.toggle.textContent = open ? 'Close fauna' : 'Fauna';
	}

	controller(kind) {
		const key = ['lumen', 'hopper', 'ray'].includes(kind) ? 'fauna' : kind;
		if (!this.controllers.has(key)) {
			const s = this.shared, options = { mount: false };
			const controller = key === 'fauna' ? new FaunaSurvey(s, s.fauna, options)
				: key === 'reed' ? new ReedSurvey(s, s.walkers, options)
				: key === 'bird' ? new BirdSurvey(s, s.birds, options)
				: new LanternMiteSurvey(s, s.mites, options);
			this.controllers.set(key, controller);
		}
		return this.controllers.get(key);
	}

	stop() {
		for (const controller of this.controllers.values()) {
			controller.tracking = false;
			controller.pendingVisit = false;
			controller.watchFlight = controller.watchPebble = controller.watchRay = null;
			controller.mode = null;
		}
		this.shared.fauna.model.observing = false;
		this.shared.mites.guided = this.shared.mites.observing = false;
		this.active = null;
		this.search = null;
	}

	visit(kind, another = false, audio = true) {
		const entry = FAUNA.find(entry => entry.id === kind);
		if (!entry) return;
		this.stop();
		if (audio) this.shared.hud.start?.({ capture: false });
		const controller = this.controller(kind);
		this.kind = kind;
		this.active = controller;
		if (kind === 'bird') {
			const other = another && this.shared.birds.encounters.find(bird => bird.habitat.id !== controller.subject?.habitat.id);
			if (another && !other) this.findForest(kind, controller.subject?.habitat.id);
			else { controller.watch('ground', other || undefined); if (controller.mode === 'search') this.findForest(kind); }
		} else if (kind === 'reed' || kind === 'mite') {
			const found = controller.visit(another ? controller.group : undefined);
			if (kind === 'mite' && !found) this.findForest(kind, another ? controller.group?.id : undefined);
		} else if (another) {
			if (kind === 'hopper') controller.nextColony();
			else if (kind === 'ray') controller.nextRay();
			else controller.nextFlock();
		} else controller.visit(kind);
		for (const [id, button] of this.buttons) button.setAttribute('aria-pressed', String(id === kind));
		this.next.hidden = false;
		this.next.textContent = entry.next;
		this.detail.textContent = this.search ? 'Finding a home in the forest…' : controller.detail.textContent || entry.habitat;
		this.setOpen(true);
		const url = new URL(location.href);
		for (const key of ['reeds', 'birds', 'mites']) url.searchParams.delete(key);
		url.searchParams.set('fauna', kind);
		history.replaceState(null, '', url);
	}

	explore() {
		this.stop();
		this.shared.player.fly = false;
		this.shared.player.keys.clear();
		this.shared.hud.start?.({ capture: false });
		this.setOpen(false);
		if (!config.isTouch) {
			try { this.shared.renderer.domElement.requestPointerLock?.()?.catch(() => this.setOpen(true)); }
			catch { this.setOpen(true); }
		}
	}

	rememberHomes() {
		for (const bird of this.shared.birds.encounters) this.homes.bird.set(bird.habitat.id, { ...bird.ground });
		for (const colony of this.shared.mites.colonies.values()) this.homes.mite.set(colony.id, { ...colony.site.arrival });
	}

	findForest(kind, exclude) {
		this.rememberHomes();
		const p = this.shared.player, hm = this.shared.heightmap;
		const known = [...this.homes[kind]].filter(([id]) => id !== exclude).map(([, position]) => position);
		const candidates = [];
		// Only use suitable terrain; the world systems still select actual trees and residents.
		for (let x = -5000; x <= 5000; x += 250) for (let z = -5000; z <= 5000; z += 250) {
			const ground = hm.sample(x, z), habitat = hm.habitat(x, z);
			if (ground > hm._water + 4 && hm._slope < .3 && habitat.forest > .15 && habitat.wet > .1 && habitat.coast < .5 && !hm.caves.hasOpening(x, z)) candidates.push({ x, y: ground + 11, z });
		}
		candidates.sort((a, b) => Math.hypot(a.x - p.position.x, a.z - p.position.z) - Math.hypot(b.x - p.position.x, b.z - p.position.z));
		known.sort((a, b) => Math.hypot(a.x - p.position.x, a.z - p.position.z) - Math.hypot(b.x - p.position.x, b.z - p.position.z));
		const destinations = known.slice(0, 4);
		for (const at of candidates) {
			if (destinations.length >= 8) break;
			if (destinations.every(other => Math.hypot(other.x - at.x, other.z - at.z) > 600)) destinations.push(at);
		}
		this.active.tracking = false;
		this.active.mode = null;
		this.active.autoTries = 5;
		this.search = { kind, exclude, destinations, nextAt: 0, retryAt: 0 };
	}

	searchForest() {
		const search = this.search, now = this.shared.time;
		if (!search || now < search.retryAt) return;
		search.retryAt = now + 1;
		if (search.nextAt && search.kind === 'bird') {
			const bird = this.shared.birds.encounters.find(bird => bird.habitat.id !== search.exclude);
			if (bird) { this.active.watch('ground', bird); this.search = null; return; }
		} else if (search.nextAt && search.kind === 'mite') {
			const current = search.exclude ? this.shared.mites.colonies.get(search.exclude) : undefined;
			if (this.active.visit(current)) { this.search = null; return; }
		}
		if (now < search.nextAt) return;
		const at = search.destinations.shift();
		if (!at) {
			this.active.tracking = false;
			this.active.mode = null;
			this.search = null;
			this.active = null;
			this.detail.textContent = 'No nearby home found. Choose another creature or try again.';
			return;
		}
		const player = this.shared.player;
		player.keys.clear(); player.velocity.set(0, 0, 0); player.fly = true;
		player.position.set(at.x, at.y, at.z);
		search.nextAt = now + 6;
	}

	guide(dt) { if (!this.search) this.active?.guide(dt); }
	update(ms) {
		if (this.shared.time >= (this.rememberAt || 0)) { this.rememberAt = this.shared.time + 1; this.rememberHomes(); }
		this.searchForest();
		if (!this.search) this.active?.update(ms);
		if (this.search) this.detail.textContent = 'Finding a home in the forest…';
		else if (this.active?.detail.textContent) this.detail.textContent = this.active.detail.textContent;
	}
}
