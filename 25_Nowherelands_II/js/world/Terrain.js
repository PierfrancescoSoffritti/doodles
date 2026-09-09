import { terrainMeshData } from './TerrainMeshData.js';
import * as THREE from 'three';
import { config } from '../core/Config.js';
import { createTerrainMaterial } from './TerrainMaterial.js';
import { Vegetation } from './Vegetation.js?v=birds-10';

// Quadtree terrain: the whole continent is always on screen, from 3 m cells at the player's feet
// to 300 m cells on the far horizon. Every node is a 48x48 grid with a skirt hanging off its
// edges to hide the cracks between neighbours of different detail.
const SEG = 48;
const ROOT = 40960;                  // covers the 16 km world wherever the spawn ends up
const MAX_DEPTH = 9;                 // 80 m leaves beside rivers/cave mouths; 160 m elsewhere
const RIVER_DEPTH = 8;               // the finest level away from rivers
const LOD_FACTOR = config.isTouch ? 1.3 : 1.7;
const BUILD_BUDGET_MS = 3;
const KEEP_FRAMES = 900;

function buildIndex(seg) {
	const n = seg + 1;
	const idx = [];
	for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
		const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
		idx.push(a, c, b, b, c, d);
	}
	// skirts: 4 rows of n vertices appended after the grid, one per edge
	let base = n * n;
	const edge = (grid, skirt, flip) => {
		for (let k = 0; k < seg; k++) {
			const g0 = grid(k), g1 = grid(k + 1), s0 = skirt(k), s1 = skirt(k + 1);
			if (flip) idx.push(g0, s0, g1, g1, s0, s1); else idx.push(g0, g1, s0, g1, s1, s0);
		}
	};
	edge((k) => k, (k) => base + k, false); base += n;                                  // z = 0 (top)
	edge((k) => seg * n + k, (k) => base + k, true); base += n;                         // z = seg (bottom)
	edge((k) => k * n, (k) => base + k, true); base += n;                               // x = 0 (left)
	edge((k) => k * n + seg, (k) => base + k, false);                                   // x = seg (right)
	return new THREE.BufferAttribute(new Uint32Array(idx), 1);
}

export class Terrain {
	constructor(scene, heightmap, shared) {
		this.scene = scene;
		this.heightmap = heightmap;
		this.shared = shared;
		this.material = createTerrainMaterial(shared, heightmap);
		shared.terrainUniforms = this.material.uniforms;
		this.vegetation = new Vegetation(scene, heightmap, shared);
		this.index = buildIndex(SEG);
		this.nodes = new Map();
		this.riverNodes = new Map();
		this.requests = [];
		this.frame = 0;
		this.vegKey = null;
		this.vegQueue = [];
		this.stats = { nodes: 0, drawn: 0, builds: 0 };
	}

	key(depth, ix, iz) { return depth * 1e6 + ix * 1000 + iz; }

	// Narrow water and cave mouths need fine surface geometry. Buried passages do
	// not force extra terrain subdivisions hundreds of metres above the player.
	hasRiver(key, cx, cz, size) {
		let v = this.riverNodes.get(key);
		if (v === undefined) {
			const m = size * 0.5 + 12;
			v = this.heightmap.rivers.segmentsIn(cx - m, cz - m, cx + m, cz + m).size > 0 || this.heightmap.caves.hasOpening(cx,cz);
			this.riverNodes.set(key, v);
		}
		return v;
	}

	update(playerPos, dt) {
		this.frame++;
		const deadline = performance.now() + BUILD_BUDGET_MS;
		const drawn = new Set();
		this.requests.length = 0;
		this.select(0, 0, 0, playerPos, drawn);

		for (const [k, node] of this.nodes) node.mesh.visible = drawn.has(k);

		// build the most urgent missing children within a time budget
		this.requests.sort((a, b) => a.priority - b.priority);
		const stream = this.shared.surfaceWork;
		if (stream?.ready && !this.prewarming) {
			const needed = new Set(this.requests.map(r => `terrain:${r.key}`));
			stream.prune('terrain:', needed);
			for (const r of this.requests) {
				stream.request(`terrain:${r.key}`, { type: 'terrain', depth: r.depth, ix: r.ix, iz: r.iz }, r.priority,
					data => { if (!this.nodes.has(r.key)) this.install(r.depth, r.ix, r.iz, data); });
			}
			stream.drain(deadline);
		} else for (const r of this.requests) {
			if (this.nodes.has(r.key)) continue;
			this.build(r.depth, r.ix, r.iz);
			if (performance.now() >= deadline) break;
		}

		if (this.frame % 120 === 0) this.sweep();
		this.stats.nodes = this.nodes.size;
		this.stats.drawn = drawn.size;

		this.updateVegetation(playerPos, dt, deadline);
	}

	// Build everything needed for the first view before the player enters.
	prewarm(playerPos, maxMs = 1500) {
		this.prewarming = true;
		const t0 = performance.now();
		for (let i = 0; i < 40 && performance.now() - t0 < maxMs; i++) {
			this.update(playerPos, 0);
			if (this.requests.every((r) => this.nodes.has(r.key))) break;
		}
		this.vegetation.centerX = Math.round(playerPos.x / config.world.chunkSize);
		this.vegetation.centerZ = Math.round(playerPos.z / config.world.chunkSize);
		if (this.vegJob) { for (const _ of this.vegJob) {} this.vegJob = null; }
		const t1 = performance.now();
		while (this.vegQueue.length && performance.now() - t1 < maxMs * 0.6) {
			const e = this.vegQueue.shift();
			if (e.far) this.vegetation.addFarChunk(this.vegetation.farKey(e.x, e.z), e.x, e.z);
			else this.vegetation.addChunk(this.vegetation.key(e.x, e.z), e.x, e.z);
		}
		this.prewarming = false;
	}

	select(depth, ix, iz, pos, drawn) {
		const size = ROOT / (1 << depth);
		const cx = -ROOT / 2 + (ix + 0.5) * size, cz = -ROOT / 2 + (iz + 0.5) * size;
		if (this.heightmap.maxHeightIn(cx, cz, size) < -9) return;   // under the sea, out of sight
		const dx = Math.max(Math.abs(pos.x - cx) - size / 2, 0), dz = Math.max(Math.abs(pos.z - cz) - size / 2, 0);
		const dist = Math.hypot(dx, dz);
		const key = this.key(depth, ix, iz);

		if (depth < MAX_DEPTH && dist < size * LOD_FACTOR && (depth < RIVER_DEPTH || this.hasRiver(key, cx, cz, size))) {
			let ready = true;
			for (let q = 0; q < 4; q++) {
				const kx = ix * 2 + (q & 1), kz = iz * 2 + (q >> 1);
				const ks = size / 2, kcx = -ROOT / 2 + (kx + 0.5) * ks, kcz = -ROOT / 2 + (kz + 0.5) * ks;
				if (this.heightmap.maxHeightIn(kcx, kcz, ks) < -9) continue;
				const kk = this.key(depth + 1, kx, kz);
				if (!this.nodes.has(kk)) {
					ready = false;
					const kd = Math.hypot(Math.max(Math.abs(pos.x - kcx) - ks / 2, 0), Math.max(Math.abs(pos.z - kcz) - ks / 2, 0));
					this.requests.push({ key: kk, depth: depth + 1, ix: kx, iz: kz, priority: kd / ks });
				}
			}
			if (ready) {
				const node = this.nodes.get(key);
				if (node) node.used = this.frame;
				for (let q = 0; q < 4; q++) this.select(depth + 1, ix * 2 + (q & 1), iz * 2 + (q >> 1), pos, drawn);
				return;
			}
		}
		let node = this.nodes.get(key);
		if (!node) node = this.build(depth, ix, iz);
		node.used = this.frame;
		drawn.add(key);
	}

	build(depth, ix, iz) {
		return this.install(depth, ix, iz, terrainMeshData(this.heightmap, depth, ix, iz));
	}

	install(depth, ix, iz, { pos, apron, caveMask }) {
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		geometry.setAttribute('aApron',new THREE.BufferAttribute(apron,1));
		geometry.setAttribute('aCave',new THREE.BufferAttribute(caveMask,1));
		geometry.setIndex(this.index);
		geometry.computeBoundingSphere();
		const mesh = new THREE.Mesh(geometry, this.material);
		mesh.frustumCulled = true;
		mesh.visible = false;
		this.scene.add(mesh);
		const node = { mesh, depth, used: this.frame };
		this.nodes.set(this.key(depth, ix, iz), node);
		this.stats.builds++;
		return node;
	}

	sweep() {
		for (const [k, node] of this.nodes) {
			if (this.frame - node.used > KEEP_FRAMES && node.depth > 2) {
				this.scene.remove(node.mesh);
				node.mesh.geometry.dispose();
				this.nodes.delete(k);
			}
		}
	}

	updateVegetation(playerPos, dt, deadline = performance.now() + BUILD_BUDGET_MS) {
		const size = config.world.chunkSize, r = config.world.vegetationRadius;
		const cx = Math.round(playerPos.x / size), cz = Math.round(playerPos.z / size);
		const key = cx + ',' + cz;
		if (key !== this.vegKey) {
			this.vegKey = key;
			this.vegJob?.return(); this.vegJob = null;
			this.vegQueue.length = 0;
			for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
				if (!this.vegetation.chunks.has(this.vegetation.key(cx + dx, cz + dz))) this.vegQueue.push({ x: cx + dx, z: cz + dz, d2: dx * dx + dz * dz });
			}
			// the far layer of giants: blocks of two by two chunks, out to the giant radius
			const fr = config.world.giantRadius, fcx = Math.floor(cx / 2), fcz = Math.floor(cz / 2);
			for (let dz = -fr; dz <= fr; dz++) for (let dx = -fr; dx <= fr; dx++) {
				const fx = fcx + dx, fz = fcz + dz;
				if (!this.vegetation.farChunks.has(this.vegetation.farKey(fx, fz))) this.vegQueue.push({ far: true, x: fx, z: fz, d2: (fx * 2 + 0.5 - cx) ** 2 + (fz * 2 + 0.5 - cz) ** 2 });
			}
			this.vegQueue.sort((a, b) => a.d2 - b.d2);
		}
		this.vegetation.centerX = cx;
		this.vegetation.centerZ = cz;
		// Share the installation budget with terrain and shore textures. A near chunk
		// is published atomically after its cooperative build finishes.
		while (performance.now() < deadline && (this.vegJob || this.vegQueue.length)) {
			if (!this.vegJob) {
				const e = this.vegQueue.shift();
				if (e.far) { this.vegetation.addFarChunk(this.vegetation.farKey(e.x, e.z), e.x, e.z); continue; }
				this.vegJob = this.vegetation.buildChunk(this.vegetation.key(e.x, e.z), e.x, e.z);
			}
			if (this.vegJob.next().done) this.vegJob = null;
		}
		this.vegetation.update(dt, cx, cz);
	}
}
