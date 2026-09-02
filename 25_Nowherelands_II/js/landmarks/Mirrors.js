import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { bus, Events } from '../core/EventBus.js';
import { damp } from '../core/Utils.js';

const NEAR = 260;

// Standing mirrors that slowly turn to face you. The nearest ones are true planar reflectors.
export class Mirrors {
	constructor(scene, heightmap, shared, rnd, spots) {
		this.id = 'mirrors';
		this.title = 'the mirrors';
		this.subtitle = 'the valley echoes longer';
		this.shared = shared;
		this.items = [];
		this.interactables = [];
		this.radius = 70;
		this.position = new THREE.Vector3();
		this.fallback = new THREE.MeshStandardMaterial({ color: '#9fa6c8', metalness: 1, roughness: 0.15, side: THREE.DoubleSide });
		for (const spot of spots) {
			const segments = rnd.chance(0.5) ? 4 : 32;
			const size = rnd.chance(0.3) ? rnd.range(22, 34) : (rnd.chance(0.4) ? rnd.range(5, 9) : rnd.range(10, 18));
			const geometry = new THREE.CircleGeometry(size, segments);
			const mesh = new Reflector(geometry, { textureWidth: 512, textureHeight: 512, clipBias: 0.01, color: '#c8c2e0', multisample: 0 });
			mesh.material.side = THREE.DoubleSide;
			mesh.reflectorMaterial = mesh.material;
			mesh.reflectorRender = mesh.onBeforeRender;
			mesh.onBeforeRender = () => {};
			mesh.material = this.fallback;
			const ground = heightmap.height(spot.x, spot.z);
			// at the water's edge the disc wades in, roughly half of it below the surface
			const y = spot.edge ? Math.max(heightmap.waterAt(spot.x, spot.z) + size * rnd.range(0.35, 0.6), ground + size * 0.3) : ground + size + 2;
			mesh.position.set(spot.x, y, spot.z);
			mesh.rotation.y = rnd.range(0, Math.PI * 2);
			scene.add(mesh);
			const frame = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: new THREE.Color('#ff6ad5').multiplyScalar(1.6) }));
			mesh.add(frame);
			const glow = new THREE.PointLight('#ff6ad5', 0, 60, 1.8);
			mesh.add(glow);
			const item = { mesh, size, baseY: mesh.position.y, phase: rnd.range(0, 6), hover: 0, flash: 0, frame, glow, active: false };
			shared.colliders.push({ position: mesh.position, radius: size * 0.9 });
			this.items.push(item);
			this.interactables.push({ mesh, landmark: this, onPress: (c) => this.press(item, c), onHover: (h) => { item.hoverTarget = h; } });
		}
		this.time = 0;
	}

	distanceTo(p) { let d = Infinity; for (const it of this.items) d = Math.min(d, it.mesh.position.distanceTo(p)); return d; }

	press(item, charge) {
		if (this.shared.conductor) this.shared.conductor.mirrorTouch(item.mesh.position);
		item.flash = 1 + charge;
		bus.emit(Events.RIPPLE, { x: item.mesh.position.x, z: item.mesh.position.z, size: 2 + charge * 2, hue: 0.95 });
	}

	setActive(item, on) {
		if (item.active === on) return;
		item.active = on;
		item.mesh.material = on ? item.mesh.reflectorMaterial : this.fallback;
		item.mesh.onBeforeRender = on ? item.mesh.reflectorRender : () => {};
	}

	update(dt, shared) {
		this.time += dt;
		const player = shared.player.position;
		// only the two nearest mirrors within range render real reflections
		const byDist = this.items.map((it) => [it, it.mesh.position.distanceTo(player)]).sort((a, b) => a[1] - b[1]);
		byDist.forEach(([it, d], i) => this.setActive(it, i < 2 && d < NEAR));
		for (const it of this.items) {
			it.flash = damp(it.flash, 0, 3, dt);
			it.hover = damp(it.hover, it.hoverTarget ? 1 : 0, 10, dt);
			const targetYaw = Math.atan2(player.x - it.mesh.position.x, player.z - it.mesh.position.z);
			let d = targetYaw - it.mesh.rotation.y;
			d = Math.atan2(Math.sin(d), Math.cos(d));
			it.mesh.rotation.y += d * (1 - Math.exp(-0.35 * dt));
			it.mesh.position.y = it.baseY + Math.sin(this.time * 0.5 + it.phase) * 1.5;
			it.glow.intensity = it.flash * 40 + it.hover * 8;
			it.frame.material.color.setHSL(shared.hue, 0.9, 0.6).multiplyScalar(1.4 + it.flash * 3 + it.hover * 1.5);
		}
	}
}
