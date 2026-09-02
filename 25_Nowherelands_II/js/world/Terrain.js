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
		// far tier: big coarse chunks that carry the horizon out to several kilometres
		this.far = { size: 1280, segments: 16, radius: 5, chunks: new Map(), queue: [], lastKey: null };
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
		this.updateFar(playerPos);
	}

	updateFar(playerPos) {
		const f = this.far;
		const cx = Math.round(playerPos.x / f.size), cz = Math.round(playerPos.z / f.size);
		const key = this.key(cx, cz);
		if (key !== f.lastKey) {
			f.lastKey = key;
			const needed = new Set();
			f.queue.length = 0;
			const fineReach = this.viewRadius * this.size;
			for (let dz = -f.radius; dz <= f.radius; dz++) {
				for (let dx = -f.radius; dx <= f.radius; dx++) {
					const k = this.key(cx + dx, cz + dz);
					// skip coarse chunks that the fine tier fully covers
					const ox = (cx + dx) * f.size - playerPos.x, oz = (cz + dz) * f.size - playerPos.z;
					const farthestCorner = Math.hypot(Math.abs(ox) + f.size / 2, Math.abs(oz) + f.size / 2);
					if (farthestCorner < fineReach * 0.85) continue;
					needed.add(k);
					if (!f.chunks.has(k)) f.queue.push([cx + dx, cz + dz, dx * dx + dz * dz]);
				}
			}
			f.queue.sort((a, b) => a[2] - b[2]);
			for (const [k, mesh] of f.chunks) {
				if (!needed.has(k)) { this.scene.remove(mesh); mesh.geometry.dispose(); f.chunks.delete(k); }
			}
		}
		let budget = f.chunks.size === 0 ? 100 : 2;
		while (budget-- > 0 && f.queue.length) {
			const [x, z] = f.queue.shift();
			const k = this.key(x, z);
			if (!f.chunks.has(k)) f.chunks.set(k, this.buildFarChunk(x, z));
		}
	}

	buildFarChunk(cx, cz) {
		const f = this.far, size = f.size, seg = f.segments;
		const ox = cx * size, oz = cz * size;
		const geometry = new THREE.PlaneGeometry(size, size, seg, seg);
		geometry.rotateX(-Math.PI / 2);
		const pos = geometry.attributes.position;
		for (let i = 0; i < pos.count; i++) {
			const x = pos.getX(i) + ox, z = pos.getZ(i) + oz;
			pos.setXYZ(i, x, this.heightmap.height(x, z) - 3, z);   // sits just under the fine tier where they overlap
		}
		geometry.deleteAttribute('normal');
		geometry.deleteAttribute('uv');
		geometry.computeBoundingSphere();
		const mesh = new THREE.Mesh(geometry, this.material);
		this.scene.add(mesh);
		return mesh;
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
