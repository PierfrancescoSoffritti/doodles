import * as THREE from 'three';
import { damp } from '../core/Utils.js';

const BOX = 260, HEIGHT = 170, COUNT = 26000;

export class Snow {
	constructor(scene, shared) {
		this.shared = shared;
		const pos = new Float32Array(COUNT * 3), extra = new Float32Array(COUNT * 2);
		for (let i = 0; i < COUNT; i++) {
			pos[i * 3] = Math.random() * BOX; pos[i * 3 + 1] = Math.random() * HEIGHT; pos[i * 3 + 2] = Math.random() * BOX;
			extra[i * 2] = 0.6 + Math.random() * 0.8;       // fall speed
			extra[i * 2 + 1] = 0.6 + Math.random() * 1.2;   // size
		}
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		geometry.setAttribute('aExtra', new THREE.BufferAttribute(extra, 2));
		this.uniforms = { uTime: { value: 0 }, uFall: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uAmount: { value: 0 }, uPixelRatio: { value: 1 }, uWind: { value: 0.4 } };
		this.points = new THREE.Points(geometry, new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
			vertexShader: /* glsl */`
				attribute vec2 aExtra;
				uniform float uTime, uFall, uAmount, uPixelRatio, uWind;
				uniform vec3 uCenter;
				varying float vA;
				void main() {
					vec3 p = position;
					p.y = mod(p.y - uFall * aExtra.x, ${HEIGHT}.0);
					p.x += sin(uTime * 0.6 + p.y * 0.05 + position.z) * 6.0 + uTime * uWind * 12.0;
					p.z += cos(uTime * 0.4 + p.y * 0.04) * 4.0;
					p.xz = uCenter.xz + mod(p.xz - uCenter.xz + ${BOX / 2}.0, ${BOX}.0) - ${BOX / 2}.0;
					p.y += uCenter.y - 60.0;
					vec4 mv = modelViewMatrix * vec4(p, 1.0);
					float dist = -mv.z;
					gl_PointSize = aExtra.y * 210.0 * uPixelRatio / max(dist, 1.0);
					// thinner snow shows fewer flakes, not just dimmer ones
					float show = step(1.0 - uAmount, fract(aExtra.y * 7.13 + aExtra.x * 3.71));
					vA = show * min(uAmount * 1.6, 1.0) * (1.0 - smoothstep(20.0, 150.0, dist));
					gl_Position = projectionMatrix * mv;
				}`,
			fragmentShader: /* glsl */`
				varying float vA;
				void main() {
					float d = length(gl_PointCoord - 0.5) * 2.0;
					float a = pow(max(1.0 - d, 0.0), 1.6) * vA;
					gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a * 1.6, a);
				}`,
		}));
		this.points.frustumCulled = false;
		this.points.visible = false;
		scene.add(this.points);
		this.amount = 0;
	}

	update(time, dt, cameraPos, renderer) {
		this.amount = damp(this.amount, this.shared.state.snow, 0.6, dt);
		this.shared.state.snowVisible = this.amount;
		this.points.visible = this.amount > 0.01;
		const u = this.uniforms;
		u.uTime.value = time;
		u.uFall.value += dt * (14 + 12 * this.amount);   // integrated so a change in intensity never runs the flakes backwards
		u.uAmount.value = this.amount;
		u.uCenter.value.copy(cameraPos);
		u.uPixelRatio.value = renderer.getPixelRatio();
	}
}
