import { baseWidth } from './Rivers.js';

// River deltas: where a big river meets a sheltered, shallow, soft coast it builds a lobe of low
// land out into the sea and splits into distributaries across it. Pure JS, run inside
// shapeRivers before any river is shaped, so the trunk and its branches are shaped over the
// finished lobe like any other river.
//
// Modelled on river-dominated deltas (Wax Lake, Lena, the Mississippi's passes), following the
// measurements in the delta literature:
//   - a channel entering standing water drops a bar at its mouth and splits around it; the two
//     daughters make about 72 degrees between them, and the smaller one turns harder
//   - daughter widths cluster around 1.7 : 1, and widths follow discharge (w ~ sqrt(A)), so the
//     branch takes 22-40 % of the flow and the widths fall with every order of splitting
//   - each channel runs a few of its own widths before it splits again, so the spacing between
//     bifurcations shrinks seaward and the network is self-similar (Lena's fractal dimension ~1.8)
//   - the islands between are teardrops pointed upstream; the whole lobe is a fan whose land
//     either fills in between the channels (arcuate, Lena / Wax Lake) or is confined to levee
//     fingers along them with bays between (bird's foot, Mississippi); one `fill` parameter
//     spans the two
//   - the delta plain is nearly flat, a metre or two above the sea, and a mouth-bar shoal lies
//     under a metre or two of water a channel width or two past every mouth; a delta front
//     slopes down to the shelf beyond
//
// Every channel is a river record of its own (the trunk continues along the main channel, a
// branch is a new record starting on its parent's centreline with `fromRiver` set), so the
// heightmap carve, the water ribbons, the shore map and the vegetation all handle a delta with
// no special cases beyond the branch's first samples slipping under its parent.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (to, from) => { let d = to - from; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

const MIN_MOUTH_WIDTH = 24;      // narrower rivers do not carry the sediment for a delta
const MIN_BRANCH_WIDTH = 13;     // a channel narrower than this does not split again
const MAX_ORDER = 3;             // orders of bifurcation
const RUN_STEP = 12;             // metres between planned path points
const FRONT_SLOPE = 0.045;       // the delta front: metres down per metre out from the shore
const TIP_HEIGHT = 0.85;         // the plain at the edge of the lobe, metres above the sea
const EDGE_DROP = 0.6;           // how far the plain eases down over its last forty metres to the beach

export function planDeltas(rivers, ctx) {
	const { h, N, cell, size, area, hard, lakeId, rnd, noise } = ctx;
	const toWorld = (k) => [-size / 2 + (k % N) * cell, -size / 2 + ((k / N) | 0) * cell];
	const gx = (x) => (x + size / 2) / cell, gz = (z) => (z + size / 2) / cell;
	const hAt = (x, z) => { const i = Math.round(gx(x)), j = Math.round(gz(z)); return i < 0 || j < 0 || i >= N || j >= N ? -100 : h[j * N + i]; };
	const deltas = [];
	const seaRivers = rivers.filter((r) => r.mouthType === 'sea').sort((a, b) => area[b.cells[b.cells.length - 1]] - area[a.cells[a.cells.length - 1]]);
	let first = true;
	const skip = (river, why, extra) => { if (ctx.debug) console.log(`delta: river ${river.id} skipped: ${why}`, extra ?? ''); };
	for (const river of seaRivers) {
		const cells = river.cells;
		// the apex: the last cell standing clear of the sea
		let apexIdx = cells.length - 1;
		while (apexIdx > 0 && h[cells[apexIdx]] <= 0.5) apexIdx--;
		if (apexIdx < 40) { skip(river, 'short'); continue; }
		const apexCell = cells[apexIdx];
		const A0 = area[apexCell] * cell * cell;
		const Wm = baseWidth(A0);
		if (Wm < MIN_MOUTH_WIDTH) { skip(river, 'narrow', Wm.toFixed(0)); continue; }
		// the biggest river always gets its delta; the others usually
		if (!first && rnd.next() > 0.65) { skip(river, 'chance'); continue; }
		if (hard[apexCell] > 0.62) { skip(river, 'rocky', hard[apexCell].toFixed(2)); continue; }   // a rocky coast holds no delta
		const [ax, az] = toWorld(apexCell);
		const [bx, bz] = toWorld(cells[Math.max(0, apexIdx - 14)]);
		const riverHeading = Math.atan2(az - bz, ax - bx);
		// the lobe builds straight out to sea, whichever way the river came down to the coast:
		// its axis is the seaward normal of the coast here, the mean direction of the open water
		let sx = 0, sz = 0;
		for (let k = 0; k < 48; k++) {
			const a = k / 48 * TAU;
			for (const r of [4 * Wm, 8 * Wm, 12 * Wm]) if (hAt(ax + Math.cos(a) * r, az + Math.sin(a) * r) <= 0) { sx += Math.cos(a); sz += Math.sin(a); }
		}
		let heading = Math.hypot(sx, sz) > 1 ? Math.atan2(sz, sx) : riverHeading;
		if (Math.abs(angDiff(heading, riverHeading)) > Math.PI * 0.6) { skip(river, 'coast faces the wrong way'); continue; }
		const landGrade = (h[cells[Math.max(0, apexIdx - 30)]] - h[apexCell]) / (30 * cell);
		if (landGrade > 0.3) { skip(river, 'steep coast', landGrade.toFixed(3)); continue; }
		// the plain can stand no higher than the valley floor that feeds it, or the water would run uphill
		let floor = Infinity;
		for (let i = Math.max(0, apexIdx - 45); i <= apexIdx - 4; i++) floor = Math.min(floor, h[cells[i]]);
		const apexH = Math.min(2.7, floor - 0.25);
		if (apexH < 1.7) { skip(river, 'valley floor too low', floor.toFixed(2)); continue; }
		// real lobes run twelve to twenty mouth widths out (Wax Lake, the Mississippi passes)
		let R = clamp((11 + rnd.range(0, 6)) * Wm, 300, 1600);
		const halfAngle = rnd.range(58, 75) * Math.PI / 180;
		// how far each ray from the apex runs before it meets land the plain cannot bury: a bay-head
		// delta fills its bay, and the lobe and the channels stop short of the far shore
		const NRAY = 48, HIGH = apexH + 1.5;
		const rayLand = new Float64Array(NRAY);
		let open = 0, deepest = 0;
		for (let k = 0; k < NRAY; k++) {
			const a = k / NRAY * TAU;
			let r = 2 * Wm;
			for (; r < R + 260; r += 8) { const v = hAt(ax + Math.cos(a) * r, az + Math.sin(a) * r); if (v > HIGH) break; if (v < deepest && r < R) deepest = v; }
			rayLand[k] = r;      // finite even when nothing was met, so the angular blend below stays finite
			if (Math.abs(angDiff(a, heading)) < halfAngle && rayLand[k] > 0.5 * R) open++;
		}
		const rayLandAt = (a) => { const f = ((a / TAU) % 1 + 1) % 1 * NRAY, i = Math.floor(f), t = f - i; return lerp(rayLand[i % NRAY], rayLand[(i + 1) % NRAY], t); };
		const openFrac = open / Math.round(2 * halfAngle / TAU * NRAY);
		if (openFrac < 0.35 || deepest < -150) { skip(river, 'closed or deep sea', JSON.stringify({ openFrac: +openFrac.toFixed(2), deepest: Math.round(deepest), R: Math.round(R), heading: Math.round(heading * 180 / Math.PI), riverHeading: Math.round(riverHeading * 180 / Math.PI) })); continue; }

		const seed = rnd.range(0, 1000);
		const delta = { river: river.id, x: ax, z: az, heading, R, halfAngle, fill: rnd.range(0.5, 0.9), apexH, seed, paths: [], mouths: 0, branches: 0 };
		// ---- the channel network ----
		const nM = noise.meander;
		const radialOf = (x, z) => Math.atan2(z - az, x - ax);
		const rr = (x, z) => Math.hypot(x - ax, z - az);
		const offAxis = (x, z) => angDiff(radialOf(x, z), heading);
		const landMargin = 1.4 * Wm + 25;     // the lobe keeps this far off the old shore, room for a channel mouth
		const rFan = (theta) => {
			const t = Math.abs(theta) / halfAngle;
			const fan = t < 1 ? Math.pow(Math.cos(t * Math.PI / 2), 0.3) : 0;
			return Math.min(R * delta.fill * Math.max(fan, 0.22) * (1 + 0.1 * nM.noise(theta * 1.3 + seed, seed * 0.3)), rayLandAt(heading + theta) - landMargin);
		};
		// other rivers reaching the sea inside the lobe: a river of any size keeps the lobe short of
		// its mouth; a small stream is carried across the plain to the sea as a channel of its own
		const absorbed = [];
		let tooClose = false;
		for (const o of rivers) {
			if (o === river || o.mouthType !== 'sea') continue;
			let oi = o.cells.length - 1;
			while (oi > 0 && h[o.cells[oi]] <= 0.5) oi--;
			const [ox, oz] = toWorld(o.cells[oi]);
			const d = Math.hypot(ox - ax, oz - az), theta = angDiff(Math.atan2(oz - az, ox - ax), heading);
			if (d > rFan(theta) + 90) continue;
			const Wo = baseWidth(area[o.cells[oi]] * cell * cell);
			if (Wo >= 20 || oi < 6) { R = Math.min(R, d - 120); if (R < 4.5 * Wm) { tooClose = true; break; } }
			else absorbed.push({ river: o, apexIdx: oi, x: ox, z: oz, w: Wo });
		}
		if (tooClose) { skip(river, 'another mouth too close', Math.round(R)); continue; }
		delta.rFan = rFan;
		// distance from a point to the edge of every planned channel
		const clearance = (x, z) => {
			let best = Infinity;
			for (const p of delta.paths) for (const q of p.pts) { const d = Math.hypot(q[0] - x, q[1] - z) - q[2] * 0.5; if (d < best) best = d; }
			return best;
		};
		const deg = Math.PI / 180;

		// ---- one run of channel ----
		// The heading is continuous everywhere. It is a base direction that relaxes only very slowly
		// toward the radial from the apex (distributaries are nearly straight), a bounded sinuosity
		// (a deviation of up to fourteen degrees with a wavelength of about twelve widths, the
		// low-sinuosity end of Leopold and Wolman's range) and, out of a split, a turn that eases in
		// over a few widths plus the sideways slide of the centreline off the bar. Width is a
		// function of arc length. Points carry [x, z, width, underParent, contributing area].
		const run = (x, z, base, w, length, path, opts = {}) => {
			const { turn = null, width = null, under = 0, relax = 0.015, seed2 = 0, catchment = Math.pow((w - 4) / 0.0075, 2) } = opts;
			const pts = [];
			let along = 0, hitLand = false;
			while (along < length) {
				pts.push([x, z, width ? width(along) : w, along < under ? 1 : 0, catchment]);
				if (along > 2 * w && hAt(x, z) > apexH + 1.0) { hitLand = true; break; }
				if (rr(x, z) > 1) {
					base += angDiff(radialOf(x, z), base) * relax;
					const off = angDiff(base, heading);
					if (Math.abs(off) > halfAngle) base -= (off - Math.sign(off) * halfAngle) * 0.3;
				}
				const wander = 0.18 * nM.noise(along / (12 * w) + seed2, seed2 * 0.7 + seed);
				let t = 0;
				if (turn) {
					t = turn.angle * smoothstep(0, turn.len, along);
					if (along < turn.Ls) { const u = along / turn.Ls; t += Math.atan(turn.c * 6 * u * (1 - u) / turn.Ls); }
				}
				const hdg = base + t + wander;
				x += Math.cos(hdg) * RUN_STEP; z += Math.sin(hdg) * RUN_STEP;
				along += RUN_STEP;
			}
			if (!hitLand) pts.push([x, z, width ? width(along) : w, 0, catchment]);
			path.pts.push(...pts);
			return { x, z, base: base + (turn ? turn.angle : 0), hitLand };
		};

		// ---- how a channel splits ----
		// Two daughters usually; at the apex a big river fans into three (Wax Lake). The angles are
		// the small ones the references show between adjacent daughters (25-45 degrees, wider across
		// a three-way apex), the smaller daughter turning harder, and every daughter is checked for
		// room: clear of the other channels, inside the fan, not into old land. Returns the daughters
		// as { q: share of the flow, angle } sorted across the node, or null for no split.
		const planSplit = (x, z, base, w, isApex) => {
			const r0 = rr(x, z);
			const roomFor = (angle, wd) => {
				const px = x + Math.cos(base + angle) * 4 * w, pz = z + Math.sin(base + angle) * 4 * w;
				if (Math.abs(offAxis(px, pz)) > halfAngle - 0.1 || hAt(px, pz) > apexH + 1.0) return false;
				return clearance(px, pz) > 2.2 * wd + 12;
			};
			if (isApex && w >= 34 && rnd.next() < 0.7) {
				const qm = rnd.range(0.32, 0.42), qa = (1 - qm) * rnd.range(0.4, 0.6), qb = 1 - qm - qa;
				const spread = rnd.range(52, 76) * deg, skew = rnd.range(-0.15, 0.15);
				const ds = [{ q: qa, angle: -spread * (0.5 - skew) }, { q: qm, angle: rnd.range(-6, 6) * deg }, { q: qb, angle: spread * (0.5 + skew) }];
				if (ds.every((d) => roomFor(d.angle, baseWidth(0) + (w - 4) * Math.sqrt(d.q)))) return ds;
			}
			const qb = rnd.range(0.24, 0.42);
			const total = rnd.range(26, 44) * deg;
			const thB = total * (0.55 + 0.45 * (1 - 2 * qb)), thM = total - thB;
			const wB = 4 + (w - 4) * Math.sqrt(qb), wM = 4 + (w - 4) * Math.sqrt(1 - qb);
			const sides = r0 < 1 && rnd.next() < 0.5 ? [-1, 1] : [1, -1];
			// the branch goes to the side with room; the main channel bends slightly the other way
			for (const s of sides) if (roomFor(s * thB, wB) && roomFor(-s * thM, wM)) {
				const ds = [{ q: 1 - qb, angle: -s * thM }, { q: qb, angle: s * thB }];
				return ds.sort((a, b) => a.angle - b.angle);
			}
			return null;
		};

		// ---- a channel from a node ----
		// It splits while it has the width and the room, else runs to the sea. At a split the parent
		// widens over its last two and a half widths (the jet slows over the mouth bar and drops its
		// load, Edmonds & Slingerland 2007), every daughter starts at the node with that full width,
		// narrows to its own over the bar zone while its centreline slides outward, so the inner
		// banks part where the bar tip stands, then turns away with a heading that eases in over a
		// few of its widths. Daughter widths follow discharge (w ~ sqrt(A)).
		const channel = (x, z, base, A, order, path, isApex) => {
			const w = baseWidth(A);
			const r0 = rr(x, z), theta = r0 < 1 ? 0 : offAxis(x, z);
			// where this channel's land ends: near the lobe's rim, or short of the old shore ahead
			const shore = Math.min(R * (0.86 + 0.14 * smoothstep(1, 0, Math.abs(theta) / halfAngle)), rayLandAt(heading + theta) - 2.2 * w - 20);
			const remaining = shore - r0;
			const daughters = order < MAX_ORDER && w >= MIN_BRANCH_WIDTH * 1.6 && remaining > 5 * w ? planSplit(x, z, base, w, isApex) : null;
			if (!daughters) {
				// the terminal run: to the shore, then a couple of widths out over the mouth bar
				const L = Math.max(remaining, 0.5 * w) + 2.2 * w;
				const end = run(x, z, base, w, L, path, { catchment: A, seed2: rnd.range(0, 100) });
				path.terminal = { x: end.x, z: end.z, hdg: end.base, w };
				delta.mouths++;
				return;
			}
			const ws = daughters.map((d) => baseWidth(A * d.q));
			const Wp = ws.reduce((a, b) => a + b, 0);
			// the parent widens into the split
			const ramp = 2.5 * w;
			for (let k = path.pts.length - 1; k >= 0; k--) {
				const p = path.pts[k], d = Math.hypot(p[0] - x, p[1] - z);
				if (d > ramp) break;
				p[2] = Math.max(p[2], w + (Wp - w) * smoothstep(ramp, 0, d));
			}
			const Ls = 2 * Wp;
			delta.nodes.push({ x, z, hdg: base, Wp, Ls });
			let acc = -Wp / 2, mainIdx = 0;
			daughters.forEach((d, i) => { d.w = ws[i]; d.c = acc + ws[i] / 2; acc += ws[i]; if (d.q > daughters[mainIdx].q) mainIdx = i; });
			// every daughter's bar zone and free run first, then their own splits, so a channel's
			// grandchildren see all of its siblings when they look for room
			const ends = [];
			daughters.forEach((d, i) => {
				const isMain = i === mainIdx;
				const p = isMain ? path : { pts: [], w: d.w, order: order + 1, fromPath: path };
				if (!isMain) { delta.paths.push(p); delta.branches++; }
				const turn = { angle: d.angle, len: 3.5 * d.w + 0.5 * Ls, c: d.c, Ls };
				const free = (2 + rnd.range(0, 3.5)) * d.w;
				const end = run(x, z, base, d.w, Ls + free, p, { catchment: A * d.q, turn, width: (s2) => Wp + (d.w - Wp) * smoothstep(0, Ls, s2), under: isMain ? 0 : 0.85 * Ls, seed2: rnd.range(0, 100) });
				ends.push({ d, p, end });
			});
			for (const { d, p, end } of ends) {
				if (end.hitLand) { p.terminal = { x: end.x, z: end.z, hdg: end.base, w: d.w }; delta.mouths++; continue; }
				channel(end.x, end.z, end.base, A * d.q, order + 1, p, false);
			}
		};
		delta.nodes = [];
		const trunkPath = { pts: [], w: Wm, order: 0, fromPath: null };
		delta.paths.push(trunkPath);
		{
			// the lead-in: the river's own heading eases round to the lobe's axis before the first split
			const lead = run(ax, az, riverHeading, Wm, 2.5 * Wm + 40, trunkPath, { catchment: A0, relax: 0.06, seed2: rnd.range(0, 100) });
			channel(lead.x, lead.z, lead.base, A0, 0, trunkPath, true);
		}

		if (!delta.branches) { skip(river, 'no room to split'); continue; }
		first = false;
		// the lobe's land is the envelope of the channel network (as at Wax Lake), scaled by `fill`:
		// per angle, the farthest channel point within a few degrees plus a couple of widths, falling
		// back to the rear cap where no channel runs
		{
			const NB = 48, env = new Float64Array(NB).fill(0);
			for (const p of delta.paths) for (const q of p.pts) {
				const r = rr(q[0], q[1]);
				if (r < 1) continue;
				const b = Math.round(((radialOf(q[0], q[1]) / TAU) % 1 + 1) % 1 * NB) % NB;
				const reach = r + 2.5 * q[2];
				for (let o = -2; o <= 2; o++) { const k = (b + o + NB) % NB; const v = reach - Math.abs(o) * 0.6 * q[2]; if (v > env[k]) env[k] = v; }
			}
			const envAt = (a) => { const f = ((a / TAU) % 1 + 1) % 1 * NB, i = Math.floor(f), t = f - i; return lerp(env[i % NB], env[(i + 1) % NB], t); };
			const fanFormula = rFan;
			delta.rFan = (theta) => Math.min(fanFormula(theta), Math.max(envAt(heading + theta) * (0.6 + 0.4 * delta.fill), R * 0.22 * delta.fill));
		}
		for (const ab of absorbed) {
			const o = ab.river;
			const [px, pz] = toWorld(o.cells[Math.max(0, ab.apexIdx - 8)]);
			const path = { pts: [], w: ab.w, order: MAX_ORDER, fromPath: null, parentAlong: 0 };
			// its mouth must not already lie in another channel
			if (clearance(ab.x, ab.z) < ab.w + 12) continue;
			delta.paths.push(path);
			const lead = run(ab.x, ab.z, Math.atan2(ab.z - pz, ab.x - px), ab.w, 30, path, { catchment: area[o.cells[ab.apexIdx]] * cell * cell, relax: 0.06, seed2: rnd.range(0, 100) });
			channel(lead.x, lead.z, lead.base, area[o.cells[ab.apexIdx]] * cell * cell, MAX_ORDER, path, false);
			o.cells = o.cells.slice(0, ab.apexIdx + 1);
			o.junction = -1;
			o.delta = { ext: path.pts.slice(1).map((q) => [q[0], q[1]]), extA: path.pts.slice(1).map((q) => Math.pow((q[2] - 4) / 0.0075, 2)), extCatchment: path.pts.slice(1).map(q => q[4]), id: deltas.length };
			path.river = o;
		}

		// ---- the lobe ----
		raiseLobe(delta, ctx);

		// ---- the river records ----
		// the trunk continues along its path; the branches are new rivers off it
		const areasFor = (path) => {
			// the width is known at every point; the shaper wants areas, so invert the width law
			return path.pts.map((p) => { const w = p[2]; return Math.pow((w - 4) / 0.0075, 2); });
		};
		river.cells = cells.slice(0, apexIdx + 1);
		river.junction = -1;
		river.delta = { ext: trunkPath.pts.slice(1).map((p) => [p[0], p[1]]), extA: areasFor(trunkPath).slice(1), extCatchment: trunkPath.pts.slice(1).map(p => p[4]), id: deltas.length };
		trunkPath.river = river;
		for (const p of delta.paths) {
			if (p === trunkPath || p.river) continue;
			const parentRiver = p.fromPath.river;
			const rec = { id: rivers.length, cells: [], pts: p.pts.map((q) => [q[0], q[1]]), areas: areasFor(p), catchments: p.pts.map(q => q[4]), under: p.pts.map((q) => q[3] || 0), junction: -1, mouthType: 'sea', fromLake: -1, fromRiver: parentRiver.id, parentId: -1, delta: { id: deltas.length } };
			p.river = rec;
			rivers.push(rec);
		}
		deltas.push({ river: river.id, x: ax, z: az, heading, R: Math.round(R), fill: +delta.fill.toFixed(2), apexH: +apexH.toFixed(2), mouths: delta.mouths, branches: delta.branches, halfAngle: Math.round(halfAngle * 180 / Math.PI) });
	}
	return deltas;
}

// Builds the lobe on the height grid: a fan of plain around the apex, levee fingers along every
// channel, a beach at the edge, a delta front sloping to the shelf, mouth-bar shoals off the
// mouths. Only ever raises the ground.
function raiseLobe(delta, ctx) {
	const { h, N, cell, size, lakeId } = ctx;
	const { x: ax, z: az, R, apexH, rFan, heading } = delta;
	const plain = (r) => TIP_HEIGHT + (apexH - TIP_HEIGHT) * Math.pow(1 - clamp(r / R, 0, 1), 0.75);
	// finger corridors: the channel points minus the sea reach of each terminal run
	const fingers = delta.paths.map((p) => {
		let pts = p.pts;
		if (p.terminal) { const drop = Math.ceil(2.2 * p.terminal.w / RUN_STEP); pts = pts.slice(0, Math.max(2, pts.length - drop)); }
		return pts;
	});
	// distance beyond the levee corridor of the nearest channel, and that channel's edge distance and width
	let fdEdge = 0, fdW = 0;
	const fingerDist = (x, z) => {
		let best = Infinity;
		for (const pts of fingers) {
			for (let i = 0; i < pts.length - 1; i++) {
				const a = pts[i], b = pts[i + 1];
				const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
				let t = l2 > 0 ? ((x - a[0]) * dx + (z - a[1]) * dz) / l2 : 0;
				t = clamp(t, 0, 1);
				const px = a[0] + dx * t - x, pz = a[1] + dz * t - z;
				const w = lerp(a[2], b[2], t);
				const dist = Math.sqrt(px * px + pz * pz);
				const d = dist - Math.max(2.2 * w, 18);
				if (d < best) { best = d; fdEdge = dist - w * 0.5; fdW = w; }
			}
		}
		return best;
	};
	const shoals = delta.paths.filter((p) => p.terminal).map((p) => { const t = p.terminal; return { x: t.x - Math.cos(t.hdg) * 0.6 * t.w, z: t.z - Math.sin(t.hdg) * 0.6 * t.w, r: 1.8 * t.w }; });
	const margin = R + 220;
	const i0 = Math.max(1, Math.floor((ax - margin + size / 2) / cell)), i1 = Math.min(N - 2, Math.ceil((ax + margin + size / 2) / cell));
	const j0 = Math.max(1, Math.floor((az - margin + size / 2) / cell)), j1 = Math.min(N - 2, Math.ceil((az + margin + size / 2) / cell));
	for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
		const k = j * N + i;
		if (lakeId[k] >= 0) continue;
		const x = -size / 2 + i * cell, z = -size / 2 + j * cell;
		const r = Math.hypot(x - ax, z - az);
		const theta = r < 1 ? 0 : angDiff(Math.atan2(z - az, x - ax), heading);
		const dFan = r - rFan(theta);
		const dF = fingerDist(x, z);
		const d = Math.min(dFan, dF);
		let hd;
		if (d < 0) {
			// a natural levee stands along every channel and the plain sags into backswamp between them
			const levee = 0.35 * (1 - smoothstep(0, 1.5 * fdW, fdEdge)) - 0.4 * smoothstep(2 * fdW, 5 * fdW, fdEdge);
			hd = Math.max(plain(r) + levee, TIP_HEIGHT * 0.7) - EDGE_DROP * (1 - smoothstep(0, 40, -d));
		} else hd = plain(r) - EDGE_DROP - FRONT_SLOPE * d - 0.0004 * d * d;
		for (const s of shoals) {
			const ds = Math.hypot(x - s.x, z - s.z);
			if (ds < s.r) { const u = ds / s.r; hd = Math.max(hd, -1.2 - 2.6 * u * u); }
		}
		// the front blends back into the shelf a hundred and fifty metres out
		const lift = hd - h[k];
		if (lift > 0) h[k] += lift * (1 - smoothstep(70, 170, d));
	}
}
