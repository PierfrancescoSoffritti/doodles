import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Random, Simplex2D } from '../core/Random.js';
import { config } from '../core/Config.js';
import { hslGlsl, createRockMaterial } from './TerrainMaterial.js';
import { ROCK_STRIDE } from './gen/Rivers.js';
import { SEG_KIND } from './Heightmap.js';
import { WatersideMeshes } from './WatersideMeshes.js';
import { RiverEcology } from './RiverEcology.js';

const UNBORN = 1e9;
const ss = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const TREE_HEIGHT = 60;

// Plant kinds. `preborn` is the share that exists as soon as the chunk does (visible from afar);
// the rest grows out of the ground when the player comes within `reveal` units.
const KINDS = {
	tree:    { reveal: 460, preborn: 0.45, dur: 2.4, back: 0.15 },
	giant:   { reveal: 0, preborn: 1.0, dur: 3.0, back: 0.1 },       // the old-growth giants are always standing, seen from kilometres away
	shrub:   { reveal: 260, preborn: 0.4, dur: 1.8, back: 0.4 },
	crystal: { reveal: 420, preborn: 0.7, dur: 2.0, back: 0.5 },
	blade:   { reveal: 0, preborn: 1.0, dur: 1.4, back: 1.0 },      // the distant grass: always there, hidden near the player
	tuft:    { reveal: 140, preborn: 0.35, dur: 1.5, back: 1.0 },   // wireframe grass everywhere: part there from the start, the rest rises as you approach
	reed:    { reveal: 170, preborn: 0.3, dur: 1.8, back: 0.8 },
	sprout:  { reveal: 160, preborn: 0.1, dur: 2.2, back: 1.0 },
	rock:    { reveal: 0, preborn: 1.0, dur: 0.6, back: 0.0 },      // boulders are simply there
};

// ---------- geometry builders ----------
// One recursive tree, shaped by its options: trunk and radius ranges, how many branches per node,
// how wide they spread, how much they reach back up, how fast they shrink, a lean and a wind bias.
function buildTree(rnd, o) {
	const parts = [];
	const up = new THREE.Vector3(0, 1, 0);
	const wind = new THREE.Vector3(1, 0.15, 0).normalize();
	function branch(origin, dir, length, radius, depth) {
		const geom = new THREE.CylinderGeometry(radius * o.taper, radius, length, o.segs, 1, true);
		geom.translate(0, length / 2, 0);
		geom.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()));
		geom.translate(origin.x, origin.y, origin.z);
		parts.push(geom);
		if (depth === 0) return;
		const end = origin.clone().addScaledVector(dir, length);
		const n = rnd.int(o.n[0], depth > 2 && o.nDeep ? o.nDeep : o.n[1]);
		for (let i = 0; i < n; i++) {
			const axis = new THREE.Vector3(rnd.range(-1, 1), rnd.range(-0.2, 0.6) * o.axisY, rnd.range(-1, 1)).normalize();
			const nd = dir.clone().applyAxisAngle(axis, rnd.range(o.spread[0], o.spread[1])).lerp(up, o.up);
			if (o.wind) nd.lerp(wind, o.wind);
			nd.normalize();
			branch(end, nd, length * rnd.range(o.shrink[0], o.shrink[1]), radius * o.rShrink, depth - 1);
		}
	}
	const stems = o.stems || 1;
	for (let k = 0; k < stems; k++) {
		const t = o.tilt || 0.1;
		const dir = new THREE.Vector3(rnd.range(-t, t) + (o.lean ? rnd.range(o.lean[0], o.lean[1]) : 0), 1, rnd.range(-t, t)).normalize();
		if (stems > 1) { const a = k / stems * Math.PI * 2 + rnd.range(0, 1); dir.x += Math.cos(a) * 0.45; dir.z += Math.sin(a) * 0.45; dir.normalize(); }
		branch(new THREE.Vector3(0, o.base ?? -2, 0), dir, rnd.range(o.trunk[0], o.trunk[1]), rnd.range(o.radius[0], o.radius[1]), o.depth);
	}
	const merged = mergeGeometries(parts, false);
	merged.computeVertexNormals();
	return merged;
}

// the open-ground tree: a stout trunk that forks and forks again into a wide bare crown
const buildBareTree = (rnd) => buildTree(rnd, { trunk: [18, 26], radius: [0.9, 1.4], depth: 4, n: [2, 4], nDeep: 3, spread: [0.45, 0.95], up: 0.15, shrink: [0.55, 0.75], rShrink: 0.6, taper: 0.55, axisY: 1, segs: 5 });
// krummholz: the wind-pruned tree of the tree line and the exposed coast, squat, leaning along +x,
// every branch streaming the same way. Placed with +x pointing downwind.
const buildKrummholz = (rnd) => buildTree(rnd, { trunk: [6, 10], radius: [0.8, 1.15], depth: 3, n: [2, 4], spread: [0.5, 1.1], up: 0.05, wind: 0.45, shrink: [0.6, 0.8], rShrink: 0.62, taper: 0.6, axisY: 1, segs: 5, lean: [0.7, 1.4], tilt: 0.25 });
// a snag: a dead trunk broken off with a stub or two
const buildSnag = (rnd) => buildTree(rnd, { trunk: [12, 22], radius: [1.0, 1.5], depth: 1, n: [1, 2], spread: [0.7, 1.1], up: 0.1, shrink: [0.2, 0.4], rShrink: 0.45, taper: 0.35, axisY: 1, segs: 5 });
// vertex colours are linear (three converts only material colours from sRGB), so these are far darker than they look
const TRUNK = [0.03, 0.02, 0.07], LEAF = [0.085, 0.052, 0.19], NEEDLE = [0.07, 0.045, 0.16];

// ---- the old-growth giants ----
// Real tree architecture at old-growth scale: a buttressed trunk, limbs that fork three times, and
// foliage hung along the outer branches as leaf-cluster cards cut out of a painted atlas, so the
// canopy is a ragged mass with sky showing through it rather than a solid blob. Trunks and cards
// share one geometry and one material: cards take their alpha from the atlas, trunk vertices carry
// a negative v that tells the shader to skip the lookup.

// The atlas: broadleaf clusters in the left half, needle sprays in the right, painted once per seed.
function leafAtlas(rnd) {
	const W = 512, H = 256;
	const c = document.createElement('canvas');
	c.width = W; c.height = H;
	const ctx = c.getContext('2d');
	ctx.clearRect(0, 0, W, H);
	const shade = (y, k) => { const b = Math.round(255 * Math.min(1, Math.max(0.35, 0.5 + 0.5 * (1 - y / H) * k + rnd.range(-0.12, 0.12)))); return `rgb(${b},${b},${b})`; };
	// broadleaf: overlapping leaves in a rough disc with holes torn out of it
	{
		const cx = 128, cy = 126, voids = [];
		for (let i = 0; i < 4; i++) { const a = rnd.range(0, 6.3), r = rnd.range(30, 95); voids.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, rnd.range(12, 24)]); }
		for (let i = 0; i < 420; i++) {
			const a = rnd.range(0, 6.3), r = 108 * Math.pow(rnd.next(), 0.6);
			const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.92;
			if (voids.some(([vx, vy, vr]) => Math.hypot(x - vx, y - vy) < vr)) continue;
			if (r > 80 && rnd.next() < (r - 80) / 40) continue;   // the rim frays
			ctx.save(); ctx.translate(x, y); ctx.rotate(rnd.range(0, 6.3));
			ctx.fillStyle = shade(y, 1.0);
			ctx.beginPath(); ctx.ellipse(0, 0, rnd.range(6, 10), rnd.range(3.5, 5.5), 0, 0, 6.3); ctx.fill();
			ctx.restore();
		}
	}
	// needles: short strokes sprayed from twigs, a looser, spikier disc
	{
		const cx = 384, cy = 126;
		ctx.lineCap = 'round';
		for (let i = 0; i < 700; i++) {
			const a = rnd.range(0, 6.3), r = 104 * Math.pow(rnd.next(), 0.55);
			const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
			if (r > 75 && rnd.next() < (r - 75) / 35) continue;
			const d = rnd.range(0, 6.3), l = rnd.range(9, 17);
			ctx.strokeStyle = shade(y, 0.9); ctx.lineWidth = rnd.range(1.8, 3.2);
			ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(d) * l, y + Math.sin(d) * l); ctx.stroke();
		}
	}
	const tex = new THREE.CanvasTexture(c);
	tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
	tex.anisotropy = 4;
	return tex;
}

// a tapered tube from a to b, painted, uvs parked at v = -1 so the shader treats it as bark
function tube(a, b, ra, rb, segs, color) {
	const dir = b.clone().sub(a), len = dir.length();
	const g = new THREE.CylinderGeometry(rb, ra, len, segs, 1, true).toNonIndexed();
	g.translate(0, len / 2, 0);
	g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
	g.translate(a.x, a.y, a.z);
	const n = g.attributes.position.count, col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
	for (let i = 0; i < n; i++) { col[i * 3] = color[0]; col[i * 3 + 1] = color[1]; col[i * 3 + 2] = color[2]; uv[i * 2] = 0.5; uv[i * 2 + 1] = -1; }
	g.setAttribute('color', new THREE.BufferAttribute(col, 3));
	g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
	return g;
}

// a foliage cluster: three quads crossed at 60 degrees and tilted a little, all with the crown's
// normal so the canopy lights as one rounded mass
function card(rnd, center, size, normal, color, kind) {
	const pos = [], nrm = [], uv = [], col = [];
	const a0 = rnd.range(0, 6.3), u0 = kind === 0 ? 0.01 : 0.51, u1 = kind === 0 ? 0.49 : 0.99;
	for (let k = 0; k < 3; k++) {
		const a = a0 + k * Math.PI / 3, tilt = rnd.range(-0.45, 0.45);
		const right = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(size / 2);
		const upv = new THREE.Vector3(Math.sin(a) * Math.sin(tilt), Math.cos(tilt), -Math.cos(a) * Math.sin(tilt)).multiplyScalar(size / 2);
		const c = [[-1, -1, u0, 0], [1, -1, u1, 0], [1, 1, u1, 1], [-1, -1, u0, 0], [1, 1, u1, 1], [-1, 1, u0, 1]];
		for (const [sx, sy, u, v] of c) {
			pos.push(center.x + right.x * sx + upv.x * sy, center.y + right.y * sx + upv.y * sy, center.z + right.z * sx + upv.z * sy);
			nrm.push(normal.x, normal.y, normal.z);
			uv.push(u, v);
			col.push(color[0], color[1], color[2]);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	return g;
}

const crownNormal = (p, center, upMix) => p.clone().sub(center).normalize().lerp(new THREE.Vector3(0, 1, 0), upMix).normalize();

// The world runs at about five times human scale (the eye is 11 m up, the grass 2 to 6 m tall), so
// an old-growth giant is 250 to 350 m tall with a trunk 15 to 20 m through. Each giant comes in two
// levels of detail built from the same skeleton: the full tree for the near chunks, and the trunk
// with a handful of big cards for the far layer, so the same silhouette stands out to the horizon.
const G = 3;

function finish(parts, trunkRadius, hang = []) {
	const g = mergeGeometries(parts, false);
	g.scale(G, G, G);
	g.computeBoundingSphere();
	return { geometry: g, trunkRadius: trunkRadius * G, hang: hang.map((v) => v.clone().multiplyScalar(G)) };
}

// the spreading giant: a buttressed trunk to a first fork twenty to thirty metres up, three to five
// great limbs forking twice more, leaf clusters at every tip and along the last reaches
function buildGiantBroadleaf(rnd) {
	const hi = [], lo = [];
	const H0 = rnd.range(22, 34), R0 = rnd.range(2.2, 3.4);
	const v = (x, y, z) => new THREE.Vector3(x, y, z);
	const tilt = v(rnd.range(-0.08, 0.08), 1, rnd.range(-0.08, 0.08)).normalize();
	const top = tilt.clone().multiplyScalar(H0);
	const both = (g) => { hi.push(g); lo.push(g.clone()); };
	both(tube(v(0, -4, 0), tilt.clone().multiplyScalar(5), R0 * 1.9, R0 * 1.05, 12, TRUNK));
	both(tube(tilt.clone().multiplyScalar(4.9), top, R0 * 1.05, R0 * 0.7, 12, TRUNK));
	const clusters = [], hang = [];
	const up = v(0, 1, 0);
	function limb(origin, dir, len, r, depth) {
		const end = origin.clone().addScaledVector(dir, len);
		const g = tube(origin.clone().addScaledVector(dir, -r * 0.8), end, r, r * 0.62, depth === 2 ? 8 : (depth === 1 ? 6 : 5), TRUNK);
		hi.push(g);
		if (depth === 2) lo.push(g.clone());
		hang.push(origin.clone().addScaledVector(dir, len * rnd.range(0.35, 0.9)));   // where a lamp can hang
		if (depth === 0) { clusters.push({ p: end, s: rnd.range(12, 18) }); if (len > 7) clusters.push({ p: origin.clone().addScaledVector(dir, len * 0.5), s: rnd.range(8, 12) }); return; }
		if (depth === 1) clusters.push({ p: origin.clone().addScaledVector(dir, len * 0.6), s: rnd.range(8, 12) });
		const n = depth === 2 ? rnd.int(2, 3) : rnd.int(2, 4);
		for (let i = 0; i < n; i++) {
			const axis = v(rnd.range(-1, 1), rnd.range(-0.2, 0.5), rnd.range(-1, 1)).normalize();
			const nd = dir.clone().applyAxisAngle(axis, rnd.range(0.4, 0.9)).lerp(up, depth === 2 ? 0.1 : 0.25).normalize();
			limb(end, nd, len * rnd.range(0.55, 0.72), r * 0.6, depth - 1);
		}
	}
	const center = top.clone().add(v(0, 20, 0));
	const n = rnd.int(3, 5);
	for (let k = 0; k < n; k++) {
		const a = k / n * Math.PI * 2 + rnd.range(0, 0.9), spread = rnd.range(0.55, 0.9);
		const dir = v(Math.cos(a) * spread, 1, Math.sin(a) * spread).normalize();
		const o = top.clone().addScaledVector(tilt, -rnd.range(0, 5));
		const len = rnd.range(17, 25);
		limb(o, dir, len, R0 * 0.55, 2);
		// the far version: one big cluster per limb where its sub-crown sits
		const cp = o.clone().addScaledVector(dir, len * 1.55);
		lo.push(card(rnd, cp, len * 1.7, crownNormal(cp, center, 0.35), LEAF.map((x) => x * 0.9), 0));
	}
	lo.push(card(rnd, center.clone().add(v(0, 8, 0)), 30, v(0, 1, 0), LEAF.map((x) => x * 0.95), 0));
	for (const c of clusters) hi.push(card(rnd, c.p, c.s, crownNormal(c.p, center, 0.35), LEAF.map((x) => x * rnd.range(0.7, 1.15)), 0));
	return { hi: finish(hi, R0, hang), lo: finish(lo, R0) };
}

// the sequoia: a straight trunk seventy to a hundred metres up, tapering, whorls of short branches
// from a third of the way up carrying sprays of needles, the crown narrowing to a spire
function buildGiantConifer(rnd) {
	const hi = [], lo = [];
	const H = rnd.range(72, 104), R0 = rnd.range(2.4, 3.6);
	const v = (x, y, z) => new THREE.Vector3(x, y, z);
	const both = (g) => { hi.push(g); lo.push(g.clone()); };
	both(tube(v(0, -4, 0), v(0, 6, 0), R0 * 1.8, R0, 12, TRUNK));
	both(tube(v(0, 5.9, 0), v(0, H * 0.55, 0), R0, R0 * 0.55, 10, TRUNK));
	both(tube(v(0, H * 0.55 - 0.1, 0), v(0, H, 0), R0 * 0.55, 0.3, 7, TRUNK));
	const y0 = H * rnd.range(0.26, 0.34), count = rnd.int(26, 34);
	const center = v(0, (y0 + H) / 2, 0);
	const hang = [];
	let a = rnd.range(0, 6.3);
	const Lof = (t) => (1 - t * 0.8) * 14 + 2;
	for (let i = 0; i < count; i++) {
		const t = i / (count - 1), y = y0 + (H - y0) * t;
		a += 2.4 + rnd.range(-0.3, 0.3);
		const L = (1 - t * 0.8) * rnd.range(11, 17) + 2;
		const dir = v(Math.cos(a), rnd.range(-0.25, 0.05) + t * 0.2, Math.sin(a)).normalize();
		const base = v(0, y, 0), tip = base.clone().addScaledVector(dir, L);
		hi.push(tube(base.clone().addScaledVector(dir, -R0 * 0.3), tip, 0.45 * (1 - t * 0.5) + 0.1, 0.12, 4, TRUNK));
		if (t < 0.6) hang.push(base.clone().addScaledVector(dir, L * rnd.range(0.5, 0.85)));
		const s = (8 + 5 * (1 - t)) * rnd.range(0.85, 1.15);
		hi.push(card(rnd, tip.clone().addScaledVector(dir, -s * 0.15), s, crownNormal(tip, center, 0.3), NEEDLE.map((x) => x * rnd.range(0.75, 1.15)), 1));
		if (L > 6) hi.push(card(rnd, base.clone().addScaledVector(dir, L * 0.45), s * 0.85, crownNormal(tip, center, 0.3), NEEDLE.map((x) => x * rnd.range(0.7, 1.05)), 1));
	}
	hi.push(card(rnd, v(0, H + 2, 0), 9, v(0, 1, 0), NEEDLE, 1));
	// the far version: a stack of big sprays down the crown axis
	for (let k = 0; k < 6; k++) {
		const t = (k + 0.5) / 6, y = y0 + (H - y0) * t;
		lo.push(card(rnd, v(0, y, 0), Lof(t) * 2.3 + 4, v(0, 1, 0).lerp(v(Math.cos(k * 2.1), 0, Math.sin(k * 2.1)), 0.5).normalize(), NEEDLE.map((x) => x * 0.9), 1));
	}
	return { hi: finish(hi, R0, hang), lo: finish(lo, R0) };
}

// a tiny lantern to hang from a branch: a cord from the hang point, a cap, a hexagonal body that glows, a knob
function buildLamp() {
	const parts = [];
	const paintUv = (g, c) => { const src = g.index ? g.toNonIndexed() : g; src.deleteAttribute('uv'); src.deleteAttribute('normal'); const n = src.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; } src.setAttribute('color', new THREE.BufferAttribute(col, 3)); return src; };
	const cord = new THREE.CylinderGeometry(0.05, 0.05, 6, 3, 1); cord.translate(0, -3, 0);
	const cap = new THREE.ConeGeometry(0.6, 0.4, 6); cap.translate(0, -6.2, 0);
	const body = new THREE.CylinderGeometry(0.42, 0.32, 0.95, 6, 1); body.translate(0, -6.85, 0);
	const knob = new THREE.ConeGeometry(0.28, 0.35, 6); knob.rotateX(Math.PI); knob.translate(0, -7.5, 0);
	parts.push(paintUv(cord, [0.05, 0.03, 0.09]), paintUv(cap, [0.09, 0.05, 0.12]), paintUv(body, [1.0, 0.74, 0.38]), paintUv(knob, [0.09, 0.05, 0.12]));
	return mergeGeometries(parts, false);
}
const LAMP_BODY_Y = -6.85;

// a shrub: two or three short stems from the ground, forking twice, the understorey and the thicket
const buildShrub = (rnd) => buildTree(rnd, { trunk: [1.6, 3.2], radius: [0.22, 0.38], depth: 2, n: [3, 5], spread: [0.6, 1.2], up: 0.1, shrink: [0.6, 0.85], rShrink: 0.6, taper: 0.5, axisY: 1, segs: 4, stems: 3, base: -0.6 });

function buildBlade() {
	const segs = 3, w = 0.35;
	const pos = [], col = [], idx = [];
	for (let i = 0; i <= segs; i++) {
		const t = i / segs, hw = w * (1 - t * 0.85);
		pos.push(-hw, t, 0, hw, t, 0);
		col.push(t, t, t, t, t, t);
	}
	for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	g.setIndex(idx);
	return g;
}

// the old sprout: a glowing ball on a stem with four dark leaves
function buildSprout() {
	const stem = new THREE.CylinderGeometry(0.08, 0.18, 4, 4, 1);
	stem.translate(0, 2, 0);
	const ball = new THREE.IcosahedronGeometry(0.9, 1);
	ball.translate(0, 4.6, 0);
	const leaves = [];
	for (let k = 0; k < 4; k++) {
		const leaf = new THREE.BufferGeometry();
		leaf.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.3, 0, 1.6, 1.4, 0.9, 1.6, 1.4, -0.9, 3.4, 0.2, 0], 3));
		leaf.setIndex([0, 1, 2, 3, 2, 1]);
		leaf.rotateY(k * Math.PI / 2);
		leaves.push(leaf.toNonIndexed());
	}
	const paint = (g, r, gg, b) => { const n = g.attributes.position.count; const c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = gg; c[i * 3 + 2] = b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('normal'); g.deleteAttribute('uv'); return g; };
	const ni = (g) => (g.index ? g.toNonIndexed() : g);
	const parts = [paint(ni(stem), 0.1, 0.06, 0.2), paint(ni(ball), 2.2, 1.3, 2.4), ...leaves.map((l) => paint(l, 0.04, 0.22, 0.12))];
	return mergeGeometries(parts, false);
}

// a boulder: a jittered icosahedron, squashed a little, flat-shaded by the material
function buildBoulder(rnd) {
	const g = new THREE.IcosahedronGeometry(1, 1);   // already non-indexed
	const pos = g.attributes.position;
	const v = new THREE.Vector3();
	const seed = [rnd.range(0, 10), rnd.range(0, 10), rnd.range(0, 10)];
	for (let i = 0; i < pos.count; i++) {
		v.fromBufferAttribute(pos, i);
		const k = 0.72 + 0.28 * Math.abs(Math.sin(v.x * 3.1 + seed[0]) * Math.cos(v.y * 2.7 + seed[1]) + Math.sin(v.z * 3.7 + seed[2]) * 0.5);
		v.multiplyScalar(k);
		v.y *= 0.72;
		pos.setXYZ(i, v.x, v.y, v.z);
	}
	g.deleteAttribute('uv');
	g.computeVertexNormals();
	return g;
}

function hexPrism(r, h) {
	const g = new THREE.CylinderGeometry(r * 0.85, r, h, 6, 1);
	g.translate(0, h / 2, 0);
	return g;
}

function edgePositions(geometry, angle = 1) { return new THREE.EdgesGeometry(geometry, angle).attributes.position.array; }

// ---------- shaders ----------
const growthGlsl = /* glsl */`
	uniform float uTime, uWind, uHeightRef, uPulse, uDur, uBack, uNearFade;
	attribute float aBorn;
	float easeOutCubic(float t) { return 1.0 - pow(1.0 - t, 3.0); }
	float easeOutBack(float t) { float c1 = 1.70158, c3 = c1 + 1.0; float u = t - 1.0; return 1.0 + c3 * u * u * u + c1 * u * u; }
	float growT() { return clamp((uTime - aBorn) / uDur, 0.0, 1.0); }
	void applyGrowth(inout vec3 p, float swayStrength, vec3 ipos) {
		float hw = clamp(p.y / uHeightRef, 0.0, 1.0);
		hw *= hw;
		float ph = ipos.x * 0.05 + ipos.z * 0.07;
		float sway = sin(uTime * 0.8 + ph) * 0.6 + sin(uTime * 2.3 + ph * 1.7) * 0.25;
		p.x += sway * hw * uWind * swayStrength;
		p.z += cos(uTime * 0.6 + ph * 1.3) * 0.4 * hw * uWind * swayStrength;
		float t = growT();
		float ey = mix(easeOutCubic(t), easeOutBack(t), uBack);
		float exz = easeOutCubic(t);
		p.xz *= 0.55 + 0.45 * exz;
		p.y = p.y * ey - (1.0 - exz) * 2.5;
		float near = mix(1.0, smoothstep(1.5, 5.0, distance(ipos.xz, cameraPosition.xz)), uNearFade);
		p *= near;
	}`;

function instancedMaterial(base, uniforms, swayStrength, extraVertex = '', extraFragment = null) {
	base.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, uniforms);
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', '#include <common>\n' + growthGlsl)
			.replace('#include <begin_vertex>', `#include <begin_vertex>\nvec3 ipos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);\n${extraVertex}\napplyGrowth(transformed, ${swayStrength.toFixed(2)}, ipos);`);
		if (extraFragment) shader.fragmentShader = extraFragment(shader.fragmentShader);
	};
	return base;
}

export class Vegetation {
	constructor(scene, heightmap, shared) {
		this.scene = scene;
		this.heightmap = heightmap;
		this.shared = shared;
		this.chunks = new Map();
		this.radius = config.world.vegetationRadius;
		this.time = 0;
		this.centerX = 0;
		this.centerZ = 0;

		const rnd = new Random(config.seed + ':flora');
		this.bareTrees = [0, 1, 2, 3, 4, 5].map(() => buildBareTree(rnd));
		this.leafAtlas = leafAtlas(rnd);
		this.broadleaves = [0, 1, 2, 3].map(() => buildGiantBroadleaf(rnd));
		this.sequoias = [0, 1, 2].map(() => buildGiantConifer(rnd));
		this.farChunks = new Map();
		this.groveNoise = new Simplex2D(new Random(config.seed + ':groves'));   // where the colossal old groves stand
		this.farRadius = config.world.giantRadius;
		this.pr = { x: 0, z: 0, y: 0, H: 0, hSea: 0, slope: 0, bank: 0, hard: 0, forest: 0, wet: 0, coast: 0, alt: 1 };
		this.krummholz = [0, 1, 2].map(() => buildKrummholz(rnd));
		this.snags = [0, 1].map(() => buildSnag(rnd));
		this.shrubs = [0, 1, 2, 3].map(() => buildShrub(rnd));
		this.blade = buildBlade();
		this.sprout = buildSprout();
		this.crystalSolid = hexPrism(1, 1);
		this.crystalEdges = edgePositions(hexPrism(1, 1));
		this.tuftEdges = edgePositions(new THREE.CylinderGeometry(0.2, 0.45, 1, 2).translate(0, 0.5, 0));

		const U = (dur, back, heightRef, nearFade = 1) => ({ uTime: { value: 0 }, uWind: { value: 1 }, uPulse: { value: 0 }, uHeightRef: { value: heightRef }, uDur: { value: dur }, uBack: { value: back }, uNearFade: { value: nearFade } });
		this.uniformSets = [];
		const mk = (kind, heightRef, nearFade) => { const u = U(KINDS[kind].dur, KINDS[kind].back, heightRef, nearFade); this.uniformSets.push(u); return u; };
		this.boulders = [0, 1, 2, 3].map(() => buildBoulder(rnd));
		this.log = new THREE.CylinderGeometry(0.8, 1, 1, 6, 1);   // a fallen trunk lying along +x
		this.log.rotateZ(Math.PI / 2);
		this.rockMaterial = createRockMaterial(shared, shared.terrainUniforms);
		this.riverEcology = new RiverEcology(shared);
		this.watersideMeshes = new WatersideMeshes(shared);

		this.treeMaterial = instancedMaterial(new THREE.MeshStandardMaterial({ color: '#0a0716', roughness: 0.95, metalness: 0.05, flatShading: true, side: THREE.DoubleSide }), mk('tree', TREE_HEIGHT), 2.5);
		// the giants: bark and leaf cards in one material; cards are cut out of the atlas, bark (uv v < 0)
		// skips the lookup; facets catch the moon; snow settles on the upward faces
		const leafU = mk('giant', 300);
		leafU.uSnow = shared.terrainUniforms.uSnow;
		// Lambert, pure diffuse, no specular sheen on bark seen at grazing angles. Leaves let the moon
		// through (a back-lit term), the whole tree gets an ambient lift so a canopy is never black
		// from below, and the canopy shimmers in the key's hue with every note and the bass.
		const tu = shared.terrainUniforms;
		Object.assign(leafU, { uMoonDir: tu.uMoonDir, uMoonColor: tu.uMoonColor, uMoonIntensity: tu.uMoonIntensity, uHue: { value: 0.8 }, uBass: { value: 0 } });
		this.leafUniforms = leafU;
		this.leafMaterial = instancedMaterial(new THREE.MeshLambertMaterial({ color: '#ffffff', map: this.leafAtlas, alphaTest: 0.5, vertexColors: true, side: THREE.DoubleSide }), leafU, 6.0, 'vWp = ipos + transformed;', (fs) => fs
			.replace('#include <common>', '#include <common>\nuniform float uSnow, uHue, uPulse, uBass, uMoonIntensity, uTime;\nuniform vec3 uMoonDir, uMoonColor;\nvarying vec3 vWp;\n' + hslGlsl)
			.replace('#include <map_fragment>', 'if (vMapUv.y >= 0.0) diffuseColor *= texture2D(map, vMapUv);')
			.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nvec3 wn = inverseTransformDirection(normal, viewMatrix);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.4, 0.4, 0.56), uSnow * smoothstep(0.3, 0.9, wn.y) * 0.75);')
			.replace('#include <lights_fragment_end>', /* glsl */`
				#include <lights_fragment_end>
				float leaf = vMapUv.y >= 0.0 ? 1.0 : 0.0;
				float thru = max(dot(-wn, uMoonDir), 0.0) * uMoonIntensity;
				reflectedLight.directDiffuse += diffuseColor.rgb * uMoonColor * thru * 0.7 * leaf;
				reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.36, 0.27, 0.6) * (0.7 + 0.3 * leaf);
`));
		this.leafMaterial.onBeforeCompile = ((orig) => (shader) => { orig(shader); shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;'); })(this.leafMaterial.onBeforeCompile);

		// Fireflies around the giants' trunks and under their canopies, blinking in short flashes, and the
		// warm glow of the lanterns hung from their branches. Both twinkle with the notes and the bass,
		// and flare around a note that sounds nearby. They live in the near chunks.
		this.notes = new Float32Array(8 * 4).fill(-1e3);
		this.noteCursor = 0;
		const flareGlsl = /* glsl */`
			uniform vec4 uNotes[8];   // x, z, time, strength
			float noteFlare(vec2 xz, float t) {
				float flare = 0.0;
				for (int i = 0; i < 8; i++) {
					float age = t - uNotes[i].z;
					if (age < 0.0 || age > 3.5) continue;
					flare += uNotes[i].w * exp(-age * 1.5) * smoothstep(0.0, 0.2, age) * (1.0 - smoothstep(80.0, 320.0, distance(xz, uNotes[i].xy)));
				}
				return flare;
			}`;
		this.lightMaterial = new THREE.ShaderMaterial({
			uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uPulse: { value: 0 }, uBass: { value: 0 }, uNight: { value: 1 }, uNotes: { value: this.notes } },
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
			vertexShader: /* glsl */`
				attribute vec4 aInfo;   // phase, size, kind (0 firefly, 1 lamp glow), tint
				uniform float uTime, uPixelRatio, uPulse, uBass, uNight;
				varying vec3 vCol; varying float vA;
				${flareGlsl}
				void main() {
					vec3 p = position;
					float k = aInfo.z;
					float flare = noteFlare(p.xz, uTime);
					if (k < 0.5) {
						// a firefly wanders and flashes: a short blink every few seconds, more often when the music moves
						p += vec3(sin(uTime * 0.6 + aInfo.x), sin(uTime * 0.45 + aInfo.x * 1.3) * 0.5, cos(uTime * 0.5 + aInfo.x)) * 4.0;
						float cycle = sin(uTime * (0.9 + 0.5 * uPulse) + aInfo.x);
						float blink = smoothstep(0.55, 0.9, cycle);
						vA = 0.08 + blink * (0.9 + 0.6 * uPulse) + flare * 1.5;
						vCol = mix(vec3(0.75, 1.0, 0.35), vec3(1.0, 0.95, 0.5), aInfo.w);
						gl_PointSize = aInfo.y * 260.0;
					} else {
						// a lantern's halo: warm, steady with a slow flicker, swelling with the bass
						float flick = 0.85 + 0.15 * sin(uTime * 7.0 + aInfo.x) * sin(uTime * 4.3 + aInfo.x * 2.1);
						vA = (0.8 + 0.6 * uPulse + 0.4 * uBass) * flick + flare * 1.4;
						vCol = mix(vec3(1.0, 0.72, 0.35), vec3(1.0, 0.6, 0.55), aInfo.w);
						gl_PointSize = aInfo.y * 2600.0;
					}
					vA *= 0.6 + 0.4 * uNight;
					vec4 mv = modelViewMatrix * vec4(p, 1.0);
					float dist = max(-mv.z, 1.0);
					vA *= exp(-dist * 0.0006);
					gl_PointSize = gl_PointSize * uPixelRatio / dist;
					gl_Position = projectionMatrix * mv;
				}`,
			fragmentShader: /* glsl */`
				varying vec3 vCol; varying float vA;
				void main() {
					float d = length(gl_PointCoord - 0.5) * 2.0;
					float a = pow(max(1.0 - d, 0.0), 2.2) * vA;
					gl_FragColor = vec4(vCol * a * 2.0, a);
				}`,
		});
		this.lamp = buildLamp();
		this.lampUniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
		Object.assign(this.lampUniforms, { uTime: { value: 0 }, uWind: { value: 1 }, uPulse: { value: 0 }, uNotes: { value: this.notes } });
		this.lampMaterial = new THREE.ShaderMaterial({
			uniforms: this.lampUniforms,
			fog: true,
			vertexShader: /* glsl */`
				#include <fog_pars_vertex>
				attribute vec3 color;
				attribute vec2 aInfo;   // phase, tint
				uniform float uTime, uWind, uPulse;
				varying vec3 vCol; varying float vGlow;
				${flareGlsl}
				void main() {
					vec3 p = position;
					// the lamp swings on its cord from the hang point
					float a = (sin(uTime * 1.1 + aInfo.x) * 0.5 + sin(uTime * 2.3 + aInfo.x * 1.7) * 0.2) * 0.14 * uWind;
					p.x += a * -p.y;
					p.z += cos(uTime * 0.9 + aInfo.x * 1.3) * 0.05 * uWind * -p.y;
					vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
					float flick = 0.88 + 0.12 * sin(uTime * 7.0 + aInfo.x) * sin(uTime * 4.3 + aInfo.x * 2.1);
					vGlow = color.r > 0.5 ? (0.9 + 0.6 * uPulse + noteFlare(wp.xz, uTime) * 1.2) * flick : 0.0;
					vCol = color.r > 0.5 ? mix(color, color * vec3(1.0, 0.8, 1.2), aInfo.y) : color;
					vec4 mvPosition = viewMatrix * wp;
					gl_Position = projectionMatrix * mvPosition;
					#include <fog_vertex>
				}`,
			fragmentShader: /* glsl */`
				#include <fog_pars_fragment>
				varying vec3 vCol; varying float vGlow;
				void main() {
					gl_FragColor = vec4(vGlow > 0.0 ? vCol * (0.5 + vGlow) : vCol, 1.0);
					#include <fog_fragment>
				}`,
		});
		this.shrubMaterial = instancedMaterial(new THREE.MeshStandardMaterial({ color: '#0a0716', roughness: 0.95, metalness: 0.05, flatShading: true, side: THREE.DoubleSide }), mk('shrub', 6), 0.8);
		this.crystalMaterial = instancedMaterial(new THREE.MeshBasicMaterial({ color: '#05030c' }), mk('crystal', 1), 0, 'transformed.y *= 1.0 + uPulse * 0.25;');
		this.bladeMaterial = instancedMaterial(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true }), mk('blade', 1), 0.35,
			'float keep = mix(1.0, 0.3, smoothstep(50.0, 320.0, distance(ipos.xz, cameraPosition.xz)));\nvec2 hp = fract(ipos.xz * 0.0731) * 97.0;\nfloat rnd = fract(sin(dot(hp, vec2(12.9898, 78.233))) * 43758.5453);\ntransformed *= 1.0 - smoothstep(keep - 0.12, keep + 0.02, rnd);', (fs) => fs
			.replace('#include <common>', '#include <common>\nuniform float uHue, uPulse;\n' + hslGlsl)
			.replace('#include <color_fragment>', /* glsl */`
				float t = vColor.r;
				vec3 base = vec3(0.02, 0.015, 0.06);
				vec3 tip = hsl2rgb(vec3(uHue, 0.95, 0.55)) * (0.6 + 0.5 * uPulse);
				diffuseColor.rgb = mix(base, tip, pow(t, 1.8));`));
		this.bladeMaterial.onBeforeCompile = ((orig) => (shader) => { orig(shader); shader.uniforms.uHue = this.hueUniform; })(this.bladeMaterial.onBeforeCompile);
		this.hueUniform = { value: 0.8 };
		this.sproutMaterial = instancedMaterial(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true }), mk('sprout', 5), 0.4,
			'if (color.g > 0.15 && color.r < 0.1) transformed.y += sin(uTime * 1.1 + ipos.x) * 0.5 * transformed.x * 0.3;\nif (color.r > 1.0) transformed.y += sin(uTime * 0.9 + ipos.z) * 0.35;',
			(fs) => fs.replace('#include <color_fragment>', '#include <color_fragment>\nif (diffuseColor.r > 1.0) diffuseColor.rgb *= 0.8 + uPulse * 1.5;').replace('#include <common>', '#include <common>\nuniform float uPulse;'));

		// merged line plants (tufts, reeds, crystal edges) share one shader
		this.lineUniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
		Object.assign(this.lineUniforms, { uTime: { value: 0 }, uWind: { value: 1 }, uHue: { value: 0.8 }, uPulse: { value: 0 } });
		this.lineMaterial = new THREE.ShaderMaterial({
			uniforms: this.lineUniforms,
			fog: true,
			vertexShader: /* glsl */`
				#include <fog_pars_vertex>
				attribute vec3 aBase;
				attribute vec4 aInfo;    // height weight, phase, kind (0 tuft, 1 reed, 2 crystal), duration
				attribute float aBorn;
				uniform float uTime, uWind, uPulse;
				varying float vT; varying float vKind;
				float easeOutCubic(float t) { return 1.0 - pow(1.0 - t, 3.0); }
				float easeOutBack(float t) { float c1 = 1.70158, c3 = c1 + 1.0; float u = t - 1.0; return 1.0 + c3 * u * u * u + c1 * u * u; }
				void main() {
					float t = clamp((uTime - aBorn) / aInfo.w, 0.0, 1.0);
					if (aInfo.z < 0.5) {
						// grass is densest around the player and thins toward the horizon
						float keep = mix(1.0, 0.32, smoothstep(50.0, 320.0, distance(aBase.xz, cameraPosition.xz)));
						float rnd = fract(aInfo.y * 0.159155 + aBase.x * 0.013);
						t *= 1.0 - smoothstep(keep - 0.12, keep + 0.02, rnd);
					}
					float ey = aInfo.z > 1.5 ? mix(easeOutCubic(t), easeOutBack(t), 0.5) : easeOutBack(t);
					vec3 p = position;
					float hw = aInfo.x;
					p.y = aBase.y + (p.y - aBase.y) * ey;
					p.xz = aBase.xz + (p.xz - aBase.xz) * (0.6 + 0.4 * easeOutCubic(t));
					float swayAmt = aInfo.z > 1.5 ? 0.0 : (aInfo.z > 0.5 ? 0.9 : 0.45);
					float sway = sin(uTime * 1.3 + aInfo.y) * 0.35 + sin(uTime * 2.7 + aInfo.y * 1.9) * 0.15;
					p.x += sway * hw * hw * uWind * swayAmt;
					p.z += cos(uTime * 0.9 + aInfo.y) * 0.2 * hw * hw * uWind * swayAmt;
					if (aInfo.z > 1.5) p.y += (p.y - aBase.y) * uPulse * 0.25;
					float near = smoothstep(1.5, 5.0, distance(aBase.xz, cameraPosition.xz));
					p = mix(aBase, p, near);
					vT = hw; vKind = aInfo.z;
					vec4 worldPosition = vec4(p, 1.0);
					vec4 mvPosition = viewMatrix * worldPosition;
					gl_Position = projectionMatrix * mvPosition;
					#include <fog_vertex>
				}`,
			fragmentShader: /* glsl */`
				#include <fog_pars_fragment>
				uniform float uHue, uPulse;
				varying float vT; varying float vKind;
				${hslGlsl}
				void main() {
					vec3 tint = hsl2rgb(vec3(uHue, 0.7, 0.75));
					vec3 col;
					if (vKind > 1.5) col = hsl2rgb(vec3(fract(uHue + 0.5), 0.8, 0.65)) * (1.0 + 1.2 * uPulse);
					else if (vKind > 0.5) col = mix(vec3(0.2, 0.25, 0.4), vec3(0.75, 0.9, 1.0), vT) * (0.8 + 1.0 * uPulse);
					else col = mix(vec3(0.25, 0.2, 0.4), mix(tint, vec3(1.0), 0.45), vT) * (0.75 + 0.5 * uPulse);
					gl_FragColor = vec4(col, 1.0);
					#include <fog_fragment>
				}`,
		});
	}

	// ---- placement helpers ----
	// One probe per candidate: the carved height with its scratch fields, and the baked habitat
	// (gen/Habitat.js) that says how good the ground is for trees, how wet it is, how exposed to
	// the sea wind, and how far below the tree line. Every placement rule reads this.
	look(x, z) {
		const hm = this.heightmap, pr = this.pr;
		const y = hm.sample(x, z);
		pr.x = x; pr.z = z; pr.y = y; pr.H = y - hm._water; pr.hSea = y - hm.waterLevel;
		pr.slope = hm._slope; pr.bank = hm._bank; pr.hard = hm._hardness;
		const hb = hm.habitat(x, z);
		pr.forest = hb.forest; pr.wet = hb.wet; pr.coast = hb.coast; pr.alt = hb.alt;
		return pr;
	}

	// which way the wind bends things: inland on the coast, the prevailing wind elsewhere
	downwind(x, z, coast) {
		const w = this._wind || (this._wind = { x: 0, z: 0 });
		if (coast > 0.15) { this.heightmap.inlandDir(x, z, w); if (w.x !== 0 || w.z !== 0) return w; }
		w.x = 0.85; w.z = 0.53; return w;
	}

	// The giants of one vegetation chunk, the same list whether the near chunk or the far layer asks:
	// a coarse jittered grid thinned by forest suitability, broadleaf in the warm lowland, sequoias with
	// altitude and toward the tree line, sized by water and soil, stunted and leaning on the coast.
	giantSpots(cx, cz) {
		const size = config.world.chunkSize, ox = cx * size, oz = cz * size;
		const rnd = new Random(config.seed + ':giants:' + this.key(cx, cz));
		const pr = this.pr, out = [];
		const canopyVariants = [rnd.int(0, this.broadleaves.length - 1), rnd.int(0, this.broadleaves.length - 1)];
		const coniferVariants = [rnd.int(0, this.sequoias.length - 1), rnd.int(0, this.sequoias.length - 1)];
		this.grid(rnd, ox, oz, size, 40, (x, z) => {
			if (Math.hypot(x, z) < 150) return;
			this.look(x, z);
			if (pr.H < 4 || pr.bank > 0.35 || pr.slope > 0.7 || pr.forest < 0.03 || pr.alt < 0.25) return;
			const f = pr.forest;
			// the giants keep to the inland: rare and small near the coast, full size up toward the mountains
			const inland = ss(25, 220, pr.hSea) * (1 - 0.6 * pr.coast);
			if (rnd.next() > (Math.pow(f, 1.6) * 0.5 + 0.02 * ss(0.03, 0.25, f)) * (0.45 + 0.55 * inland)) return;
			// never mirrored: a negative instance scale flips the winding and three corrects that per object, not per instance, so lit sides would swap
			const it = { x, z, y: pr.y, yaw: rnd.range(0, Math.PI * 2), sy: rnd.range(0.95, 1.2), sc: 1, lean: 0, lx: 0, lz: 0, mirror: false, variant: 0, born: -1e6, sub: this.key(cx, cz) };
			// groves: a slow field picks where the colossal old trees stand together; between the groves the
			// forest is younger and half the size, and a rare monarch towers over its grove
			const grove = ss(-0.05, 0.55, this.groveNoise.noise(x / 450 + 11.1, z / 450 - 4.7));
			it.sc = rnd.range(0.8, 1.2) * (0.45 + 0.9 * grove) * (rnd.next() < 0.05 * grove ? 1.5 : 1) * (0.85 + 0.25 * pr.wet) * (0.7 + 0.3 * f) * (0.3 + 0.7 * inland) * (0.7 + 0.3 * pr.alt);
			if (pr.coast > 0.15) { const w = this.downwind(x, z, pr.coast); it.lx = w.x; it.lz = w.z; it.lean = pr.coast * rnd.range(0.08, 0.25); }
			else { const a = rnd.range(0, 6.3); it.lx = Math.cos(a); it.lz = Math.sin(a); it.lean = rnd.range(0, 0.04); }
			const coniferShare = Math.min(0.92, 0.08 + 0.85 * ss(120, 420, pr.hSea) + 0.5 * (1 - ss(0.3, 0.75, pr.alt))) * (1 - 0.25 * pr.wet);
			it.conifer = rnd.next() < coniferShare;
			it.variant = it.conifer ? coniferVariants[rnd.int(0, 1)] : canopyVariants[rnd.int(0, 1)];
			out.push(it);
		});
		return out;
	}

	farKey(fx, fz) { return 'f' + fx + ',' + fz; }

	// The far layer: the giants of a two-by-two block of chunks in their low-detail form, always
	// standing, frustum-culled. Where a near chunk exists its giants are hidden here (zero scale).
	addFarChunk(fkey, fx, fz) {
		if (this.farChunks.has(fkey)) return;
		const items = [];
		for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) items.push(...this.giantSpots(fx * 2 + i, fz * 2 + j));
		const chunk = { meshes: [], groups: [], far: true };
		const rnd = new Random(config.seed + ':far:' + fkey);
		for (const conifer of [false, true]) {
			const geoms = conifer ? this.sequoias : this.broadleaves;
			const buckets = geoms.map(() => []);
			for (const it of items) if (it.conifer === conifer) buckets[it.variant % geoms.length].push(it);
			buckets.forEach((list, v) => {
				if (!list.length) return;
				const before = chunk.meshes.length;
				this.makeInstanced(geoms[v].lo.geometry, this.leafMaterial, 'giant', list, rnd, chunk, (it, p, q, s, r, yAxis) => Vegetation.stand(it, p, q, s, r, yAxis, it.sy));
				chunk.groups[chunk.groups.length - 1].items = list;
				chunk.groups[chunk.groups.length - 1].mesh = chunk.meshes[before];
			});
		}
		for (const mesh of chunk.meshes) this.scene.add(mesh);
		this.farChunks.set(fkey, chunk);
		this.refreshFar(fkey);
	}

	// Lanterns hung from a few branches of every giant (an instanced mesh swinging in the wind, and a
	// halo at each body) and fireflies around its trunk and under its canopy.
	treeLights(items, rnd, chunk) {
		const pos = [], info = [], lamps = [];
		for (const it of items) {
			const geo = (it.conifer ? this.sequoias : this.broadleaves)[it.variant % (it.conifer ? this.sequoias.length : this.broadleaves.length)];
			const cos = Math.cos(it.yaw), sin = Math.sin(it.yaw);
			const world = (h) => [it.x + (h.x * cos + h.z * sin) * it.sc, it.y + h.y * it.sc * it.sy, it.z + (-h.x * sin + h.z * cos) * it.sc];
			// lamps: a few of the hang points, more on the big old trees
			const hang = geo.hi.hang;
			if (hang.length && it.sc > 0.45) {
				const n = Math.min(hang.length, Math.round(rnd.range(3, 8) * it.sc));
				const used = new Set();
				for (let i = 0; i < n; i++) {
					const k = rnd.int(0, hang.length - 1);
					if (used.has(k)) continue;
					used.add(k);
					const [x, y, z] = world(hang[k]);
					const scale = rnd.range(2.0, 3.2), phase = rnd.range(0, 6.3), tint = rnd.next() < 0.3 ? rnd.range(0.4, 1) : 0;
					lamps.push({ x, y, z, scale, phase, tint });
					pos.push(x, y + LAMP_BODY_Y * scale, z);
					info.push(phase, scale, 1, tint);
				}
			}
			// fireflies: low around the trunk and up under the canopy
			const tr = geo.hi.trunkRadius * it.sc;
			for (let i = 0, m = rnd.int(4, 8); i < m; i++) {
				const a = rnd.range(0, 6.3), rr = tr + rnd.range(2, 30);
				pos.push(it.x + Math.cos(a) * rr, it.y + rnd.range(3, 40), it.z + Math.sin(a) * rr);
				info.push(rnd.range(0, 6.3), rnd.range(0.6, 1.1), 0, rnd.next());
			}
		}
		if (pos.length) {
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
			g.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 4));
			const points = new THREE.Points(g, this.lightMaterial);
			points.frustumCulled = false;
			chunk.meshes.push(points);
		}
		if (lamps.length) {
			const geom = this.lamp.clone();
			const mesh = new THREE.InstancedMesh(geom, this.lampMaterial, lamps.length);
			const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
			const ai = new Float32Array(lamps.length * 2);
			lamps.forEach((l, i) => {
				p.set(l.x, l.y, l.z); q.setFromAxisAngle(yAxis, rnd.range(0, 6.3)); s.set(l.scale, l.scale, l.scale);
				mesh.setMatrixAt(i, m.compose(p, q, s));
				ai[i * 2] = l.phase; ai[i * 2 + 1] = l.tint;
			});
			geom.setAttribute('aInfo', new THREE.InstancedBufferAttribute(ai, 2));
			mesh.frustumCulled = false;
			chunk.meshes.push(mesh);
		}
	}

	// a note sounded here: the tree lights around it flare
	noteAt(x, z, strength = 1) {
		const o = this.noteCursor * 4;
		this.notes[o] = x; this.notes[o + 1] = z; this.notes[o + 2] = this.time; this.notes[o + 3] = strength;
		this.noteCursor = (this.noteCursor + 1) % 8;
	}

	removeFarChunk(fkey) {
		const chunk = this.farChunks.get(fkey);
		if (!chunk) return;
		for (const mesh of chunk.meshes) { this.scene.remove(mesh); mesh.geometry.dispose(); if (mesh.dispose) mesh.dispose(); }
		this.farChunks.delete(fkey);
	}

	// hide or show the far copies of a block's giants according to which near chunks exist
	refreshFar(fkey) {
		const chunk = this.farChunks.get(fkey);
		if (!chunk) return;
		const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0), zero = new THREE.Matrix4().makeScale(0, 0, 0);
		for (const g of chunk.groups) {
			if (!g.items) continue;
			g.items.forEach((it, i) => {
				if (this.chunks.has(it.sub)) g.mesh.setMatrixAt(i, zero);
				else { Vegetation.stand(it, p, q, s, null, yAxis, it.sy); g.mesh.setMatrixAt(i, m.compose(p, q, s)); }
			});
			g.mesh.instanceMatrix.needsUpdate = true;
		}
	}

	// random candidates, kept when `test` says so (test may read the heightmap scratch fields)
	spots(rnd, ox, oz, size, count, test) {
		const out = [];
		for (let i = 0; i < count * 3 && out.length < count; i++) {
			const x = ox + rnd.range(-size / 2, size / 2), z = oz + rnd.range(-size / 2, size / 2);
			if (Math.hypot(x, z) < 14) continue;
			if (test(x, z)) out.push({ x, z });
		}
		return out;
	}

	// a jittered grid of candidates, one per `spacing` metres: even coverage, no two on top of each other
	grid(rnd, ox, oz, size, spacing, fn) {
		const n = Math.max(1, Math.round(size / spacing)), sp = size / n;
		for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
			const x = ox - size / 2 + (i + rnd.next()) * sp, z = oz - size / 2 + (j + rnd.next()) * sp;
			if (Math.hypot(x, z) < 14) continue;
			fn(x, z);
		}
	}

	makeInstanced(geometry, material, kind, items, rnd, chunk, place) {
		if (!items.length) return;
		const geom = geometry.clone();
		const mesh = new THREE.InstancedMesh(geom, material, items.length);
		const born = new Float32Array(items.length);
		const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
		const pos = [];
		items.forEach((it, i) => {
			place(it, p, q, s, rnd, yAxis);
			mesh.setMatrixAt(i, m.compose(p, q, s));
			born[i] = it.born !== undefined ? it.born : (rnd.next() < KINDS[kind].preborn ? this.time + rnd.range(0, 0.8) : UNBORN);
			pos.push(it.x, it.z);
		});
		geom.setAttribute('aBorn', new THREE.InstancedBufferAttribute(born, 1));
		mesh.frustumCulled = false;
		if (kind === 'giant') { mesh.computeBoundingSphere(); mesh.frustumCulled = true; }
		chunk.meshes.push(mesh);
		chunk.groups.push({ kind: KINDS[kind], attr: geom.getAttribute('aBorn'), pos, ranges: null, count: items.length, pending: items.length });
	}

	// one instanced mesh per geometry variant, so a stand mixes silhouettes
	makeVariants(geometries, material, kind, items, rnd, chunk, place) {
		const buckets = geometries.map(() => []);
		for (const it of items) buckets[it.variant % geometries.length].push(it);
		buckets.forEach((list, v) => this.makeInstanced(geometries[v], material, kind, list, rnd, chunk, place));
	}

	// a standing plant: on the ground, turned, mirrored half the time, tipped by `lean` toward (lx, lz)
	static stand(it, p, q, s, r, yAxis, sy = 1) {   // r unused here; kept for the place() signature
		p.set(it.x, it.y, it.z);
		q.setFromAxisAngle(yAxis, it.yaw);
		if (it.lean) { const axis = new THREE.Vector3(it.lz, 0, -it.lx); q.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, it.lean)); }
		s.set(it.sc * (it.mirror ? -1 : 1), it.sc * sy, it.sc);
	}

	key(cx, cz) { return cx + ',' + cz; }

	addChunk(key, cx, cz) {
		if (Math.abs(cx - this.centerX) > this.radius || Math.abs(cz - this.centerZ) > this.radius) return;
		if (this.chunks.has(key)) return;
		const size = config.world.chunkSize;
		const ox = cx * size, oz = cz * size;
		const rnd = new Random(config.seed + ':veg:' + key);
		const hm = this.heightmap;
		const chunk = { meshes: [], groups: [] };

		const pr = this.pr, look = (x, z) => this.look(x, z), downwind = (x, z, coast) => this.downwind(x, z, coast);

		// ---- the giants of this chunk, full detail, solid ----
		chunk.colliders = [];
		{
			const giants = this.giantSpots(cx, cz);
			for (const conifer of [false, true]) {
				const geoms = conifer ? this.sequoias : this.broadleaves;
				const buckets = geoms.map(() => []);
				for (const it of giants) if (it.conifer === conifer) buckets[it.variant % geoms.length].push(it);
				buckets.forEach((list, v) => this.makeInstanced(geoms[v].hi.geometry, this.leafMaterial, 'giant', list, rnd, chunk, (it, p, q, s, r, yAxis) => {
					Vegetation.stand(it, p, q, s, r, yAxis, it.sy);
					const c = { position: new THREE.Vector3(it.x, it.y, it.z), radius: geoms[v].hi.trunkRadius * it.sc * 1.05 };
					chunk.colliders.push(c); this.shared.colliders.push(c);
				}));
			}
			this.treeLights(giants, rnd, chunk);
		}

		// ---- the smaller trees: bare silhouettes in the open ground and along the edges, dead giants
		// as snags in the old forest, krummholz streaming downwind in the belt below the tree line ----
		const bare = [], krumm = [], snags = [];
		const pick2 = (arr) => [rnd.int(0, arr.length - 1), rnd.int(0, arr.length - 1)];
		const bareVariants = pick2(this.bareTrees);
		const krummVariant = rnd.int(0, this.krummholz.length - 1);
		this.grid(rnd, ox, oz, size, 16, (x, z) => {
			if (Math.hypot(x, z) < 60) return;
			look(x, z);
			if (pr.H < 3.5 || pr.bank > 0.35 || pr.slope > 0.8 || pr.forest < 0.015) return;
			const f = pr.forest;
			const p = Math.pow(f, 1.6) * 0.42 + 0.018 * ss(0.03, 0.25, f);
			if (rnd.next() > p) return;
			const it = { x, z, y: pr.y, yaw: rnd.range(0, Math.PI * 2), sc: 1, lean: 0, lx: 0, lz: 0, mirror: rnd.next() < 0.5, variant: 0 };
			it.sc = rnd.range(0.7, 1.25) * (0.8 + 0.3 * pr.wet) * (0.65 + 0.35 * f) * (1 - 0.3 * pr.coast) * (0.6 + 0.4 * pr.alt);
			if (rnd.next() < 1 - ss(0.1, 0.5, pr.alt)) {
				const w = downwind(x, z, pr.coast);
				it.yaw = Math.atan2(-w.z, w.x) + rnd.range(-0.45, 0.45);   // the geometry leans along +x
				it.variant = krummVariant + rnd.int(0, 1);
				it.sc *= rnd.range(0.9, 1.4);
				krumm.push(it);
				return;
			}
			if (pr.coast > 0.15) { const w = downwind(x, z, pr.coast); it.lx = w.x; it.lz = w.z; it.lean = pr.coast * rnd.range(0.12, 0.35); }
			else { const a = rnd.range(0, 6.3); it.lx = Math.cos(a); it.lz = Math.sin(a); it.lean = rnd.range(0, 0.05); }
			if (f > 0.6 && rnd.next() < 0.03) { it.variant = rnd.int(0, 1); it.sc *= 4; snags.push(it); return; }
			const bareShare = Math.max(f < 0.35 ? 0.4 : 0.06, 0.25 * (1 - ss(25, 220, pr.hSea)));
			if (rnd.next() < bareShare) { it.variant = bareVariants[rnd.int(0, 1)]; it.sc *= 1.6; bare.push(it); }
		});
		const placeTree = (it, p, q, s, r, yAxis) => Vegetation.stand(it, p, q, s, r, yAxis, r.range(1.0, 1.4));
		this.makeVariants(this.bareTrees, this.treeMaterial, 'tree', bare, rnd, chunk, placeTree);
		this.makeVariants(this.krummholz, this.treeMaterial, 'tree', krumm, rnd, chunk, (it, p, q, s, r, yAxis) => Vegetation.stand(it, p, q, s, r, yAxis, r.range(0.8, 1.1)));
		this.makeVariants(this.snags, this.treeMaterial, 'tree', snags, rnd, chunk, (it, p, q, s, r, yAxis) => Vegetation.stand(it, p, q, s, r, yAxis, r.range(0.7, 1.2)));

		// ---- shrubs: dwarf scrub in the belt below the tree line and on the open ground above it ----
		const shrubs = [];
		const shrubVariants = pick2(this.shrubs);
		this.grid(rnd, ox, oz, size, 8, (x, z) => {
			look(x, z);
			if (pr.H < 3 || pr.bank > 0.35 || pr.slope > 0.85 || pr.hSea > 950 || pr.alt > 0.6) return;
			const p = 0.3 * (1 - ss(0.05, 0.6, pr.alt)) * (1 - 0.5 * pr.hard) * (0.5 + 0.5 * (1 - pr.forest));
			if (rnd.next() > p) return;
			const w = downwind(x, z, pr.coast);
			shrubs.push({ x, z, y: pr.y, yaw: rnd.range(0, 6.3), sc: rnd.range(0.6, 1.3) * (0.75 + 0.3 * pr.wet), lean: rnd.range(0.05, 0.3), lx: w.x, lz: w.z, mirror: rnd.next() < 0.5, variant: shrubVariants[rnd.int(0, 1)] });
		});
		this.makeVariants(this.shrubs, this.shrubMaterial, 'shrub', shrubs, rnd, chunk, (it, p, q, s, r, yAxis) => Vegetation.stand(it, p, q, s, r, yAxis, r.range(0.8, 1.2)));

		// ---- fallen trunks in the old forest ----
		const fallen = [];
		this.grid(rnd, ox, oz, size, 64, (x, z) => {
			look(x, z);
			if (pr.H < 3.5 || pr.bank > 0.3 || pr.slope > 0.45 || pr.forest < 0.5 || rnd.next() > 0.3 * pr.forest) return;
			fallen.push({ x, z, y: pr.y, len: rnd.range(50, 110), r: rnd.range(2.5, 4.5), yaw: rnd.range(0, 6.3) });
		});

		// ---- grass: solid blades seen from afar, thinning under the trees, lusher in the wet, sparse on hard ground ----
		const grassP = (top) => (x, z) => {
			look(x, z);
			if (pr.H < 3.5 || pr.hSea > top || pr.bank > 0.35 || pr.slope > 0.9) return false;
			const g = (1 - 0.6 * pr.forest) * (0.45 + 0.55 * pr.wet) * (1 - 0.45 * pr.hard) * (0.35 + 0.65 * (1 - ss(top - 250, top, pr.hSea)));
			return rnd.next() < g;
		};
		const bladeSpots = this.spots(rnd, ox, oz, size, 520, grassP(640));
		this.makeInstanced(this.blade, this.bladeMaterial, 'blade', bladeSpots, rnd, chunk, (it, p, q, s, r, yAxis) => { p.set(it.x, hm.height(it.x, it.z) - 0.3, it.z); q.setFromAxisAngle(yAxis, r.range(0, 6.3)); s.set(r.range(0.8, 1.4), r.range(2.5, 6.5), 1); });

		// glowing sprouts, rare, in the wet lowland
		const lowland = hm.height(ox, oz) - hm.waterLevel < 80;
		if (rnd.chance(lowland ? 0.7 : 0.2)) {
			const sproutSpots = this.spots(rnd, ox, oz, size, rnd.int(2, 7), (x, z) => { look(x, z); return pr.H > 2 && pr.hSea < 25 && pr.bank < 0.35 && pr.slope < 0.5 && rnd.next() < 0.3 + 0.7 * pr.wet; });
			this.makeInstanced(this.sprout, this.sproutMaterial, 'sprout', sproutSpots, rnd, chunk, (it, p, q, s, r, yAxis) => { const sc = r.range(0.7, 1.6); p.set(it.x, hm.height(it.x, it.z) - 0.2, it.z); q.setFromAxisAngle(yAxis, r.range(0, 6.3)); s.set(sc, sc, sc); });
		}

		// crystal columns: clusters of hex prisms on the dry, hard, high ground
		const crystals = [];
		const chunkH = hm.height(ox, oz) - hm.waterLevel;
		const highland = chunkH > 450;
		if (rnd.chance(highland ? 0.85 : (lowland ? 0.15 : 0.4))) {
			const clusters = this.spots(rnd, ox, oz, size, rnd.int(1, highland ? 3 : 2), (x, z) => { look(x, z); return pr.H > 3 && pr.bank < 0.35 && pr.slope < 0.4 && pr.wet < 0.55 && pr.forest < 0.3; });
			for (const { x: cx2, z: cz2 } of clusters) {
				const n = rnd.int(3, 7);
				for (let i = 0; i < n; i++) {
					const x = cx2 + rnd.range(-9, 9), z = cz2 + rnd.range(-9, 9);
					if (!hm.isLand(x, z, 2)) continue;
					crystals.push({ x, z, y: hm.height(x, z) - 0.5, r: rnd.range(1.2, 2.6), h: rnd.range(5, 22), rot: rnd.range(0, 6.3) });
				}
			}
		}
		if (crystals.length) {
			this.makeInstanced(this.crystalSolid, this.crystalMaterial, 'crystal', crystals, rnd, chunk, (c, p, q, s, r, yAxis) => { p.set(c.x, c.y, c.z); q.setFromAxisAngle(yAxis, c.rot); s.set(c.r, c.h, c.r); });
		}

		// merged lines: tufts, reeds by the water, crystal edges
		const verts = [], bases = [], infos = [], ranges = [], pos = [], kinds = [];
		const pushLines = (arr, x, y, z, rot, sx, sy, sz, dx, dz, h, phase, kind, dur) => {
			for (let k = 0; k < arr.length; k += 3) {
				const lx = arr[k] * sx, ly = arr[k + 1] * sy, lz = arr[k + 2] * sz;
				const rx = lx * Math.cos(rot) - lz * Math.sin(rot), rz = lx * Math.sin(rot) + lz * Math.cos(rot);
				verts.push(x + dx + rx, y + ly, z + dz + rz);
				bases.push(x, y, z);
				infos.push(ly / h, phase, kind, dur);
			}
		};
		const beginPlant = (x, z, kind) => { ranges.push([verts.length / 3, 0]); pos.push(x, z); kinds.push(kind); };
		const endPlant = () => { ranges[ranges.length - 1][1] = verts.length / 3; };

		// boulders: scree on steep ground and under cliffs, outcrops on hard rock, stones in the rapids
		{
			const rocks = [];
			for (const { x, z } of this.spots(rnd, ox, oz, size, 70, (x, z) => {
				const h = hm.sample(x, z);
				if (h < hm._water + 0.5 || hm._bank > 0.3) return false;
				const s = hm._slope;
				return s > 0.35 && rnd.next() < (s - 0.3) * (0.4 + hm._hardness);
			})) rocks.push({ x, z, r: rnd.range(0.8, 3.0) * (1 + 1.6 * Math.pow(rnd.next(), 3)), sink: 0.35 });
			if (rnd.chance(0.55)) {
				for (const { x, z } of this.spots(rnd, ox, oz, size, rnd.int(1, 3), (x, z) => { const h = hm.sample(x, z); return h > hm._water + 3 && hm._hardness > 0.6 && hm._slope > 0.15 && hm._slope < 1.3 && hm._bank < 0.2; }))
					rocks.push({ x, z, r: rnd.range(4.5, 11), sink: 0.4 });
			}
			// river rocks are world data: the stones the water pours over, boulders in the chutes and
			// pools, the outcrops that turned the river. Driftwood is stranded on the calm banks.
			const logs = [];
			{
				const x0 = ox - size / 2, x1 = ox + size / 2, z0 = oz - size / 2, z1 = oz + size / 2;
				for (const r of hm.world.rivers) {
					const rk = r.rocks;
					for (let q = 0; q < rk.length; q += ROCK_STRIDE) {
						const x = rk[q], z = rk[q + 1];
						if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
						rocks.push({ x, z, y: rk[q + 2], r: rk[q + 3], sink: 0.35, kind: rk[q + 4] });
					}
				}
				for (const sIdx of hm.rivers.segmentsIn(x0, z0, x1, z1)) {
					const a = hm.rivers.at(sIdx, 0);
					if (a.x < x0 || a.x >= x1 || a.z < z0 || a.z >= z1) continue;
					if (a.kind !== SEG_KIND.FLOW || a.foam > 0.2 || rnd.next() > 0.05) continue;
					const len = Math.hypot(a.dx, a.dz) || 1, tx = a.dx / len, tz = a.dz / len;
					const side = rnd.next() < 0.5 ? -1 : 1;
					const off = a.w * 0.5 + rnd.range(2, 6);
					logs.push({ x: a.x + -tz * off * side, z: a.z + tx * off * side, len: rnd.range(6, 14), r: rnd.range(0.3, 0.6), yaw: Math.atan2(tx, tz) + rnd.range(-0.6, 0.6) });
				}
			}
			for (const f of fallen) logs.push(f);
			if (logs.length) {
				this.makeInstanced(this.log, this.rockMaterial, 'rock', logs, rnd, chunk, (log, p, q, s, r, yAxis) => {
					p.set(log.x, hm.height(log.x, log.z) + log.r * 0.6, log.z);
					q.setFromEuler(new THREE.Euler(r.range(-0.15, 0.15), log.yaw + Math.PI / 2, r.range(-0.1, 0.1)));
					s.set(log.len, log.r, log.r);
				});
			}
			// beach cobbles and lakeside stones, sparse
			for (const { x, z } of this.spots(rnd, ox, oz, size, 8, (x, z) => { const h = hm.sample(x, z) - hm._water; return h > 0.2 && h < 2.5 && hm._slope < 0.4 && hm._hardness > 0.45; })) rocks.push({ x, z, r: rnd.range(0.7, 1.8), sink: 0.4 });
			const byVariant = [[], [], [], []];
			for (const r of rocks) byVariant[rnd.int(0, 3)].push(r);
			byVariant.forEach((list, v) => {
				if (!list.length) return;
				this.makeInstanced(this.boulders[v], this.rockMaterial, 'rock', list, rnd, chunk, (rock, p, q, s, r, yAxis) => {
					// river rocks sit at the height the generator gave them (partly out of the water); the rest rest on the ground
					const y = rock.y !== undefined && !Number.isNaN(rock.y) ? rock.y : hm.height(rock.x, rock.z) - rock.r * rock.sink;
					p.set(rock.x, y, rock.z);
					q.setFromEuler(new THREE.Euler(r.range(-0.4, 0.4), r.range(0, 6.3), r.range(-0.4, 0.4)));
					s.set(rock.r * r.range(0.8, 1.25), rock.r * r.range(0.7, 1.1), rock.r * r.range(0.8, 1.25));
					if (rock.kind === 4) s.y *= 0.5;
					if (rock.r >= 3.5) { const c = { position: new THREE.Vector3(rock.x, y, rock.z), radius: rock.r * 0.9 }; chunk.colliders.push(c); this.shared.colliders.push(c); }
				});
			});
		}

		// wireframe tufts: the near grass, up into the alpine meadows
		for (const { x, z } of this.spots(rnd, ox, oz, size, 600, grassP(950))) {
			const y = hm.height(x, z) - 0.2, h = rnd.range(2.5, 6.5) * (0.8 + 0.4 * hm.habitat(x, z).wet), rot = rnd.range(0, 6.3), phase = rnd.range(0, 6.3);
			beginPlant(x, z, 'tuft');
			for (const [dx, dz, sh] of [[0, 0, h], [rnd.range(-2.5, 2.5), rnd.range(-2.5, 2.5), h * 0.5], [rnd.range(-2.5, 2.5), rnd.range(-2.5, 2.5), h * 0.55]])
				pushLines(this.tuftEdges, x, y, z, rot, 1, sh, 1, dx, dz, h, phase, 0, KINDS.tuft.dur);
			endPlant();
		}
		// reeds: at the waterline of the sea, the lakes and the rivers, and across the marshy flats
		// (delta backswamps, wet floodplains) a little above it
		const reedP = (x, z) => {
			look(x, z);
			if (pr.slope > 0.6 || hm._riverSeg >= 0) return false;
			if (pr.H > -0.5 && pr.H < 3.5) return true;
			return pr.wet > 0.8 && pr.H < 5 && pr.slope < 0.3 && rnd.next() < 0.6;
		};
		for (const { x, z } of this.spots(rnd, ox, oz, size, 130, reedP)) {
			const y = hm.height(x, z) - 0.2, h = rnd.range(7, 14), phase = rnd.range(0, 6.3);
			beginPlant(x, z, 'reed');
			for (let k = 0; k < rnd.int(2, 5); k++) {
				const dx = rnd.range(-1.8, 1.8), dz = rnd.range(-1.8, 1.8), lean = rnd.range(-0.15, 0.15), rh = h * rnd.range(0.7, 1);
				const segs = [[0, 0, 0], [lean * rh * 0.4, rh * 0.45, 0], [lean * rh * 0.4, rh * 0.45, 0], [lean * rh, rh, 0], [lean * rh, rh, 0], [lean * rh + 0.5, rh + 0.8, 0.3]];
				pushLines(segs.flat(), x, y, z, rnd.range(0, 6.3), 1, 1, 1, dx, dz, h, phase, 1, KINDS.reed.dur);
			}
			endPlant();
		}
		for (const c of crystals) {
			beginPlant(c.x, c.z, 'crystal');
			pushLines(this.crystalEdges, c.x, c.y, c.z, c.rot, c.r, c.h, c.r, 0, 0, c.h, 0, 2, KINDS.crystal.dur);
			endPlant();
		}
		if (verts.length) {
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
			geometry.setAttribute('aBase', new THREE.Float32BufferAttribute(bases, 3));
			geometry.setAttribute('aInfo', new THREE.Float32BufferAttribute(infos, 4));
			const born = new Float32Array(verts.length / 3);
			ranges.forEach(([s, e], i) => { const b = rnd.next() < KINDS[kinds[i]].preborn ? this.time + rnd.range(0, 0.8) : UNBORN; for (let k = s; k < e; k++) born[k] = b; });
			geometry.setAttribute('aBorn', new THREE.BufferAttribute(born, 1));
			const lines = new THREE.LineSegments(geometry, this.lineMaterial);
			lines.frustumCulled = false;
			chunk.meshes.push(lines);
			chunk.groups.push({ kind: null, kinds: kinds.map((k) => KINDS[k]), attr: geometry.getAttribute('aBorn'), pos, ranges, count: ranges.length, pending: ranges.length });
		}

		this.riverEcology.build(hm, chunk, cx, cz, size, config.seed);
		this.watersideMeshes.build(hm, chunk, cx, cz, size, config.seed);
		for (const mesh of chunk.meshes) this.scene.add(mesh);
		this.chunks.set(key, chunk);
		this.refreshFar(this.farKey(Math.floor(cx / 2), Math.floor(cz / 2)));
	}

	removeChunk(key) {
		const chunk = this.chunks.get(key);
		if (!chunk) return;
		for (const mesh of chunk.meshes) { this.scene.remove(mesh); mesh.geometry.dispose(); if (mesh.dispose) mesh.dispose(); }
		if (chunk.colliders && chunk.colliders.length) { const drop = new Set(chunk.colliders); this.shared.colliders = this.shared.colliders.filter((c) => !drop.has(c)); }
		this.chunks.delete(key);
		const [cx, cz] = key.split(',').map(Number);
		this.refreshFar(this.farKey(Math.floor(cx / 2), Math.floor(cz / 2)));
	}

	// Plants grow out of the ground as the player approaches.
	reveal(chunk, px, pz) {
		const t = this.time;
		for (const g of chunk.groups) {
			if (g.pending <= 0) continue;
			const a = g.attr.array;
			let changed = false;
			for (let i = 0; i < g.count; i++) {
				const s = g.ranges ? g.ranges[i][0] : i;
				if (a[s] !== UNBORN) continue;
				const kind = g.kind || g.kinds[i];
				const dx = g.pos[i * 2] - px, dz = g.pos[i * 2 + 1] - pz;
				if (dx * dx + dz * dz < kind.reveal * kind.reveal) {
					const born = t + Math.random() * 0.4;
					if (g.ranges) { const [s0, e] = g.ranges[i]; for (let k = s0; k < e; k++) a[k] = born; } else a[i] = born;
					g.pending--; changed = true;
				}
			}
			if (changed) g.attr.needsUpdate = true;
		}
	}

	update(dt, cx, cz) {
		this.time += dt;
		this.centerX = cx;
		this.centerZ = cz;
		const a = this.shared.audio ? this.shared.audio.analysis : null;
		const pulse = a ? a.attack : 0;
		const wind = 0.7 + this.shared.state.snow * 1.2 + this.shared.state.hum * 0.5;
		for (const u of this.uniformSets) { u.uTime.value = this.time; u.uWind.value = wind; u.uPulse.value = pulse; }
		this.lineUniforms.uTime.value = this.time;
		this.lineUniforms.uWind.value = wind;
		this.lineUniforms.uPulse.value = pulse;
		this.lineUniforms.uHue.value = this.shared.hue;
		this.hueUniform.value = this.shared.hue;
		const bass = a ? a.bass : 0;
		this.leafUniforms.uHue.value = this.shared.hue;
		this.leafUniforms.uBass.value = bass;
		const lu = this.lightMaterial.uniforms;
		lu.uTime.value = this.time; lu.uPulse.value = pulse; lu.uBass.value = bass;
		lu.uNight.value = this.shared.night === undefined ? 1 : this.shared.night;
		if (this.shared.renderer) lu.uPixelRatio.value = this.shared.renderer.getPixelRatio();
		this.lampUniforms.uTime.value = this.time; this.lampUniforms.uWind.value = wind; this.lampUniforms.uPulse.value = pulse;

		const player = this.shared.player ? this.shared.player.position : null;
		for (const [key, chunk] of this.chunks) {
			const [x, z] = key.split(',').map(Number);
			if (Math.abs(x - cx) > this.radius || Math.abs(z - cz) > this.radius) { this.removeChunk(key); continue; }
			if (player && Math.abs(x - cx) <= 2 && Math.abs(z - cz) <= 2) this.reveal(chunk, player.x, player.z);
		}
		const fcx = Math.floor(cx / 2), fcz = Math.floor(cz / 2);
		for (const key of this.farChunks.keys()) {
			const [x, z] = key.slice(1).split(',').map(Number);
			if (Math.abs(x - fcx) > this.farRadius || Math.abs(z - fcz) > this.farRadius) this.removeFarChunk(key);
		}
	}
}
