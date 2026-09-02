import * as THREE from 'three';
import { bus, Events } from '../core/EventBus.js';
import { Random } from '../core/Random.js';
import { config } from '../core/Config.js';
import { clamp01 } from '../core/Utils.js';
import { Sequencer } from './Sequencer.js';
import { Octahedrons } from './Octahedrons.js';
import { TimeMonolith } from './TimeMonolith.js';
import { Mirrors } from './Mirrors.js';
import { Wanderer } from './Wanderer.js';

// Places landmarks around the spawn, handles gaze/press interaction and discovery.
export class Landmarks {
	constructor(scene, heightmap, shared, camera) {
		this.shared = shared;
		this.camera = camera;
		const rnd = new Random(config.seed + ':landmarks');
		const place = (rMin, rMax, baseAngle) => {
			const a = baseAngle + rnd.range(-0.5, 0.5), r = rnd.range(rMin, rMax);
			return heightmap.findFlatSpot(rnd, Math.cos(a) * r, Math.sin(a) * r, 90, 0.3, 6);
		};
		const a0 = rnd.range(0, Math.PI * 2);
		const s1 = place(240, 340, a0);
		const s2 = place(380, 520, a0 + 2.1);
		// the still clock likes a flat shore; most mirrors stand at the water's edge so they double in it
		const a3 = a0 + 4.2 + rnd.range(-0.5, 0.5), r3 = rnd.range(420, 620);
		const s3 = heightmap.findShoreSpot(rnd, Math.cos(a3) * r3, Math.sin(a3) * r3, 220, 45);
		const mirrorSpots = [];
		for (let i = 0; i < 7; i++) {
			const a = rnd.range(0, Math.PI * 2), r = rnd.range(200, 900);
			mirrorSpots.push(i < 5 ? heightmap.findWaterEdgeSpot(rnd, Math.cos(a) * r, Math.sin(a) * r, 180) : place(220, 900, a));
		}
		const w = place(120, 170, a0 + 1);

		this.list = [
			new Sequencer(scene, heightmap, shared, s1.x, s1.z),
			new Octahedrons(scene, heightmap, shared, rnd, s2.x, s2.z),
			new TimeMonolith(scene, heightmap, shared, s3.x, s3.z),
			new Mirrors(scene, heightmap, shared, rnd, mirrorSpots),
			new Wanderer(scene, heightmap, shared, w.x, w.z),
		];
		for (const l of this.list) l.discovered = false;

		this.interactables = this.list.flatMap((l) => l.interactables || []);
		this.meshes = this.interactables.map((i) => i.mesh);
		this.raycaster = new THREE.Raycaster();
		this.raycaster.far = 140;
		this.hovered = null;
		this.frame = 0;

		bus.on(Events.PRESS_END, ({ duration }) => {
			// re-aim on release so a click never falls between two gaze updates
			const target = this.aim() || this.hovered;
			if (!target) return;
			const charge = clamp01((duration - 0.28) / 1.1);
			target.onPress(charge);
		});
	}

	addFireflies(fireflies) {
		const hues = { spiral: 0.9, octahedrons: 0.5, timeMonolith: 0.5, mirrors: 0.1 };
		for (const l of this.list) {
			if (l.id === 'wanderer') continue;
			if (l.id === 'mirrors') { for (const it of l.items) fireflies.addCluster(it.mesh.position.x, it.mesh.position.z, 30, 12, 0.9); continue; }
			fireflies.addCluster(l.position.x, l.position.z, 80, 60, hues[l.id]);
		}
	}

	aim() {
		const p = this.shared.player.position;
		this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
		const near = this.interactables.filter((i) => i.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(p) < 160);
		const hits = this.raycaster.intersectObjects(near.map((i) => i.mesh), false);
		return hits.length ? near.find((i) => i.mesh === hits[0].object) : null;
	}

	update(dt, shared) {
		this.frame++;
		for (const l of this.list) l.update(dt, shared, this.list);

		// discovery by proximity
		const p = shared.player.position;
		for (const l of this.list) {
			if (l.discovered || l.radius <= 0) continue;
			const d = l.distanceTo ? l.distanceTo(p) : l.position.distanceTo(p);
			if (d < l.radius) {
				l.discovered = true;
				bus.emit(Events.DISCOVER, { id: l.id, title: l.title, subtitle: l.subtitle });
			}
		}

		// gaze
		if (this.frame % 2 === 0) {
			const hit = this.aim();
			if (hit !== this.hovered) {
				if (this.hovered) this.hovered.onHover(false);
				if (hit) hit.onHover(true);
				this.hovered = hit;
				shared.hud.setHover(!!hit);
			}
		}
	}
}
