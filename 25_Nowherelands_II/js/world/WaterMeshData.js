import { crestShape, crestOffset } from './RiverGeometry.js';
import { clipShore } from './LakeSurface.js';
import { riverWakes } from './RiverFlow.js';
import { RIVER_STRIDE, RV, RIVER_KIND, surfaceHalfWidth } from './gen/Rivers.js';

// CPU-only geometry synthesis, shared by startup and the streaming worker.
export const NEAR_RADIUS = 260;
export const NEAR_BUILD = 340;
export const NEAR_REBUILD = 40;
const NEAR_QUAD = 2.2;
const NEAR_LAKE_SUB = 4;
export function nearCoverageRadius(cx, cz, px, pz) {
	return Math.max(0, Math.min(NEAR_RADIUS, NEAR_BUILD - Math.hypot(cx - px, cz - pz) - 24));
}
export class WaterMeshData {
	constructor(heightmap) {
		this.heightmap = heightmap; this.world = heightmap.world;
		this.sections = this.world.rivers.map(r => this.riverSections(r));
		this.lakeGrids = this.prepareLakes();
	}
	prepareLakes() {
		const world = this.world, heightmap = this.heightmap, N = world.res;
		return world.lakes.map(lake => {
			if (!heightmap.lakes.cells[lake.id].length) return null;
			let i0 = N, i1 = 0, j0 = N, j1 = 0;
			for (const k of heightmap.lakes.cells[lake.id]) { const i = k % N, j = (k / N) | 0; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
			i0 = Math.max(i0 - 1, 0); j0 = Math.max(j0 - 1, 0); i1 = Math.min(i1 + 1, N - 1); j1 = Math.min(j1 + 1, N - 1);
			const W = (i1 - i0 + 1) * 2, H = (j1 - j0 + 1) * 2;
			const mask = new Uint8Array(W * H);
			for (const k of heightmap.lakes.cells[lake.id]) {
				const i = (k % N) - i0, j = ((k / N) | 0) - j0;
				for (let sj = 2 * j - 1; sj <= 2 * j + 2; sj++) for (let si = 2 * i - 1; si <= 2 * i + 2; si++) {
					if (si < 0 || sj < 0 || si >= W || sj >= H) continue;
					mask[sj * W + si] = 1;
				}
			}
			return { lake, i0, j0, W, H, mask };
		}).filter(Boolean);
	}
	buildStatic() {
		const b = new Builder(); this.buildLakes(b, 1, null);
		for (let ri = 0; ri < this.world.rivers.length; ri++) this.buildRiver(b, ri, null, 0);
		return b.pack();
	}
	// ---------- lakes ----------
	// One quad per half grid cell, or `sub` x `sub` quads per half cell for the near mesh, kept
	// where `keep(x, z)` says so.
	buildLakes(b, sub, keep, bounds = null) {
		const world = this.world, heightmap = this.heightmap;
		const N = world.res, cell = world.cell, half = cell / 2;
		const wx = (i) => -world.size / 2 + i * cell - heightmap.ox;
		const wz = (j) => -world.size / 2 + j * cell - heightmap.oz;
		for (const { lake, i0, j0, W, H, mask } of this.lakeGrids) {
			const xmin = wx(i0) - half, zmin = wz(j0) - half;
			const loX = bounds ? Math.max(0, Math.floor((bounds.x0 - xmin) / half)) : 0;
			const loZ = bounds ? Math.max(0, Math.floor((bounds.z0 - zmin) / half)) : 0;
			const hiX = bounds ? Math.min(W, Math.ceil((bounds.x1 - xmin) / half)) : W;
			const hiZ = bounds ? Math.min(H, Math.ceil((bounds.z1 - zmin) / half)) : H;
			if (loX >= hiX || loZ >= hiZ) continue;
			const y = lake.level - 0.08;
			const fieldCache = new Map();
			const field = ([x, z]) => {
				const key = `${x},${z}`; let value = fieldCache.get(key);
				if (value === undefined) { value = Math.min(heightmap.lakes.coverage(lake.id, x, z), y - heightmap.height(x, z) + 0.04); fieldCache.set(key, value); }
				return value;
			};
			const triangle = (vertices) => {
				const poly = clipShore(vertices, field);
				if (poly.length < 3) return;
				const ids = poly.map(([x, z]) => b.still(x, y, z, heightmap.lakes.waveWeight(lake.id, x, z)));
				for (let k = 1; k < ids.length - 1; k++) b.idx.push(ids[0], ids[k], ids[k + 1]);
			};
			for (let sj = loZ; sj < hiZ; sj++) for (let si = loX; si < hiX; si++) {
				if (!mask[sj * W + si]) continue;
				const x0 = wx(i0) - half + si * half, z0 = wz(j0) - half + sj * half;
				if (keep && !keep(x0 + half / 2, z0 + half / 2)) continue;
				const gi = Math.floor(heightmap.gx(x0)), gj = Math.floor(heightmap.gz(z0));
				// Narrow feeders keep enough tessellation to survive shoreline clipping at every distance.
				const divisions = heightmap.lakes.joinCells.has(gj * N + gi) ? Math.max(sub, NEAR_LAKE_SUB) : sub;
				const q = half / divisions;
				for (let v = 0; v < divisions; v++) for (let u = 0; u < divisions; u++) {
					const x = x0 + u * q, z = z0 + v * q;
					const a = [x, z], c = [x, z + q], d = [x + q, z + q], e = [x + q, z];
					if (((si * 7 + sj * 13 + u * 3 + v * 5 + u * v) & 3) < 2) { triangle([a, c, e]); triangle([e, c, d]); }
					else { triangle([a, c, d]); triangle([a, d, e]); }
				}
			}
		}
	}

	// ---------- rivers ----------
	// a cross-section of the surface at every sample: centre, normal, half width and the fields
	riverSections(r) {
		const S = RIVER_STRIDE, d = r.data, count = r.count;
		const out = [], fallSections = new Map();
		for (const f of r.falls) { fallSections.set(f.i, f); fallSections.set(f.j, f); }
		for (let i = 0; i < count; i++) {
			const o = i * S;
			const x = d[o + RV.X], z = d[o + RV.Z], wl = d[o + RV.WL] - 0.08, w = d[o + RV.W], dep = d[o + RV.D], foam = d[o + RV.FOAM], bank = d[o + RV.BANK], speed = d[o + RV.SPEED], along = d[o + RV.ALONG], kind = d[o + RV.KIND], fd = d[o + RV.FADE];
			// tangent: forward at a pool start, backward at a lip, centred elsewhere
			const ia = kind === RIVER_KIND.POOL || kind === RIVER_KIND.STEP_TOP ? i : Math.max(0, i - 1), ib = kind === RIVER_KIND.LIP || kind === RIVER_KIND.STEP_BOTTOM ? i : Math.min(count - 1, i + 1);
			let tx = d[ib * S + RV.X] - d[ia * S + RV.X], tz = d[ib * S + RV.Z] - d[ia * S + RV.Z];
			const len = Math.hypot(tx, tz) || 1;
			tx /= len; tz /= len;
			const fall = fallSections.get(i);
			if (fall) { tx = fall.dx; tz = fall.dz; }
			// the surface runs just under the bank, to where the ground stands clear of it
			const bend = d[o + RV.BEND];
			const left = surfaceHalfWidth(w, dep, bank, -1, bend), right = surfaceHalfWidth(w, dep, bank, 1, bend);
			const hw = Math.max(left, right);
			let stepH = 0;
			const [skew, bow] = crestShape(r, i);
			if (kind === RIVER_KIND.STEP_TOP && i < count - 1) { stepH = d[o + RV.WL] - d[o + S + RV.WL]; }
			else if (kind === RIVER_KIND.STEP_BOTTOM && i > 0) { stepH = d[o - S + RV.WL] - d[o + RV.WL]; }

			out.push({ x, z, y: wl, travel: d[o + RV.TRAVEL], tx, tz, nx: -tz, nz: tx, hw, left, right, bend, skew, bow, foam, dep, w, along, speed, stepH, kind, fd });
		}
		return out;
	}

	// Quads between consecutive samples of one river, subdivided `subAlong` times along the flow
	// and `subAcross` times across it. `keep(i)` selects the sample pairs (i, i+1) to build.
	// `quad` is the target quad size in metres for the near mesh (0 for the static mesh's one quad per sample).
	buildRiver(b, ri, keep, quad) {
		const r = this.world.rivers[ri], secs = this.sections[ri], lakeId = this.heightmap.lakes.receivingLake[ri];
		const count = r.count;
		for (let i = 0; i < count - 1; i++) {
			const a = secs[i], c = secs[i + 1];
			if (a.kind === RIVER_KIND.LIP) continue;                    // the fall covers the gap
			if (keep && !keep(i)) continue;
			// as many quads as it takes to match the sea's facets, so a river's last reaches look like the sea
			const barDetail = Math.max(r.data[i * RIVER_STRIDE + RV.BAR], r.data[(i + 1) * RIVER_STRIDE + RV.BAR]) > 0.2 ? 12 : 4;
			const subAcross = quad ? Math.min(Math.max(Math.round(a.hw * 2 / quad), barDetail), 32) : barDetail;
			const subAlong = quad ? Math.min(Math.max(Math.round(Math.hypot(c.x - a.x, c.z - a.z) / quad), 1), 8) : 1;
			const wk = riverWakes(r, i, RIVER_STRIDE, RV.ALONG);
			// a riffle ramp is exactly one quad: the step height belongs to the quad, never interpolated into its neighbours
			const stepH = a.kind === RIVER_KIND.STEP_TOP && c.kind === RIVER_KIND.STEP_BOTTOM ? a.stepH : 0;
			// rows of vertices from section a to section c
			const rows = [];
			for (let j = 0; j <= subAlong; j++) {
				const t = j / subAlong;
				const s = t === 0 ? a : t === 1 ? c : lerpSection(a, c, t);
				const row = [];
				const wave = a.kind === RIVER_KIND.POOL ? t : c.kind === RIVER_KIND.LIP ? 1 - t : 1;
				for (let k = 0; k <= subAcross; k++) {
					const u = (k / subAcross) * 2 - 1;                    // -1 right bank .. +1 left bank
					const across = u * (u < 0 ? s.left : s.right);
					const warp = crestOffset(across / (s.w * 0.5), s.skew, s.bow);
					const x = s.x + s.nx * across + s.tx * warp, z = s.z + s.nz * across + s.tz * warp;
					const bed = this.heightmap.height(x, z);
					const coverage = lakeId >= 0 ? this.heightmap.lakes.coverage(lakeId, x, z) : -1;
					const join = coverage > 0 && s.y <= this.world.lakes[lakeId].level + 0.02 ? Math.min(1, coverage / 3) : 0;
					row.push(b.river(x, s.y, z, [s.foam, s.dep, across / (s.w * 0.5), s.w], [s.along, s.speed, stepH, s.travel], wk, s.fd, [s.bend, bed, s.tx, s.tz], join, wave));
				}
				rows.push(row);
			}
			// two triangles across the diagonal, counter-clockwise seen from above; the diagonal
			// alternates so the facets do not all lean the same way
			for (let j = 0; j < subAlong; j++) for (let k = 0; k < subAcross; k++) {
				const aL = rows[j][k + 1], aR = rows[j][k], bL = rows[j + 1][k + 1], bR = rows[j + 1][k];
				if (((i * 7 + j * 13 + k * 5 + j * k) & 3) < 2) b.idx.push(aR, aL, bL, aR, bL, bR); else b.idx.push(aR, aL, bR, aL, bL, bR);
			}
		}
	}

	buildNear(px, pz) {
		const hm = this.heightmap;
		const segs = hm.rivers.segmentsIn(px - NEAR_BUILD, pz - NEAR_BUILD, px + NEAR_BUILD, pz + NEAR_BUILD);
		const perRiver = new Map();
		for (const s of segs) {
			const ri = hm.rivers.segRiver[s], i = hm.rivers.segIndex[s];
			let set = perRiver.get(ri);
			if (!set) { set = new Set(); perRiver.set(ri, set); }
			set.add(i);
		}
		const b = new Builder();
		const r2 = NEAR_BUILD * NEAR_BUILD;
		this.buildLakes(b, NEAR_LAKE_SUB, (x, z) => { const dx = x - px, dz = z - pz; return dx * dx + dz * dz < r2; }, { x0: px - NEAR_BUILD, z0: pz - NEAR_BUILD, x1: px + NEAR_BUILD, z1: pz + NEAR_BUILD });
		for (const [ri, set] of perRiver) {
			const secs = this.sections[ri];
			this.buildRiver(b, ri, (i) => { if (!set.has(i)) return false; const s = secs[i], c = secs[i + 1]; const dx = s.x - px, dz = s.z - pz; const reach = NEAR_BUILD + Math.max(s.hw, c.hw) * 1.5 + Math.hypot(c.x - s.x, c.z - s.z); return dx * dx + dz * dz < reach * reach; }, NEAR_QUAD);
		}
		return b.pack();
	}
}

const NO_WAKE = [0, 0, 0];
const STILL = [0, -1, 0, 0], NO_STEP = [0, 0, 0, 0], NO_WAKES = [NO_WAKE, NO_WAKE, NO_WAKE];

function lerpSection(a, c, t) {
	const L = (p, q) => p + (q - p) * t;
	let nx = L(a.nx, c.nx), nz = L(a.nz, c.nz);
	const nl = Math.hypot(nx, nz) || 1;
	nx /= nl; nz /= nl;
	return { x: L(a.x, c.x), z: L(a.z, c.z), y: L(a.y, c.y), tx: L(a.tx, c.tx), tz: L(a.tz, c.tz), nx, nz, hw: L(a.hw, c.hw), left: L(a.left, c.left), right: L(a.right, c.right), bend: L(a.bend, c.bend), skew: L(a.skew, c.skew), bow: L(a.bow, c.bow), foam: L(a.foam, c.foam), dep: L(a.dep, c.dep), w: L(a.w, c.w), along: L(a.along, c.along), travel: L(a.travel, c.travel), speed: L(a.speed, c.speed), stepH: Math.max(a.stepH, c.stepH), fd: L(a.fd, c.fd) };
}

// accumulates vertices and indices for one water geometry
class Builder {
	constructor() { this.pos = []; this.info0 = []; this.info1 = []; this.fade = []; this.channel = []; this.join = []; this.wave = []; this.wake0 = []; this.wake1 = []; this.wake2 = []; this.idx = []; this.stillVertices = new Map(); }
	// info0: foam, depth (-1 for still water), across (signed, 1 at the channel edge), width
	// info1: along, speed, step height, integrated travel time
	river(x, y, z, i0, i1, wk, fd, channel = [0, 0, 0, 0], join = 0, wave = 1) {
		this.pos.push(x, y, z);
		this.info0.push(i0[0], i0[1], i0[2], i0[3]);
		this.info1.push(i1[0], i1[1], i1[2], i1[3]);
		this.fade.push(fd);
		this.channel.push(...channel);
		this.join.push(join); this.wave.push(wave);
		this.wake0.push(wk[0][0], wk[0][1], wk[0][2]); this.wake1.push(wk[1][0], wk[1][1], wk[1][2]); this.wake2.push(wk[2][0], wk[2][1], wk[2][2]);
		return this.pos.length / 3 - 1;
	}
	still(x, y, z, wave = 1) {
		const key = `${x},${y},${z}`;
		const cached = this.stillVertices.get(key);
		if (cached !== undefined) return cached;
		const index = this.river(x, y, z, STILL, NO_STEP, NO_WAKES, 0, [0, 0, 0, 0], 0, wave);
		this.stillVertices.set(key, index); return index;
	}
	pack() {
		const fields = { position: [this.pos, 3], aInfo0: [this.info0, 4], aInfo1: [this.info1, 4], aWave: [this.wave, 1], aJoin: [this.join, 1], aChannel: [this.channel, 4], aFade: [this.fade, 1], aWake0: [this.wake0, 3], aWake1: [this.wake1, 3], aWake2: [this.wake2, 3] };
		const attributes = Object.fromEntries(Object.entries(fields).map(([key, [values, size]]) => [key, { array: Float32Array.from(values), size }]));
		return { attributes, index: Uint32Array.from(this.idx) };
	}
}
