import * as THREE from 'three';
import { config } from '../core/Config.js';
import { createTerrainMaterial } from './TerrainMaterial.js';
import { Vegetation } from './Vegetation.js';

// Endless chunked terrain streamed around the player, with vegetation attached per chunk.
export class Terrain {
	constructor(scene, heightmap, shared) {
		this.scene = scene;
		this.heightmap = heightmap;
		this.material = createTerrainMaterial(shared);
		this.vegetation = new Vegetation(scene, heightmap, shared);
		this.chunks = new Map();
		this.queue = [];
		this.size = config.world.chunkSize;
		this.segments = config.world.chunkSegments;
		this.viewRadius = config.world.viewRadius;
		this.lastKey = null;
	}

	key(cx, cz) { return cx + ',' + cz; }

	update(playerPos, dt) {
		const cx = Math.round(playerPos.x / this.size);
		const cz = Math.round(playerPos.z / this.size);
		const key = this.key(cx, cz);

		this.vegetation.centerX = cx;
		this.vegetation.centerZ = cz;
		if (key !== this.lastKey) {
			this.lastKey = key;
			this.refreshNeeded(cx, cz);
		}

		// Build a few chunks per frame, nearest first.
		let budget = this.chunks.size === 0 ? 40 : 3;
		while (budget-- > 0 && this.queue.length) {
			const [x, z] = this.queue.shift();
			const k = this.key(x, z);
			if (!this.chunks.has(k)) this.chunks.set(k, this.buildChunk(x, z));
		}

		this.vegetation.update(dt, cx, cz);
	}

	refreshNeeded(cx, cz) {
		const r = this.viewRadius;
		const needed = new Set();
		this.queue.length = 0;
		for (let dz = -r; dz <= r; dz++) {
			for (let dx = -r; dx <= r; dx++) {
				if (dx * dx + dz * dz > (r + 0.5) * (r + 0.5)) continue;
				const k = this.key(cx + dx, cz + dz);
				needed.add(k);
				if (!this.chunks.has(k)) this.queue.push([cx + dx, cz + dz, dx * dx + dz * dz]);
			}
		}
		this.queue.sort((a, b) => a[2] - b[2]);

		for (const [k, chunk] of this.chunks) {
			if (!needed.has(k)) {
				this.scene.remove(chunk.mesh);
				chunk.mesh.geometry.dispose();
				this.vegetation.removeChunk(k);
				this.chunks.delete(k);
			}
		}
	}

	buildChunk(cx, cz) {
		const size = this.size, seg = this.segments;
		const ox = cx * size, oz = cz * size;
		const geometry = new THREE.PlaneGeometry(size, size, seg, seg);
		geometry.rotateX(-Math.PI / 2);
		const pos = geometry.attributes.position;
		for (let i = 0; i < pos.count; i++) {
			const x = pos.getX(i) + ox, z = pos.getZ(i) + oz;
			pos.setXYZ(i, x, this.heightmap.height(x, z), z);
		}
		geometry.deleteAttribute('normal');
		geometry.deleteAttribute('uv');
		geometry.computeBoundingSphere();
		const mesh = new THREE.Mesh(geometry, this.material);
		mesh.frustumCulled = true;
		this.scene.add(mesh);
		this.vegetation.addChunk(this.key(cx, cz), cx, cz);
		return { mesh, cx, cz };
	}
}
