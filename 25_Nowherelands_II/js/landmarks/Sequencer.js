import * as THREE from 'three';
import { bus, Events } from '../core/EventBus.js';
import { damp } from '../core/Utils.js';

const SLOTS = 16, RADIUS = 46;
const INITIAL = [0, -1, 2, -1, 4, -1, 1, -1, 3, -1, -1, 2, -1, 0, 4, -1];

// A ring of sixteen monoliths that is also a step sequencer. A light orbits as the playhead.
export class Sequencer {
	constructor(scene, heightmap, shared, x, z) {
		this.id = 'spiral';
		this.title = 'the spiral';
		this.subtitle = 'a melody joins the drone';
		this.shared = shared;
		this.heightmap = heightmap;
		this.position = new THREE.Vector3(x, heightmap.height(x, z), z);
		this.radius = 110;
		this.group = new THREE.Group();
		scene.add(this.group);

		const geometry = new THREE.CylinderGeometry(2.6, 3.6, 1, 4, 1);
		geometry.rotateY(Math.PI / 4);
		geometry.translate(0, 0.5, 0);
		this.items = [];
		this.interactables = [];
		for (let i = 0; i < SLOTS; i++) {
			const a = (i / SLOTS) * Math.PI * 2;
			const px = x + Math.cos(a) * RADIUS, pz = z + Math.sin(a) * RADIUS;
			const py = heightmap.height(px, pz);
			const material = new THREE.MeshStandardMaterial({ color: '#0b0719', roughness: 0.9, metalness: 0, envMapIntensity: 0.15, flatShading: true, emissive: new THREE.Color('#ff6ad5'), emissiveIntensity: 0.08 });
			const mesh = new THREE.Mesh(geometry, material);
			const height = i % 4 === 0 ? 16 : (i % 2 === 0 ? 11 : 8);
			mesh.position.set(px, py - 0.5, pz);
			mesh.scale.set(1, height, 1);
			mesh.rotation.y = -a;
			this.group.add(mesh);
			const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), new THREE.LineBasicMaterial({ color: '#ff6ad5' }));
			mesh.add(edges);
			shared.colliders.push({ position: mesh.position, radius: 5.5 });
			const item = { mesh, edges, degree: INITIAL[i], baseHeight: height, flash: 0, bump: 0, hover: 0, index: i, hueOffset: i / SLOTS };
			this.items.push(item);
			this.interactables.push({ mesh, landmark: this, onPress: (charge) => this.press(item, charge), onHover: (h) => { item.hoverTarget = h; } });
		}

		// centre: hovering wireframe octahedron and playhead light
		this.core = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(7, 0)), new THREE.LineBasicMaterial({ color: new THREE.Color('#8ef6ff').multiplyScalar(1.8) }));
		this.core.position.copy(this.position).add(new THREE.Vector3(0, 26, 0));
		this.group.add(this.core);
		this.coreLight = new THREE.PointLight('#8ef6ff', 14, 220, 1.6);
		this.coreLight.position.copy(this.core.position);
		this.group.add(this.coreLight);

		this.playhead = new THREE.PointLight('#ff6ad5', 22, 90, 1.6);
		this.playhead.position.copy(this.position);
		this.group.add(this.playhead);
		this.playheadOrb = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6ad5').multiplyScalar(2.5) }));
		this.group.add(this.playheadOrb);
		this.playTarget = this.position.clone().add(new THREE.Vector3(0, 12, 0));

		this.registered = false;
		this.time = 0;
	}

	register(conductor) {
		this.conductor = conductor;
		conductor.scheduler.onStep((step, time) => this.onStep(step, time));
		this.registered = true;
	}

	onStep(step, time) {
		const item = this.items[step % SLOTS];
		const delay = Math.max(0, (time - this.conductor.engine.now) * 1000);
		setTimeout(() => {
			this.playTarget.copy(item.mesh.position).add(new THREE.Vector3(0, item.baseHeight + 6, 0));
			if (item.degree >= 0) item.flash = 1;
		}, delay);
		if (item.degree < 0) return;
		const scale = this.conductor.scale;
		this.conductor.engine.playTone({
			freq: scale.freq(item.degree, 1), time, position: item.mesh.position,
			duration: 0.25, velocity: 0.34, type: 'triangle', detune: 6, attack: 0.008, release: 1.5, dest: this.conductor.engine.playerBus,
			cutoff: 1800, cutoffEnv: 3, reverb: 0.75, delay: 0.4, layer: 'sequencer', octaveLayer: 0.4,
		});
	}

	press(item, charge) {
		if (!this.conductor) return;
		if (charge < 0.05) {
			// quick touch: cycle the slot's pitch
			const len = this.conductor.scale.length;
			item.degree = item.degree >= len ? -1 : item.degree + 1;
			if (item.degree >= 0) this.conductor.monolithNote(item.degree, item.mesh.position, 0);
			else this.conductor.monolithOff(item.mesh.position);
		} else {
			const degree = item.degree >= 0 ? item.degree : 0;
			this.conductor.monolithNote(degree, item.mesh.position, charge);
			bus.emit(Events.RIPPLE, { x: item.mesh.position.x, z: item.mesh.position.z, size: 1 + charge * 3, hue: this.shared.hue + item.hueOffset });
		}
		item.bump = 1 + charge;
		item.flash = 1 + charge;
	}

	update(dt, shared) {
		this.time += dt;
		if (!this.registered && shared.conductor) this.register(shared.conductor);
		const hue = shared.hue;
		for (const item of this.items) {
			item.flash = damp(item.flash, 0, 4, dt);
			item.bump = damp(item.bump, 0, 6, dt);
			item.hover = damp(item.hover, item.hoverTarget ? 1 : 0, 10, dt);
			const on = item.degree >= 0;
			const m = item.mesh.material;
			m.emissive.setHSL((hue + 0.92 + item.hueOffset * 0.14) % 1, 0.85, 0.5);
			m.emissiveIntensity = (on ? 0.03 + (item.degree / 7) * 0.04 : 0.01) + item.flash * 1.2 + item.hover * 0.16;
			item.edges.material.color.copy(m.emissive).multiplyScalar((on ? 1.2 + (item.degree / 7) * 0.8 : 0.25) + item.flash * 4 + item.hover * 1.5);
			item.mesh.scale.y = item.baseHeight * (1 + item.bump * 0.08);
			item.mesh.scale.x = item.mesh.scale.z = 1 + item.bump * 0.12;
		}
		this.core.rotation.y = this.time * 0.25;
		this.core.position.y = this.position.y + 26 + Math.sin(this.time * 0.8) * 2;
		this.playhead.position.lerp(this.playTarget, 1 - Math.exp(-9 * dt));
		this.playheadOrb.position.copy(this.playhead.position);
		const a = shared.audio ? shared.audio.analysis.attack : 0;
		this.coreLight.intensity = 12 + a * 30;
		this.coreLight.color.setHSL((hue + 0.5) % 1, 0.8, 0.65);
	}
}
