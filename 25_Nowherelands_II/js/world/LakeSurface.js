import { RIVER_STRIDE as S, RV, surfaceHalfWidth } from './gen/Rivers.js';

const NO_LAKES = Object.freeze([]);

// Basin coverage is shared by lake meshes, terrain wetness and the shore map.
export class LakeSurface {
	constructor(world, resolve = true) {
		this.world = world;
		this.candidateCache = new Map();
		const N = world.res;
		this.ids = world.lakeId ? Int32Array.from(world.lakeId) : new Int32Array(N * N).fill(-1);
		this.outlets = new Map();
		this.inlets = new Map();
		this.receivingLake = world.rivers.map(r => r.toLake ?? -1);
		// Tributaries submerged in a lake's backwater belong to that lake too.
		for (let pass = 0; pass < world.rivers.length; pass++) {
			let changed = false;
			world.rivers.forEach((river, ri) => {
				if (this.receivingLake[ri] >= 0 || !(river.parentId >= 0) || river.count < 2) return;
				const id = this.receivingLake[river.parentId];
				if (!(id >= 0) || river.data[(river.count - 1) * S + RV.WL] > world.lakes[id].level + 0.1) return;
				this.receivingLake[ri] = id; changed = true;
			});
			if (!changed) break;
		}
		for (const [ri, river] of world.rivers.entries()) {
			const id = this.receivingLake[ri];
			if (!(id >= 0) || river.count < 2) continue;
			const d = river.data, list = this.inlets.get(id) || [];
			const level = world.lakes[id].level;
			for (let i = river.count - 2; i >= 0; i--) {
				const o = i * S;
				if (d[o + RV.WL] > level + 0.1) break;
				list.push({ x: d[o], z: d[o + 1], bx: d[o + S], bz: d[o + S + 1], width: surfaceHalfWidth(d[o + RV.W], d[o + RV.D], d[o + RV.BANK]) });
			}
			this.inlets.set(id, list);
		}
		for (const river of world.rivers) {
			if (!(river.fromLake >= 0) || river.toLake === river.fromLake || river.count < 2) continue;
			const d = river.data, x = d[0], z = d[1];
			let dx = d[S] - x, dz = d[S + 1] - z;
			const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
			const list = this.outlets.get(river.fromLake) || [];
			const width = surfaceHalfWidth(d[RV.W], d[RV.D], d[RV.BANK]);
			let bx = x - dx * world.cell, bz = z - dz * world.cell, nearest = Infinity;
			for (const k of world.lakes[river.fromLake].cells) {
				const px = k % N * world.cell - world.size / 2 - world.spawn.x;
				const pz = Math.floor(k / N) * world.cell - world.size / 2 - world.spawn.z;
				if ((px - x) * dx + (pz - z) * dz >= 0) continue;
				const distance = Math.hypot(px - (x - dx * world.cell), pz - (z - dz * world.cell));
				if (distance < nearest) { nearest = distance; bx = px; bz = pz; }
			}
			const lead = Math.min(world.cell, Math.hypot(bx - x, bz - z) * 0.6);
			const cx = x - dx * lead, cz = z - dz * lead, path = [];
			for (let i = 0; i <= 8; i++) {
				const t = i / 8, u = 1 - t;
				path.push([u * u * bx + 2 * u * t * cx + t * t * x, u * u * bz + 2 * u * t * cz + t * t * z]);
			}
			list.push({ x, z, bx, bz, dx, dz, path, width, depth: Math.max(1, d[RV.D]), level: world.lakes[river.fromLake].level, reach: d[RV.W] * 0.5 + world.cell * 2 });
			this.outlets.set(river.fromLake, list);
		}
		this.drainCells = new Map();
		for (const river of world.rivers) {
			if (!(river.fromLake >= 0) || river.fromLake === river.toLake) continue;
			const d = river.data, id = river.fromLake, level = world.lakes[id].level;
			const outlet = this.outlets.get(id)?.find(o => o.x === d[0] && o.z === d[1]);
			if (!outlet) continue;
			for (let i = 0; i < river.count - 1; i++) {
				const a = i * S, b = a + S;
				if (Math.min(d[a + RV.WL], d[b + RV.WL]) >= level - 0.1) continue;
				const width = Math.max(surfaceHalfWidth(d[a + RV.W], d[a + RV.D], d[a + RV.BANK]), surfaceHalfWidth(d[b + RV.W], d[b + RV.D], d[b + RV.BANK])) + 2;
				const cut = { id, level, outlet, x: d[a], z: d[a + 1], bx: d[b], bz: d[b + 1], top: d[a + RV.WL], bottom: d[b + RV.WL], width };
				const x0 = Math.max(0, Math.floor((Math.min(cut.x, cut.bx) - width + world.spawn.x + world.size / 2) / world.cell));
				const x1 = Math.min(N - 1, Math.ceil((Math.max(cut.x, cut.bx) + width + world.spawn.x + world.size / 2) / world.cell));
				const z0 = Math.max(0, Math.floor((Math.min(cut.z, cut.bz) - width + world.spawn.z + world.size / 2) / world.cell));
				const z1 = Math.min(N - 1, Math.ceil((Math.max(cut.z, cut.bz) + width + world.spawn.z + world.size / 2) / world.cell));
				for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
					const k = z * N + x;
					if (!this.drainCells.has(k)) this.drainCells.set(k, []);
					this.drainCells.get(k).push(cut);
				}
			}
		}
		this.cells = (world.lakes || []).map(() => []);
		for (let k = 0; k < this.ids.length; k++) if (this.ids[k] >= 0) this.cells[this.ids[k]].push(k);
		this.joinCells = new Map();
		this.inletCells = new Map();
		for (const map of [this.inlets, this.outlets]) for (const [id, joins] of map) {
			const candidates = new Set(this.cells[id]);
			for (const join of joins) {
				const radius = join.width + world.cell * 2;
				const gx = (x) => (x + world.spawn.x + world.size / 2) / world.cell;
				const gz = (z) => (z + world.spawn.z + world.size / 2) / world.cell;
				const x0 = Math.max(0, Math.floor(gx(Math.min(join.x, join.bx ?? join.x) - radius))), x1 = Math.min(N - 1, Math.ceil(gx(Math.max(join.x, join.bx ?? join.x) + radius)));
				const z0 = Math.max(0, Math.floor(gz(Math.min(join.z, join.bz ?? join.z) - radius))), z1 = Math.min(N - 1, Math.ceil(gz(Math.max(join.z, join.bz ?? join.z) + radius)));
				for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
					const k = z * N + x; candidates.add(k);
					if (!this.joinCells.has(k)) this.joinCells.set(k, new Set());
					this.joinCells.get(k).add(id);
					if (map === this.inlets) {
						if (!this.inletCells.has(k)) this.inletCells.set(k, []);
						this.inletCells.get(k).push({ id, join });
					}
				}
			}
			this.cells[id] = Array.from(candidates);
		}
		this.removed = new Map();
		if (resolve) this.resolveConnectivity();
	}

	coverage(id, x, z) {
		const w = this.world, N = w.res, ids = this.ids;
		const fx = (x + w.spawn.x + w.size / 2) / w.cell, fz = (z + w.spawn.z + w.size / 2) / w.cell;
		const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
		if (i < 0 || j < 0 || i >= N - 1 || j >= N - 1) return -w.cell;
		const at = (k) => ids[k] === id ? 1 : 0, k = j * N + i;
		const support = (at(k) * (1 - tx) + at(k + 1) * tx) * (1 - tz) + (at(k + N) * (1 - tx) + at(k + N + 1) * tx) * tz;
		let distance = (support - 0.5) * w.cell, feeder = -Infinity;
		for (const entry of this.inletCells.get(k) || []) {
			if (entry.id !== id) continue;
			const inlet = entry.join;
			const dx = inlet.bx - inlet.x, dz = inlet.bz - inlet.z, l2 = dx * dx + dz * dz;
			const t = Math.max(0, Math.min(1, ((x - inlet.x) * dx + (z - inlet.z) * dz) / (l2 || 1)));
			distance = Math.max(distance, inlet.width - Math.hypot(x - inlet.x - dx * t, z - inlet.z - dz * t));
		}
		for (const outlet of this.outlets.get(id) || []) {
			const dx = x - outlet.x, dz = z - outlet.z;
			const along = dx * outlet.dx + dz * outlet.dz, across = Math.abs(dx * -outlet.dz + dz * outlet.dx);
			const throat = Math.min(-along, outlet.width - outletDistance(outlet, x, z));
			distance = Math.max(distance, throat);
			feeder = Math.max(feeder, throat);
			if (along > -w.cell && along < w.cell * 3 && across < outlet.reach) distance = Math.min(distance, -along);
		}
		// The lake cannot cover its own river after the river has dropped below it.
		for (const cut of this.drainCells.get(k) || []) {
			if (cut.id !== id) continue;
			const gap = drainDistance(cut, x, z);
			distance = Math.min(distance, gap);
		}
		// Exact feeder geometry survives the coarser connectivity raster.
		if (this.removedAt(id, x, z) > 0) return Math.max(feeder, Math.min(distance, -w.cell));
		return distance;
	}

	// Keep the connected basin after drainage cuts; stranded water becomes part of the bank.
	resolveConnectivity(terrain = null) {
		this.removed.clear();
		const w = this.world, subdivisions = 4, spacing = w.cell / subdivisions;
		for (const lake of w.lakes || []) {
			const cells = this.cells[lake.id];
			if (!cells.length) continue;
			let x0 = w.res, z0 = w.res, x1 = 0, z1 = 0;
			for (const k of cells) { const x = k % w.res, z = Math.floor(k / w.res); x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
			const width = (x1 - x0 + 1) * subdivisions, height = (z1 - z0 + 1) * subdivisions;
			const wet = new Uint8Array(width * height), labels = new Int32Array(wet.length), queue = new Int32Array(wet.length);
			const ox = x0 * w.cell - w.size / 2 - w.spawn.x, oz = z0 * w.cell - w.size / 2 - w.spawn.z;
			for (const k of cells) {
				const cx = (k % w.res - x0) * subdivisions, cz = (Math.floor(k / w.res) - z0) * subdivisions;
				for (let z = 0; z < subdivisions; z++) for (let x = 0; x < subdivisions; x++) {
					const ix = cx + x, iz = cz + z;
					const px = ox + (ix + 0.5) * spacing, pz = oz + (iz + 0.5) * spacing;
					if (this.coverage(lake.id, px, pz) >= 0 && (!terrain || terrain(px, pz) < lake.level - 0.12)) wet[iz * width + ix] = 1;
				}
			}
			let count = 0, largest = 0, largestSize = 0;
			for (let k = 0; k < wet.length; k++) {
				if (!wet[k] || labels[k]) continue;
				const label = ++count; let head = 0, tail = 1; queue[0] = k; labels[k] = label;
				while (head < tail) {
					const p = queue[head++], x = p % width, z = Math.floor(p / width);
					for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
						const ix = x + dx, iz = z + dz, n = iz * width + ix;
						if (ix < 0 || iz < 0 || ix >= width || iz >= height || !wet[n] || labels[n]) continue;
						labels[n] = label; queue[tail++] = n;
					}
				}
				if (tail > largestSize) { largest = label; largestSize = tail; }
			}
			if (count < 2) continue;
			const removed = new Uint8Array(wet.length);
			for (let k = 0; k < wet.length; k++) if (wet[k] && labels[k] !== largest) removed[k] = 1;
			// Include the dry fringe so shoreline clipping cannot leave wet slivers around a removed pool.
			for (let pass = 0; pass < 2; pass++) {
				const previous = removed.slice();
				for (let z = 1; z < height - 1; z++) for (let x = 1; x < width - 1; x++) {
					const k = z * width + x;
					if (labels[k] === largest) continue;
					if (previous[k - 1] || previous[k + 1] || previous[k - width] || previous[k + width]) removed[k] = 1;
				}
			}
			this.removed.set(lake.id, { removed, ox, oz, spacing, width, height });
		}
	}

	removedAt(id, x, z) {
		const grid = this.removed?.get(id);
		if (!grid) return 0;
		const fx = (x - grid.ox) / grid.spacing - 0.5, fz = (z - grid.oz) / grid.spacing - 0.5;
		const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
		const at = (i, j) => i >= 0 && j >= 0 && i < grid.width && j < grid.height ? grid.removed[j * grid.width + i] : 0;
		return (at(ix, iz) * (1 - tx) + at(ix + 1, iz) * tx) * (1 - tz) + (at(ix, iz + 1) * (1 - tx) + at(ix + 1, iz + 1) * tx) * tz;
	}

	candidates(k) {
		const n = this.world.res, a = this.ids[k], b = this.ids[k+1], c = this.ids[k+n], d = this.ids[k+n+1], joins = this.joinCells.get(k);
		if (!(a >= 0 || b >= 0 || c >= 0 || d >= 0 || joins?.size)) return NO_LAKES;
		let ids = this.candidateCache.get(k);
		if (ids) return ids;
		ids = [...new Set([a, b, c, d, ...(joins || [])])].filter(id => id >= 0);
		// Bound memory when exploring the whole continent. Clearing affects only speed.
		if (this.candidateCache.size >= 8192) this.candidateCache.clear();
		this.candidateCache.set(k, ids);
		return ids;
	}

	fillDisconnected(x, z, height) {
		if (!this.removed?.size) return height;
		const w = this.world, i = Math.floor((x + w.spawn.x + w.size / 2) / w.cell), j = Math.floor((z + w.spawn.z + w.size / 2) / w.cell);
		const k = j * w.res + i;
		const candidates = this.candidates(k);
		for (const id of candidates) {
			const weight = this.removedAt(id, x, z);
			if (id >= 0 && weight > 0) height += Math.max(0, w.lakes[id].level + 0.35 - height) * weight;
		}
		return height;
	}

	isSpillway(lakeId, x, z) {
		const w = this.world, i = Math.floor((x + w.spawn.x + w.size / 2) / w.cell), j = Math.floor((z + w.spawn.z + w.size / 2) / w.cell);
		for (const id of this.joinCells.get(j * w.res + i) || []) for (const outlet of this.outlets.get(id) || []) {
			if (id !== lakeId) continue;
			const along = (x - outlet.x) * outlet.dx + (z - outlet.z) * outlet.dz;
			const across = Math.abs((x - outlet.x) * -outlet.dz + (z - outlet.z) * outlet.dx);
			if (along >= -0.05 && along < w.cell * 3 && across <= outlet.width) return true;
		}
		for (const cut of this.drainCells.get(j * w.res + i) || []) if (cut.id === lakeId && drainDistance(cut, x, z) < 0) return true;
		return false;
	}

	waveWeight(id, x, z) {
		let weight = 1;
		for (const outlet of this.outlets.get(id) || []) {
			const along = (x - outlet.x) * outlet.dx + (z - outlet.z) * outlet.dz;
			const across = Math.abs((x - outlet.x) * -outlet.dz + (z - outlet.z) * outlet.dx);
			if (across <= outlet.width + 1 && Math.abs(along) < 3) weight = Math.min(weight, Math.abs(along) / 3);
		}
		return weight;
	}

	// Carve the feeder through the rim, including the full width of the waterfall brow.
	carveOutlet(x, z, height) {
		const w = this.world, i = Math.floor((x + w.spawn.x + w.size / 2) / w.cell), j = Math.floor((z + w.spawn.z + w.size / 2) / w.cell);
		for (const id of this.joinCells.get(j * w.res + i) || []) for (const outlet of this.outlets.get(id) || []) {
			const along = (x - outlet.x) * outlet.dx + (z - outlet.z) * outlet.dz;
			if (along > 0.05) continue;
			const dist = outletDistance(outlet, x, z), bank = 4;
			if (dist >= outlet.width + bank) continue;
			const u = Math.min(1, dist / outlet.width), depth = outlet.depth * (1 - 0.75 * u * u);
			const t = Math.max(0, Math.min(1, (dist - outlet.width) / bank));
			const blend = 1 - t * t * (3 - 2 * t);
			height -= Math.max(0, height - (outlet.level - depth)) * blend;
		}
		return height;
	}

	levelAt(x, z) {
		this.shoreId = -1; this.shoreDistance = -Infinity;
		const w = this.world, N = w.res;
		const i = Math.floor((x + w.spawn.x + w.size / 2) / w.cell), j = Math.floor((z + w.spawn.z + w.size / 2) / w.cell);
		if (i < 0 || j < 0 || i >= N - 1 || j >= N - 1) return -10000;
		let level = -10000;
		const candidates = this.candidates(j * N + i);
		for (const id of candidates) {
			if (id < 0) continue;
			const coverage = this.coverage(id, x, z);
			if (coverage > this.shoreDistance) { this.shoreId = id; this.shoreDistance = coverage; }
			if (w.lakes[id].level > level && coverage >= 0) level = w.lakes[id].level;
		}
		return level;
	}
}

// Clip a triangle against an implicit shoreline; roots are refined in world space.
export function clipShore(vertices, field) {
	const values = vertices.map(field);
	if (values.every(v => v >= 0)) return vertices;
	if (values.every(v => v < 0)) return [];
	const out = [];
	for (let i = 0; i < vertices.length; i++) {
		const a = vertices[i], b = vertices[(i + 1) % vertices.length], fa = values[i], fb = values[(i + 1) % vertices.length];
		if (fa >= 0) out.push(a);
		if ((fa >= 0) === (fb >= 0)) continue;
		let lo = 0, hi = 1;
		for (let n = 0; n < 7; n++) {
			const t = (lo + hi) * 0.5, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
			if ((field(p) >= 0) === (fa >= 0)) lo = t; else hi = t;
		}
		const t = (lo + hi) * 0.5;
		out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
	}
	return out;
}

function outletDistance(outlet, x, z) {
	let distance = Infinity;
	for (let i = 1; i < outlet.path.length; i++) {
		const a = outlet.path[i - 1], b = outlet.path[i], dx = b[0] - a[0], dz = b[1] - a[1];
		const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
		distance = Math.min(distance, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
	}
	return distance;
}

function drainDistance(cut, x, z) {
	const dx = cut.bx - cut.x, dz = cut.bz - cut.z, length = dx * dx + dz * dz;
	const t = Math.max(0, Math.min(1, ((x - cut.x) * dx + (z - cut.z) * dz) / (length || 1)));
	if (cut.top + (cut.bottom - cut.top) * t >= cut.level - 0.1) return Infinity;
	const distance = Math.hypot(x - cut.x - dx * t, z - cut.z - dz * t) - cut.width;
	const o = cut.outlet, along = (x - o.x) * o.dx + (z - o.z) * o.dz;
	return Math.hypot(x - o.x, z - o.z) < o.width * 2 ? Math.max(-along, distance) : distance;
}
