import * as THREE from 'three';
import { Random } from '../core/Random.js';
import { riverHabitat } from './gen/ChannelMorphology.js';
import { surfaceHalfWidth, RIVER_STRIDE, RV } from './gen/Rivers.js';

// Small solid silhouettes alongside the world's wire grass. Four batched plant communities
// per occupied vegetation chunk; no particles, textures, physics, or per-plant updates.
function plantGeometry(type) {
	const rnd = new Random('riparian:' + type), p = [], colors = [];
	const leafColor = type === 'bramble' ? [0.21, 0.29, 0.25] : type === 'aquatic' ? [0.12, 0.32, 0.25] : [0.3, 0.38, 0.3];
	const tri = (a, b, c, tint = 1) => { p.push(...a, ...b, ...c); for (let j = 0; j < 3; j++) colors.push(...leafColor.map(v => v * tint)); };
	if (type === 'bramble') {
		for (let stem = 0; stem < 7; stem++) {
			const angle = stem * 2.4, dx = Math.cos(angle), dz = Math.sin(angle), reach = rnd.range(0.65, 1.25);
			let previous = [0, 0, 0];
			for (let k = 1; k <= 6; k++) {
				const t = k / 6, node = [dx * t * reach, Math.sin(t * 2.55) * 0.8, dz * t * reach];
				tri(previous, [previous[0] + 0.025, previous[1], previous[2] + 0.025], node, 0.5);
				for (const side of [-1, 1]) {
					const l = 0.15 + rnd.next() * 0.15;
					const tip = [node[0] - dz * l * side + dx * l * 0.3, node[1] + l * 0.35, node[2] + dx * l * side + dz * l * 0.3];
					const mid = node.map((v, i) => (v + tip[i]) * 0.5);
					tri(node, [mid[0] + dx * l * 0.4, mid[1] + 0.055, mid[2] + dz * l * 0.4], tip, rnd.range(0.65, 1.4));
					tri(node, tip, [mid[0] - dx * l * 0.4, mid[1] - 0.025, mid[2] - dz * l * 0.4], 0.8);
				}
				previous = node;
			}
		}
	} else {
		const n = type === 'reed' ? 9 : 14;
		for (let k = 0; k < n; k++) {
			const a = rnd.range(0, 6.283), dx = Math.cos(a), dz = Math.sin(a);
			const h = rnd.range(0.55, 1), spread = type === 'reed' ? 0.15 : 0.55;
			const lean = type === 'aquatic' ? 0.75 : rnd.range(0.1, 0.45);
			const width = type === 'reed' ? 0.018 : 0.055;
			let last = [dx * spread, 0, dz * spread];
			for (let j = 1; j <= 4; j++) {
				const t = j / 4, taper = 1 - (t - 0.25) * 0.8;
				const next = [dx * spread + (type === 'aquatic' ? 1 : dx) * lean * t * t, h * t, dz * (spread + lean * t * t)];
				tri([last[0] - dz * width * taper, last[1], last[2] + dx * width * taper], [last[0] + dz * width * taper, last[1], last[2] - dx * width * taper], next, 0.7 + t * 0.6);
				last = next;
			}
			if (type === 'reed') {
				tri([last[0] - 0.035, last[1] - 0.15, last[2]], [last[0] + 0.035, last[1] - 0.15, last[2]], [last[0], last[1] + 0.08, last[2]], 0.5);
			}
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
	geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
	geometry.computeVertexNormals();
	return geometry;
}

export class RiverEcology {
	constructor(shared) {
		this.geometries = Object.fromEntries(['bramble', 'reed', 'sedge', 'aquatic'].map(k => [k, plantGeometry(k)]));
		this.material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: '#1b2033', emissiveIntensity: 0.28 });
		this.material.onBeforeCompile = shader => {
			shader.uniforms.uRiverTime = shared.terrainUniforms.uTime;
			shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uRiverTime;');
			shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
				float phase = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.21;
				transformed.x += sin(uRiverTime * 1.35 + phase) * position.y * position.y * 0.06;
				transformed.z += cos(uRiverTime * 1.1 + phase) * position.y * position.y * 0.04;`);
		};
	}
	build(hm, chunk, cx, cz, size, seed) {
		const rnd = new Random(seed + ':riparian:' + cx + ':' + cz);
		const x0 = cx * size - size / 2, z0 = cz * size - size / 2, x1 = x0 + size, z1 = z0 + size;
		const plants = { bramble: [], reed: [], sedge: [], aquatic: [] };
		for (const index of hm.rivers.segmentsIn(x0 - 30, z0 - 30, x1 + 30, z1 + 30)) {
			const a = hm.rivers.at(index, 0.5);
			if (a.kind !== 0 || a.wl < 1) continue;
			const river = hm.world.rivers[hm.rivers.segRiver[index]], sample = hm.rivers.segIndex[index] * RIVER_STRIDE;
			const speed = river.data[sample + RV.SPEED];
			const length = Math.hypot(a.dx, a.dz) || 1, tx = a.dx / length, tz = a.dz / length;
			for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
				const edge = surfaceHalfWidth(a.w, a.d, a.bank, side, a.bend);
				const offset = side * (edge + rnd.range(-5, 22)), along = rnd.range(-4, 4);
				const x = a.x - tz * offset + tx * along, z = a.z + tx * offset + tz * along;
				if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
				const y = hm.sample(x, z), H = y - Math.max(hm._water, a.wl);
				if (hm._slope > 0.8) continue;
				const u = Math.min(1, Math.abs(offset / (a.w * 0.5)));
				const localSpeed = speed * Math.max(0.08, 1 - u * u);
				const habitat = riverHabitat(H, localSpeed, a.foam, a.wl);
				const patch = 0.5 + 0.5 * Math.sin(a.along * 0.027 + side * 9 + river.id);
				const type = H < -0.2 ? 'aquatic' : H > 1.2 ? 'bramble' : patch > 0.55 ? 'reed' : 'sedge';
				if (rnd.next() > habitat[type] * (0.3 + patch * 0.65) || plants[type].length >= 180) continue;
				const scale = type === 'bramble' ? rnd.range(2.5, 5.5) : type === 'reed' ? rnd.range(4.0, 8.0) : type === 'aquatic' ? Math.min(-H * 0.9, 2.8) : rnd.range(1.8, 3.8);
				plants[type].push({ x, y: y - 0.05, z, scale, yaw: type === 'aquatic' ? Math.atan2(-tz, tx) : rnd.range(0, 6.28) });
			}
		}
		const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), position = new THREE.Vector3(), scale = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
		for (const [type, list] of Object.entries(plants)) {
			if (!list.length) continue;
			const mesh = new THREE.InstancedMesh(this.geometries[type].clone(), this.material, list.length);
			list.forEach((it, i) => {
				position.set(it.x, it.y, it.z); scale.setScalar(it.scale); q.setFromAxisAngle(up, it.yaw);
				mesh.setMatrixAt(i, matrix.compose(position, q, scale));
			});
			mesh.name = 'river-' + type;
			mesh.computeBoundingSphere();
			chunk.meshes.push(mesh);
		}
	}
}
