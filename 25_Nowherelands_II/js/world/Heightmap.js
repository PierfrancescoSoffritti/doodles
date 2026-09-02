import { Random, Simplex2D } from '../core/Random.js';
import { config } from '../core/Config.js';
import { smoothstep, clamp } from '../core/Utils.js';
import { NO_WATER } from './gen/WorldGen.js';

// The baked world, sampled continuously. Height is the bicubic grid plus procedural close-up
// detail, with river channels carved analytically from the river polylines so streams stay
// crisp at any resolution. The world origin sits at the spawn point.

const SQRT2 = Math.SQRT2;
const HASH = 128;   // river spatial hash cell, world units

class RiverIndex {
	constructor(rivers) {
		this.rivers = rivers;
		this.map = new Map();
		// flat segment table: ax az bx bz wlA wlB wA wB dA dB fA fB
		let nSeg = 0;
		for (const r of rivers) nSeg += Math.max(0, r.count - 1);
		this.seg = new Float32Array(nSeg * 12);
		this.segRiver = new Int32Array(nSeg);
		let s = 0;
		rivers.forEach((r, ri) => {
			const d = r.data;
			for (let i = 0; i < r.count - 1; i++, s++) {
				const a = i * 6, b = a + 6, o = s * 12;
				this.seg[o] = d[a]; this.seg[o + 1] = d[a + 1]; this.seg[o + 2] = d[b]; this.seg[o + 3] = d[b + 1];
				this.seg[o + 4] = d[a + 2]; this.seg[o + 5] = d[b + 2];
				this.seg[o + 6] = d[a + 3]; this.seg[o + 7] = d[b + 3];
				this.seg[o + 8] = d[a + 4]; this.seg[o + 9] = d[b + 4];
				this.seg[o + 10] = d[a + 5]; this.seg[o + 11] = d[b + 5];
				this.segRiver[s] = ri;
				const reach = Math.max(d[a + 3], d[b + 3]) * 1.1 + 10;
				const x0 = Math.floor((Math.min(d[a], d[b]) - reach) / HASH), x1 = Math.floor((Math.max(d[a], d[b]) + reach) / HASH);
				const z0 = Math.floor((Math.min(d[a + 1], d[b + 1]) - reach) / HASH), z1 = Math.floor((Math.max(d[a + 1], d[b + 1]) + reach) / HASH);
				for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
					const key = cx * 65536 + cz;
					let list = this.map.get(key);
					if (!list) { list = []; this.map.set(key, list); }
					list.push(s);
				}
			}
		});
	}

	cellList(x, z) { return this.map.get(Math.floor(x / HASH) * 65536 + Math.floor(z / HASH)); }

	// Every segment touching a rectangle, as segment indices.
	segmentsIn(x0, z0, x1, z1) {
		const out = new Set();
		for (let cz = Math.floor(z0 / HASH); cz <= Math.floor(z1 / HASH); cz++) for (let cx = Math.floor(x0 / HASH); cx <= Math.floor(x1 / HASH); cx++) {
			const list = this.map.get(cx * 65536 + cz);
			if (list) for (const s of list) out.add(s);
		}
		return out;
	}
}

export class Heightmap {
	constructor(seed, world) {
		this.world = world;
		this.N = world.res;
		this.cell = world.cell;
		this.size = world.size;
		this.grid = world.height;
		this.lakeLevel = world.lakeLevel;
		this.rock = world.rock;
		this.ox = world.spawn.x;
		this.oz = world.spawn.z;
		this.waterLevel = config.world.waterLevel;
		this.detail = new Simplex2D(new Random(seed + ':detail'));
		this.forestNoise = new Simplex2D(new Random(seed + ':forest'));
		this.rivers = new RiverIndex(world.rivers);
		this.maxPyramid = this.buildMaxPyramid();
		// scratch results of the last sample()
		this._water = NO_WATER;
		this._bank = 0;
		this._foam = 0;
		this._riverDist = Infinity;
		this._riverWidth = 0;
	}

	// ---- grid access ----
	gx(x) { return (x + this.ox + this.size / 2) / this.cell; }
	gz(z) { return (z + this.oz + this.size / 2) / this.cell; }

	gridAt(fx, fz) {
		const N = this.N;
		const i = clamp(Math.round(fx), 0, N - 1), j = clamp(Math.round(fz), 0, N - 1);
		return this.grid[j * N + i];
	}

	bicubic(fx, fz) {
		const N = this.N, g = this.grid;
		const x = clamp(fx, 1, N - 2.001), z = clamp(fz, 1, N - 2.001);
		const i = x | 0, j = z | 0, tx = x - i, tz = z - j;
		let r0, r1, r2, r3;
		{
			let k = (j - 1) * N + i;
			r0 = cubic(g[k - 1], g[k], g[k + 1], g[k + 2], tx); k += N;
			r1 = cubic(g[k - 1], g[k], g[k + 1], g[k + 2], tx); k += N;
			r2 = cubic(g[k - 1], g[k], g[k + 1], g[k + 2], tx); k += N;
			r3 = cubic(g[k - 1], g[k], g[k + 1], g[k + 2], tx);
		}
		return cubic(r0, r1, r2, r3, tz);
	}

	// Outside the baked grid the sea floor keeps falling away.
	base(x, z) {
		const fx = this.gx(x), fz = this.gz(z);
		const N = this.N;
		let h = this.bicubic(fx, fz);
		const out = Math.max(1 - fx, fx - (N - 2), 1 - fz, fz - (N - 2), 0);
		if (out > 0) h = Math.min(h, -8) - out * this.cell * 0.05;
		return h;
	}

	// Full sample: carved height, plus side results in _water/_bank/_foam.
	sample(x, z) {
		const fx = this.gx(x), fz = this.gz(z);
		const N = this.N, g = this.grid;
		let h = this.bicubic(fx, fz);
		const out = Math.max(1 - fx, fx - (N - 2), 1 - fz, fz - (N - 2), 0);
		if (out > 0) h = Math.min(h, -8) - out * this.cell * 0.05;

		const i = clamp(Math.round(fx), 1, N - 2), j = clamp(Math.round(fz), 1, N - 2);
		const k = j * N + i;
		const slope = Math.hypot(g[k + 1] - g[k - 1], g[k + N] - g[k - N]) / (2 * this.cell);
		const hardness = this.rock[k] / 255;
		let water = Math.max(this.waterLevel, this.lakeLevel[k]);

		// river channel
		let bank = 0, foam = 0, rDist = Infinity, rWidth = 0;
		const list = this.rivers.cellList(x, z);
		if (list) {
			const seg = this.rivers.seg;
			let nearest = -1, nearestN = Infinity;
			let nd = 0, nt = 0;
			for (let q = 0; q < list.length; q++) {
				const o = list[q] * 12;
				const ax = seg[o], az = seg[o + 1], bx = seg[o + 2], bz = seg[o + 3];
				const dx = bx - ax, dz = bz - az;
				const l2 = dx * dx + dz * dz;
				let t = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
				t = t < 0 ? 0 : t > 1 ? 1 : t;
				const px = ax + dx * t - x, pz = az + dz * t - z;
				const dist = Math.sqrt(px * px + pz * pz);
				const w = seg[o + 6] + (seg[o + 7] - seg[o + 6]) * t;
				const reach = w * 0.5 + w * 0.6 + 8;
				const nrm = dist / reach;
				if (nrm < nearestN) { nearestN = nrm; nearest = o; nd = dist; nt = t; }
			}
			if (nearest >= 0 && nearestN < 1) {
				const o = nearest, t = nt, dist = nd;
				const wl = seg[o + 4] + (seg[o + 5] - seg[o + 4]) * t;
				const w = seg[o + 6] + (seg[o + 7] - seg[o + 6]) * t;
				const d = seg[o + 8] + (seg[o + 9] - seg[o + 8]) * t;
				foam = seg[o + 10] + (seg[o + 11] - seg[o + 10]) * t;
				const hw = w * 0.5, bankW = w * 0.6 + 8;
				rDist = dist; rWidth = w;
				if (dist < hw) {
					const u = dist / hw;
					const bed = wl - d * (0.15 + 0.85 * Math.sqrt(Math.max(0, 1 - u * u)));
					h = Math.min(h, bed);
					bank = 1;
					water = Math.max(water, wl);
				} else {
					const tt = (dist - hw) / bankW;
					const s = tt * tt * (3 - 2 * tt);
					const edge = wl - d * 0.15;
					let hb = edge + (h - edge) * s;
					if (h < wl + 0.6) hb = Math.max(hb, wl + 0.6 * (1 - s));
					h = hb;
					bank = 1 - s;
					if (dist < hw + 1.5) water = Math.max(water, wl);
				}
			}
		}

		// close-up relief: soft on meadows, rocky where it is steep and hard; none on shores or in channels
		const rel = h - water;
		const fade = smoothstep(0.4, 4, rel) * (1 - bank);
		if (fade > 0.001) {
			const rocky = smoothstep(0.3, 0.9, slope);
			const amp = 1.1 + 3.5 * rocky;
			const dn = this.detail.fbm(x / 47, z / 47, 3);
			const rn = 1 - Math.abs(this.detail.noise(x / 23 + 7.3, z / 23 - 3.1));
			h += (dn * amp + rn * 2.6 * rocky * (0.4 + hardness)) * fade;
		}

		this._water = water;
		this._bank = bank;
		this._foam = foam;
		this._riverDist = rDist;
		this._riverWidth = rWidth;
		this._slope = slope;
		this._hardness = hardness;
		return h;
	}

	height(x, z) { return this.sample(x, z); }

	// Water surface height here (sea, lake or river), or the sea level if none is above the ground.
	waterAt(x, z) { this.sample(x, z); return this._water; }
	depthAt(x, z) { const h = this.sample(x, z); return this._water - h; }
	hardnessAt(x, z) {
		const i = clamp(Math.round(this.gx(x)), 0, this.N - 1), j = clamp(Math.round(this.gz(z)), 0, this.N - 1);
		return this.rock[j * this.N + i] / 255;
	}

	normal(x, z, out) {
		const e = 1.5;
		const hl = this.height(x - e, z), hr = this.height(x + e, z);
		const hd = this.height(x, z - e), hu = this.height(x, z + e);
		out.set(hl - hr, 2 * e, hd - hu).normalize();
		return out;
	}

	slope(x, z) {
		const e = 2;
		const dx = (this.height(x + e, z) - this.height(x - e, z)) / (2 * e);
		const dz = (this.height(x, z + e) - this.height(x, z - e)) / (2 * e);
		return Math.hypot(dx, dz);
	}

	forestDensity(x, z) {
		const h = this.gridAt(this.gx(x), this.gz(z));
		return smoothstep(-0.15, 0.5, this.forestNoise.fbm(x / 900, z / 900, 3)) * (1 - smoothstep(520, 760, h));
	}

	isLand(x, z, margin = 3) { const h = this.sample(x, z); return h > this._water + margin; }

	// Is there open water within `reach` of this point?
	nearWater(x, z, reach = 40) {
		for (let k = 0; k < 8; k++) {
			const a = (k / 8) * Math.PI * 2;
			if (this.depthAt(x + Math.cos(a) * reach, z + Math.sin(a) * reach) > 1) return true;
		}
		return false;
	}

	// ---- coarse max-height pyramid for LOD culling ----
	buildMaxPyramid() {
		const levels = [];
		let N = this.N, src = this.grid;
		levels.push({ N, data: src });
		while (N > 4) {
			const M = N >> 1;
			const dst = new Float32Array(M * M);
			for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
				const k = (2 * j) * N + 2 * i;
				dst[j * M + i] = Math.max(src[k], src[k + 1], src[k + N], src[k + N + 1]);
			}
			levels.push({ N: M, data: dst });
			N = M; src = dst;
		}
		return levels;
	}

	// Upper bound of the grid height inside a world-space square (ignores detail noise; callers add a margin).
	maxHeightIn(cx, cz, size) {
		const fx0 = this.gx(cx - size / 2), fx1 = this.gx(cx + size / 2), fz0 = this.gz(cz - size / 2), fz1 = this.gz(cz + size / 2);
		if (fx1 < 0 || fz1 < 0 || fx0 > this.N || fz0 > this.N) return -1e3;
		const cells = size / this.cell;
		let lvl = 0;
		while (lvl < this.maxPyramid.length - 1 && cells / (1 << (lvl + 1)) > 4) lvl++;
		const { N, data } = this.maxPyramid[lvl];
		const s = 1 << lvl;
		const i0 = clamp(Math.floor(fx0 / s) - 1, 0, N - 1), i1 = clamp(Math.ceil(fx1 / s) + 1, 0, N - 1);
		const j0 = clamp(Math.floor(fz0 / s) - 1, 0, N - 1), j1 = clamp(Math.ceil(fz1 / s) + 1, 0, N - 1);
		let m = -1e3;
		for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const v = data[j * N + i]; if (v > m) m = v; }
		return m;
	}

	// ---- spot finders (seeded searches used by landmarks) ----
	// The water's edge itself: a gentle spot straddling the waterline.
	findWaterEdgeSpot(rnd, cx, cz, radius) {
		for (let i = 0; i < 800; i++) {
			const a = rnd.next() * Math.PI * 2;
			const r = Math.sqrt(rnd.next()) * radius * (1 + Math.floor(i / 200));
			const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
			const h = this.sample(x, z) - this._water;
			if (h < -3 || h > 1.5 || this.slope(x, z) > 0.3) continue;
			if (!this.nearWater(x, z, 25)) continue;
			return { x, z, edge: true };
		}
		return this.findShoreSpot(rnd, cx, cz, radius);
	}

	// A flat piece of shore: low, gentle, and with water close by. Falls back to any flat spot.
	findShoreSpot(rnd, cx, cz, radius, flatRadius = 0) {
		for (let i = 0; i < 600; i++) {
			const a = rnd.next() * Math.PI * 2;
			const r = Math.sqrt(rnd.next()) * radius * (1 + Math.floor(i / 150));
			const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
			const h = this.sample(x, z) - this._water;
			if (h < 2.5 || h > 9 || this.slope(x, z) > 0.25 || !this.nearWater(x, z)) continue;
			if (flatRadius > 0) {
				let ok = true;
				for (let k = 0; k < 6 && ok; k++) {
					const b = (k / 6) * Math.PI * 2;
					const hx = x + Math.cos(b) * flatRadius, hz = z + Math.sin(b) * flatRadius;
					const hh = this.sample(hx, hz) - this._water;
					if (hh < 1.5 || hh > 12 || this.slope(hx, hz) > 0.35) ok = false;
				}
				if (!ok) continue;
			}
			return { x, z };
		}
		return this.findFlatSpot(rnd, cx, cz, radius);
	}

	// Find a flat dry spot near a target using a seeded spiral search.
	findFlatSpot(rnd, cx, cz, radius, maxSlope = 0.35, minHeight = 6) {
		for (let i = 0; i < 400; i++) {
			const a = rnd.next() * Math.PI * 2;
			const r = Math.sqrt(rnd.next()) * radius * (1 + Math.floor(i / 100));
			const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
			if (this.sample(x, z) > this._water + minHeight && this.slope(x, z) < maxSlope) return { x, z };
		}
		return { x: cx, z: cz };
	}
}

function cubic(p0, p1, p2, p3, t) {
	return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}

export { NO_WATER, SQRT2 };
