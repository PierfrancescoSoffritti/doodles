// River shaping: turns the drainage chains traced on the eroded grid into rivers with a water
// surface, a channel, banks, falls, steps and rocks, and cuts their valleys into the terrain.
// Pure JS (no three/DOM) so it runs in the worker and in node for tuning.
//
// Principles
//   - the water follows the land: its grade is the land's grade, capped only for big rivers, so
//     lowland streams sit half a metre below their meadows and can be walked into
//   - a gorge is cut only where the land is steeper than the river can be, and never deeper
//     than the local relief allows; past that the river runs as a chute on the canyon floor
//   - waterfalls happen only where the land itself has a cliff (steeper than FALL_GRADE);
//     nothing is ever stamped into a smooth slope to make one
//   - in moderately steep reaches the water pools and steps (step-pool cascades); in steep
//     reaches it slides as white water; in gentle reaches it simply slopes
//   - a river bends because something hard is in the way: the path is pushed away from hard
//     rock and outcrops, and the outcrop that turned it is left standing on the outer bank
//   - rocks in and beside the channel are world data, shared by the terrain, the water shader
//     (wakes) and the vegetation (boulders)

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export const RIVER_STRIDE = 10;
// per-sample fields
export const RV = { X: 0, Z: 1, WL: 2, W: 3, D: 4, FOAM: 5, BANK: 6, SPEED: 7, ALONG: 8, KIND: 9 };
// FLOW: ordinary sample. STEP_TOP/STEP_BOTTOM: the two ends of a short steep riffle ramp.
// LIP: the ribbon ends here (a waterfall follows). POOL: the first sample after a fall's foot.
export const RIVER_KIND = { FLOW: 0, STEP_TOP: 1, STEP_BOTTOM: 2, LIP: 3, POOL: 4 };
export const ROCK_STRIDE = 5;      // x, z, y (NaN: rest on the ground), radius, kind
export const ROCK_KIND = { LIP: 0, CHUTE: 1, OUTCROP: 2, POOL: 3, BAR: 4 };
export const WAKE_STRIDE = 3;      // along, across (m, +right), radius: rocks that break the surface
export const SAMPLE_SPACING = 8;

export const FALL_MIN = 3;         // a drop this tall is a waterfall with its own mesh
export const FALL_MAX = 48;        // taller cliffs become two falls
const FALL_GRADE = 0.42;           // land steeper than this along the channel is a cliff
const CHUTE_GRADE = 0.1;           // water steeper than this slides as white water
const RIFFLE_GRADE = 0.025;        // between this and CHUTE_GRADE the water pools and steps

// ---------- cross-section shared with the runtime heightmap ----------
// depth of the bed below the water surface as a fraction of the channel depth, u = |across| / half width;
// the bed is still EDGE_DEPTH of the way down at the channel edge so a coarse mesh cannot poke through
export const EDGE_DEPTH = 0.4;
export const bedProfile = (u) => EDGE_DEPTH + (1 - EDGE_DEPTH) * Math.sqrt(Math.max(0, 1 - u * u));
// horizontal width of the bank rising from the channel edge to the valley floor
export const bankWidth = (bank, depth, w) => clamp((bank + EDGE_DEPTH * depth) / 0.3, 4, 0.7 * w + 12);
// fraction of the bank width at which the bank stands `lift` metres above the water
export function waterEdge(bank, depth, lift = 0) {
	const s = clamp((lift + EDGE_DEPTH * depth) / (bank + EDGE_DEPTH * depth), 0, 1);
	let lo = 0, hi = 1;
	for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (m * m * (3 - 2 * m) < s) lo = m; else hi = m; }
	return hi;
}
// half width of the water surface: it runs a little way under the bank, to where the ground stands
// clear of it, so the coarse terrain mesh never leaves a dry crack or an exposed edge
export const surfaceHalfWidth = (w, depth, bank) => w * 0.5 + bankWidth(bank, depth, w) * waterEdge(bank, depth, 0.15);
// the fall face: horizontal run for a given drop (steep, but not a plane the mesh can't show)
export const fallFaceRun = (drop) => Math.max(1.5, drop * 0.16);

// ---------- helpers ----------
function bilinear(grid, N, fx, fz) {
	const x = clamp(fx, 0, N - 1.001), z = clamp(fz, 0, N - 1.001);
	const i = x | 0, j = z | 0, tx = x - i, tz = z - j;
	const k = j * N + i;
	return (grid[k] * (1 - tx) + grid[k + 1] * tx) * (1 - tz) + (grid[k + N] * (1 - tx) + grid[k + N + 1] * tx) * tz;
}
const smoothArr = (arr, win) => arr.map((v, i) => { let s = 0, c = 0; for (let o = -win; o <= win; o++) { s += arr[clamp(i + o, 0, arr.length - 1)]; c++; } return s / c; });
const smoothPts = (arr, win) => arr.map((p, i) => { let sx = 0, sz = 0, n = 0; for (let o = -win; o <= win; o++) { const q = arr[clamp(i + o, 0, arr.length - 1)]; sx += q[0]; sz += q[1]; n++; } return [sx / n, sz / n]; });

// arc-length resampling of a polyline with per-vertex scalars carried along
function resample(pts, scalars, spacing) {
	const cum = [0];
	for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
	const total = cum[cum.length - 1];
	const n = Math.max(4, Math.round(total / spacing));
	const P = [], out = scalars.map(() => []);
	let seg = 0;
	for (let i = 0; i <= n; i++) {
		const s = (i / n) * total;
		while (seg < cum.length - 2 && cum[seg + 1] < s) seg++;
		const t = (s - cum[seg]) / Math.max(cum[seg + 1] - cum[seg], 1e-6);
		P.push([lerp(pts[seg][0], pts[seg + 1][0], t), lerp(pts[seg][1], pts[seg + 1][1], t)]);
		scalars.forEach((arr, q) => out[q].push(lerp(arr[seg], arr[seg + 1], t)));
	}
	return { P, scalars: out, spacing: total / n };
}

const tangentAt = (P, i) => {
	const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
	const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
	return [dx / l, dz / l];
};

const baseWidth = (aM2) => clamp(4 + Math.sqrt(aM2) * 0.0075, 6, 110);
const maxGrade = (aKm2) => clamp(0.09 * Math.pow(Math.max(aKm2, 0.05), -0.5), 0.004, 0.15);

// ---------- entry ----------
export function shapeRivers(rivers, world, rnd, noise) {
	const { N, lakes, lakeId } = world;
	const M = N * N;
	// a lake's rim may be cut down to the lake level, never below it: an outlet is a notch, not a breach
	const nearLake = new Uint8Array(M), rimFloor = new Float32Array(M).fill(-1e4);
	const DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1];
	for (let k = 0; k < M; k++) {
		if (lakeId[k] < 0) continue;
		const i = k % N, j = (k / N) | 0, lvl = lakes[lakeId[k]].level;
		for (let d = 0; d < 8; d++) {
			const ni = i + DX[d], nj = j + DZ[d];
			if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
			const kk = nj * N + ni;
			nearLake[kk] = 1;
			if (lvl > rimFloor[kk]) rimFloor[kk] = lvl;
		}
	}
	const ctx = Object.assign({ rnd, noise, carved: new Uint8Array(M), nearLake, rimFloor }, world);
	// parents come before their tributaries in id order, so a tributary always finds its parent shaped
	for (const r of rivers) { if (ctx.riverLimit !== undefined && r.id >= ctx.riverLimit) { r.data = new Float32Array(0); r.count = 0; r.rocks = new Float32Array(0); r.wakes = new Float32Array(0); r.falls = []; r.maxWidth = 0; r.stats = {}; continue; } shapeRiver(r, rivers, ctx); }
	if (!ctx.noSoften) softenCreases(ctx);
}

// ---------- one river ----------
function shapeRiver(river, rivers, ctx) {
	const { h, N, cell, size, lakes, lakeId, hard, area, rnd, noise } = ctx;
	const SP = SAMPLE_SPACING;
	const toWorld = (k) => [-size / 2 + (k % N) * cell, -size / 2 + ((k / N) | 0) * cell];
	const gx = (x) => (x + size / 2) / cell, gz = (z) => (z + size / 2) / cell;
	const groundAt = (x, z) => bilinear(h, N, gx(x), gz(z));
	const hardAt = (x, z) => bilinear(hard, N, gx(x), gz(z));
	const inLake = (x, z) => { const i = Math.round(gx(x)), j = Math.round(gz(z)); return i < 0 || j < 0 || i >= N || j >= N || lakeId[j * N + i] >= 0; };
	const seed = rnd.range(0, 1000);
	const parent = river.mouthType === 'river' ? rivers[river.parentId] : null;

	// ---- 1. centreline ----
	const cells = river.cells.slice();
	if (river.junction >= 0) cells.push(river.junction);
	let pts = cells.map(toWorld);
	pts = smoothPts(pts, 2);
	pts[0] = toWorld(cells[0]);
	if (parent) {
		// meet the parent on its own centreline, not at the grid cell it happened to flow through
		const near = parent.nearest(pts[pts.length - 1][0], pts[pts.length - 1][1]);
		pts[pts.length - 1] = [near.x, near.z];
		for (let q = 2; q < 6 && pts.length - 1 - q > 0; q++) {
			const p = pts[pts.length - 1 - q], f = (6 - q) / 6 * 0.5;
			pts[pts.length - 1 - q] = [lerp(p[0], near.x, f * (1 - q / 6)), lerp(p[1], near.z, f * (1 - q / 6))];
		}
	}
	const chainT = [];
	for (let i = 0; i < cells.length; i++) chainT.push(i ? Math.min(chainT[i - 1], h[cells[i]]) : h[cells[i]]);
	const rs = resample(pts, [cells.map((k) => area[k] * cell * cell), chainT], SP);
	let P = rs.P;
	const A = rs.scalars[0], Tc = rs.scalars[1];
	const n = P.length;
	const W0 = A.map(baseWidth);

	// ---- relief: how mountainous the land around each sample is ----
	const gradeWide = Tc.map((v, i) => { const a = Tc[clamp(i - 25, 0, n - 1)], b = Tc[clamp(i + 25, 0, n - 1)]; return Math.max(0, (a - b) / ((Math.min(i, 25) + Math.min(n - 1 - i, 25)) * SP || 1)); });
	let relief = Tc.map((t, i) => Math.max(smoothstep(0.045, 0.2, gradeWide[i]), 0.7 * smoothstep(150, 520, t)));
	relief = smoothArr(relief, 10);

	// ---- 2. bends: pushed off hard rock and outcrops ----
	const push = new Float64Array(n);
	const nO = noise.outcrop;
	const outcropAt = (x, z) => smoothstep(0.42, 0.78, nO.noise(x / 75 + seed, z / 75 - seed));
	for (let i = 0; i < n; i++) {
		const [tx, tz] = tangentAt(P, i);
		const nx = -tz, nz = tx;
		const pd = W0[i] * 0.5 + 10;
		const hl = hardAt(P[i][0] - nx * pd, P[i][1] - nz * pd), hr = hardAt(P[i][0] + nx * pd, P[i][1] + nz * pd);
		const ol = outcropAt(P[i][0] - nx * pd * 1.3, P[i][1] - nz * pd * 1.3), orr = outcropAt(P[i][0] + nx * pd * 1.3, P[i][1] + nz * pd * 1.3);
		// positive: pushed to the right (+n)
		push[i] = (clamp((hl - hr) * 12, -0.5, 0.5) + (ol - orr)) * (1 - relief[i] * 0.85);
	}
	let pushS = smoothArr(smoothArr(Array.from(push), 10), 10);
	const bendSide = new Int8Array(n), bendStrength = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		// a river on a hillside cannot wander sideways without perching itself above the valley
		const amp = Math.min(W0[i] * 1.5, 36) * (1 - smoothstep(0.025, 0.07, gradeWide[i]));
		const endFade = Math.min(1, i / 14, (n - 1 - i) / 14);
		let off = clamp(pushS[i] * amp * 1.6, -amp, amp) * endFade;
		const [tx, tz] = tangentAt(P, i);
		const nx = -tz, nz = tx;
		// never into a lake or off the map
		for (let tries = 0; tries < 4 && Math.abs(off) > 1 && inLake(P[i][0] + nx * off, P[i][1] + nz * off); tries++) off *= 0.5;
		P[i] = [P[i][0] + nx * off, P[i][1] + nz * off];
		bendSide[i] = off > 0 ? -1 : 1;      // the obstacle sits on the side the river was pushed away from
		bendStrength[i] = Math.abs(off) / amp;
	}
	P = smoothPts(P, 2);
	P[0] = rs.P[0]; P[n - 1] = rs.P[n - 1];

	// ---- 3. water profile ----
	const T = P.map(([x, z]) => groundAt(x, z));
	// the ground across the whole corridor too: the water can be no higher than the lowest bank
	const Tside = P.map(([x, z], i) => {
		const [tx, tz] = tangentAt(P, i);
		let lowest = Infinity;
		for (const pd of [W0[i] * 0.5 + 3, W0[i] * 0.5 + 9]) lowest = Math.min(lowest, groundAt(x - tz * pd, z + tx * pd), groundAt(x + tz * pd, z - tx * pd));
		return lowest + 0.3;
	});
	const Tmin = T.map((t, i) => Math.min(t, Tc[i], Tside[i]));
	const Tmono = new Float64Array(n);
	for (let i = 0; i < n; i++) Tmono[i] = i ? Math.min(Tmono[i - 1], Tc[i]) : Tc[i];
	const tgSmooth = new Float64Array(n);
	for (let i = 0; i < n; i++) { const a = Tmono[clamp(i - 3, 0, n - 1)], b = Tmono[clamp(i + 3, 0, n - 1)]; tgSmooth[i] = Math.max(0, (a - b) / ((Math.min(i, 3) + Math.min(n - 1 - i, 3)) * SP || 1)); }
	const bankBase = relief.map((r, i) => lerp(0.45, 2.4, r) + 0.012 * W0[i]);
	const cap = relief.map((r) => lerp(3, 40, r));
	const kCut = relief.map((r) => 1 - 0.45 * r);

	let mouth;
	if (river.mouthType === 'sea') mouth = 0;
	else if (river.mouthType === 'lake') mouth = lakes[lakeId[river.junction]].level;
	else if (parent) mouth = parent.nearest(P[n - 1][0], P[n - 1][1]).wl;
	else mouth = Tmin[n - 1] - bankBase[n - 1];
	const wl = new Float64Array(n), cliff = new Uint8Array(n);
	wl[n - 1] = mouth;
	for (let i = n - 2; i >= 0; i--) {
		const seg = SP;
		const tg = Math.max(0, (Tmono[i] - Tmono[i + 1]) / seg);
		const ceiling = Tmin[i] - bankBase[i];
		if (tg > FALL_GRADE) {
			// a cliff: the water takes the whole drop of the land here
			cliff[i] = 1;
			wl[i] = Math.min(ceiling, wl[i + 1] + (Tmono[i] - Tmono[i + 1]));
		} else {
			const gorge = Tmin[i + 1] - bankBase[i + 1] - wl[i + 1];
			let allow = Math.max(maxGrade(A[i] / 1e6), tgSmooth[i] * kCut[i]);
			if (gorge > cap[i]) allow = Math.max(allow, tgSmooth[i]);       // canyon floor: stop deepening
			wl[i] = Math.min(ceiling, wl[i + 1] + allow * seg);
		}
		if (wl[i] < mouth) wl[i] = mouth;          // never below the water it flows into
	}
	if (river.fromLake >= 0) {
		const level = lakes[river.fromLake].level;
		wl[0] = level;
		for (let i = 1; i < n; i++) if (wl[i] > level) wl[i] = level;
	}
	for (let i = 1; i < n; i++) if (wl[i] > wl[i - 1]) wl[i] = wl[i - 1];
	// the surface stays clear of the water it flows into until the very end, where it slips under
	// it, so the two surfaces never fight for the same pixels
	{
		const clear = river.mouthType === 'river' ? 0.06 : 0.3;
		// (unless the land itself lies below the receiving water, as happens on the odd lake rim)
		for (let i = 0; i < n - 1; i++) if (wl[i] < mouth + clear && Tmin[i] - bankBase[i] >= mouth) wl[i] = mouth + clear;
		wl[n - 1] = mouth - (river.mouthType === 'river' ? 0.3 : 0.6);
	}

	// ---- 4. reach types, falls, steps ----
	const grade = new Float64Array(n);
	for (let i = 0; i < n - 1; i++) grade[i] = (wl[i] - wl[i + 1]) / SP;
	grade[n - 1] = grade[Math.max(0, n - 2)];
	// falls: runs of cliff segments
	const falls = [];      // { a: top sample, b: bottom sample }
	for (let i = 0; i < n - 1;) {
		if (!cliff[i]) { i++; continue; }
		let j = i;
		while (j < n - 1 && cliff[j]) j++;
		// run i..j (samples), drop wl[i] - wl[j]; split runs taller than FALL_MAX
		let a = i;
		while (a < j) {
			let b = a + 1;
			while (b < j && wl[a] - wl[b + 1] <= FALL_MAX) b++;
			if (wl[a] - wl[b] >= FALL_MIN) falls.push({ a, b });
			a = b;
		}
		i = j;
	}
	const inFall = new Uint8Array(n);
	for (const f of falls) for (let q = f.a; q <= f.b; q++) inFall[q] = q === f.a ? 2 : (q === f.b ? 3 : 1);

	// pools: walking upstream, the water lies at the level of the next step downstream
	const pooled = new Float64Array(n), stepH = new Float32Array(n);
	pooled[n - 1] = wl[n - 1];
	let poolLevel = wl[n - 1], jitter = rnd.range(0.75, 1.25);
	for (let i = n - 2; i >= 0; i--) {
		const g = grade[i];
		if (inFall[i] || inFall[i + 1] === 2 || g < RIFFLE_GRADE || g > CHUTE_GRADE) {
			// falls, chutes and gentle flow: the surface follows the profile; close any pool below
			if (!inFall[i] && wl[i] - poolLevel >= 0.35 && poolLevel < wl[i + 1] + 1e-6 && i < n - 2 && grade[i + 1] >= RIFFLE_GRADE && grade[i + 1] <= CHUTE_GRADE) stepH[i] = wl[i] - poolLevel;
			poolLevel = wl[i];
			pooled[i] = wl[i];
			continue;
		}
		// wide rivers do not step: their rapids are sloped white water
		if (W0[i] > 24) { poolLevel = wl[i]; pooled[i] = wl[i]; continue; }
		const target = clamp(g * Math.max(4 * W0[i], 24), 0.3, 1.2) * jitter;
		if (wl[i] - poolLevel >= target) {
			stepH[i] = wl[i] - poolLevel;
			poolLevel = wl[i];
			jitter = rnd.range(0.75, 1.25);
		}
		pooled[i] = poolLevel;
	}
	// a lake outlet drops over its lip: whatever the height, the first sample is the lake level
	if (river.fromLake >= 0 && pooled[0] < wl[0]) { stepH[0] = wl[0] - pooled[0]; pooled[0] = wl[0]; }

	// ---- 5. width, depth, speed ----
	const nM = noise.meander;
	const W = new Float64Array(n), D = new Float64Array(n), reachType = new Uint8Array(n);   // 0 flow, 1 riffle, 2 chute, 3 fall
	for (let i = 0; i < n; i++) {
		const g = grade[Math.min(i, n - 2)];
		reachType[i] = inFall[i] ? 3 : (g > CHUTE_GRADE ? 2 : (g >= RIFFLE_GRADE ? 1 : 0));
	}
	// pool position for breathing widths: 0 at a step, 1 at the next step downstream
	const poolU = new Float32Array(n);
	{
		let start = 0;
		for (let i = 1; i <= n; i++) {
			if (i === n || stepH[i] > 0 || inFall[i]) { const len = Math.max(i - start, 1); for (let q = start; q < i; q++) poolU[q] = (q - start) / len; start = i; }
		}
	}
	for (let i = 0; i < n; i++) {
		const type = reachType[i];
		let w = W0[i] * (type === 2 ? 0.62 : type === 1 ? 0.9 : 1.0) * (1 - 0.25 * relief[i]);
		w *= 1 + 0.32 * nM.noise(rs.spacing * i / (W0[i] * 22) + seed, seed * 0.7);
		if (type <= 1) w *= 0.86 + 0.3 * Math.sin(poolU[i] * Math.PI);
		if (river.mouthType === 'sea') w *= 1 + 0.45 * smoothstep(40, 0, n - 1 - i);
		W[i] = w;
		D[i] = (0.7 + 0.08 * w) * (type === 2 ? 0.6 : type === 1 ? 1.0 : 1.2) * (1 + 0.35 * Math.sin(poolU[i] * Math.PI));
	}
	const Ws = smoothArr(Array.from(W), 4), Ds = smoothArr(Array.from(D), 4);

	// ---- 6. emit samples (steps and falls become explicit geometry) ----
	const out = [];       // { x, z, wl, w, d, foam, bank, speed, along, kind, floor, fw, sl, i }
	const KIND = RIVER_KIND;
	const fallRecs = [];
	const emit = (i, x, z, level, kind, extra = {}) => {
		const rec = { x, z, wl: level, w: Ws[i], d: Ds[i], foam: 0, bank: Math.max(0.25, wl[i] + bankBase[i] - level), speed: 0, kind, i, floor: wl[i] + bankBase[i], relief: relief[i], grade: grade[Math.min(i, n - 2)], ...extra };
		out.push(rec);
		return rec;
	};
	for (let i = 0; i < n; i++) {
		if (inFall[i] === 1) continue;                       // inside a cliff run: the fall covers it
		const [tx, tz] = tangentAt(P, i);
		if (inFall[i] === 2) {
			// the lip; the ribbon resumes at the foot of the face
			const f = falls.find((q) => q.a === i);
			const drop = wl[f.a] - wl[f.b];
			const run = fallFaceRun(drop);
			const lip = emit(i, P[i][0], P[i][1], wl[i], KIND.LIP, { foam: 0.6 });
			const foot = emit(f.b, P[i][0] + tx * (run + 1.5), P[i][1] + tz * (run + 1.5), wl[f.b], KIND.POOL, { foam: 1, floor: wl[f.b] + bankBase[f.b], bank: bankBase[f.b] });
			fallRecs.push({ lipRec: lip, footRec: foot, x: P[i][0], z: P[i][1], dx: tx, dz: tz, top: wl[i], bottom: wl[f.b], drop, w: Ws[i], run, seed: rnd.range(0, 100), bankTop: bankBase[i], bankBot: bankBase[f.b], dTop: Ds[i], dBot: Ds[f.b] });
			continue;
		}
		if (inFall[i] === 3) {
			// the foot sample itself follows the emitted POOL sample when it lies further on
			const last = out[out.length - 1];
			if (Math.hypot(P[i][0] - last.x, P[i][1] - last.z) > 2.5) emit(i, P[i][0], P[i][1], pooled[i], KIND.FLOW, { foam: 1 });
			continue;
		}
		if (stepH[i] > 0 && i < n - 1) {
			const hs = stepH[i];
			if (hs >= FALL_MIN) {
				// a tall step out of a lake or at a reach boundary: treat it as a fall on the spot
				const run = fallFaceRun(hs);
				const lip = emit(i, P[i][0], P[i][1], pooled[i], KIND.LIP, { foam: 0.6 });
				const foot = emit(i, P[i][0] + tx * (run + 1.5), P[i][1] + tz * (run + 1.5), pooled[i] - hs, KIND.POOL, { foam: 1, bank: bankBase[i] + (wl[i] - pooled[i]) + hs });
				fallRecs.push({ lipRec: lip, footRec: foot, x: P[i][0], z: P[i][1], dx: tx, dz: tz, top: pooled[i], bottom: pooled[i] - hs, drop: hs, w: Ws[i], run, seed: rnd.range(0, 100), bankTop: bankBase[i], bankBot: foot.bank, dTop: Ds[i], dBot: Ds[i] });
				continue;
			}
			const ramp = clamp(hs * 0.8, 0.5, 1.8);
			const f = clamp(0.35 + hs * 0.5, 0.4, 1);
			emit(i, P[i][0], P[i][1], pooled[i], KIND.STEP_TOP, { foam: f * 0.7, step: hs });
			emit(i, P[i][0] + tx * ramp, P[i][1] + tz * ramp, pooled[i] - hs, KIND.STEP_BOTTOM, { foam: f, step: hs, bank: bankBase[i] + (wl[i] - pooled[i]) + hs });
			continue;
		}
		const g = grade[Math.min(i, n - 2)];
		emit(i, P[i][0], P[i][1], pooled[i], KIND.FLOW, { foam: reachType[i] === 2 ? 1 : (W0[i] > 24 ? 0.4 * smoothstep(0.03, 0.09, g) : 0) });
	}
	// arc length along the emitted samples
	const m = out.length;
	for (let q = 0; q < m; q++) out[q].along = q ? out[q - 1].along + Math.hypot(out[q].x - out[q - 1].x, out[q].z - out[q - 1].z) : 0;
	// flow speed from the slope of the water surface itself: a pool crawls, a ramp or a chute races
	{
		const slope = new Float64Array(m);
		for (let q = 0; q < m; q++) {
			const a = out[Math.max(0, q - 1)], b = out[Math.min(m - 1, q + 1)];
			slope[q] = Math.max(0, (a.wl - b.wl) / Math.max(b.along - a.along, 1));
		}
		for (let q = 0; q < m; q++) {
			let s = 0, c = 0;
			for (let o = -2; o <= 2; o++) { const k = q + o; if (k >= 0 && k < m) { s += slope[k]; c++; } }
			out[q].speed = clamp(0.3 + (s / c) * 14, 0.3, 3);
		}
	}
	// foam: bright below every drop, fading over a few widths, and a little ahead of it
	for (let q = 1; q < m; q++) {
		const prev = out[q - 1];
		const len = prev.kind === KIND.POOL ? clamp(5 * prev.w, 20, 120) : clamp(1.5 * prev.w, 8, 40);
		const carry = prev.foam - (out[q].along - prev.along) / len;
		if (carry > out[q].foam) out[q].foam = carry;
	}
	for (let q = m - 2; q >= 0; q--) {
		const next = out[q + 1];
		if (next.kind === KIND.STEP_TOP || next.kind === KIND.LIP) { const lead = 0.35 - (next.along - out[q].along) / (1.5 * next.w); if (lead > out[q].foam) out[q].foam = lead; }
	}
	for (let q = 0; q < m; q++) out[q].foam = clamp(out[q].foam, 0, 1);

	// ---- 7. rocks ----
	const rocks = [], wakes = [];
	const addRock = (x, z, y, r, kind) => rocks.push(x, z, y, r, kind);
	for (let q = 0; q < m; q++) {
		const s = out[q];
		const [tx, tz] = q < m - 1 ? [(out[q + 1].x - s.x), (out[q + 1].z - s.z)] : [(s.x - out[q - 1].x), (s.z - out[q - 1].z)];
		const l = Math.hypot(tx, tz) || 1, ux = tx / l, uz = tz / l, nx = -uz, nz = ux;
		const at = (along, acrossFrac) => [s.x + ux * along + nx * acrossFrac * s.w * 0.5, s.z + uz * along + nz * acrossFrac * s.w * 0.5];
		if (s.kind === KIND.STEP_TOP) {
			// the bar of stones the water pours over
			const count = 2 + Math.floor(s.w / 7);
			for (let k = 0; k < count; k++) {
				const fr = rnd.range(-0.9, 0.9);
				const [x, z] = at(rnd.range(-2.5, 0.3), fr);
				const r = rnd.range(0.6, 1.3) + s.w * 0.015 + Math.min(s.step, 2) * 0.3;
				addRock(x, z, s.wl - r * 0.25, r, ROCK_KIND.LIP);
				if (r > 1.05) wakes.push(s.along + rnd.range(-2.5, 0.3), fr * s.w * 0.5, r);
			}
		}
		if (s.kind === KIND.FLOW && reachType[s.i] === 2 && rnd.next() < 4 / Math.max(2 * s.w, 12)) {
			const fr = rnd.range(-0.75, 0.75);
			const [x, z] = at(rnd.range(0, 6), fr);
			const r = rnd.range(0.8, 2.4) + s.w * 0.02;
			addRock(x, z, s.wl - r * 0.35, r, ROCK_KIND.CHUTE);
			wakes.push(s.along + 3, fr * s.w * 0.5, r);
		}
		if (s.kind === KIND.FLOW && reachType[s.i] <= 1 && rnd.next() < 0.035) {
			const fr = rnd.range(-0.5, 0.5);
			const [x, z] = at(rnd.range(0, 6), fr);
			const r = rnd.range(1.1, 2.2) + s.w * 0.015;
			addRock(x, z, s.wl - r * 0.4, r, ROCK_KIND.POOL);
			wakes.push(s.along + 3, fr * s.w * 0.5, r);
		}
		if (s.kind === KIND.POOL) {
			// boulders that came down with the fall, at the sides of the plunge pool
			for (let k = 0; k < 2 + Math.floor(s.w / 12); k++) {
				const side = rnd.next() < 0.5 ? -1 : 1;
				const [x, z] = at(rnd.range(2, 6 + s.w * 0.3), side * rnd.range(0.7, 1.15));
				const r = rnd.range(1.2, 2.8) + s.w * 0.02;
				addRock(x, z, s.wl - r * 0.35, r, ROCK_KIND.POOL);
			}
		}
	}
	// the outcrops that turned the river: on the outer bank of each bend
	for (let i = 8; i < n - 8; i++) {
		if (bendStrength[i] < 0.35) continue;
		let peak = true;
		for (let o = -12; o <= 12 && peak; o++) if (bendStrength[clamp(i + o, 0, n - 1)] > bendStrength[i]) peak = false;
		if (!peak) continue;
		const [tx, tz] = tangentAt(P, i);
		const nx = -tz, nz = tx, side = bendSide[i];
		const count = 2 + Math.round(bendStrength[i] * 3);
		for (let k = 0; k < count; k++) {
			const r = rnd.range(2.2, 4.5) + bendStrength[i] * 3.5 * rnd.next() + W0[i] * 0.03;
			const off = W0[i] * 0.5 + 2 + r * 0.8 + rnd.range(0, 6);
			const along = rnd.range(-W0[i], W0[i]);
			addRock(P[i][0] + nx * off * side + tx * along, P[i][1] + nz * off * side + tz * along, NaN, r, ROCK_KIND.OUTCROP);
		}
		for (let k = 0; k < 3; k++) {
			const r = rnd.range(0.6, 1.4);
			const off = W0[i] * 0.5 + rnd.range(-1, 3);
			const along = rnd.range(-W0[i], W0[i]);
			addRock(P[i][0] + nx * off * side + tx * along, P[i][1] + nz * off * side + tz * along, NaN, r, ROCK_KIND.BAR);
		}
	}

	// ---- 8. carve the valley ----
	stampValley(out, fallRecs, ctx, seed);

	// ---- 9. pack ----
	const data = new Float32Array(m * RIVER_STRIDE);
	for (let q = 0; q < m; q++) {
		const s = out[q], o = q * RIVER_STRIDE;
		data[o + RV.X] = s.x; data[o + RV.Z] = s.z; data[o + RV.WL] = s.wl; data[o + RV.W] = s.w; data[o + RV.D] = s.d;
		data[o + RV.FOAM] = s.foam; data[o + RV.BANK] = s.bank; data[o + RV.SPEED] = s.speed; data[o + RV.ALONG] = s.along; data[o + RV.KIND] = s.kind;
	}
	river.data = data;
	river.count = m;
	river.maxWidth = Math.max(...Ws);
	river.rocks = Float32Array.from(rocks);
	river.wakes = Float32Array.from(wakes);
	river.falls = fallRecs.map((f) => ({ i: out.indexOf(f.lipRec), x: f.x, z: f.z, dx: f.dx, dz: f.dz, top: f.top, bottom: f.bottom, drop: f.drop, w: f.w, run: f.run, seed: f.seed, bankTop: f.bankTop, bankBot: f.bankBot, dTop: f.dTop, dBot: f.dBot }));
	river.nearest = (x, z) => {
		let best = 0, bd = Infinity;
		for (let q = 0; q < m; q++) { const d = (data[q * RIVER_STRIDE] - x) ** 2 + (data[q * RIVER_STRIDE + 1] - z) ** 2; if (d < bd) { bd = d; best = q; } }
		const o = best * RIVER_STRIDE;
		return { i: best, x: data[o], z: data[o + 1], wl: data[o + RV.WL], w: data[o + RV.W] };
	};
	let bendSum = 0, bendMax = 0;
	for (let i = 0; i < n; i++) { bendSum += bendStrength[i]; if (bendStrength[i] > bendMax) bendMax = bendStrength[i]; }
	if (ctx.debug) river.probe = out.map((s) => ({ i: s.i, x: s.x, z: s.z, T: T[s.i], Tc: Tc[s.i], Tside: Tside[s.i], wl: wl[s.i], level: s.wl, bank: s.bank, kind: s.kind }));
	river.stats = { bendMean: bendSum / n, bendMax, outcrops: rocks.filter((v, i) => i % 5 === 4 && v === ROCK_KIND.OUTCROP).length, falls: fallRecs.length, steps: out.filter((s) => s.kind === KIND.STEP_TOP).length, chute: reachType.filter((t) => t === 2).length / n, riffle: reachType.filter((t) => t === 1).length / n, flow: reachType.filter((t) => t === 0).length / n, relief: relief.reduce((a, b) => a + b, 0) / n };
}

// ---------- valley stamp ----------
// Lowers the grid to a valley floor at floor = water + bank: a wide flat floodplain with gentle
// sides in the lowlands, a narrow bench with steep walls in the mountains. Never raises anything.
function stampValley(out, falls, ctx, seed) {
	const { h, N, cell, size, lakeId, nearLake, rimFloor, carved, noise } = ctx;
	const nD = noise.detail;
	const m = out.length;
	const lowerTo = (k, tgt) => {
		if (lakeId[k] >= 0) return;
		const t = nearLake[k] ? Math.max(tgt, rimFloor[k] + 0.2) : tgt;
		if (t < h[k]) { h[k] = t; carved[k] = 1; }
	};
	const KIND = RIVER_KIND;
	// Each sub-step lowers only a thin slab across the flow, so a cell always takes the floor of
	// its own position along the river: a wide floodplain never reaches back up a sloping reach.
	const SUB = 4, HALF_SLAB = SUB * 0.5 + 0.6;
	for (let q = 0; q < m - 1; q++) {
		const a = out[q], b = out[q + 1];
		const len = Math.hypot(b.x - a.x, b.z - a.z);
		if (len < 1e-3) continue;
		const tx = (b.x - a.x) / len, tz = (b.z - a.z) / len;
		const steps = Math.max(1, Math.round(len / SUB));
		for (let st = 0; st < steps; st++) {
			const t = st / steps;
			const x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
			const r = lerp(a.relief, b.relief, t), w = lerp(a.w, b.w, t), g = lerp(a.grade, b.grade, t);
			let floor = a.kind === KIND.LIP ? (t > 0.02 ? b.floor : a.floor) : lerp(a.floor, b.floor, t);
			const nearFall = a.kind === KIND.LIP || a.kind === KIND.POOL || b.kind === KIND.LIP;
			// a flat floodplain where the river is gentle and the land low, a bench in the hills, a slot in the mountains
			let fw = w * 0.5 + lerp(1.4 * w + 6, 0.3 * w + 3, r) * (1 - 0.7 * smoothstep(0.01, 0.05, g));
			let sl = lerp(0.16, 0.8, r) * (0.7 + 0.6 * (0.5 + 0.5 * nD.noise(a.along / 300 + seed, seed)));
			if (nearFall) { fw = Math.max(fw, w * 0.5 + 14); sl = Math.max(sl, 0.9); }
			const gi = (x + size / 2) / cell, gj = (z + size / 2) / cell;
			const ci = Math.round(gi), cj = Math.round(gj);
			const here = ci >= 0 && cj >= 0 && ci < N && cj < N ? h[cj * N + ci] : floor;
			const cut = here - floor;
			if (cut < 0.2 && !nearFall) continue;
			const radius = Math.min(Math.max(cut, 0) / sl + fw + 4, 260);
			const rc = Math.ceil(radius / cell);
			for (let dj = -rc; dj <= rc; dj++) {
				const j = cj + dj;
				if (j < 1 || j >= N - 1) continue;
				for (let di = -rc; di <= rc; di++) {
					const i = ci + di;
					if (i < 1 || i >= N - 1) continue;
					const px = -size / 2 + i * cell, pz = -size / 2 + j * cell;
					const ox = px - x, oz = pz - z;
					if (Math.abs(ox * tx + oz * tz) > HALF_SLAB) continue;
					let dist = Math.abs(ox * -tz + oz * tx);
					if (dist > radius) continue;
					// the crease where the wall meets the floor wanders instead of running straight
					dist += nD.noise(px / 45 + seed, pz / 45) * 3;
					const target = floor + Math.max(0, dist - fw) * sl;
					lowerTo(j * N + i, target);
				}
			}
		}
	}
}

// soften the creases where the valley walls meet the old ground (and the bicubic ringing they cause)
function softenCreases(ctx) {
	const { h, N, lakeId, nearLake, rimFloor, carved } = ctx;
	const src = Float32Array.from(h);
	for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
		const k = j * N + i;
		if (!carved[k] && !carved[k - 1] && !carved[k + 1] && !carved[k - N] && !carved[k + N]) continue;
		if (lakeId[k] >= 0) continue;
		const sm = src[k] * 0.5 + (src[k - 1] + src[k + 1] + src[k - N] + src[k + N]) * 0.125;
		h[k] = nearLake[k] ? Math.max(sm, rimFloor[k] + 0.2) : sm;
	}
}
