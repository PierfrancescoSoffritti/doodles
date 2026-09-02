import { Random, Simplex2D } from '../../core/Random.js';

// Offline world generation: a finite continent shaped by uplift and river erosion.
// Pure JS with no DOM or three.js dependency so it can run in a worker (or node for tests).
//
// Pipeline
//   1. base terrain: warped island mask, coastal plains, mountain spines as uplift
//   2. landscape evolution at coarse res: stream-power incision + hillslope diffusion + talus,
//      hard rock erodes slowly (cliffs, plateaus, gorges)
//   3. upsample, add relief noise, run a shorter fine pass so small valleys appear
//   4. coast shaping (cliffs on hard rock, beaches on soft), cirques for mountain lakes
//   5. depression filling -> lakes; drainage area -> river network as polylines with
//      a stepped water profile (pools and drops) and meanders in gentle reaches
//   6. spawn on a lowland shore near the largest river mouth, facing the mountains

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export const WORLD_SIZE = 16384;
export const WORLD_RES = 1024;
export const NO_WATER = -1e4;

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DZ = [0, 0, 1, -1, 1, -1, 1, -1];
const DD = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

// ---------- helpers ----------
class MinHeap {
	constructor(cap) { this.keys = new Float64Array(cap); this.vals = new Int32Array(cap); this.n = 0; this.topKey = 0; }
	push(key, val) {
		let i = this.n++;
		const k = this.keys, v = this.vals;
		while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
		k[i] = key; v[i] = val;
	}
	pop() {
		const k = this.keys, v = this.vals;
		const top = v[0];
		this.topKey = k[0];
		const n = --this.n;
		if (n > 0) {
			const key = k[n], val = v[n];
			let i = 0;
			for (;;) {
				let l = 2 * i + 1;
				if (l >= n) break;
				const r = l + 1;
				if (r < n && k[r] < k[l]) l = r;
				if (k[l] >= key) break;
				k[i] = k[l]; v[i] = v[l]; i = l;
			}
			k[i] = key; v[i] = val;
		}
		return top;
	}
}

// Barnes priority flood: hf = h with every depression raised to its spill level (+eps per step so
// water still has a downhill path across the flat). Seeds: sea cells and the map border.
function priorityFlood(h, hf, N, eps, seaLevel = 0) {
	const M = N * N;
	const visited = new Uint8Array(M);
	const heap = new MinHeap(M);
	for (let k = 0; k < M; k++) {
		const i = k % N, j = (k / N) | 0;
		if (h[k] <= seaLevel || i === 0 || j === 0 || i === N - 1 || j === N - 1) { hf[k] = h[k]; visited[k] = 1; heap.push(h[k], k); }
	}
	while (heap.n) {
		const c = heap.pop();
		const hc = heap.topKey;
		const i = c % N, j = (c / N) | 0;
		for (let d = 0; d < 8; d++) {
			const ni = i + DX[d], nj = j + DZ[d];
			if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
			const n = nj * N + ni;
			if (visited[n]) continue;
			visited[n] = 1;
			const v = Math.max(h[n], hc + eps);
			hf[n] = v;
			heap.push(v, n);
		}
	}
}

function bilinear(grid, N, fx, fz) {
	const x = clamp(fx, 0, N - 1.001), z = clamp(fz, 0, N - 1.001);
	const i = x | 0, j = z | 0, tx = x - i, tz = z - j;
	const k = j * N + i;
	return (grid[k] * (1 - tx) + grid[k + 1] * tx) * (1 - tz) + (grid[k + N] * (1 - tx) + grid[k + N + 1] * tx) * tz;
}

function cubic(p0, p1, p2, p3, t) {
	return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}

function bicubic(grid, N, fx, fz) {
	const x = clamp(fx, 1, N - 2.001), z = clamp(fz, 1, N - 2.001);
	const i = x | 0, j = z | 0, tx = x - i, tz = z - j;
	let rows = [0, 0, 0, 0];
	for (let r = -1; r <= 2; r++) {
		const k = (j + r) * N + i;
		rows[r + 1] = cubic(grid[k - 1], grid[k], grid[k + 1], grid[k + 2], tx);
	}
	return cubic(rows[0], rows[1], rows[2], rows[3], tz);
}

// ---------- 1. base terrain ----------
function makeSpines(rnd, size) {
	const n = rnd.int(2, 3);
	const spines = [];
	for (let s = 0; s < n; s++) {
		const pts = [];
		let x = rnd.range(-0.22, 0.22) * size, z = rnd.range(-0.22, 0.22) * size;
		let a = rnd.range(0, TAU);
		const len = rnd.int(6, 10);
		for (let i = 0; i < len; i++) {
			pts.push([x, z]);
			a += rnd.range(-0.45, 0.45);
			x += Math.cos(a) * 1100;
			z += Math.sin(a) * 1100;
		}
		spines.push({ pts, halfWidth: rnd.range(1300, 2100), strength: rnd.range(0.75, 1) });
	}
	return spines;
}

function distToPolyline(pts, x, z) {
	let best = Infinity;
	for (let i = 0; i < pts.length - 1; i++) {
		const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
		const dx = bx - ax, dz = bz - az;
		const l2 = dx * dx + dz * dz;
		let t = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
		t = clamp(t, 0, 1);
		const px = ax + dx * t - x, pz = az + dz * t - z;
		const d = px * px + pz * pz;
		if (d < best) best = d;
	}
	return Math.sqrt(best);
}

function baseTerrain(rnd, N, size, noise, spines) {
	const cell = size / (N - 1);
	const M = N * N;
	const h = new Float32Array(M), uplift = new Float32Array(M), hard = new Float32Array(M), strata = new Float32Array(M);
	const { continent: nC, warp: nW, hills: nH, rock: nR, mountain: nM, plateau: nP } = noise;
	for (let j = 0; j < N; j++) {
		const z = -size / 2 + j * cell;
		for (let i = 0; i < N; i++) {
			const x = -size / 2 + i * cell;
			const k = j * N + i;
			const wx = x + nW.fbm(x / 5200, z / 5200, 2) * 1600;
			const wz = z + nW.fbm(x / 5200 + 31.7, z / 5200 - 17.3, 2) * 1600;
			const r = Math.hypot(wx, wz) / (size * 0.47);
			const c = nC.fbm(wx / 6500, wz / 6500, 4, 2.0, 0.55) * 0.6 + 0.66 - Math.pow(r, 2.8) + nC.fbm(x / 1400 + 50, z / 1400 + 50, 3) * 0.09;
			const rock = clamp(nR.fbm(x / 1500, z / 1500, 3) * 0.55 + 0.5, 0, 1);
			hard[k] = rock;
			strata[k] = smoothstep(0.2, 0.7, nP.fbm(x / 2600 + 5, z / 2600 - 9, 2));

			let ridge = 0;
			for (const s of spines) {
				const d = distToPolyline(s.pts, wx, wz);
				const v = Math.exp(-Math.pow(d / s.halfWidth, 1.7)) * s.strength;
				if (v > ridge) ridge = v;
			}
			const land = smoothstep(-0.03, 0.22, c);
			const hills = nH.fbm(x / 1150, z / 1150, 5);
			let hh;
			if (c < 0) {
				hh = -3 - Math.pow(-c, 0.75) * 150 + hills * 3;
			} else {
				hh = 2 + smoothstep(0, 0.4, c) * 80 + hills * 40 * (0.25 + 0.75 * land) + 6 * smoothstep(0, 0.06, c);
			}
			const mtn = ridge * (480 + 260 * nM.fbm(x / 3200, z / 3200, 2)) * land;
			const crest = 1 - Math.abs(nM.noise(x / 900 + 3.1, z / 900 - 7.7));
			const crest2 = 1 - Math.abs(nM.noise(x / 380 - 11.3, z / 380 + 5.9));
			hh += mtn + ridge * (crest * crest * 640 + crest2 * crest2 * 260) * land;
			h[k] = hh;
			uplift[k] = ridge * land;
		}
	}
	return { h, uplift, hard, strata, cell };
}

// ---------- 2. landscape evolution ----------
function computeReceivers(hf, recv, N) {
	for (let j = 0; j < N; j++) {
		for (let i = 0; i < N; i++) {
			const k = j * N + i;
			const hc = hf[k];
			let best = k, bestS = 0;
			for (let d = 0; d < 8; d++) {
				const ni = i + DX[d], nj = j + DZ[d];
				if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
				const n = nj * N + ni;
				const s = (hc - hf[n]) / DD[d];
				if (s > bestS) { bestS = s; best = n; }
			}
			recv[k] = best;
		}
	}
}

// Braun & Willett ordering: every cell after its receiver.
function buildStack(recv, stack, N, work) {
	const M = N * N;
	const { ndon, offs, donors, dfs } = work;
	ndon.fill(0);
	for (let k = 0; k < M; k++) if (recv[k] !== k) ndon[recv[k]]++;
	offs[0] = 0;
	for (let k = 0; k < M; k++) offs[k + 1] = offs[k] + ndon[k];
	ndon.fill(0);
	for (let k = 0; k < M; k++) { const r = recv[k]; if (r !== k) donors[offs[r] + ndon[r]++] = k; }
	let top = 0;
	for (let k = 0; k < M; k++) {
		if (recv[k] !== k) continue;
		let sp = 0;
		dfs[sp++] = k;
		while (sp) {
			const c = dfs[--sp];
			stack[top++] = c;
			for (let q = offs[c]; q < offs[c + 1]; q++) dfs[sp++] = donors[q];
		}
	}
	return top;
}

function accumulateArea(recv, stack, area, M) {
	area.fill(1);
	for (let s = M - 1; s >= 0; s--) { const c = stack[s]; const r = recv[c]; if (r !== c) area[r] += area[c]; }
}

function erode(t, N, params, rnd, progress, label) {
	const { h, uplift, hard, strata, cell } = t;
	const M = N * N;
	const { iterations, K, m, upliftRate, diffusion, floodEvery } = params;
	const hf = new Float32Array(M), lakeDepth = new Float32Array(M);
	const recv = new Int32Array(M), stack = new Int32Array(M), area = new Float32Array(M);
	const work = { ndon: new Int32Array(M), offs: new Int32Array(M + 1), donors: new Int32Array(M), dfs: new Int32Array(M) };
	const lap = new Float32Array(M);

	for (let it = 0; it < iterations; it++) {
		if (progress) progress(label, it / iterations);
		if (it % floodEvery === 0) {
			priorityFlood(h, hf, N, 1e-3);
			for (let k = 0; k < M; k++) lakeDepth[k] = hf[k] - h[k];
		} else {
			for (let k = 0; k < M; k++) hf[k] = h[k] + lakeDepth[k];
		}
		computeReceivers(hf, recv, N);
		buildStack(recv, stack, N, work);
		accumulateArea(recv, stack, area, M);

		// stream power, implicit in n=1: h' = (h + f*h'_recv) / (1 + f)
		const cellArea = cell * cell;
		for (let s = 0; s < M; s++) {
			const c = stack[s];
			const r = recv[c];
			if (r === c || h[c] <= 0) continue;
			if (lakeDepth[c] > 0.05) continue;      // standing water does not cut
			const rock = hard[c];
			let k = K * (1 - 0.78 * smoothstep(0.5, 0.82, rock));
			if (strata[c] > 0) k *= 1 + strata[c] * 0.9 * (0.5 + 0.5 * Math.sin(h[c] * (TAU / 48) + rock * 6));
			const diag = (r % N) !== (c % N) && ((r / N) | 0) !== ((c / N) | 0);
			const ff = k * Math.pow(area[c] * cellArea, m) / (cell * (diag ? Math.SQRT2 : 1));
			h[c] = (h[c] + ff * h[r]) / (1 + ff);
		}

		// uplift keeps the ranges growing while rivers cut into them
		if (upliftRate > 0) for (let k = 0; k < M; k++) if (h[k] > 0) h[k] += uplift[k] * upliftRate;

		// hillslope diffusion (rounds ridges, fills tiny pits)
		if (diffusion > 0) {
			for (let j = 1; j < N - 1; j++) {
				for (let i = 1; i < N - 1; i++) {
					const k = j * N + i;
					lap[k] = h[k - 1] + h[k + 1] + h[k - N] + h[k + N] - 4 * h[k];
				}
			}
			for (let k = 0; k < M; k++) if (h[k] > -1) h[k] += lap[k] * diffusion * (1 - 0.6 * smoothstep(0.55, 0.85, hard[k])) * (1 - 0.65 * smoothstep(450, 850, h[k]));
		}

		// talus: slopes steeper than the rock can hold slump onto the cell below
		for (let j = 1; j < N - 1; j++) {
			for (let i = 1; i < N - 1; i++) {
				const k = j * N + i;
				if (h[k] <= 0) continue;
				const tal = (0.75 + 1.9 * smoothstep(0.35, 0.85, hard[k])) * cell;
				let low = -1, bestS = 0, lowD = 1;
				for (let d = 0; d < 8; d++) {
					const n = k + DX[d] + DZ[d] * N;
					const s = (h[k] - h[n]) / DD[d];
					if (s > bestS) { bestS = s; low = n; lowD = DD[d]; }
				}
				if (low >= 0 && bestS > tal) {
					const move = (bestS - tal) * lowD * 0.25;
					h[k] -= move;
					h[low] += move;
				}
			}
		}
	}
	return { recv, stack, area, hf, lakeDepth, work };
}

// ---------- 3. upsample ----------
function upsample(t, N0, N1, size, noise) {
	const cell = size / (N1 - 1);
	const M1 = N1 * N1;
	const out = { h: new Float32Array(M1), uplift: new Float32Array(M1), hard: new Float32Array(M1), strata: new Float32Array(M1), cell };
	const scale = (N0 - 1) / (N1 - 1);
	const nD = noise.detail;
	for (let j = 0; j < N1; j++) {
		const z = -size / 2 + j * cell;
		for (let i = 0; i < N1; i++) {
			const x = -size / 2 + i * cell;
			const k = j * N1 + i;
			const fx = i * scale, fz = j * scale;
			let hh = bicubic(t.h, N0, fx, fz);
			out.uplift[k] = bilinear(t.uplift, N0, fx, fz);
			out.hard[k] = bilinear(t.hard, N0, fx, fz);
			out.strata[k] = bilinear(t.strata, N0, fx, fz);
			if (hh > 0) {
				const land = smoothstep(0, 25, hh);
				const relief = 0.35 + 0.65 * smoothstep(60, 500, hh);
				const alpine = smoothstep(450, 900, hh);
				hh += nD.fbm(x / 420, z / 420, 3) * (14 + 10 * alpine) * land * relief;
				hh += (1 - Math.abs(nD.noise(x / 210 + 9, z / 210 + 4))) * (9 + 14 * alpine) * land * relief * smoothstep(120, 600, hh);
				hh += (1 - Math.abs(nD.noise(x / 95 - 3, z / 95 + 8))) * 11 * alpine;
			hh += (1 - Math.abs(nD.noise(x / 160 + 21, z / 160 - 13))) * 16 * alpine;
			}
			out.h[k] = hh;
		}
	}
	return out;
}

// ---------- 4. coast, cirques ----------
function shapeCoast(t, N) {
	const { h, hard } = t;
	const M = N * N;
	const src = Float32Array.from(h);
	const nearSea = new Uint8Array(M);
	for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
		const k = j * N + i;
		if (src[k] <= 0) continue;
		for (let d = 0; d < 8; d++) if (src[k + DX[d] + DZ[d] * N] <= 0) { nearSea[k] = 1; break; }
	}
	for (let j = 2; j < N - 2; j++) for (let i = 2; i < N - 2; i++) {
		const k = j * N + i;
		if (src[k] <= 0) continue;
		let ring = 0;
		for (let d = 0; d < 8; d++) if (nearSea[k + DX[d] + DZ[d] * N]) { ring = 1; break; }
		if (!nearSea[k] && !ring) continue;
		const cliff = smoothstep(0.5, 0.7, hard[k]);
		// inland reference: the highest land two cells away from the sea
		let inland = src[k];
		for (let d = 0; d < 8; d++) inland = Math.max(inland, src[k + 2 * DX[d] + 2 * DZ[d] * N]);
		if (cliff > 0 && inland > 14) {
			// hard coast: the land holds its height right up to the drop
			const target = nearSea[k] ? Math.max(src[k], inland * 0.9) : Math.max(src[k], inland * 0.97);
			h[k] = lerp(h[k], target, cliff);
			// undercut shelf: the sea cell next to a cliff is shallow rock
			if (nearSea[k]) for (let d = 0; d < 8; d++) { const n = k + DX[d] + DZ[d] * N; if (src[n] <= 0 && src[n] > -40) h[n] = lerp(h[n], -3, cliff * 0.7); }
		} else if (cliff < 0.3) {
			// soft coast: beach ramps
			const beach = nearSea[k] ? Math.min(src[k], 0.7) : Math.min(src[k], 3.0);
			h[k] = lerp(h[k], beach, (1 - cliff / 0.3) * 0.8);
			if (nearSea[k]) for (let d = 0; d < 8; d++) { const n = k + DX[d] + DZ[d] * N; if (src[n] <= 0 && src[n] > -3) h[n] = Math.min(h[n], -2.5); }
		}
	}
}

function carveCirques(t, N, area, rnd, size) {
	const { h, cell } = t;
	const cands = [];
	for (let j = 4; j < N - 4; j += 2) for (let i = 4; i < N - 4; i += 2) {
		const k = j * N + i;
		if (h[k] < 620 || area[k] > 220 || area[k] < 4) continue;
		let maxDrop = 0;
		for (let d = 0; d < 8; d++) maxDrop = Math.max(maxDrop, Math.abs(h[k] - h[k + DX[d] + DZ[d] * N]) / DD[d]);
		if (maxDrop / cell > 0.32) continue;
		cands.push({ k, i, j, score: h[k] + rnd.range(0, 300) });
	}
	cands.sort((a, b) => b.score - a.score);
	const chosen = [];
	for (const c of cands) {
		if (chosen.length >= rnd.int(4, 7)) break;
		if (chosen.some((o) => Math.hypot(o.i - c.i, o.j - c.j) * cell < 900)) continue;
		chosen.push(c);
	}
	for (const c of chosen) {
		const r = rnd.range(90, 170), depth = rnd.range(14, 30);
		const hc = h[c.k];
		const rc = Math.ceil(r / cell) + 1;
		for (let dj = -rc; dj <= rc; dj++) for (let di = -rc; di <= rc; di++) {
			const d = Math.hypot(di, dj) * cell;
			if (d > r) continue;
			const k = c.k + di + dj * N;
			const u = d / r;
			const bowl = hc - depth + depth * 1.12 * u * u;
			const w = smoothstep(1, 0.55, u);
			h[k] = lerp(h[k], bowl, w);
		}
	}
	return chosen.length;
}

// ---------- 5. lakes and rivers ----------
function findLakes(h, hf, N, cell) {
	const M = N * N;
	const lakeId = new Int32Array(M).fill(-1);
	const lakeLevel = new Float32Array(M).fill(NO_WATER);
	const lakes = [];
	const queue = new Int32Array(M);
	for (let k = 0; k < M; k++) {
		if (lakeId[k] >= 0 || hf[k] - h[k] <= 0.25) continue;
		// flood the connected depression
		let head = 0, tail = 0, level = hf[k], maxDepth = 0;
		queue[tail++] = k; lakeId[k] = lakes.length;
		const cells = [];
		while (head < tail) {
			const c = queue[head++];
			cells.push(c);
			if (hf[c] > level) level = hf[c];
			if (hf[c] - h[c] > maxDepth) maxDepth = hf[c] - h[c];
			const i = c % N, j = (c / N) | 0;
			for (let d = 0; d < 4; d++) {
				const ni = i + DX[d], nj = j + DZ[d];
				if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
				const n = nj * N + ni;
				if (lakeId[n] >= 0 || hf[n] - h[n] <= 0.25) continue;
				lakeId[n] = lakes.length;
				queue[tail++] = n;
			}
		}
		if (cells.length < 40 && maxDepth < 6 || cells.length < 10 || maxDepth < 2.2 || level < 0.5) {
			for (const c of cells) { h[c] = hf[c]; lakeId[c] = -2; }   // puddle: fill it in
			lakes.push(null);
			continue;
		}
		lakes.push({ level, cells, maxDepth, area: cells.length * cell * cell });
	}
	const out = [];
	const remap = new Int32Array(lakes.length).fill(-1);
	lakes.forEach((l, idx) => { if (l) { remap[idx] = out.length; out.push(l); } });
	for (let k = 0; k < M; k++) {
		const id = lakeId[k];
		if (id >= 0 && remap[id] >= 0) { lakeId[k] = remap[id]; lakeLevel[k] = out[remap[id]].level; }
		else lakeId[k] = -1;
	}
	out.forEach((l, i) => { l.id = i; l.cells = Int32Array.from(l.cells); });
	return { lakes: out, lakeId, lakeLevel };
}

// Erosion leaves lakes a couple of metres deep; real lakes deepen away from the shore.
function deepenLakes(h, lakes, lakeId, N) {
	const dist = new Int32Array(N * N).fill(-1);
	const queue = [];
	for (const lake of lakes) {
		for (const c of lake.cells) {
			const i = c % N, j = (c / N) | 0;
			let rim = false;
			for (let d = 0; d < 4 && !rim; d++) { const ni = i + DX[d], nj = j + DZ[d]; if (ni < 0 || nj < 0 || ni >= N || nj >= N || lakeId[nj * N + ni] !== lake.id) rim = true; }
			if (rim) { dist[c] = 0; queue.push(c); }
		}
	}
	let head = 0;
	while (head < queue.length) {
		const c = queue[head++];
		const i = c % N, j = (c / N) | 0;
		for (let d = 0; d < 4; d++) {
			const ni = i + DX[d], nj = j + DZ[d];
			if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
			const n = nj * N + ni;
			if (lakeId[n] < 0 || dist[n] >= 0) continue;
			dist[n] = dist[c] + 1;
			queue.push(n);
		}
	}
	for (const lake of lakes) {
		let maxDepth = 0;
		for (const c of lake.cells) {
			const target = lake.level - Math.min(2 + 4 * dist[c], 18);
			if (target < h[c]) h[c] = target;
			if (lake.level - h[c] > maxDepth) maxDepth = lake.level - h[c];
		}
		lake.maxDepth = maxDepth;
	}
}

function traceRivers(h, hf, recv, area, lakeId, N, cell, threshold, work) {
	const M = N * N;
	const isRiver = new Uint8Array(M);
	for (let k = 0; k < M; k++) if (area[k] >= threshold && h[k] > -1.5 && lakeId[k] < 0) isRiver[k] = 1;
	const { ndon, offs, donors } = work;
	const mark = new Int32Array(M).fill(-1);
	const rivers = [];

	const bestDonor = (c) => {
		let best = -1, bestA = 0;
		for (let q = offs[c]; q < offs[c + 1]; q++) {
			const d = donors[q];
			if (!isRiver[d] || mark[d] >= 0) continue;
			if (area[d] > bestA) { bestA = area[d]; best = d; }
		}
		return best;
	};
	const trace = (mouth, junction, mouthType) => {
		const path = [mouth];
		let c = mouth;
		for (;;) { const d = bestDonor(c); if (d < 0) break; path.push(d); c = d; }
		if (path.length < 6) return;
		const id = rivers.length;
		for (const p of path) mark[p] = id;
		path.reverse();
		let fromLake = -1;
		{
			const s = path[0], si = s % M % N, sj = (s / N) | 0;
			for (let d = 0; d < 8 && fromLake < 0; d++) { const ni = si + DX[d], nj = sj + DZ[d]; if (ni >= 0 && nj >= 0 && ni < N && nj < N && lakeId[nj * N + ni] >= 0) fromLake = lakeId[nj * N + ni]; }
		}
		rivers.push({ id, cells: path, junction, mouthType, fromLake });
	};

	const cells = [];
	for (let k = 0; k < M; k++) if (isRiver[k]) cells.push(k);
	cells.sort((a, b) => area[b] - area[a]);
	// mouths into the sea or a lake, or endorheic pits
	for (const k of cells) {
		const r = recv[k];
		if (mark[k] >= 0) continue;
		if (r === k) trace(k, -1, 'pit');
		else if (h[r] <= 0) trace(k, r, 'sea');
		else if (lakeId[r] >= 0) trace(k, r, 'lake');
	}
	// tributaries, largest first, until every river cell belongs to something
	for (let pass = 0; pass < 12; pass++) {
		let found = false;
		for (const k of cells) {
			if (mark[k] >= 0) continue;
			const r = recv[k];
			if (r !== k && mark[r] >= 0 && lakeId[r] < 0) { trace(k, r, 'river'); found = true; }
		}
		if (!found) break;
	}
	void ndon;
	return rivers;
}

// Rivers grade their own beds: the floor can only climb so steeply per metre upstream, the
// limit falling with drainage area. Where the land drops faster the river cuts a gorge, and
// once a gorge would grow deeper than the cap the river takes the height in one waterfall.
function gradeRivers(rivers, h, area, N, cell, size, lakes, lakeId, rnd, opts = {}) {
	const channelWidth = (aKm2) => clamp(3.5 + Math.sqrt(aKm2 * 1e6) * 0.0075, 5, 110);
	const maxGrade = (aKm2) => clamp(0.09 * Math.pow(Math.max(aKm2, 0.05), -0.5), 0.004, 0.15);
	const GORGE = opts.gorge || 80, FALL_MAX = 42, WALL = 0.7;
	// never cut a lake's rim
	const M = N * N;
	// a lake's rim may be cut down to the lake level, never below it, so an outlet is a notch, not a dam
	const nearLake = new Uint8Array(M), carved = new Uint8Array(M), rimFloor = new Float32Array(M).fill(-1e4);
	for (let k = 0; k < M; k++) if (lakeId[k] >= 0) { const i = k % N, j = (k / N) | 0; const lvl = lakes[lakeId[k]].level; for (let d = 0; d < 8; d++) { const ni = i + DX[d], nj = j + DZ[d]; if (ni >= 0 && nj >= 0 && ni < N && nj < N) { const kk = nj * N + ni; nearLake[kk] = 1; if (lvl > rimFloor[kk]) rimFloor[kk] = lvl; } } }
	for (const r of rivers) {
		const cells = r.cells.slice();
		if (r.junction >= 0) cells.push(r.junction);
		const n = cells.length;
		const T = cells.map((k) => h[k]);
		const A = cells.map((k) => area[k] * cell * cell / 1e6);
		let mouth;
		if (r.mouthType === 'sea') mouth = Math.min(T[n - 1], 0);
		else if (r.mouthType === 'lake') mouth = lakes[lakeId[r.junction]].level;
		else mouth = T[n - 1];
		const prof = new Float64Array(n);
		const fallH = new Float32Array(n);     // drop between cell i and i+1 taken as a fall
		const dist = (i) => { const a = cells[i], b = cells[i + 1]; return ((a % N) !== (b % N) && ((a / N) | 0) !== ((b / N) | 0)) ? cell * Math.SQRT2 : cell; };
		prof[n - 1] = Math.min(T[n - 1], mouth);
		let lastFall = n - 1;
		for (let i = n - 2; i >= 0; i--) {
			let p = Math.min(T[i], prof[i + 1] + maxGrade(A[i]) * dist(i));
			if (T[i] - p > GORGE) {
				// the gorge would be too deep: put a fall on the steepest natural ledge downstream of here,
				// where the land already drops, rather than cutting a terrace into a smooth slope
				let best = -1, bestS = -1;
				for (let k = i + 1; k < lastFall; k++) {
					if (T[k] - prof[k] < 12) continue;
					const steep = T[Math.max(k - 1, 0)] - T[k + 1];
					if (steep > bestS) { bestS = steep; best = k; }
				}
				if (best < 0) best = i;
				const F = clamp(T[best] - 4 - prof[best + 1], 6, rnd.range(FALL_MAX * 0.35, FALL_MAX));
				prof[best] = prof[best + 1] + F;
				fallH[best] = F;
				for (let j = best - 1; j >= i; j--) prof[j] = Math.min(T[j], prof[j + 1] + maxGrade(A[j]) * dist(j));
				lastFall = best;
				continue;
			}
			prof[i] = p;
		}
		// a lake outlet leaves at the lake level and drops over its lip
		if (r.fromLake >= 0) {
			const level = lakes[r.fromLake].level;
			prof[0] = Math.max(prof[0], Math.min(level, T[0]));
			if (prof[0] - prof[1] > 1.5) fallH[0] = prof[0] - prof[1];
		}
		r.profile = prof;
		r.fallH = fallH;
		// stamp the valley cross-section along each segment, a few times per cell so the walls stay smooth
		for (let i = 0; i < n - 1; i++) {
			const ka = cells[i], kb = cells[i + 1];
			const ax = ka % N, az = (ka / N) | 0, bx = kb % N, bz = (kb / N) | 0;
			const steps = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) * 4));
			for (let st = 0; st < steps; st++) {
				const t = st / steps;
				const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
				// a fall is a step in the floor, not a ramp
				const floor = fallH[i] > 0 ? (t < 0.5 ? prof[i] : prof[i + 1]) : prof[i] + (prof[i + 1] - prof[i]) * t;
				const cut = (T[i] + (T[i + 1] - T[i]) * t) - floor;
				if (cut < 0.3) continue;
				const w = channelWidth(A[i]) * 0.9 + 4;
				const radius = cut / WALL + w;
				const rc = Math.ceil(radius / cell);
				const ci = Math.round(px), cj = Math.round(pz);
				for (let dj = -rc; dj <= rc; dj++) {
					const j = cj + dj;
					if (j < 1 || j >= N - 1) continue;
					for (let di = -rc; di <= rc; di++) {
						const ii = ci + di;
						if (ii < 1 || ii >= N - 1) continue;
						const dist = Math.hypot(ii - px, j - pz) * cell;
						if (dist > radius) continue;
						const target = floor + Math.max(0, dist - w) * WALL;
						const kk = j * N + ii;
						if (lakeId[kk] >= 0) continue;
						const tgt = nearLake[kk] ? Math.max(target, rimFloor[kk] + 0.2) : target;
						if (tgt < h[kk]) { h[kk] = tgt; carved[kk] = 1; }
					}
				}
			}
		}
	}
	// soften the creases where the valley walls meet the old ground, or the bicubic sampling rings
	const src = Float32Array.from(h);
	for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
		const k = j * N + i;
		if (!carved[k] && !carved[k - 1] && !carved[k + 1] && !carved[k - N] && !carved[k + N]) continue;
		if (lakeId[k] >= 0) continue;
		const sm = src[k] * 0.5 + (src[k - 1] + src[k + 1] + src[k - N] + src[k + N]) * 0.125;
		h[k] = nearLake[k] ? Math.max(sm, rimFloor[k] + 0.2) : sm;
	}
}

// Turn a chain of cells into a smooth polyline with a water surface that only ever steps downhill:
// pools and riffles of varying height, real falls where the grading put them, widths that swell
// in the pools and pinch at the drops.
function buildRiverGeometry(river, h, area, N, cell, size, lakes, lakeId, rivers, rnd, noise) {
	const toWorld = (k) => [-size / 2 + (k % N) * cell, -size / 2 + ((k / N) | 0) * cell];
	const cells = river.cells.slice();
	if (river.junction >= 0) cells.push(river.junction);
	let pts = cells.map(toWorld);
	const areas = cells.map((k) => area[k] * cell * cell);
	const prof = river.profile, fallH = river.fallH;

	// moving average keeps the corridor, drops the grid staircase
	const smooth = (arr, win) => arr.map((p, i) => {
		let sx = 0, sz = 0, n = 0;
		for (let o = -win; o <= win; o++) { const q = arr[clamp(i + o, 0, arr.length - 1)]; sx += q[0]; sz += q[1]; n++; }
		return [sx / n, sz / n];
	});
	pts = smooth(pts, 2);
	pts[0] = toWorld(cells[0]);

	// resample by arc length; every sample remembers which cell segment it came from
	const spacing = 8;
	const cum = [0];
	for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
	const total = cum[cum.length - 1];
	const n = Math.max(4, Math.round(total / spacing));
	const P = [], A = [], F = [], fallIdx = [];
	let seg = 0, lastSeg = -1;
	for (let i = 0; i <= n; i++) {
		const s = (i / n) * total;
		while (seg < cum.length - 2 && cum[seg + 1] < s) seg++;
		const t = (s - cum[seg]) / Math.max(cum[seg + 1] - cum[seg], 1e-6);
		P.push([lerp(pts[seg][0], pts[seg + 1][0], t), lerp(pts[seg][1], pts[seg + 1][1], t)]);
		A.push(lerp(areas[seg], areas[seg + 1], t));
		// floor from the graded profile; a fall is a step half way along its cell segment
		if (fallH[seg] > 0) {
			F.push(t < 0.5 ? prof[seg] : prof[seg + 1]);
			if (t >= 0.5 && lastSeg !== seg) { fallIdx.push(i); lastSeg = seg; }
		} else F.push(lerp(prof[seg], prof[seg + 1], t));
	}
	const count = P.length;
	const isFall = new Uint8Array(count);
	for (const i of fallIdx) isFall[i] = 1;

	// base width from catchment, blended across junction jumps, then breathing along the reach
	const nM = noise.meander;
	const phase = rnd.range(0, 100);
	let W = A.map((a) => clamp(3.5 + Math.sqrt(a) * 0.0075, 5, 110));
	const smooth1 = (arr, win) => arr.map((v, i) => { let s = 0, c = 0; for (let o = -win; o <= win; o++) { s += arr[clamp(i + o, 0, arr.length - 1)]; c++; } return s / c; });
	W = smooth1(W, 12);
	W = W.map((w, i) => w * (1 + 0.28 * nM.noise(i * spacing / 150 + phase, phase * 0.7)));

	// gradient of the floor over ~200 m
	const grad = F.map((v, i) => { const a = F[clamp(i - 12, 0, count - 1)], b = F[clamp(i + 12, 0, count - 1)]; return Math.max(0, (a - b) / (Math.min(i, 12) + Math.min(count - 1 - i, 12) || 1) / spacing); });

	// meanders where the river is gentle: wavelength ~11 widths, amplitude a couple of widths
	const off = new Float32Array(count);
	let s = 0;
	for (let i = 0; i < count; i++) {
		if (i) s += spacing;
		const gentle = 1 - smoothstep(0.006, 0.03, grad[i]);
		const amp = Math.min(W[i] * 2.5, 90) * gentle * (0.6 + 0.4 * nM.noise(s / 900 + phase, phase));
		const lambda = W[i] * 11 + 60;
		off[i] = amp * Math.sin((s / lambda) * TAU + nM.noise(s / 500, phase) * 1.5);
	}
	// keep the ends anchored so junctions still meet
	for (let i = 0; i < count; i++) {
		const endFade = Math.min(1, i / 10, (count - 1 - i) / 10);
		const prev = P[clamp(i - 1, 0, count - 1)], next = P[clamp(i + 1, 0, count - 1)];
		const dx = next[0] - prev[0], dz = next[1] - prev[1];
		const len = Math.hypot(dx, dz) || 1;
		P[i] = [P[i][0] + (-dz / len) * off[i] * endFade, P[i][1] + (dx / len) * off[i] * endFade];
	}
	const P2 = smooth(P, 2);
	P2[0] = P[0]; P2[count - 1] = P[count - 1];

	// water surface: below the banks, monotone, then quantised into pools and drops
	const bankH = W.map((w) => 1.6 + 0.09 * w);
	const m = new Float32Array(count);
	for (let i = 0; i < count; i++) m[i] = F[i] - bankH[i];
	if (river.fromLake >= 0) {
		const level = lakes[river.fromLake].level;
		for (let i = 0; i < count && F[i] > level - 0.5; i++) m[i] = level;
	}
	for (let i = 1; i < count; i++) if (m[i] > m[i - 1]) m[i] = m[i - 1];
	let mouthLevel;
	if (river.mouthType === 'sea') mouthLevel = 0;
	else if (river.mouthType === 'lake') mouthLevel = lakes[lakeId[river.junction]].level;
	else if (river.mouthType === 'river') {
		const parent = rivers[river.parentId];
		mouthLevel = parent ? parent.levelAtCell(river.junction) : m[count - 1];
	} else mouthLevel = m[count - 1];
	m[count - 1] = mouthLevel;
	for (let i = count - 2; i >= 0; i--) if (m[i] < m[i + 1]) m[i] = m[i + 1];

	const wl = new Float32Array(count), foam = new Float32Array(count), dropAt = new Float32Array(count);
	let pool = m[0], lastStep = -1e9, lastStepH = 1, poolStart = 0;
	let stepJitter = rnd.range(0.6, 1.5);
	const falls = [];
	for (let i = 0; i < count; i++) {
		// pools at least six widths (and 40 m) long, so a steep reach is pools between small falls, not stairs
		const stepH = clamp(grad[i] * Math.max(6 * W[i], 40) * stepJitter, 0.4, 6);
		if (isFall[i] && m[i] < pool - 1) {
			const drop = pool - m[i];
			falls.push({ i, drop });
			pool = m[i]; lastStep = i; lastStepH = drop; dropAt[i] = drop; poolStart = i;
			stepJitter = rnd.range(0.6, 1.5);
		} else if (m[i] < pool - stepH || i === count - 1) {
			if (i < count - 1) { lastStep = i; lastStepH = pool - m[i]; dropAt[i] = pool - m[i]; poolStart = i; stepJitter = rnd.range(0.6, 1.5); }
			pool = m[i];
		}
		wl[i] = pool;
		const foamLen = Math.min((2 + lastStepH * 1.5) / spacing, 3);
		foam[i] = i - lastStep < foamLen ? 1 - (i - lastStep) / foamLen : 0;
	}
	wl[count - 1] = Math.min(wl[count - 1], mouthLevel);
	if (count > 2) wl[count - 2] = Math.max(wl[count - 2], wl[count - 1]);

	// pools swell, riffles pinch: width breathes with the position inside each pool
	{
		let start = 0;
		const bounds = [];
		for (let i = 1; i < count; i++) if (dropAt[i] > 0) { bounds.push([start, i]); start = i; }
		bounds.push([start, count - 1]);
		for (const [a, b] of bounds) {
			const len = Math.max(b - a, 1);
			for (let i = a; i <= b; i++) {
				const u = (i - a) / len;
				W[i] *= 0.82 + 0.36 * Math.sin(u * Math.PI);
			}
		}
		W = smooth1(W, 2);
	}

	const depth = W.map((w, i) => (1 + 0.07 * w) * (1 + 0.5 * smoothstep(0.02, 0.05, grad[i])));
	// pack: x, z, waterY, width, depth, foam
	const data = new Float32Array(count * 6);
	for (let i = 0; i < count; i++) {
		data[i * 6] = P2[i][0]; data[i * 6 + 1] = P2[i][1];
		data[i * 6 + 2] = wl[i]; data[i * 6 + 3] = W[i]; data[i * 6 + 4] = depth[i]; data[i * 6 + 5] = foam[i];
	}
	river.data = data;
	river.count = count;
	river.maxWidth = Math.max(...W);
	river.drops = Array.from(dropAt);
	river.falls = falls.map(({ i, drop }) => {
		const a = P2[Math.max(0, i - 4)], b = P2[Math.min(count - 1, i + 1)];
		const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
		return { i, x: P2[i][0], z: P2[i][1], top: wl[Math.max(0, i - 1)], bottom: wl[i], drop, w: W[i], dx: (b[0] - a[0]) / len, dz: (b[1] - a[1]) / len };
	});
	river.levelAtCell = (k) => {
		const [x, z] = toWorld(k);
		let best = 0, bd = Infinity;
		for (let i = 0; i < count; i++) { const d = Math.hypot(data[i * 6] - x, data[i * 6 + 1] - z); if (d < bd) { bd = d; best = i; } }
		return data[best * 6 + 2];
	};
}

// ---------- 6. spawn ----------
function chooseSpawn(rivers, h, lakeLevel, N, cell, size, rnd) {
	const gx = (x) => (x + size / 2) / cell, gz = (z) => (z + size / 2) / cell;
	const H = (x, z) => bilinear(h, N, gx(x), gz(z));
	const dry = (x, z) => H(x, z) > 2.5 && lakeLevel[Math.round(gz(z)) * N + Math.round(gx(x))] === NO_WATER;
	const landFrac = (x, z, r) => { let n = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; if (dry(x + Math.cos(a) * r, z + Math.sin(a) * r)) n++; } return n / 16; };
	const gentle = (x, z) => Math.abs(H(x + 10, z) - H(x - 10, z)) / 20 < 0.25 && Math.abs(H(x, z + 10) - H(x, z - 10)) / 20 < 0.25;

	const seaRivers = rivers.filter((r) => r.mouthType === 'sea').sort((a, b) => b.data[(b.count - 1) * 6 + 3] - a.data[(a.count - 1) * 6 + 3]);
	for (const r of seaRivers.slice(0, 5)) {
		const d = r.data;
		for (let i = r.count - 1 - Math.round(300 / 8); i > 30; i -= 8) {
			const x = d[i * 6], z = d[i * 6 + 1], w = d[i * 6 + 3];
			const ax = d[(i - 8) * 6] - d[(i + 8) * 6], az = d[(i - 8) * 6 + 1] - d[(i + 8) * 6 + 1];
			const len = Math.hypot(ax, az) || 1;
			const nx = -az / len, nz = ax / len;
			for (const side of [1, -1]) {
				for (const off of [w / 2 + 40, w / 2 + 70]) {
					const sx = x + nx * off * side, sz = z + nz * off * side;
					const hh = H(sx, sz);
					if (hh < 3 || hh > 40 || !gentle(sx, sz) || landFrac(sx, sz, 180) < 0.85 || landFrac(sx, sz, 60) < 0.99) continue;
					// face upstream, toward the mountains
					const ux = d[Math.max(0, i - 60) * 6] - sx, uz = d[Math.max(0, i - 60) * 6 + 1] - sz;
					return { x: sx, z: sz, yaw: Math.atan2(-ux, -uz), river: r.id };
				}
			}
		}
	}
	// fallback: any low gentle land cell near the sea
	for (let tries = 0; tries < 4000; tries++) {
		const x = rnd.range(-0.4, 0.4) * size, z = rnd.range(-0.4, 0.4) * size;
		const hh = H(x, z);
		if (hh < 4 || hh > 30 || !gentle(x, z) || landFrac(x, z, 180) < 0.85) continue;
		return { x, z, yaw: rnd.range(0, TAU), river: -1 };
	}
	return { x: 0, z: 0, yaw: 0, river: -1 };
}

// ---------- main ----------
export function generateWorld(seed, progress = null, opts = {}) {
	const size = opts.size || WORLD_SIZE;
	const N1 = opts.res || WORLD_RES;
	const N0 = N1 >> 1;
	const rnd = new Random(seed + ':world');
	const noise = {
		continent: new Simplex2D(new Random(seed + ':continent')),
		warp: new Simplex2D(new Random(seed + ':warp')),
		hills: new Simplex2D(new Random(seed + ':hills')),
		rock: new Simplex2D(new Random(seed + ':rock')),
		mountain: new Simplex2D(new Random(seed + ':mountain')),
		plateau: new Simplex2D(new Random(seed + ':plateau')),
		detail: new Simplex2D(new Random(seed + ':detail')),
		meander: new Simplex2D(new Random(seed + ':meander')),
	};
	const t0 = performance.now();
	const timings = {};
	const mark = (name) => { timings[name] = Math.round(performance.now() - t0); };

	if (progress) progress('shaping the land', 0);
	const spines = makeSpines(rnd, size);
	const coarse = baseTerrain(rnd, N0, size, noise, spines);
	mark('base');
	const P = Object.assign({ coarseIterations: 170, coarseK: 0.007, coarseUplift: 1.2, fineIterations: 64, fineK: 0.0034, fineUplift: 0.7, riverAreaKm2: 0.55 }, opts);
	erode(coarse, N0, { iterations: P.coarseIterations, K: P.coarseK, m: 0.5, upliftRate: P.coarseUplift, diffusion: 0.09, floodEvery: 10 }, rnd, progress, 'raising mountains');
	mark('erodeCoarse');
	const fine = upsample(coarse, N0, N1, size, noise);
	mark('upsample');
	const ev = erode(fine, N1, { iterations: P.fineIterations, K: P.fineK, m: 0.5, upliftRate: P.fineUplift, diffusion: 0.07, floodEvery: 13 }, rnd, progress, 'carving valleys');
	mark('erodeFine');

	if (progress) progress('cutting the coast', 0);
	shapeCoast(fine, N1);
	const cirques = carveCirques(fine, N1, ev.area, rnd, size);
	mark('coast');

	// exact fill for lake levels, then a routing fill for rivers
	const N = N1, M = N * N, cell = fine.cell, h = fine.h;
	const hfExact = new Float32Array(M);
	priorityFlood(h, hfExact, N, 0);
	const { lakes, lakeId, lakeLevel } = findLakes(h, hfExact, N, cell);
	deepenLakes(h, lakes, lakeId, N);
	mark('lakes');

	if (progress) progress('letting the rivers run', 0);
	const hf = new Float32Array(M);
	priorityFlood(h, hf, N, 1e-3);
	const recv = new Int32Array(M), stack = new Int32Array(M), area = new Float32Array(M);
	computeReceivers(hf, recv, N);
	buildStack(recv, stack, N, ev.work);
	accumulateArea(recv, stack, area, M);
	const threshold = P.riverAreaKm2 * 1e6 / (cell * cell);
	const rivers = traceRivers(h, hf, recv, area, lakeId, N, cell, threshold, ev.work);
	// parents for tributaries
	const cellRiver = new Int32Array(M).fill(-1);
	for (const r of rivers) for (const c of r.cells) cellRiver[c] = r.id;
	for (const r of rivers) r.parentId = r.mouthType === 'river' ? cellRiver[r.junction] : -1;
	gradeRivers(rivers, h, area, N, cell, size, lakes, lakeId, rnd, P);
	for (const r of rivers) buildRiverGeometry(r, h, area, N, cell, size, lakes, lakeId, rivers, rnd, noise);
	mark('rivers');

	const spawn = chooseSpawn(rivers, h, lakeLevel, N, cell, size, rnd);
	mark('spawn');

	// the world origin moves to the spawn: rivers become spawn-relative here, grids via the heightmap offset
	for (const r of rivers) { for (let i = 0; i < r.count; i++) { r.data[i * 6] -= spawn.x; r.data[i * 6 + 1] -= spawn.z; } for (const f of r.falls) { f.x -= spawn.x; f.z -= spawn.z; } }

	// rock hardness as bytes for shading and boulder placement
	const rock = new Uint8Array(M);
	for (let k = 0; k < M; k++) rock[k] = Math.round(clamp(fine.hard[k], 0, 1) * 255);

	// slope-limited peak stats for tuning
	let maxH = -Infinity, land = 0;
	for (let k = 0; k < M; k++) { if (h[k] > maxH) maxH = h[k]; if (h[k] > 0) land++; }

	return {
		size, res: N, cell,
		height: h,
		lakeLevel,
		lakeId,
		rock,
		area,
		lakes: lakes.map((l) => ({ id: l.id, level: l.level, cells: l.cells, area: l.area, maxDepth: l.maxDepth })),
		rivers: rivers.map((r) => ({ id: r.id, data: r.data, count: r.count, maxWidth: r.maxWidth, mouthType: r.mouthType, parentId: r.parentId, drops: Float32Array.from(r.drops), falls: r.falls })),
		spawn,
		stats: { maxH, landFraction: land / M, lakes: lakes.length, rivers: rivers.length, cirques, timings, total: Math.round(performance.now() - t0) },
	};
}
