import * as THREE from 'three';
import { bus, Events } from '../core/EventBus.js';
import { damp } from '../core/Utils.js';

export class Octahedrons {
	constructor(scene, heightmap, shared, rnd, x, z) {
		this.id = 'octahedrons';
		this.title = 'the hollow stones';
		this.subtitle = 'bells ring across the valley';
		this.shared = shared;
		this.position = new THREE.Vector3(x, heightmap.height(x, z), z);
		this.radius = 120;
		this.group = new THREE.Group();
		scene.add(this.group);
		this.items = [];
		this.interactables = [];
		for (let i = 0; i < 4; i++) {
			const spot = heightmap.findFlatSpot(rnd, x, z, 70, 0.5, 3);
			const size = rnd.range(6, 12);
			const material = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.12, emissive: new THREE.Color('#ff6ad5'), emissiveIntensity: 0.02 });
			const main = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), material);
			main.position.set(spot.x, heightmap.height(spot.x, spot.z) + size * 1.6, spot.z);
			const sats = [];
			for (let k = 0; k < 2; k++) {
				const s = new THREE.Mesh(new THREE.OctahedronGeometry(size * 0.25, 0), material);
				sats.push(s);
				this.group.add(s);
			}
			this.group.add(main);
			const edges = new THREE.LineSegments(new THREE.EdgesGeometry(main.geometry), new THREE.LineBasicMaterial({ color: '#ff6ad5' }));
			main.add(edges);
			shared.colliders.push({ position: main.position, radius: size * 1.4 });
			const light = new THREE.PointLight('#ff6ad5', 6, 120, 1.8);
			light.position.copy(main.position);
			this.group.add(light);
			const item = { main, edges, sats, light, size, baseY: main.position.y, rotTarget: new THREE.Vector2(0, 0), flash: 0, hover: 0, phase: rnd.range(0, 6), index: i };
			this.items.push(item);
			this.interactables.push({ mesh: main, landmark: this, onPress: (c) => this.press(item, c), onHover: (h) => { item.hoverTarget = h; } });
		}
		this.time = 0;
	}

	press(item, charge) {
		const conductor = this.shared.conductor;
		if (!conductor) return;
		conductor.octahedronNote(item.index, item.main.position, charge);
		item.rotTarget.x += Math.PI / 2;
		item.rotTarget.y += Math.PI / 2 * (charge > 0.3 ? 2 : 1);
		item.flash = 1 + charge * 2;
		bus.emit(Events.RIPPLE, { x: item.main.position.x, z: item.main.position.z, size: 1.5 + charge * 3, hue: (this.shared.hue + 0.5) % 1 });
	}

	update(dt, shared) {
		this.time += dt;
		const hue = shared.hue;
		const attack = shared.audio ? shared.audio.analysis.attack : 0;
		for (const it of this.items) {
			it.flash = damp(it.flash, 0, 3, dt);
			it.hover = damp(it.hover, it.hoverTarget ? 1 : 0, 10, dt);
			it.main.rotation.y = damp(it.main.rotation.y, it.rotTarget.x, 4, dt);
			it.main.rotation.z = damp(it.main.rotation.z, it.rotTarget.y, 4, dt);
			it.main.position.y = it.baseY + Math.sin(this.time * 0.6 + it.phase) * 1.5;
			const s = 1 + it.flash * 0.15;
			it.main.scale.set(s, s, s);
			it.main.material.emissive.setHSL((hue + 0.5 + it.index * 0.08) % 1, 0.9, 0.55);
			it.main.material.emissiveIntensity = 0.02 + it.flash * 1.2 + it.hover * 0.25 + attack * 0.08;
			it.edges.material.color.copy(it.main.material.emissive).multiplyScalar(1.5 + it.flash * 4 + it.hover * 1.5 + attack * 0.8);
			it.light.intensity = 5 + it.flash * 60 + attack * 8;
			it.light.color.copy(it.main.material.emissive);
			it.sats.forEach((sat, k) => {
				const sp = k === 0 ? 1 : -0.55, r = it.size * 1.6;
				const a1 = this.time * 0.9 * sp + it.phase, a2 = this.time * 0.45 * sp;
				sat.position.set(
					it.main.position.x + r * Math.sin(a1) * Math.cos(a2),
					it.main.position.y + r * Math.sin(a1) * Math.sin(a2),
					it.main.position.z + r * Math.cos(a1));
				sat.rotation.x = this.time * sp; sat.rotation.y = this.time * 0.7 * sp;
			});
		}
	}
}
