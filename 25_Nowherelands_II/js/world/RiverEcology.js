import * as THREE from 'three';
import { Random } from '../core/Random.js';
import { riverHabitat } from './gen/ChannelMorphology.js';
import { surfaceHalfWidth, RIVER_STRIDE, RV } from './gen/Rivers.js';

// Small solid silhouettes alongside the world's wire grass. Nine instanced communities
// with shared geometry, bounded recruitment and no per-plant frame updates.
export function plantGeometry(type) {
	const rnd = new Random('riparian:' + type), p = [], colors = [];
	const leafColor = type === 'moss' ? [0.12, 0.24, 0.18] : type === 'fern' ? [0.2, 0.35, 0.29] : type === 'bramble' ? [0.21, 0.29, 0.25] : type === 'aquatic' ? [0.12, 0.32, 0.25] : [0.3, 0.38, 0.3];
	const tri = (a, b, c, tint = 1) => { p.push(...a, ...b, ...c); for (let j = 0; j < 3; j++) colors.push(...leafColor.map(v => v * tint)); };
	if (type === 'fern') {
		for (let stem = 0; stem < 8; stem++) {
			const a = stem * 2.4, dx = Math.cos(a), dz = Math.sin(a);
			for (let j = 1; j < 10; j++) {
				const t = j / 10, node = [dx * t, Math.sin(t * 2.5) * 0.6, dz * t], leaf = 0.24 * Math.sin(t * Math.PI);
				for (const side of [-1, 1]) tri(node, [node[0] + dx * 0.14 - dz * leaf * side, node[1] + 0.045, node[2] + dz * 0.14 + dx * leaf * side], [node[0] + dx * 0.1, node[1] - 0.025, node[2] + dz * 0.1], 0.7 + t * 0.7);
			}
		}
	} else if (type === 'moss' || type === 'lily') {
		for (let k = 0; k < 7; k++) {
			const a = k * 2.4, x = Math.cos(a) * 0.5, z = Math.sin(a) * 0.5, radius = rnd.range(0.18, 0.4);
			for (let j = 0; j < 7; j++) {
				if (type === 'lily' && j === 0) continue;
				const a0 = j * 6.283 / 7, a1 = (j + 1) * 6.283 / 7, y = type === 'moss' ? rnd.range(0.06, 0.17) : 0.02;
				tri([x, y, z], [x + Math.cos(a0) * radius, 0, z + Math.sin(a0) * radius], [x + Math.cos(a1) * radius, 0, z + Math.sin(a1) * radius], rnd.range(0.6, 1.3));
			}
		}
	} else if (type === 'willow') {
		for (let stem = 0; stem < 4; stem++) {
			const a = stem * 2.4, dx = Math.cos(a) * 0.4, dz = Math.sin(a) * 0.4;
			tri([0, 0, 0], [0.025, 0, 0.025], [dx, 1, dz], 0.4);
			for (let j = 2; j < 10; j++) {
				const t = j / 10, side = j % 2 ? -1 : 1, node = [dx * t, t, dz * t];
				tri(node, [node[0] + side * 0.25, t + 0.06, node[2] + 0.1], [node[0] + side * 0.06, t - 0.08, node[2] + 0.04], 0.9);
			}
		}
	} else if (type === 'bramble') {
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
		const n = (type === 'reed' || type === 'rush') ? 9 : 14;
		for (let k = 0; k < n; k++) {
			const a = rnd.range(0, 6.283), dx = Math.cos(a), dz = Math.sin(a);
			const h = rnd.range(0.55, 1), spread = (type === 'reed' || type === 'rush') ? 0.15 : 0.55;
			const lean = type === 'aquatic' ? 0.75 : rnd.range(0.1, 0.45);
			const width = (type === 'reed' || type === 'rush') ? 0.018 : 0.055;
			let last = [dx * spread, 0, dz * spread];
			for (let j = 1; j <= 4; j++) {
				const t = j / 4, taper = 1 - (t - 0.25) * 0.8;
				const next = [dx * spread + (type === 'aquatic' ? 1 : dx) * lean * t * t, h * t, dz * (spread + lean * t * t)];
				tri([last[0] - dz * width * taper, last[1], last[2] + dx * width * taper], [last[0] + dz * width * taper, last[1], last[2] - dx * width * taper], next, 0.7 + t * 0.6);
				last = next;
			}
			if (type === 'reed' && k % 3) {
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
		this.features = shared.waterside;
		this.geometries = Object.fromEntries(['bramble', 'reed', 'rush', 'sedge', 'aquatic', 'fern', 'moss', 'willow', 'lily'].map(k => [k, plantGeometry(k)]));
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
		const plants = Object.fromEntries(Object.keys(this.geometries).map(type => [type, []]));
		let total = 0;
		const recruit = (x, z, wl, speed, foam, yaw, patch, exposure = 0.2) => {
			if (x < x0 || x >= x1 || z < z0 || z >= z1 || total >= 420) return;
			const y = hm.sample(x, z), surface = Math.max(hm._water, wl), H = y - surface, slope = hm._slope;
			if (slope > 0.85) return;
			const habitat = riverHabitat(H, speed, foam, wl, hm.forestDensity(x, z), exposure);
			const entries = Object.entries(habitat).filter(([type, weight]) => weight > 0.01 && plants[type].length < 100);
			const sum = entries.reduce((v, [, weight]) => v + weight, 0);
			if (!sum || rnd.next() > Math.min(0.92, sum * (0.2 + patch * 0.5))) return;
			let pick = rnd.next() * sum, type = entries[0][0];
			for (const [key, weight] of entries) { pick -= weight; if (pick <= 0) { type = key; break; } }
			const sc = { bramble: 4, reed: 6, rush: 3.5, sedge: 2.8, fern: 3.6, moss: 3.2, willow: 8, lily: 2.3, aquatic: Math.min(-H * 0.9, 3) };
			const scale = sc[type] * rnd.range(0.7, 1.3);
			plants[type].push({ x, y: type === 'lily' ? surface + 0.03 : y - 0.025, z, scale, yaw: type === 'aquatic' ? yaw : rnd.range(0, 6.28) }); total++;
		};
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
				const u = Math.min(1, Math.abs(offset / (a.w * 0.5)));
				const localSpeed = speed * Math.max(0.08, 1 - u * u);
				const patch = 0.5 + 0.5 * Math.sin(a.along * 0.027 + side * 9 + river.id);
				recruit(x, z, a.wl, localSpeed, a.foam, Math.atan2(-tz, tx), patch);
			}
		}
		for (const shore of this.features.query(this.features.shoreCells, x0 - 14, z0 - 14, x1 + 14, z1 + 14)) {
			const patch = 0.5 + Math.sin(shore.x * 0.027 + shore.z * 0.019) * 0.5;
			for (let k = 0; k < 14; k++) recruit(shore.x + rnd.range(-14, 14), shore.z + rnd.range(-14, 14), shore.level, shore.fetch * 0.35, 0, 0, patch, shore.fetch);
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
