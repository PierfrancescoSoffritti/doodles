import { bus, Events } from '../core/EventBus.js';
import { config } from '../core/Config.js';

export class HUD {
	constructor() {
		this.el = document.getElementById('hud');
		this.intro = document.getElementById('intro');
		this.enterBtn = document.getElementById('enter');
		this.ring = document.getElementById('crosshair-ring');
		this.charge = document.getElementById('crosshair-charge');
		this.toast = document.getElementById('toast');
		this.hint = document.getElementById('hint');
		this.seed = document.getElementById('seed');
		this.rec = document.getElementById('rec');
		this.joystick = document.getElementById('joystick');
		this.knob = document.getElementById('joystick-knob');
		this.fps = document.getElementById('fps');
		this.resetFPS();
		document.addEventListener('visibilitychange', () => this.resetFPS());
		this.toastTimer = null;
		this.hintTimer = null;

		let saved;
		try { saved = localStorage.getItem('nowherelands-frame-rate'); } catch { /* optional preference */ }
		const requested = new URLSearchParams(location.search).get('fps') ?? saved;
		this.frameRate = ['0', '30', '60'].includes(requested) ? Number(requested) : 60;
		const label = document.createElement('label'); label.className = 'frame-rate'; label.textContent = 'motion · ';
		const select = document.createElement('select'); select.setAttribute('aria-label', 'Frame rate');
		for (const [value, text] of [[30, '30 · quiet'], [60, '60 · balanced'], [0, 'display rate']]) {
			const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
		}
		select.value = this.frameRate;
		select.addEventListener('change', () => {
			this.frameRate = Number(select.value);
			try { localStorage.setItem('nowherelands-frame-rate', select.value); } catch { /* optional preference */ }
		});
		label.append(select); document.getElementById('corner').append(label);

		this.seed.textContent = 'seed · ' + config.seed;
		this.seed.href = '?seed=' + encodeURIComponent(config.seed);
		if (config.isTouch) document.body.classList.add('touch');

		bus.on(Events.TOAST, ({ text, sub }) => this.showToast(text, sub));
		bus.on(Events.DISCOVER, ({ title, subtitle }) => this.showToast(title, subtitle));
		bus.on(Events.KEY_CHANGE, () => {});
	}

	setLoading(label, p) {
		this.isReady = false;
		this.enterBtn.disabled = true;
		this.enterBtn.textContent = label + (p > 0 && p < 1 ? ' · ' + Math.round(p * 100) + '%' : ' …');
	}

	ready() {
		this.isReady = true;
		this.enterBtn.disabled = false;
		this.enterBtn.textContent = 'enter';
	}

	onEnter(fn) {
		const go = (e) => { e.preventDefault(); e.stopPropagation(); if (this.isReady) fn(); };
		this.enterBtn.addEventListener('click', go);
		this.intro.addEventListener('click', go);
	}

	enter() {
		this.intro.classList.add('hidden');
		this.el.classList.add('visible');
		setTimeout(() => this.showHint(config.isTouch ? 'walk toward the sound' : 'walk toward the sound · click to enter the world'), 2500);
		setTimeout(() => this.showHint(''), 12000);
	}

	setPaused(paused) {
		if (paused) this.showHint('click to continue'); else this.showHint('');
	}

	resetFPS() {
		this.fpsStart = null;
		this.fpsFrames = 0;
		this.fps.textContent = '— FPS';
	}

	recordFrame(now) {
		if (this.fpsStart === null) { this.fpsStart = now; return; }
		this.fpsFrames++;
		const elapsed = now - this.fpsStart;
		if (elapsed < 500) return;
		this.fps.textContent = Math.round(this.fpsFrames * 1000 / elapsed) + ' FPS';
		this.fpsStart = now;
		this.fpsFrames = 0;
	}

	setHover(on) { this.ring.setAttribute('r', on ? 9 : 4); this.ring.setAttribute('stroke', on ? '#ff6ad5' : '#fff'); }

	setCharge(c) {
		this.charge.setAttribute('r', (c * 22).toFixed(1));
		this.charge.setAttribute('opacity', c > 0 ? 0.8 : 0);
	}

	showToast(text, sub) {
		this.toast.innerHTML = text + (sub ? '<br><span style="font-size:0.7em;opacity:0.7;letter-spacing:0.2em">' + sub + '</span>' : '');
		this.toast.classList.add('show');
		clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(() => this.toast.classList.remove('show'), 4500);
	}

	showHint(text) {
		if (!text) { this.hint.classList.remove('show'); return; }
		this.hint.textContent = text;
		this.hint.classList.add('show');
	}

	setRecording(on) { this.rec.hidden = !on; }

	showJoystick(x, y) {
		this.joystick.hidden = false;
		this.joystick.style.left = (x - 60) + 'px';
		this.joystick.style.top = (y - 60) + 'px';
		this.joystick.style.bottom = 'auto';
	}
	moveJoystick(dx, dy) { this.knob.style.transform = `translate(${dx}px, ${dy}px)`; }
	hideJoystick() { this.joystick.hidden = true; this.knob.style.transform = ''; }
}
