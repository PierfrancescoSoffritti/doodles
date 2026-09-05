import * as THREE from 'three';
import { WaterOptics } from './WaterOptics.js';
import { crestShape, crestOffset } from './RiverGeometry.js';
import { clipShore } from './LakeSurface.js';
import { riverWakes } from './RiverFlow.js';
import { createWaterUniforms, waterVertexShader, waterFragmentShader, updateWaterUniforms } from './WaterShader.js';
import { RIVER_STRIDE, RV, RIVER_KIND, surfaceHalfWidth } from './gen/Rivers.js';

// Lakes and rivers: flat lake sheets at each lake's own level, and river ribbons that follow the
// water surface sample by sample: sloping runs, short steep riffle ramps, and gaps where a
// waterfall (its own mesh) takes over. Both share scene refraction, depth absorption and the local environment reflection.
//
// River vertices carry their position in river space (metres along the channel, signed metres
// across it) so the shader can texture the flow without smearing, and the three nearest rocks
// that break the surface so it can draw their wakes.
//
// Two meshes draw the water. A static one covers the whole continent with one quad per river
// sample and per half grid cell of lake. A near mesh, rebuilt as the player moves, covers the
// reaches and lake within NEAR_RADIUS with quads a few metres on a side; its vertices are lifted
// by waves in the vertex shader (the river's swell, a lake's wind ripples), so close up the water
// has a faceted, moving surface with real silhouettes against the banks. The static mesh discards
// its fragments inside the near radius so the two never fight.

export const NEAR_RADIUS = 260;        // where the static ribbon gives way to the waved one
const NEAR_BUILD = 340;                // reaches gathered for the near mesh
const NEAR_REBUILD = 40;               // rebuild after moving this far
const NEAR_QUAD = 2.2;                 // metres per quad on the near mesh, the sea's facet size
const NEAR_LAKE_SUB = 4;               // quads per half grid cell on a lake (about 2 m)

export class InlandWater {
	constructor(scene, heightmap, shared) {
		this.scene = scene;
		this.heightmap = heightmap;
		const world = heightmap.world;
		this.world = world;
		const uniforms = createWaterUniforms(shared, heightmap.waterLevel);
		uniforms.uNearRadius = { value: NEAR_RADIUS };
		this.uniforms = uniforms;
		this.optics = new WaterOptics(shared, uniforms);
		this.material = new THREE.ShaderMaterial({
			uniforms,
			vertexShader: waterVertexShader(shared),
			fragmentShader: waterFragmentShader(shared),
			defines: { NEAR_CULL: '' },
			transparent: true,
		});
		this.nearMaterial = new THREE.ShaderMaterial({
			uniforms,
			vertexShader: waterVertexShader(shared),
			fragmentShader: waterFragmentShader(shared),
			defines: { WAVES: '' },
			transparent: true,
		});

		// the cross-sections of every river, computed once
		this.sections = world.rivers.map((r) => this.riverSections(r));

		const b = new Builder();
		this.buildLakes(b, 1, null);
		for (let ri = 0; ri < world.rivers.length; ri++) this.buildRiver(b, ri, null, 0);
		this.mesh = new THREE.Mesh(b.geometry(), this.material);
		this.mesh.frustumCulled = false;
		this.mesh.onBeforeRender = (...args) => this.optics.capture(...args);
		this.mesh.renderOrder = 1;          // over the sea, so a river mouth shows the river until it fades
		scene.add(this.mesh);
		shared.mirrorHide.add(this.mesh);   // reads the sea's mirror, so it cannot be drawn into it
		this.shared = shared;
		this.triangles = b.idx.length / 3;

		this.near = null;
		this.nearCentre = new THREE.Vector2(1e9, 1e9);
	}

	// ---------- lakes ----------
	// One quad per half grid cell, or `sub` x `sub` quads per half cell for the near mesh, kept
	// where `keep(x, z)` says so.
	buildLakes(b, sub, keep) {
		const world = this.world, heightmap = this.heightmap;
		const N = world.res, cell = world.cell, half = cell / 2;
		const wx = (i) => -world.size / 2 + i * cell - heightmap.ox;
		const wz = (j) => -world.size / 2 + j * cell - heightmap.oz;
		for (const lake of world.lakes) {
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
			const y = lake.level - 0.08;
			const field = ([x, z]) => Math.min(heightmap.lakes.coverage(lake.id, x, z), y - heightmap.height(x, z) + 0.04);
			const triangle = (vertices) => {
				const poly = clipShore(vertices, field);
				if (poly.length < 3) return;
				const ids = poly.map(([x, z]) => b.still(x, y, z, heightmap.lakes.waveWeight(lake.id, x, z)));
				for (let k = 1; k < ids.length - 1; k++) b.idx.push(ids[0], ids[k], ids[k + 1]);
			};
			for (let sj = 0; sj < H; sj++) for (let si = 0; si < W; si++) {
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
		this.buildLakes(b, NEAR_LAKE_SUB, (x, z) => { const dx = x - px, dz = z - pz; return dx * dx + dz * dz < r2; });
		for (const [ri, set] of perRiver) {
			const secs = this.sections[ri];
			this.buildRiver(b, ri, (i) => { if (!set.has(i)) return false; const s = secs[i]; const dx = s.x - px, dz = s.z - pz; return dx * dx + dz * dz < r2; }, NEAR_QUAD);
		}
		if (this.near) { this.scene.remove(this.near); this.near.geometry.dispose(); this.shared.mirrorHide.delete(this.near); }
		this.near = new THREE.Mesh(b.geometry(), this.nearMaterial);
		this.shared.mirrorHide.add(this.near);
		this.near.frustumCulled = false;
		this.near.onBeforeRender = (...args) => this.optics.capture(...args);
		this.near.renderOrder = 1;
		this.scene.add(this.near);
		this.nearCentre.set(px, pz);
	}

	update(time, cameraPos, shared) {
		this.optics.beginFrame();
		updateWaterUniforms(this.uniforms, time, cameraPos, shared);
		if (Math.hypot(this.nearCentre.x - cameraPos.x, this.nearCentre.y - cameraPos.z) > NEAR_REBUILD) this.rebuildNear(cameraPos.x, cameraPos.z);
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
	constructor() { this.pos = []; this.info0 = []; this.info1 = []; this.fade = []; this.channel = []; this.join = []; this.wave = []; this.wake0 = []; this.wake1 = []; this.wake2 = []; this.idx = []; }
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
	still(x, y, z, wave = 1) { return this.river(x, y, z, STILL, NO_STEP, NO_WAKES, 0, [0, 0, 0, 0], 0, wave); }
	geometry() {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
		g.setAttribute('aInfo0', new THREE.Float32BufferAttribute(this.info0, 4));
		g.setAttribute('aInfo1', new THREE.Float32BufferAttribute(this.info1, 4));
		g.setAttribute('aWave', new THREE.Float32BufferAttribute(this.wave, 1));
		g.setAttribute('aJoin', new THREE.Float32BufferAttribute(this.join, 1));
		g.setAttribute('aChannel', new THREE.Float32BufferAttribute(this.channel, 4));
		g.setAttribute('aFade', new THREE.Float32BufferAttribute(this.fade, 1));
		g.setAttribute('aWake0', new THREE.Float32BufferAttribute(this.wake0, 3));
		g.setAttribute('aWake1', new THREE.Float32BufferAttribute(this.wake1, 3));
		g.setAttribute('aWake2', new THREE.Float32BufferAttribute(this.wake2, 3));
		g.setIndex(this.idx);
		g.computeBoundingSphere();
		return g;
	}
}
