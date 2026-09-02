import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAX = 96;

// Little luminous plants the player leaves behind by standing still.
export class Sprouts {
	constructor(scene, heightmap, shared) {
		this.shared = shared;
		this.heightmap = heightmap;
		const stem = new THREE.CylinderGeometry(0.08, 0.2, 3.2, 4, 1);
		stem.translate(0, 1.6, 0);
		const bulb = new THREE.IcosahedronGeometry(0.55, 0);
		bulb.translate(0, 3.6, 0);
		const geometry = mergeGeometries([stem.toNonIndexed(), bulb]);
		this.material = new THREE.MeshStandardMaterial({ color: '#1a0b33', emissive: new THREE.Color('#ff6ad5'), emissiveIntensity: 0.5, flatShading: true, metalness: 0.6, roughness: 0.3 });
		this.mesh = new THREE.InstancedMesh(geometry, this.material, MAX);
		this.mesh.count = 0;
		this.mesh.frustumCulled = false;
		scene.add(this.mesh);
		this.items = [];
		this.m = new THREE.Matrix4();
		this.q = new THREE.Quaternion();
	}

	add(x, z, time) {
		const y = this.heightmap.height(x, z);
		if (y < this.heightmap.waterLevel + 1) return false;
		const idx = this.items.length < MAX ? this.items.length : (this.cursor = ((this.cursor || 0) + 1) % MAX);
		const item = { x, y, z, born: time, rot: Math.random() * Math.PI * 2, idx, scale: 0.7 + Math.random() * 0.6 };
		if (this.items.length < MAX) this.items.push(item); else this.items[idx] = item;
		this.mesh.count = this.items.length;
		return true;
	}

	update(time) {
		for (const it of this.items) {
			const t = Math.min((time - it.born) / 2.0, 1);
			if (t >= 1 && it.done) continue;
			const s = (1 - Math.pow(1 - t, 3)) * it.scale;
			this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot);
			this.m.compose(new THREE.Vector3(it.x, it.y - 0.3, it.z), this.q, new THREE.Vector3(s, s, s));
			this.mesh.setMatrixAt(it.idx, this.m);
			it.done = t >= 1;
			this.mesh.instanceMatrix.needsUpdate = true;
		}
		const a = this.shared.audio ? this.shared.audio.analysis : null;
		this.material.emissiveIntensity = 0.45 + (a ? a.attack * 2.0 : 0);
		this.material.emissive.setHSL(this.shared.hue, 0.85, 0.6);
	}
}
