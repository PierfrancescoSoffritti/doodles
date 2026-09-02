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
export class InlandWater {
	constructor(scene, heightmap, shared) {
		const world = heightmap.world;
		const uniforms = createWaterUniforms(shared, heightmap.waterLevel);
		this.material = new THREE.ShaderMaterial({
			uniforms,
			vertexShader: waterVertexShader,
			fragmentShader: waterFragmentShader(shared),
			defines: { FLOW: '' },
		});
		this.uniforms = uniforms;

		const pos = [], info0 = [], info1 = [], fade = [], wake0 = [], wake1 = [], wake2 = [], idx = [];
		const NO_WAKE = [0, 0, 0];
		// info0: foam, depth (-1 for still water), across (signed, 1 at the channel edge), width
		// info1: along, speed, step height, step base level
		const vert = (x, y, z, i0, i1, wk, fd = 0) => {
			pos.push(x, y, z);
			fade.push(fd);
			info0.push(i0[0], i0[1], i0[2], i0[3]);
			info1.push(i1[0], i1[1], i1[2], i1[3]);
			wake0.push(wk[0][0], wk[0][1], wk[0][2]); wake1.push(wk[1][0], wk[1][1], wk[1][2]); wake2.push(wk[2][0], wk[2][1], wk[2][2]);
			return pos.length / 3 - 1;
		};

		// lakes: half-cell tiles over every lake cell and its immediate rim, at the lake level
		const N = world.res, cell = world.cell, half = cell / 2;
		const wx = (i) => -world.size / 2 + i * cell - heightmap.ox;
		const wz = (j) => -world.size / 2 + j * cell - heightmap.oz;
		const still = [0, -1, 0, 0], noStep = [0, 0, 0, 0], noWake = [NO_WAKE, NO_WAKE, NO_WAKE];
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
				const a = vert(x0, y, z0, still, noStep, noWake), b = vert(x0 + half, y, z0, still, noStep, noWake), c = vert(x0, y, z0 + half, still, noStep, noWake), d = vert(x0 + half, y, z0 + half, still, noStep, noWake);
				idx.push(a, c, b, b, c, d);
			}
		}

		// rivers
		const S = RIVER_STRIDE;
		for (const r of world.rivers) {
			const d = r.data, count = r.count;
			const wakes = r.wakes;
			const nWakes = wakes.length / WAKE_STRIDE;
			// the rocks whose wakes may cross the quad ending at this sample, nearest first
			const wakesFor = (alongA, alongB) => {
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
			};
			// a cross-section of the surface at sample i
			const section = (i) => {
				const o = i * S;
				const x = d[o + RV.X], z = d[o + RV.Z], wl = d[o + RV.WL] - 0.08, w = d[o + RV.W], dep = d[o + RV.D], foam = d[o + RV.FOAM], bank = d[o + RV.BANK], speed = d[o + RV.SPEED], along = d[o + RV.ALONG], kind = d[o + RV.KIND], fd = d[o + RV.FADE];
				// tangent: forward at a pool start, backward at a lip, centred elsewhere
				const ia = kind === RIVER_KIND.POOL ? i : Math.max(0, i - 1), ib = kind === RIVER_KIND.LIP ? i : Math.min(count - 1, i + 1);
				let tx = d[ib * S + RV.X] - d[ia * S + RV.X], tz = d[ib * S + RV.Z] - d[ia * S + RV.Z];
				const len = Math.hypot(tx, tz) || 1;
				tx /= len; tz /= len;
				const nx = -tz, nz = tx;
				// the surface runs just under the bank, to where the ground stands clear of it
				const hw = surfaceHalfWidth(w, dep, bank);
				let stepH = 0, stepBase = 0, skew = 0;
				if (kind === RIVER_KIND.STEP_TOP && i < count - 1) { stepH = d[o + RV.WL] - d[o + S + RV.WL]; stepBase = d[o + S + RV.WL] - 0.08; }
				else if (kind === RIVER_KIND.STEP_BOTTOM && i > 0) { stepH = d[o - S + RV.WL] - d[o + RV.WL]; stepBase = d[o + RV.WL] - 0.08; }
				// a riffle's lip runs askew across the channel rather than straight, so the steps do not read as stairs
				if (stepH > 0) { const seedI = kind === RIVER_KIND.STEP_TOP ? i : i - 1; skew = (Math.sin(seedI * 12.9898 + along * 0.017) * 0.5) * Math.min(w * 0.12, 1.4); }
				return { l: [x + nx * hw + tx * skew, wl, z + nz * hw + tz * skew], r: [x - nx * hw - tx * skew, wl, z - nz * hw - tz * skew], acr: hw / (w * 0.5), foam, dep, w, along, speed, stepH, stepBase, kind, fd };
			};
			// every quad owns its four vertices, so the wake attributes (constant per quad) never
			// depend on which vertex the GPU treats as provoking
			let prev = null;
			for (let i = 0; i < count; i++) {
				const cs = section(i);
				if (prev) {
					const a = prev, b = cs;
					const wk = wakesFor(a.along, b.along);
					const v = (sec, side) => vert(sec[side][0], sec[side][1], sec[side][2], [sec.foam, sec.dep, side === 'l' ? sec.acr : -sec.acr, sec.w], [sec.along, sec.speed, sec.stepH, sec.stepBase], wk, sec.fd);
					const aL = v(a, 'l'), aR = v(a, 'r'), bL = v(b, 'l'), bR = v(b, 'r');
					// two triangles across the diagonal, counter-clockwise seen from above
					idx.push(aR, aL, bL, aR, bL, bR);
				}
				prev = cs.kind === RIVER_KIND.LIP ? null : cs;
			}
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		geometry.setAttribute('aInfo0', new THREE.Float32BufferAttribute(info0, 4));
		geometry.setAttribute('aInfo1', new THREE.Float32BufferAttribute(info1, 4));
		geometry.setAttribute('aFade', new THREE.Float32BufferAttribute(fade, 1));
		geometry.setAttribute('aWake0', new THREE.Float32BufferAttribute(wake0, 3));
		geometry.setAttribute('aWake1', new THREE.Float32BufferAttribute(wake1, 3));
		geometry.setAttribute('aWake2', new THREE.Float32BufferAttribute(wake2, 3));
		geometry.setIndex(idx);
		geometry.computeBoundingSphere();
		this.mesh = new THREE.Mesh(geometry, this.material);
		this.mesh.frustumCulled = false;
		scene.add(this.mesh);
		this.triangles = idx.length / 3;
	}

	update(time, cameraPos, shared) {
		updateWaterUniforms(this.uniforms, time, cameraPos, shared);
	}
}
