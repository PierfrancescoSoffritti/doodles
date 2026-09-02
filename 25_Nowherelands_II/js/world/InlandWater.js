import * as THREE from 'three';
import { createWaterUniforms, waterVertexShader, waterFragmentShader, updateWaterUniforms } from './WaterShader.js';
import { RIVER_STRIDE, RV, RIVER_KIND, WAKE_STRIDE, surfaceHalfWidth } from './gen/Rivers.js';

// Lakes and rivers: flat lake sheets at each lake's own level, and river ribbons that follow the
// water surface sample by sample: sloping runs, short steep riffle ramps, and gaps where a
// waterfall (its own mesh) takes over. Both share one non-reflective water material.
//
// River vertices carry their position in river space (metres along the channel, signed metres
// across it) so the shader can texture the flow without smearing, and the three nearest rocks
// that break the surface so it can draw their wakes.
//
// Two meshes draw the rivers. A static one covers the whole continent with one quad per sample.
// A near mesh, rebuilt as the player moves, covers the reaches within NEAR_RADIUS with quads a
// few metres on a side; its vertices are lifted by waves in the vertex shader, so close up the
// water has a faceted, moving surface with real silhouettes against the banks. The static mesh
// discards its fragments inside the near radius so the two never fight.

export const NEAR_RADIUS = 260;        // where the static ribbon gives way to the waved one
const NEAR_BUILD = 340;                // reaches gathered for the near mesh
const NEAR_REBUILD = 40;               // rebuild after moving this far
const NEAR_ACROSS = 6, NEAR_ALONG = 2; // subdivisions per sample quad

export class InlandWater {
	constructor(scene, heightmap, shared) {
		this.scene = scene;
		this.heightmap = heightmap;
		const world = heightmap.world;
		this.world = world;
		const uniforms = createWaterUniforms(shared, heightmap.waterLevel);
		uniforms.uNearRadius = { value: NEAR_RADIUS };
		this.uniforms = uniforms;
		this.material = new THREE.ShaderMaterial({
			uniforms,
			vertexShader: waterVertexShader,
			fragmentShader: waterFragmentShader(shared),
			defines: { FLOW: '', NEAR_CULL: '' },
		});
		this.nearMaterial = new THREE.ShaderMaterial({
			uniforms,
			vertexShader: waterVertexShader,
			fragmentShader: waterFragmentShader(shared),
			defines: { FLOW: '', WAVES: '' },
			transparent: true,
		});

		// the cross-sections of every river, computed once
		this.sections = world.rivers.map((r) => this.riverSections(r));

		const b = new Builder();
		this.buildLakes(b, heightmap);
		for (let ri = 0; ri < world.rivers.length; ri++) this.buildRiver(b, ri, null, 1, 1);
		this.mesh = new THREE.Mesh(b.geometry(), this.material);
		this.mesh.frustumCulled = false;
		scene.add(this.mesh);
		this.triangles = b.idx.length / 3;

		this.near = null;
		this.nearCentre = new THREE.Vector2(1e9, 1e9);
	}

	// ---------- lakes ----------
	buildLakes(b, heightmap) {
		const world = this.world;
		const N = world.res, cell = world.cell, half = cell / 2;
		const wx = (i) => -world.size / 2 + i * cell - heightmap.ox;
		const wz = (j) => -world.size / 2 + j * cell - heightmap.oz;
		for (const lake of world.lakes) {
			let i0 = N, i1 = 0, j0 = N, j1 = 0;
			for (const k of lake.cells) { const i = k % N, j = (k / N) | 0; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
			i0 = Math.max(i0 - 1, 0); j0 = Math.max(j0 - 1, 0); i1 = Math.min(i1 + 1, N - 1); j1 = Math.min(j1 + 1, N - 1);
			const W = (i1 - i0 + 1) * 2, H = (j1 - j0 + 1) * 2;
			const mask = new Uint8Array(W * H);
			for (const k of lake.cells) {
				const i = (k % N) - i0, j = ((k / N) | 0) - j0;
				for (let sj = 2 * j - 1; sj <= 2 * j + 2; sj++) for (let si = 2 * i - 1; si <= 2 * i + 2; si++) {
					if (si < 0 || sj < 0 || si >= W || sj >= H) continue;
					mask[sj * W + si] = 1;
				}
			}
			const y = lake.level;
			for (let sj = 0; sj < H; sj++) for (let si = 0; si < W; si++) {
				if (!mask[sj * W + si]) continue;
				const x0 = wx(i0) - half + si * half, z0 = wz(j0) - half + sj * half;
				const a = b.still(x0, y, z0), c = b.still(x0, y, z0 + half), d = b.still(x0 + half, y, z0 + half), e = b.still(x0 + half, y, z0);
				b.idx.push(a, c, e, e, c, d);
			}
		}
	}

	// ---------- rivers ----------
	// a cross-section of the surface at every sample: centre, normal, half width and the fields
	riverSections(r) {
		const S = RIVER_STRIDE, d = r.data, count = r.count;
		const out = [];
		for (let i = 0; i < count; i++) {
			const o = i * S;
			const x = d[o + RV.X], z = d[o + RV.Z], wl = d[o + RV.WL] - 0.08, w = d[o + RV.W], dep = d[o + RV.D], foam = d[o + RV.FOAM], bank = d[o + RV.BANK], speed = d[o + RV.SPEED], along = d[o + RV.ALONG], kind = d[o + RV.KIND], fd = d[o + RV.FADE];
			// tangent: forward at a pool start, backward at a lip, centred elsewhere
			const ia = kind === RIVER_KIND.POOL ? i : Math.max(0, i - 1), ib = kind === RIVER_KIND.LIP ? i : Math.min(count - 1, i + 1);
			let tx = d[ib * S + RV.X] - d[ia * S + RV.X], tz = d[ib * S + RV.Z] - d[ia * S + RV.Z];
			const len = Math.hypot(tx, tz) || 1;
			tx /= len; tz /= len;
			// the surface runs just under the bank, to where the ground stands clear of it
			const hw = surfaceHalfWidth(w, dep, bank);
			let stepH = 0, stepBase = 0, skew = 0;
			if (kind === RIVER_KIND.STEP_TOP && i < count - 1) { stepH = d[o + RV.WL] - d[o + S + RV.WL]; stepBase = d[o + S + RV.WL] - 0.08; }
			else if (kind === RIVER_KIND.STEP_BOTTOM && i > 0) { stepH = d[o - S + RV.WL] - d[o + RV.WL]; stepBase = d[o + RV.WL] - 0.08; }
			// a riffle's lip runs askew across the channel rather than straight, so the steps do not read as stairs
			if (stepH > 0) { const seedI = kind === RIVER_KIND.STEP_TOP ? i : i - 1; skew = (Math.sin(seedI * 12.9898 + along * 0.017) * 0.5) * Math.min(w * 0.12, 1.4); }
			out.push({ x, z, y: wl, tx, tz, nx: -tz, nz: tx, hw, skew, acr: hw / (w * 0.5), foam, dep, w, along, speed, stepH, stepBase, kind, fd });
		}
		return out;
	}

	// the rocks whose wakes may cross the quad between two samples, nearest first
	wakesFor(r, alongA, alongB) {
		const wakes = r.wakes, nWakes = wakes.length / WAKE_STRIDE;
		const picks = [];
		for (let k = 0; k < nWakes; k++) {
			const a = wakes[k * WAKE_STRIDE], rad = wakes[k * WAKE_STRIDE + 2];
			if (a > alongB + rad * 1.6 || a < alongA - rad * 10) continue;
			picks.push([Math.abs(a - alongB), k]);
		}
		picks.sort((p, q) => p[0] - q[0]);
		const out = [NO_WAKE, NO_WAKE, NO_WAKE];
		for (let k = 0; k < Math.min(3, picks.length); k++) { const o = picks[k][1] * WAKE_STRIDE; out[k] = [wakes[o], wakes[o + 1], wakes[o + 2]]; }
		return out;
	}

	// Quads between consecutive samples of one river, subdivided `subAlong` times along the flow
	// and `subAcross` times across it. `keep(i)` selects the sample pairs (i, i+1) to build.
	buildRiver(b, ri, keep, subAlong, subAcross) {
		const r = this.world.rivers[ri], secs = this.sections[ri];
		const count = r.count;
		for (let i = 0; i < count - 1; i++) {
			const a = secs[i], c = secs[i + 1];
			if (a.kind === RIVER_KIND.LIP) continue;                    // the fall covers the gap
			if (keep && !keep(i)) continue;
			const wk = this.wakesFor(r, a.along, c.along);
			// a riffle ramp is exactly one quad: the step height belongs to the quad, never interpolated into its neighbours
			const stepH = a.kind === RIVER_KIND.STEP_TOP && c.kind === RIVER_KIND.STEP_BOTTOM ? a.stepH : 0, stepBase = stepH > 0 ? a.stepBase : 0;
			// rows of vertices from section a to section c
			const rows = [];
			for (let j = 0; j <= subAlong; j++) {
				const t = j / subAlong;
				const s = t === 0 ? a : t === 1 ? c : lerpSection(a, c, t);
				const row = [];
				for (let k = 0; k <= subAcross; k++) {
					const u = (k / subAcross) * 2 - 1;                    // -1 right bank .. +1 left bank
					const x = s.x + s.nx * u * s.hw + s.tx * s.skew * u, z = s.z + s.nz * u * s.hw + s.tz * s.skew * u;
					row.push(b.river(x, s.y, z, [s.foam, s.dep, u * s.acr, s.w], [s.along, s.speed, stepH, stepBase], wk, s.fd));
				}
				rows.push(row);
			}
			// two triangles across the diagonal, counter-clockwise seen from above
			for (let j = 0; j < subAlong; j++) for (let k = 0; k < subAcross; k++) {
				const aL = rows[j][k + 1], aR = rows[j][k], bL = rows[j + 1][k + 1], bR = rows[j + 1][k];
				b.idx.push(aR, aL, bL, aR, bL, bR);
			}
		}
	}

	// the near mesh: fine quads for every reach within NEAR_BUILD of the player
	rebuildNear(px, pz) {
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
		for (const [ri, set] of perRiver) {
			const secs = this.sections[ri];
			this.buildRiver(b, ri, (i) => { if (!set.has(i)) return false; const s = secs[i]; const dx = s.x - px, dz = s.z - pz; return dx * dx + dz * dz < r2; }, NEAR_ALONG, NEAR_ACROSS);
		}
		if (this.near) { this.scene.remove(this.near); this.near.geometry.dispose(); }
		this.near = new THREE.Mesh(b.geometry(), this.nearMaterial);
		this.near.frustumCulled = false;
		this.near.renderOrder = 1;
		this.scene.add(this.near);
		this.nearCentre.set(px, pz);
	}

	update(time, cameraPos, shared) {
		updateWaterUniforms(this.uniforms, time, cameraPos, shared);
		if (this.nearCentre.distanceTo(new THREE.Vector2(cameraPos.x, cameraPos.z)) > NEAR_REBUILD) this.rebuildNear(cameraPos.x, cameraPos.z);
	}
}

const NO_WAKE = [0, 0, 0];
const STILL = [0, -1, 0, 0], NO_STEP = [0, 0, 0, 0], NO_WAKES = [NO_WAKE, NO_WAKE, NO_WAKE];

function lerpSection(a, c, t) {
	const L = (p, q) => p + (q - p) * t;
	let nx = L(a.nx, c.nx), nz = L(a.nz, c.nz);
	const nl = Math.hypot(nx, nz) || 1;
	nx /= nl; nz /= nl;
	return { x: L(a.x, c.x), z: L(a.z, c.z), y: L(a.y, c.y), tx: L(a.tx, c.tx), tz: L(a.tz, c.tz), nx, nz, hw: L(a.hw, c.hw), skew: L(a.skew, c.skew), acr: L(a.acr, c.acr), foam: L(a.foam, c.foam), dep: L(a.dep, c.dep), w: L(a.w, c.w), along: L(a.along, c.along), speed: L(a.speed, c.speed), stepH: Math.max(a.stepH, c.stepH), stepBase: a.stepH > 0 ? a.stepBase : c.stepBase, fd: L(a.fd, c.fd) };
}

// accumulates vertices and indices for one water geometry
class Builder {
	constructor() { this.pos = []; this.info0 = []; this.info1 = []; this.fade = []; this.wake0 = []; this.wake1 = []; this.wake2 = []; this.idx = []; }
	// info0: foam, depth (-1 for still water), across (signed, 1 at the channel edge), width
	// info1: along, speed, step height, step base level
	river(x, y, z, i0, i1, wk, fd) {
		this.pos.push(x, y, z);
		this.info0.push(i0[0], i0[1], i0[2], i0[3]);
		this.info1.push(i1[0], i1[1], i1[2], i1[3]);
		this.fade.push(fd);
		this.wake0.push(wk[0][0], wk[0][1], wk[0][2]); this.wake1.push(wk[1][0], wk[1][1], wk[1][2]); this.wake2.push(wk[2][0], wk[2][1], wk[2][2]);
		return this.pos.length / 3 - 1;
	}
	still(x, y, z) { return this.river(x, y, z, STILL, NO_STEP, NO_WAKES, 0); }
	geometry() {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
		g.setAttribute('aInfo0', new THREE.Float32BufferAttribute(this.info0, 4));
		g.setAttribute('aInfo1', new THREE.Float32BufferAttribute(this.info1, 4));
		g.setAttribute('aFade', new THREE.Float32BufferAttribute(this.fade, 1));
		g.setAttribute('aWake0', new THREE.Float32BufferAttribute(this.wake0, 3));
		g.setAttribute('aWake1', new THREE.Float32BufferAttribute(this.wake1, 3));
		g.setAttribute('aWake2', new THREE.Float32BufferAttribute(this.wake2, 3));
		g.setIndex(this.idx);
		g.computeBoundingSphere();
		return g;
	}
}
