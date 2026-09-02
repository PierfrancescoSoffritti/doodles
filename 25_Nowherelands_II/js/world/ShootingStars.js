import * as THREE from 'three';
import { bus } from '../core/EventBus.js';

export class ShootingStars {
	constructor(parent, shared) {
		this.shared = shared;
		this.pool = [];
		const geometry = new THREE.PlaneGeometry(260, 5, 1, 1);
		geometry.translate(-130, 0, 0);
		for (let i = 0; i < 12; i++) {
			const material = new THREE.ShaderMaterial({
				uniforms: { uAlpha: { value: 0 } },
				transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
				vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
				fragmentShader: `uniform float uAlpha; varying vec2 vUv; void main(){ float t = vUv.x; float a = pow(t, 3.0) * (1.0 - pow(abs(vUv.y - 0.5) * 2.0, 2.0)) * uAlpha; gl_FragColor = vec4(vec3(1.0, 0.9, 1.0) * a * 2.5, a); }`,
			});
			const mesh = new THREE.Mesh(geometry, material);
			mesh.visible = false;
			mesh.frustumCulled = false;
			parent.add(mesh);
			this.pool.push({ mesh, life: 0, vel: new THREE.Vector3(), total: 1 });
		}
		this.timer = 8;
	}

	spawn() {
		const s = this.pool.find((m) => m.life <= 0);
		if (!s) return;
		const az = Math.random() * Math.PI * 2, el = 0.25 + Math.random() * 0.9;
		const r = 4800;
		const p = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(r);
		const tangent = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az));
		const down = new THREE.Vector3(0, -1, 0);
		const dir = tangent.multiplyScalar(Math.random() < 0.5 ? 1 : -1).lerp(down, 0.6).normalize();
		s.mesh.position.copy(p);
		s.vel.copy(dir).multiplyScalar(1800 + Math.random() * 900);
		s.life = s.total = 0.9 + Math.random() * 0.7;
		s.mesh.visible = true;
		// orient the streak along its velocity, viewed from the origin
		s.mesh.lookAt(0, 0, 0);
		const localDir = s.mesh.worldToLocal(p.clone().add(s.vel)).normalize();
		s.mesh.rotateZ(Math.atan2(localDir.y, localDir.x) + Math.PI);
		bus.emit('meteor', {});
	}

	update(dt) {
		const rate = this.shared.state.meteors > 0 ? 0.18 : 22;
		this.timer -= dt;
		if (this.timer <= 0) { this.spawn(); this.timer = rate * (0.5 + Math.random()); }
		for (const s of this.pool) {
			if (s.life <= 0) continue;
			s.life -= dt;
			s.mesh.position.addScaledVector(s.vel, dt);
			const t = s.life / s.total;
			s.mesh.material.uniforms.uAlpha.value = Math.sin(t * Math.PI);
			if (s.life <= 0) s.mesh.visible = false;
		}
	}
}
