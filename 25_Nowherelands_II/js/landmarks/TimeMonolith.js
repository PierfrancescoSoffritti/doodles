import * as THREE from 'three';
import { bus, Events } from '../core/EventBus.js';
import { damp } from '../core/Utils.js';

export class TimeMonolith {
	constructor(scene, heightmap, shared, x, z) {
		this.id = 'timeMonolith';
		this.title = 'the still clock';
		this.subtitle = 'something deep begins to breathe';
		this.shared = shared;
		const y = heightmap.height(x, z);
		this.position = new THREE.Vector3(x, y, z);
		this.radius = 100;
		this.group = new THREE.Group();
		this.group.position.set(x, Math.max(y, heightmap.waterAt(x, z) + 0.5) - 1, z);
		scene.add(this.group);

		const stone = new THREE.MeshStandardMaterial({ color: '#1a1530', roughness: 0.9, metalness: 0, envMapIntensity: 0.15, flatShading: true });
		const tiers = [[40, 4], [24, 4], [9, 12]];
		let h = 0;
		for (const [r, t] of tiers) {
			const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, t, 6), stone);
			m.position.y = h + t / 2;
			this.group.add(m);
			h += t;
		}
		this.sphere = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 24), new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.05, emissive: new THREE.Color('#8ef6ff'), emissiveIntensity: 0.08 }));
		this.sphere.position.y = h + 12;
		this.baseY = this.sphere.position.y;
		this.group.add(this.sphere);
		this.ring = new THREE.Mesh(new THREE.TorusGeometry(10, 0.25, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#8ef6ff').multiplyScalar(2) }));
		this.ring.position.y = this.sphere.position.y;
		this.ring.rotation.x = Math.PI / 2;
		this.group.add(this.ring);
		this.light = new THREE.PointLight('#8ef6ff', 12, 160, 1.7);
		this.light.position.y = this.sphere.position.y;
		this.group.add(this.light);

		shared.colliders.push({ position: this.position, radius: 30 });
		this.fast = false;
		this.hover = 0;
		this.flash = 0;
		this.time = 0;
		this.interactables = [{ mesh: this.sphere, landmark: this, onPress: (c) => this.press(c), onHover: (hv) => { this.hoverTarget = hv; } }];
	}

	press() {
		this.fast = !this.fast;
		bus.emit(Events.TOGGLE_TIME, { fast: this.fast });
		this.flash = 1.5;
		const p = this.sphere.getWorldPosition(new THREE.Vector3());
		if (this.shared.conductor) this.shared.conductor.timeChime(p, this.fast);
		bus.emit(Events.RIPPLE, { x: p.x, z: p.z, size: 3, hue: 0.52 });
		bus.emit(Events.TOAST, { text: this.fast ? 'time quickens' : 'time settles' });
	}

	update(dt, shared) {
		this.time += dt * (this.fast ? 4 : 1);
		this.flash = damp(this.flash, 0, 3, dt);
		this.hover = damp(this.hover, this.hoverTarget ? 1 : 0, 10, dt);
		this.sphere.position.y = this.baseY + Math.sin(this.time * 0.9) * 2;
		this.sphere.rotation.y += dt * (this.fast ? 2.5 : 0.2);
		this.ring.rotation.z += dt * (this.fast ? 1.6 : 0.15);
		this.ring.rotation.x = Math.PI / 2 + Math.sin(this.time * 0.3) * 0.5;
		this.ring.position.y = this.sphere.position.y;
		const hue = this.fast ? 0.08 : 0.52;
		this.sphere.material.emissive.setHSL(hue, 0.9, 0.6);
		this.sphere.material.emissiveIntensity = 0.1 + this.flash * 2 + this.hover * 0.7;
		this.ring.material.color.setHSL(hue, 0.9, 0.6).multiplyScalar(2 + this.flash * 3);
		this.light.color.setHSL(hue, 0.9, 0.6);
		this.light.intensity = 10 + this.flash * 70;
	}
}
