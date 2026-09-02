import * as THREE from 'three';
import { bus, Events } from '../core/EventBus.js';
import { damp, smoothstep } from '../core/Utils.js';

// The elusive one: flees when approached, sings a phrase, and leads you toward what you have not found.
export class Wanderer {
	constructor(scene, heightmap, shared, x, z) {
		this.id = 'wanderer';
		this.title = 'the wanderer';
		this.subtitle = 'a shimmer follows you';
		this.shared = shared;
		this.heightmap = heightmap;
		this.radius = 0;   // discovered by being noticed, not by distance
		this.mesh = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), new THREE.MeshStandardMaterial({ color: '#111', emissive: new THREE.Color('#8ef6ff'), emissiveIntensity: 1.8, flatShading: true }));
		this.mesh.position.set(x, heightmap.height(x, z) + 6, z);
		this.position = this.mesh.position;
		scene.add(this.mesh);
		this.light = new THREE.PointLight('#8ef6ff', 18, 90, 1.8);
		this.mesh.add(this.light);

		// trailing sparks
		const N = 60;
		this.particles = [];
		const pos = new Float32Array(N * 3), info = new Float32Array(N * 3);
		for (let i = 0; i < N; i++) { this.particles.push({ life: Math.random(), v: new THREE.Vector3(), p: new THREE.Vector3() }); info[i * 3] = Math.random() * 6; info[i * 3 + 1] = 0.4; info[i * 3 + 2] = 0.8; }
		this.pGeom = new THREE.BufferGeometry();
		this.pGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		this.pGeom.setAttribute('aInfo', new THREE.BufferAttribute(info, 3));
		this.pMat = new THREE.PointsMaterial({ color: new THREE.Color('#8ef6ff').multiplyScalar(2), size: 1.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
		this.points = new THREE.Points(this.pGeom, this.pMat);
		this.points.frustumCulled = false;
		scene.add(this.points);

		this.target = this.mesh.position.clone();
		this.fleeing = 0;
		this.spin = 0;
		this.time = 0;
		this.noticed = false;
		this.cooldown = 0;
		this.interactables = [];
	}

	pickTarget(player, landmarks) {
		const undiscovered = landmarks.filter((l) => l !== this && !l.discovered);
		const dir = new THREE.Vector3();
		if (undiscovered.length) {
			let best = null, bd = Infinity;
			for (const l of undiscovered) { const d = l.position.distanceTo(player.position); if (d < bd) { bd = d; best = l; } }
			dir.subVectors(best.position, player.position).setY(0).normalize();
		} else {
			dir.copy(player.forward).setY(0).normalize();
		}
		dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.2);
		const dist = 110 + Math.random() * 70;
		let x = player.position.x + dir.x * dist, z = player.position.z + dir.z * dist;
		for (let i = 0; i < 6 && this.heightmap.depthAt(x, z) > -2; i++) {
			dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.7);
			x = player.position.x + dir.x * dist; z = player.position.z + dir.z * dist;
		}
		this.target.set(x, 0, z);
	}

	update(dt, shared, landmarks) {
		this.time += dt;
		this.cooldown -= dt;
		const player = shared.player;
		const d = player.position.distanceTo(this.mesh.position);
		shared.wandererProximity = smoothstep(220, 25, d);

		if (d < 42 && this.cooldown <= 0) {
			this.pickTarget(player, landmarks);
			this.fleeing = 1;
			this.spin = 1;
			this.cooldown = 3;
			if (shared.conductor) shared.conductor.wandererPhrase(this.mesh.position);
			bus.emit(Events.RIPPLE, { x: this.mesh.position.x, z: this.mesh.position.z, size: 2, hue: 0.52 });
			if (!this.noticed) { this.noticed = true; this.discovered = true; bus.emit(Events.DISCOVER, { id: this.id, title: this.title, subtitle: this.subtitle }); }
		} else if (d > 320 && this.cooldown <= 0) {
			// keep near the player, leading the way
			this.pickTarget(player, landmarks);
			this.cooldown = 8;
		}

		this.fleeing = damp(this.fleeing, 0, 1.2, dt);
		this.spin = damp(this.spin, 0, 1.5, dt);
		const speed = 0.6 + this.fleeing * 6;
		const gy = Math.max(this.heightmap.height(this.mesh.position.x, this.mesh.position.z), this.heightmap._water);
		this.target.y = gy + 6 + Math.sin(this.time * 1.3) * 1.5;
		this.mesh.position.lerp(this.target, 1 - Math.exp(-speed * dt));
		this.mesh.position.y = damp(this.mesh.position.y, this.target.y, 3, dt);
		this.mesh.rotation.y += dt * (0.8 + this.spin * 14);
		this.mesh.rotation.x += dt * this.spin * 9;
		const s = 1 + Math.sin(this.time * 2) * 0.12 + this.fleeing * 0.4;
		this.mesh.scale.set(s, s, s);
		const hue = (shared.hue + 0.5) % 1;
		this.mesh.material.emissive.setHSL(hue, 0.9, 0.62);
		this.mesh.material.emissiveIntensity = 1.4 + this.fleeing * 3;
		this.light.color.copy(this.mesh.material.emissive);
		this.light.intensity = 15 + this.fleeing * 70;
		this.pMat.color.copy(this.mesh.material.emissive).multiplyScalar(2);

		const pos = this.pGeom.attributes.position.array;
		this.particles.forEach((pt, i) => {
			pt.life -= dt * (0.5 + this.fleeing);
			if (pt.life <= 0) {
				pt.life = 0.6 + Math.random() * 1.2;
				pt.p.copy(this.mesh.position).add(new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4));
				pt.v.set((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3);
			}
			pt.p.addScaledVector(pt.v, dt);
			pos[i * 3] = pt.p.x; pos[i * 3 + 1] = pt.p.y; pos[i * 3 + 2] = pt.p.z;
		});
		this.pGeom.attributes.position.needsUpdate = true;
	}
}
