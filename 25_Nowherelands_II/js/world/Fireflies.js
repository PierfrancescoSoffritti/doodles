import * as THREE from 'three';

const AMBIENT = 260, RANGE = 520;

// Drifting motes. Ambient ones wrap around the player; clusters sit at landmarks.
export class Fireflies {
	constructor(scene, heightmap, shared) {
		this.shared = shared;
		this.heightmap = heightmap;
		this.items = [];
		for (let i = 0; i < AMBIENT; i++) this.items.push(this.make(Math.random() * RANGE - RANGE / 2, Math.random() * RANGE - RANGE / 2, true));
		this.rebuild();
		this.material = new THREE.ShaderMaterial({
			uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uLevel: { value: 0 } },
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
			vertexShader: /* glsl */`
				attribute vec3 aInfo; // phase, hue, size
				uniform float uTime, uPixelRatio, uLevel;
				varying float vA; varying float vHue;
				void main() {
					float tw = pow(0.5 + 0.5 * sin(uTime * 2.2 + aInfo.x), 3.0);
					vA = (0.25 + 0.75 * tw) * (1.0 + uLevel * 0.8);
					vHue = aInfo.y;
					vec4 mv = modelViewMatrix * vec4(position, 1.0);
					gl_PointSize = aInfo.z * 40.0 * uPixelRatio / max(-mv.z, 1.0);
					gl_Position = projectionMatrix * mv;
				}`,
			fragmentShader: /* glsl */`
				varying float vA; varying float vHue;
				void main() {
					float d = length(gl_PointCoord - 0.5) * 2.0;
					float a = pow(max(1.0 - d, 0.0), 2.0) * vA;
					vec3 warm = vec3(1.0, 0.85, 0.5), cool = vec3(0.55, 0.95, 1.0), pink = vec3(1.0, 0.55, 0.9);
					vec3 c = vHue < 0.33 ? warm : (vHue < 0.66 ? cool : pink);
					gl_FragColor = vec4(c * a * 2.2, a);
				}`,
		});
		this.points = new THREE.Points(this.geometry, this.material);
		this.points.frustumCulled = false;
		scene.add(this.points);
		this.frame = 0;
	}

	make(x, z, ambient) {
		return { x, z, y: 0, ambient, phase: Math.random() * Math.PI * 2, hue: Math.random(), size: 0.8 + Math.random() * 1.4, drift: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.5 };
	}

	addCluster(x, z, radius, count, hue) {
		for (let i = 0; i < count; i++) {
			const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
			const f = this.make(x + Math.cos(a) * r, z + Math.sin(a) * r, false);
			if (hue !== undefined) f.hue = hue;
			this.items.push(f);
		}
		this.rebuild();
	}

	rebuild() {
		const n = this.items.length;
		this.positions = new Float32Array(n * 3);
		const info = new Float32Array(n * 3);
		this.items.forEach((f, i) => { info[i * 3] = f.phase; info[i * 3 + 1] = f.hue; info[i * 3 + 2] = f.size; });
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
		geometry.setAttribute('aInfo', new THREE.BufferAttribute(info, 3));
		if (this.geometry) this.geometry.dispose();
		this.geometry = geometry;
		if (this.points) this.points.geometry = geometry;
	}

	update(time, dt, playerPos, renderer) {
		this.frame++;
		const hm = this.heightmap, pos = this.positions;
		const half = RANGE / 2;
		for (let i = 0; i < this.items.length; i++) {
			const f = this.items[i];
			if (f.ambient) {
				f.x += Math.sin(time * f.speed + f.drift) * dt * 3;
				f.z += Math.cos(time * f.speed * 0.8 + f.drift) * dt * 3;
				// wrap around the player
				let dx = f.x - playerPos.x, dz = f.z - playerPos.z;
				if (dx > half) f.x -= RANGE; else if (dx < -half) f.x += RANGE;
				if (dz > half) f.z -= RANGE; else if (dz < -half) f.z += RANGE;
			}
			if ((i + this.frame) % 4 === 0 || f.y === 0) { f.groundY = hm.height(f.x, f.z); f.waterY = hm._water; }
			const g = Math.max(f.groundY, f.waterY || hm.waterLevel);
			f.y = g + 2.5 + f.size * 2 + Math.sin(time * 0.9 + f.phase) * 1.8;
			pos[i * 3] = f.x; pos[i * 3 + 1] = f.y; pos[i * 3 + 2] = f.z;
		}
		this.geometry.attributes.position.needsUpdate = true;
		this.material.uniforms.uTime.value = time;
		this.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
		this.material.uniforms.uLevel.value = ((this.shared.audio ? this.shared.audio.analysis.attack : 0) + (this.shared.night || 0) * 0.6) - (this.shared.sun ? this.shared.sun.intensity : 0) * 0.3;
	}
}
