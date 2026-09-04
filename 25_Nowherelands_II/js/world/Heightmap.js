import { crestShape, crestOffset } from './RiverGeometry.js';
import { LakeSurface } from './LakeSurface.js';
import { Random, Simplex2D } from '../core/Random.js';
import { config } from '../core/Config.js';
import { smoothstep, clamp } from '../core/Utils.js';
import { NO_WATER } from './gen/WorldGen.js';
import { RIVER_STRIDE, RV, RIVER_KIND, bedProfile, bankWidth, bankSpread, EDGE_DEPTH } from './gen/Rivers.js';

// The baked world, sampled continuously. Height is the bicubic grid plus procedural close-up
// detail, with river channels carved analytically from the river polylines so streams stay
// crisp at any resolution. The world origin sits at the spawn point.

const SQRT2 = Math.SQRT2;
const HASH = 128;   // spatial hash cell, world units

// Flat segment table over every river's samples, hashed by cell so a point finds its channel fast.
const SEG = 22;     // ax az bx bz wlA wlB wA wB dA dB fA fB bankA bankB kind alongA bendA bendB skewA bowA skewB bowB
export const SEG_KIND = { FLOW: 0, GAP: 1, STEP: 2 };   // GAP: a waterfall face (no channel), STEP: a riffle ramp

class RiverIndex {
	constructor(rivers) {
		this.rivers = rivers;
		this.map = new Map();
		let nSeg = 0;
		for (const r of rivers) nSeg += Math.max(0, r.count - 1);
		this.seg = new Float32Array(nSeg * SEG);
		this.segRiver = new Int32Array(nSeg);
		this.segIndex = new Int32Array(nSeg);      // the sample a segment starts at
		let s = 0;
		rivers.forEach((r, ri) => {
			const d = r.data;
			for (let i = 0; i < r.count - 1; i++, s++) {
				const a = i * RIVER_STRIDE, b = a + RIVER_STRIDE, o = s * SEG;
				this.seg[o] = d[a + RV.X]; this.seg[o + 1] = d[a + RV.Z]; this.seg[o + 2] = d[b + RV.X]; this.seg[o + 3] = d[b + RV.Z];
				this.seg[o + 4] = d[a + RV.WL]; this.seg[o + 5] = d[b + RV.WL];
				this.seg[o + 6] = d[a + RV.W]; this.seg[o + 7] = d[b + RV.W];
				this.seg[o + 8] = d[a + RV.D]; this.seg[o + 9] = d[b + RV.D];
				this.seg[o + 10] = d[a + RV.FOAM]; this.seg[o + 11] = d[b + RV.FOAM];
				this.seg[o + 12] = d[a + RV.BANK]; this.seg[o + 13] = d[b + RV.BANK];
				const ka = d[a + RV.KIND], kb = d[b + RV.KIND];
				this.seg[o + 14] = ka === RIVER_KIND.LIP ? SEG_KIND.GAP : (ka === RIVER_KIND.STEP_TOP && kb === RIVER_KIND.STEP_BOTTOM ? SEG_KIND.STEP : SEG_KIND.FLOW);
				this.seg[o + 15] = d[a + RV.ALONG];
				this.seg[o + 16] = d[a + RV.BEND]; this.seg[o + 17] = d[b + RV.BEND];
				const ca = crestShape(r, i), cb = crestShape(r, i + 1);
				this.seg[o + 18] = ca[0]; this.seg[o + 19] = ca[1]; this.seg[o + 20] = cb[0]; this.seg[o + 21] = cb[1];
				this.segRiver[s] = ri;
				this.segIndex[s] = i;
				const reach = Math.max(d[a + RV.W], d[b + RV.W]) * 1.2 + 18;
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

	// Fields of segment s at parameter t.
	at(s, t) {
		const o = s * SEG, g = this.seg;
		return { x: g[o] + (g[o + 2] - g[o]) * t, z: g[o + 1] + (g[o + 3] - g[o + 1]) * t, wl: g[o + 4] + (g[o + 5] - g[o + 4]) * t, w: g[o + 6] + (g[o + 7] - g[o + 6]) * t, d: g[o + 8] + (g[o + 9] - g[o + 8]) * t, foam: g[o + 10] + (g[o + 11] - g[o + 10]) * t, bank: g[o + 12] + (g[o + 13] - g[o + 12]) * t, bend: g[o + 16] + (g[o + 17] - g[o + 16]) * t, kind: g[o + 14], along: g[o + 15], dx: g[o + 2] - g[o], dz: g[o + 3] - g[o + 1] };
	}
}

// Waterfall faces, hashed the same way. Inside a fall's footprint the ground is shaped
// analytically: the channel bed up to the lip, a near-vertical rock face, the plunge pool.
class FallIndex {
	constructor(rivers) {
		this.falls = rivers.flatMap((r) => r.falls);
		this.map = new Map();
		this.falls.forEach((f, idx) => {
			f.hw = f.w * 0.5;
			f.cMax = Math.max(f.w, f.wBottom || f.w) * 0.5 + 16 + 0.25 * f.drop;
			f.sMin = -8; f.sMax = f.run + 12;
			const R = Math.max(f.cMax, f.sMax) + 2;
			for (let cz = Math.floor((f.z - R) / HASH); cz <= Math.floor((f.z + R) / HASH); cz++) for (let cx = Math.floor((f.x - R) / HASH); cx <= Math.floor((f.x + R) / HASH); cx++) {
				const key = cx * 65536 + cz;
				let list = this.map.get(key);
				if (!list) { list = []; this.map.set(key, list); }
				list.push(idx);
			}
		});
	}
	cellList(x, z) { return this.map.get(Math.floor(x / HASH) * 65536 + Math.floor(z / HASH)); }
}

// ground level across a channel at a given water level: the bed inside, the bank rising outside
function channelLevel(dist, wl, w, depth, bank, floor) {
	const hw = w * 0.5;
	if (dist < hw) return wl - depth * bedProfile(dist / hw);
	const tt = Math.min((dist - hw) / bankWidth(bank, depth, w), 1);
	const s = tt * tt * (3 - 2 * tt);
	const edge = wl - EDGE_DEPTH * depth;
	return edge + (floor - edge) * s;
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
		this.habitatMap = world.habitat;
		this._hab = { forest: 0, wet: 0, coast: 0, alt: 1 };
		this.rivers = new RiverIndex(world.rivers);
		this.falls = new FallIndex(world.rivers);
		this.lakes = new LakeSurface(world, false);
		this.lakes.resolveConnectivity((x, z) => this.height(x, z));
		this.maxPyramid = this.buildMaxPyramid();
		// scratch results of the last sample()
		this._water = NO_WATER;
		this._bank = 0;
		this._foam = 0;
		this._riverDist = Infinity;
		this._riverWidth = 0;
		this._riverAlong = 0;
		this._riverAcross = 0;
		this._riverSeg = -1;
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
		let water = Math.max(this.waterLevel, this.lakes.levelAt(x, z));
		const shoreId = this.lakes.shoreId, shoreDistance = this.lakes.shoreDistance;

		// river channel: the nearest segment (by plain distance, so a wide-banked neighbour never
		// steals ground from the segment actually abreast of the point) shapes the bed and the banks
		let bank = 0, foam = 0, rDist = Infinity, rWidth = 0, rAlong = 0, rAcross = 0, rSeg = -1;
		const list = this.rivers.cellList(x, z);
		if (list) {
			const seg = this.rivers.seg;
			let nearest = -1, nearestD = Infinity;
			let nd = 0, nt = 0, ns = 0;
			for (let q = 0; q < list.length; q++) {
				const o = list[q] * SEG;
				const ax = seg[o], az = seg[o + 1], bx = seg[o + 2], bz = seg[o + 3];
				const dx = bx - ax, dz = bz - az;
				const l2 = dx * dx + dz * dz;
				let t = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
				t = t < 0 ? 0 : t > 1 ? 1 : t;
				const len = Math.sqrt(l2) || 1;
				const along = ((x - ax) * dx + (z - az) * dz) / len;
				const across = ((x - ax) * -dz + (z - az) * dx) / len;
				let shift = 0;
				if (seg[o + 18] || seg[o + 19] || seg[o + 20] || seg[o + 21]) {
					for (let j = 0; j < 2; j++) {
						const width = seg[o + 6] + (seg[o + 7] - seg[o + 6]) * t;
						const u = clamp(across / (width * 0.5), -1.5, 1.5);
						const a = crestOffset(u, seg[o + 18], seg[o + 19]);
						const b = crestOffset(u, seg[o + 20], seg[o + 21]);
						t = clamp((along - a) / Math.max(0.1, len + b - a), 0, 1);
						shift = a + (b - a) * t;
					}
				}
				const dist = Math.hypot(across, along - t * len - shift);
				const w = seg[o + 6] + (seg[o + 7] - seg[o + 6]) * t;
				const bk = seg[o + 12] + (seg[o + 13] - seg[o + 12]) * t;
				const d = seg[o + 8] + (seg[o + 9] - seg[o + 8]) * t;
				const bend = seg[o + 16] + (seg[o + 17] - seg[o + 16]) * t;
				const side = Math.sign(across);
				const reach = w * 0.5 + bankWidth(bk, d, w) * bankSpread(side, bend);
				if (dist < reach && dist < nearestD) {
					nearestD = dist; nearest = o; nd = dist; nt = t; ns = list[q];
				}
			}
			if (nearest >= 0) {
				const o = nearest, t = nt, dist = nd;
				const wl = seg[o + 4] + (seg[o + 5] - seg[o + 4]) * t;
				const w = seg[o + 6] + (seg[o + 7] - seg[o + 6]) * t;
				const d = seg[o + 8] + (seg[o + 9] - seg[o + 8]) * t;
				const bk = seg[o + 12] + (seg[o + 13] - seg[o + 12]) * t;
				const kind = seg[o + 14];
				foam = seg[o + 10] + (seg[o + 11] - seg[o + 10]) * t;
				const bend = seg[o + 16] + (seg[o + 17] - seg[o + 16]) * t;
				const hw = w * 0.5;
				rDist = dist; rWidth = w; rSeg = ns;
				// under the sea the channel shoals to a bar over the river's last reaches, so it ends in a
				// shallow seabed rather than a wall (never in the land it cut through to get there)
				const carve = wl < this.waterLevel ? clamp(1 + (wl - this.waterLevel) / 0.5, 0, 1) : 1;
				const bar = this.waterLevel - 1.5;
				{
					const ax = seg[o], az = seg[o + 1], dx = seg[o + 2] - ax, dz = seg[o + 3] - az, l = Math.hypot(dx, dz) || 1;
					rAlong = seg[o + 15] + t * l;
					rAcross = ((x - ax) * (-dz) + (z - az) * dx) / l;
				}
				const side = Math.sign(rAcross), bankW = bankWidth(bk, d, w) * bankSpread(side, bend);
				if (kind === SEG_KIND.GAP) {
					bank = 1;      // the fall face below takes over; no close-up relief here
				} else if (dist < hw) {
					const u = dist / hw;
					// cobbled bed: small bumps, more of them toward the banks, never above the water
					const cobble = (1 - Math.abs(this.detail.noise(x / 3.2 + 4.1, z / 3.2 - 2.7))) * (0.15 + 0.3 * u * u) * Math.min(d * 0.3, 1);
					const bed = wl - d * bedProfile(side * u, bend) + cobble;
					const shoal = Math.max(bed, bar);
					h = Math.min(h, bed + (shoal - bed) * (1 - carve));
					bank = 1;
					water = Math.max(water, wl);
				} else {
					const tt = clamp((dist - hw) / bankW, 0, 1);
					const s = tt * tt * (3 - 2 * tt);
					const edge = wl - bedProfile(side, bend) * d;
					let hb = edge + (h - edge) * s;
					// where the land beside the river lies below the water, a low natural levee keeps it in
					if (h < wl + 0.25 && wl >= this.waterLevel && water < wl - 0.05) { const lip = wl + 0.35 * (1 - s); if (hb < lip) hb = lip; }
					h = hb + (Math.max(hb, bar) - hb) * (1 - carve);
					bank = 1 - s;
					if (dist < hw + bankW * 0.5) water = Math.max(water, wl);
				}
			}
		}

		// waterfall faces
		const flist = this.falls.cellList(x, z);
		if (flist) {
			const falls = this.falls.falls;
			for (let q = 0; q < flist.length; q++) {
				const f = falls[flist[q]];
				const rx = x - f.x, rz = z - f.z;
				const sAlong = rx * f.dx + rz * f.dz, c = rx * -f.dz + rz * f.dx;
				const ac = Math.abs(c);
				if (sAlong < f.sMin || sAlong > f.sMax || ac > f.cMax) continue;
				const ms = smoothstep(f.sMin, f.sMin + 5, sAlong) * (1 - smoothstep(f.sMax - 6, f.sMax, sAlong));
				const mc = 1 - smoothstep(f.cMax - 8, f.cMax, ac);
				const mask = ms * mc;
				if (mask <= 0.001) continue;
				const up = channelLevel(ac, f.top, f.w, f.dTop, f.bankTop, f.top + f.bankTop);
				const down = channelLevel(ac, f.bottom, f.wBottom || f.w, f.dBot, f.bankBot, f.bottom + f.bankBot);
				// the crest is straight across the channel and recedes downstream at the sides (a horseshoe)
				const side = Math.max(0, ac - f.hw);
				const sFace = side * 0.45 + (side > 0 ? this.detail.noise(c / 9 + f.seed, f.seed) * 1.6 : 0);
				let G;
				if (sAlong < sFace) G = up;
				else G = Math.max(down, up - (up - down) * (sAlong - sFace) / f.run);
				// ledges and columns on the face so the rock reads as rock, not a plane
				if (sAlong >= sFace && G > down + 0.5) {
					const inFace = Math.min(1, (up - G) / 4) * Math.min(1, (G - down) / 4);
					const ledges = (1 - Math.abs(this.detail.noise(c / 7 + f.seed, G / 6))) * 1.8 + (1 - Math.abs(this.detail.noise(c / 2.6 + 3, G / 2.6 + f.seed))) * 0.6;
					G += ledges * inFace;
				}
				h = h + (G - h) * mask;
				if (mask > bank) bank = mask;
				if (sAlong < sFace && ac < f.hw + 1) water = Math.max(water, f.top);
				if (sAlong > sFace + f.run * 0.5 && ac < f.hw + 1) water = Math.max(water, f.bottom);
			}
		}

		// Keep a continuous basin rim where river carving approaches a lake from the side.
		// Incoming channels cross the rim; outlet feeders are carved below.
		if (shoreId >= 0) {
			const river = rSeg >= 0 ? this.world.rivers[this.rivers.segRiver[rSeg]] : null;
			const connected = river && this.lakes.receivingLake[this.rivers.segRiver[rSeg]] === shoreId && rDist < rWidth * 0.5;
			if (!connected && !this.lakes.isSpillway(shoreId, x, z)) {
				const level = this.world.lakes[shoreId].level;
				const blend = smoothstep(-this.cell * 0.45, 0, shoreDistance) * (1 - smoothstep(0, this.cell * 0.45, shoreDistance));
				h += Math.max(0, level + 0.35 - h) * blend;
				bank = Math.max(bank, blend);
			}
		}

		const filledBank = this.lakes.fillDisconnected(x, z, h);
		if (filledBank > h) { h = filledBank; bank = 1; }
		const outletBed = this.lakes.carveOutlet(x, z, h);
		if (outletBed < h) { h = outletBed; bank = 1; }

		// close-up relief: soft on meadows, rocky where it is steep and hard; none on shores or in channels
		const rel = h - water;
		const fade = smoothstep(0.4, 4, rel) * (1 - bank);
		if (fade > 0.001) {
			const rocky = smoothstep(0.3, 0.9, slope);
			const amp = 1.1 + 3.0 * rocky;
			const dn = this.detail.fbm(x / 47, z / 47, 3);
			// broken rock, not corrugation: two ridged octaves at different scales and orientations
			const rn = (1 - Math.abs(this.detail.noise(x / 31 + 7.3, z / 23 - 3.1))) * 0.7 + (1 - Math.abs(this.detail.noise(x / 9 - 5.1, z / 13 + 2.2))) * 0.3;
			h += (dn * amp + rn * 1.6 * rocky * (0.4 + hardness)) * fade;
		}

		this._water = water;
		this._bank = bank;
		this._foam = foam;
		this._riverDist = rDist;
		this._riverWidth = rWidth;
		this._riverAlong = rAlong;
		this._riverAcross = rAcross;
		this._riverSeg = rSeg;
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

	// The baked habitat (see gen/Habitat.js), bilinear, into the scratch _hab: forest, wet, coast, alt in 0..1.
	habitat(x, z) {
		const N = this.N, m = this.habitatMap, o = this._hab;
		const fx = clamp(this.gx(x), 0, N - 1.001), fz = clamp(this.gz(z), 0, N - 1.001);
		const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j;
		const k00 = (j * N + i) * 4, k10 = k00 + 4, k01 = k00 + N * 4, k11 = k01 + 4;
		const w00 = (1 - tx) * (1 - tz), w10 = tx * (1 - tz), w01 = (1 - tx) * tz, w11 = tx * tz;
		const at = (c) => (m[k00 + c] * w00 + m[k10 + c] * w10 + m[k01 + c] * w01 + m[k11 + c] * w11) / 255;
		o.forest = at(0); o.wet = at(1); o.coast = at(2); o.alt = at(3);
		return o;
	}
	forestDensity(x, z) { return this.habitat(x, z).forest; }

	// Which way is inland? The gradient of the coast exposure, for the lean of wind-pruned trees.
	inlandDir(x, z, out) {
		const e = this.cell * 2;
		const dx = this.habitat(x + e, z).coast - this.habitat(x - e, z).coast;
		const dz = this.habitat(x, z + e).coast - this.habitat(x, z - e).coast;
		const l = Math.hypot(dx, dz);
		if (l < 1e-4) { out.x = 0; out.z = 0; return out; }
		out.x = -dx / l; out.z = -dz / l;
		return out;
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
	const value = p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
	return clamp(value, Math.min(p1, p2), Math.max(p1, p2));
}

export { NO_WATER, SQRT2 };
