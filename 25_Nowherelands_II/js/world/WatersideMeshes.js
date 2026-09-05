import * as THREE from 'three';
import { Random } from '../core/Random.js';

// All wood, root mats, strandline debris and shore cobbles in one draw per chunk.
// Built once; no runtime rigid-body simulation or individual object updates.
export class WatersideMeshes {
	constructor(shared) {
		this.features = shared.waterside;
		this.material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, emissive: '#201929', emissiveIntensity: 0.16 });
	}
	build(hm, chunk, cx, cz, size, seed) {
		const x0 = cx * size - size / 2, z0 = cz * size - size / 2, x1 = x0 + size, z1 = z0 + size;
		const features = this.features.query(this.features.cells, x0, z0, x1, z1);
		const shores = this.features.query(this.features.shoreCells, x0, z0, x1, z1);
		const p = [], c = [], rnd = new Random(seed + ':shore-mesh:' + cx + ':' + cz);
		const tri = (a, b, d, col) => { p.push(...a, ...b, ...d); for (let i = 0; i < 3; i++) c.push(...col); };
		const wood = (a, b, radius, taper = 0.6, level = -10000) => {
			const dir = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize();
			const u = new THREE.Vector3(0, 1, 0); if (Math.abs(dir.y) > 0.9) u.set(1, 0, 0);
			u.cross(dir).normalize(); const v = new THREE.Vector3().crossVectors(dir, u);
			const point = (end, angle) => { const r = radius * (end ? taper : 1) * (1 + 0.08 * Math.sin(angle * 3)); const q = end ? b : a; return q.map((val, i) => val + r * (u.getComponent(i) * Math.cos(angle) + v.getComponent(i) * Math.sin(angle))); };
			for (let j = 0; j < 7; j++) {
				const a0 = point(0, j * Math.PI * 2 / 7), a1 = point(0, (j + 1) * Math.PI * 2 / 7), b0 = point(1, j * Math.PI * 2 / 7), b1 = point(1, (j + 1) * Math.PI * 2 / 7);
				const shade = 0.65 + (j % 3) * 0.16;
				const wet = (a[1] + b[1]) * 0.5 < level + 0.7 ? 0.62 : 1;
				const col = [0.24, 0.16, 0.19].map(x => x * shade * wet);
				tri(a0, b0, a1, col); tri(a1, b0, b1, col);
				tri(a, a1, a0, [0.31, 0.23, 0.24]); tri(b, b0, b1, [0.3, 0.22, 0.23]);
			}
		};
		for (const f of features) {
			const r = new Random(f.seed), a = f.a, b = f.b, level = hm.waterAt(a[0], a[2]);
			if (f.type === 'roots') {
				// A ragged soil cap projects over the root fan, giving a small real overhang.
				const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l * 2.7, nz = dx / l * 2.7;
				const top = [[a[0] + nx, a[1], a[2] + nz], [a[0] - nx, a[1], a[2] - nz], [a[0] + dx * 0.5, a[1] - 0.25, a[2] + dz * 0.5]];
				tri(...top, [0.13, 0.09, 0.15]);
				tri(top[0], [top[2][0], top[2][1] - 0.6, top[2][2]], top[2], [0.07, 0.045, 0.08]);
				for (let j = 0; j < 8; j++) {
					const shift = r.range(-1, 1), start = [a[0] + nx * shift, a[1], a[2] + nz * shift];
					const knee = [start[0] + dx * 0.6, a[1] - r.range(0.5, 1.7), start[2] + dz * 0.6];
					const end = [b[0] + nx * shift * 0.7, b[1] + r.range(-0.2, 0.6), b[2] + nz * shift * 0.7];
					wood(start, knee, f.radius * 0.18, 0.8, level); wood(knee, end, f.radius * 0.13, 0.2, level);
				}
				continue;
			}
			wood(a, b, f.radius, f.taper ?? (f.type === 'snag' ? 0.28 : 0.62), level);
			if (f.type === 'jam') continue;
			// Broken limbs retain the tree's growth direction, now rotated with the trunk.
			const axis = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), length = axis.length(); axis.normalize();
			const lateral = new THREE.Vector3(0, 1, 0); if (Math.abs(axis.y) > 0.9) lateral.set(1, 0, 0);
			lateral.cross(axis).normalize(); const up = new THREE.Vector3().crossVectors(axis, lateral);
			for (let j = 0, count = r.int(4, f.radius > 3 ? 11 : 7); j < count; j++) {
				const t = r.range(0.25, 0.94), origin = a.map((v, k) => v + (b[k] - v) * t), l = Math.min(length * 0.23, r.range(2, 6) * f.radius);
				const theta = r.range(0, Math.PI), forward = r.range(0.25, 0.65);
				const direction = lateral.clone().multiplyScalar(Math.cos(theta)).addScaledVector(up, Math.sin(theta)).addScaledVector(axis, forward).normalize();
				const end = origin.map((v, k) => v + direction.getComponent(k) * l);
				const branchRadius = f.radius * (1 - t * 0.6) * 0.3;
				wood(origin, end, branchRadius, 0.15, level);
				if (f.type === 'fallen' && l > 5 && r.next() < 0.65) {
					const fork = origin.map((v, k) => v + (end[k] - v) * 0.65);
					const tip = fork.map((v, k) => v + (direction.getComponent(k) + lateral.getComponent(k) * r.range(-0.8, 0.8)) * l * 0.45);
					wood(fork, tip, branchRadius * 0.4, 0.12, level);
				}
			}
			if (f.type === 'fallen') for (let j = 0; j < 9; j++) {
				const theta = j * 2.4, r0 = f.radius * r.range(2, 4);
				const back = r.range(0.1, 0.5);
				const end = a.map((v, k) => v + (lateral.getComponent(k) * Math.cos(theta) + up.getComponent(k) * Math.sin(theta) - axis.getComponent(k) * back) * r0);
				wood(a, end, f.radius * 0.19, 0.18, level);
			}
		}
		for (const shore of shores) {
			// Wave-exposed rocky shores have washed cobbles; lee shores accumulate branches.
			for (let j = 0; j < 4; j++) {
				const x = shore.x + rnd.range(-9, 9), z = shore.z + rnd.range(-9, 9), y = hm.sample(x, z), H = y - shore.level;
				if (H < -1.5 || H > 3.5 || hm._riverSeg >= 0) continue;
				if (shore.hard + shore.fetch > 0.7) {
					const r = rnd.range(0.4, 1.7), ring = [[x - r, y, z], [x, y, z + r * 0.8], [x + r, y, z], [x, y, z - r * 0.8]], top = [x + r * 0.12, y + r * 0.65, z], bottom = [x, y - r * 0.3, z];
					const wet = H < 0.8 ? 0.65 : 1;
					for (let k = 0; k < 4; k++) { tri(ring[k], top, ring[(k + 1) % 4], [0.27 * wet, 0.25 * wet, 0.32 * wet]); tri(ring[k], ring[(k + 1) % 4], bottom, [0.12, 0.1, 0.17]); }
				} else if (H > 0.5 && H < 2.7 && rnd.next() < 0.5) {
					const theta = rnd.range(0, 6.28), l = rnd.range(1.5, 5);
					wood([x, y + 0.1, z], [x + Math.cos(theta) * l, y + 0.2, z + Math.sin(theta) * l], rnd.range(0.08, 0.22), 0.4, shore.level);
				}
			}
		}
		// Flood strandlines lie above ordinary river flow; discontinuous piles follow banks.
		for (const index of hm.rivers.segmentsIn(x0, z0, x1, z1)) {
			if (index % 5 || rnd.next() > 0.4) continue;
			const s = hm.rivers.at(index, 0.5), l = Math.hypot(s.dx, s.dz) || 1, tx = s.dx / l, tz = s.dz / l;
			for (const side of [-1, 1]) {
				const off = side * (s.w * 0.5 + 6), x = s.x - tz * off, z = s.z + tx * off;
				if (x < x0 || z < z0 || x >= x1 || z >= z1) continue;
				const y = hm.sample(x, z), H = y - hm._water;
				if (H < 0.6 || H > 4) continue;
				for (let j = 0; j < 3; j++) { const start = [x + tx * j, y + 0.1, z + tz * j]; wood(start, [start[0] + tx * 3 + tz, y + 0.15, start[2] + tz * 3 - tx], 0.12, 0.4); }
			}
		}
		if (!p.length) return;
		const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); g.computeVertexNormals();
		const mesh = new THREE.Mesh(g, this.material); mesh.name = 'waterside-wood-stone'; mesh.userData.features = features.length; chunk.meshes.push(mesh);
	}
}
