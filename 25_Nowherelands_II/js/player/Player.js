import * as THREE from 'three';
import { bus, Events } from '../core/EventBus.js';
import { config } from '../core/Config.js';
import { clamp, clamp01, damp } from '../core/Utils.js';

const WALK = 42, SPRINT = 80;

export class Player {
	constructor(camera, canvas, heightmap, shared) {
		this.camera = camera;
		this.canvas = canvas;
		this.heightmap = heightmap;
		this.shared = shared;
		camera.rotation.order = 'YXZ';
		this.yaw = Math.PI;      // face -z
		this.pitch = 0;
		this.position = camera.position;
		this.position.set(0, 20, 0);
		this.velocity = new THREE.Vector3();
		this.forward = new THREE.Vector3(0, 0, -1);
		this.keys = new Set();
		this.locked = false;
		this.enabled = false;
		this.speed = 0;
		this.speed01 = 0;
		this.lookTimer = 0;
		this.looking = false;
		this.bobPhase = 0;
		this.baseFov = 66;
		this.fov = this.baseFov;
		this.groundY = 20;
		this.stepAccumulator = 0;
		this.stillTime = 0;
		this.planted = false;
		this.pressStart = null;
		this.touch = { move: null, look: null, moveVec: new THREE.Vector2(), lookLast: new THREE.Vector2(), tapStart: 0, tapMoved: false };
		this.gamepadPress = false;
		this.yawRate = 0;
		this.prevYaw = this.yaw;
		this.wading = false;

		this.bind();
	}

	bind() {
		const c = this.canvas;
		document.addEventListener('keydown', (e) => {
			if (e.repeat) return;
			this.keys.add(e.code);
			if (e.code === 'KeyR' && this.enabled) bus.emit('record');
		});
		document.addEventListener('keyup', (e) => this.keys.delete(e.code));
		window.addEventListener('blur', () => this.keys.clear());

		if (!config.isTouch) {
			document.addEventListener('pointerlockchange', () => {
				this.locked = document.pointerLockElement === c;
				this.shared.hud.setPaused(!this.locked && this.enabled);
			});
			c.addEventListener('click', () => { if (this.enabled && !this.locked) { try { const r = c.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* unsupported */ } } });
			document.addEventListener('mousemove', (e) => {
				if (!this.locked) return;
				this.rotate(e.movementX, e.movementY, 0.0021);
			});
			document.addEventListener('mousedown', (e) => { if (this.locked && e.button === 0) this.press(); });
			document.addEventListener('mouseup', (e) => { if (this.locked && e.button === 0) this.release(); });
		} else {
			c.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
			c.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
			c.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
			c.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });
		}
	}

	rotate(dx, dy, sens) {
		this.yaw -= dx * sens;
		this.pitch = clamp(this.pitch - dy * sens, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
		this.lookTimer = 0.5;
	}

	press() { this.pressStart = performance.now(); bus.emit(Events.PRESS_START, {}); }
	release() {
		if (this.pressStart === null) return;
		const duration = (performance.now() - this.pressStart) / 1000;
		this.pressStart = null;
		bus.emit(Events.PRESS_END, { duration });
	}

	// ---- touch ----
	onTouchStart(e) {
		e.preventDefault();
		if (!this.enabled) return;
		for (const t of e.changedTouches) {
			if (t.clientX < innerWidth / 2 && !this.touch.move) {
				this.touch.move = { id: t.identifier, x: t.clientX, y: t.clientY };
				this.shared.hud.showJoystick(t.clientX, t.clientY);
			} else if (!this.touch.look) {
				this.touch.look = { id: t.identifier };
				this.touch.lookLast.set(t.clientX, t.clientY);
				this.touch.tapStart = performance.now();
				this.touch.tapMoved = false;
				this.press();
			}
		}
	}
	onTouchMove(e) {
		e.preventDefault();
		for (const t of e.changedTouches) {
			if (this.touch.move && t.identifier === this.touch.move.id) {
				const dx = t.clientX - this.touch.move.x, dy = t.clientY - this.touch.move.y;
				const len = Math.hypot(dx, dy), max = 50;
				const k = len > max ? max / len : 1;
				this.touch.moveVec.set(dx * k / max, dy * k / max);
				this.shared.hud.moveJoystick(dx * k, dy * k);
			} else if (this.touch.look && t.identifier === this.touch.look.id) {
				const dx = t.clientX - this.touch.lookLast.x, dy = t.clientY - this.touch.lookLast.y;
				if (Math.abs(dx) + Math.abs(dy) > 6) this.touch.tapMoved = true;
				this.touch.lookLast.set(t.clientX, t.clientY);
				this.rotate(dx, dy, 0.0045);
			}
		}
	}
	onTouchEnd(e) {
		e.preventDefault();
		for (const t of e.changedTouches) {
			if (this.touch.move && t.identifier === this.touch.move.id) {
				this.touch.move = null;
				this.touch.moveVec.set(0, 0);
				this.shared.hud.hideJoystick();
			} else if (this.touch.look && t.identifier === this.touch.look.id) {
				this.touch.look = null;
				if (this.touch.tapMoved) this.pressStart = null; else this.release();
			}
		}
	}

	pollGamepad(input) {
		const pads = navigator.getGamepads ? navigator.getGamepads() : [];
		const gp = pads && pads[0];
		if (!gp) return;
		const dz = (v) => Math.abs(v) < 0.15 ? 0 : v;
		input.x += dz(gp.axes[0] || 0);
		input.z += dz(gp.axes[1] || 0);
		const lx = dz(gp.axes[2] || 0), ly = dz(gp.axes[3] || 0);
		if (lx || ly) this.rotate(lx * 18, ly * 18, 0.0021 * 1.6);
		const pressed = (gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[7] && gp.buttons[7].value > 0.5);
		if (pressed && !this.gamepadPress) this.press();
		if (!pressed && this.gamepadPress) this.release();
		this.gamepadPress = pressed;
		if (gp.buttons[1] && gp.buttons[1].pressed) input.sprint = true;
	}

	update(dt, time) {
		const input = { x: 0, z: 0, sprint: false };
		const active = this.enabled && (this.locked || config.isTouch);
		if (active) {
			const k = this.keys;
			if (k.has('KeyW') || k.has('ArrowUp')) input.z -= 1;
			if (k.has('KeyS') || k.has('ArrowDown')) input.z += 1;
			if (k.has('KeyA') || k.has('ArrowLeft')) input.x -= 1;
			if (k.has('KeyD') || k.has('ArrowRight')) input.x += 1;
			if (k.has('ShiftLeft') || k.has('ShiftRight')) input.sprint = true;
			input.x += this.touch.moveVec.x;
			input.z += this.touch.moveVec.y;
			this.pollGamepad(input);
		}
		const len = Math.hypot(input.x, input.z);
		if (len > 1) { input.x /= len; input.z /= len; }

		const max = input.sprint ? SPRINT : WALK;
		const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
		const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
		const target = new THREE.Vector3().addScaledVector(fwd, -input.z * max).addScaledVector(right, input.x * max);

		const accel = len > 0 ? 6 : 8;
		this.velocity.x = damp(this.velocity.x, target.x, accel, dt);
		this.velocity.z = damp(this.velocity.z, target.z, accel, dt);
		// slope resistance
		const slope = this.heightmap.slope(this.position.x, this.position.z);
		const slopeK = 1 / (1 + slope * 0.9);
		this.position.x += this.velocity.x * dt * slopeK;
		this.position.z += this.velocity.z * dt * slopeK;

		// keep out of solid landmarks
		for (const c of this.shared.colliders) {
			const dx = this.position.x - c.position.x, dz = this.position.z - c.position.z;
			const d = Math.hypot(dx, dz);
			if (d < c.radius && d > 0.001) {
				const k = c.radius / d;
				this.position.x = c.position.x + dx * k;
				this.position.z = c.position.z + dz * k;
			}
		}

		this.speed = Math.hypot(this.velocity.x, this.velocity.z) * slopeK;
		this.speed01 = clamp01(this.speed / SPRINT);

		// ground
		const h = this.heightmap.height(this.position.x, this.position.z);
		const ground = Math.max(h, this.heightmap.waterLevel - 1.5);
		this.groundY = damp(this.groundY, ground, 12, dt);

		// bob & sway
		this.bobPhase += dt * (4 + this.speed * 0.14) * (this.speed01 > 0.03 ? 1 : 0);
		const bob = Math.sin(this.bobPhase) * 0.45 * this.speed01 + Math.sin(time * 0.6) * 0.06;
		this.position.y = this.groundY + config.world.eyeHeight + bob;

		this.lookTimer -= dt;
		this.looking = this.lookTimer > 0;
		this.camera.rotation.set(this.pitch + Math.sin(time * 0.35) * 0.003, this.yaw + Math.sin(this.bobPhase * 0.5) * 0.004 * this.speed01, Math.sin(this.bobPhase * 0.5) * 0.006 * this.speed01);
		this.camera.getWorldDirection(this.forward);

		this.fov = damp(this.fov, this.baseFov + this.speed01 * 9, 4, dt);
		if (Math.abs(this.camera.fov - this.fov) > 0.01) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }

		// turn rate (for the wind) and wading
		let dy = this.yaw - this.prevYaw;
		dy = Math.atan2(Math.sin(dy), Math.cos(dy));
		this.yawRate = damp(this.yawRate, dt > 0 ? dy / dt : 0, 10, dt);
		this.prevYaw = this.yaw;
		this.wading = h <= this.heightmap.waterLevel - 1;

		// footsteps leave faint rings and play along
		this.stepAccumulator += this.speed * dt;
		if (this.stepAccumulator > 9) {
			this.stepAccumulator = 0;
			bus.emit('footstep', { inWater: this.wading });
		}

		// stillness plants a sprout
		if (this.speed < 0.8 && !this.looking) this.stillTime += dt; else { this.stillTime = 0; this.planted = false; }
		if (this.stillTime > 6 && !this.planted && active) {
			this.planted = true;
			const side = Math.random() < 0.5 ? -1 : 1;
			bus.emit('plant', { x: this.position.x + fwd.x * 9 + right.x * side * 5, z: this.position.z + fwd.z * 9 + right.z * side * 5 });
		}

		// charge feedback
		if (this.pressStart !== null) this.shared.hud.setCharge(clamp01(((performance.now() - this.pressStart) / 1000 - 0.28) / 1.1));
		else this.shared.hud.setCharge(0);
	}
}
