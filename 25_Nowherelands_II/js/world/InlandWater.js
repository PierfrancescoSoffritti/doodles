import * as THREE from 'three';
import { createWaterUniforms, waterVertexShader, waterFragmentShader, updateWaterUniforms } from './WaterShader.js';

// Lakes and rivers: flat lake sheets at each lake's own level, and river ribbons whose surface
// steps down pool by pool. Both share one non-reflective water material.
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

		const pos = [], foam = [], flow = [], depth = [], across = [], idx = [];
		const vert = (x, y, z, f, fx, fz, dep = 0, acr = 0) => { pos.push(x, y, z); foam.push(f); flow.push(fx, fz); depth.push(dep); across.push(acr); return pos.length / 3 - 1; };

		// lakes: half-cell tiles over every lake cell and its immediate rim, at the lake level
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
				// the cell's own square plus half a cell beyond it on every side: up to the rim centres
				for (let sj = 2 * j - 1; sj <= 2 * j + 2; sj++) for (let si = 2 * i - 1; si <= 2 * i + 2; si++) {
					if (si < 0 || sj < 0 || si >= W || sj >= H) continue;
					mask[sj * W + si] = 1;
				}
			}
			const y = lake.level;
			for (let sj = 0; sj < H; sj++) for (let si = 0; si < W; si++) {
				if (!mask[sj * W + si]) continue;
				const x0 = wx(i0) - half + si * half, z0 = wz(j0) - half + sj * half;
				const a = vert(x0, y, z0, 0, 0, 0), b = vert(x0 + half, y, z0, 0, 0, 0), c = vert(x0, y, z0 + half, 0, 0, 0), d = vert(x0 + half, y, z0 + half, 0, 0, 0);
				idx.push(a, c, b, b, c, d);
			}
		}

		// rivers: ribbons a little wider than the channel; the banks hide the excess
		for (const r of world.rivers) {
			const d = r.data;
			let prev = null;
			for (let i = 0; i < r.count; i++) {
				const x = d[i * 6], z = d[i * 6 + 1], wl = d[i * 6 + 2] - 0.08, w = d[i * 6 + 3], dep = d[i * 6 + 4], f = d[i * 6 + 5];
				const ia = Math.max(0, i - 1), ib = Math.min(r.count - 1, i + 1);
				let tx = d[ib * 6] - d[ia * 6], tz = d[ib * 6 + 1] - d[ia * 6 + 1];
				const len = Math.hypot(tx, tz) || 1;
				tx /= len; tz /= len;
				const hw = w * 0.5 + (w * 0.6 + 8) * 0.3;
				const acr = hw / (w * 0.5);      // 1 at the channel edge, a little more at the ribbon edge
				const nx = -tz, nz = tx;
				const l = vert(x + nx * hw, wl, z + nz * hw, f, tx, tz, dep, acr);
				const rr = vert(x - nx * hw, wl, z - nz * hw, f, tx, tz, dep, -acr);
				if (prev) idx.push(prev[0], l, prev[1], prev[1], l, rr);
				prev = [l, rr];
			}
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		geometry.setAttribute('aFoam', new THREE.Float32BufferAttribute(foam, 1));
		geometry.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
		geometry.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
		geometry.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1));
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
