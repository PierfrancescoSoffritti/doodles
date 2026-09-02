import * as THREE from 'three';
import { damp } from '../core/Utils.js';

const BOX = 200, HEIGHT = 120, COUNT = 9000;

// Cozy rain: thin streaks falling around the player, fading in and out with the event.
export class Rain {
	constructor(scene, shared) {
		this.shared = shared;
		const pos = new Float32Array(COUNT * 3), extra = new Float32Array(COUNT * 2);
		for (let i = 0; i < COUNT; i++) {
			pos[i * 3] = Math.random() * BOX; pos[i * 3 + 1] = Math.random() * HEIGHT; pos[i * 3 + 2] = Math.random() * BOX;
			extra[i * 2] = 0.8 + Math.random() * 0.5;    // fall speed
			extra[i * 2 + 1] = 0.7 + Math.random() * 0.8; // size
		}
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		geometry.setAttribute('aExtra', new THREE.BufferAttribute(extra, 2));
		this.uniforms = { uFall: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uAmount: { value: 0 }, uPixelRatio: { value: 1 } };
		this.points = new THREE.Points(geometry, new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
			vertexShader: /* glsl */`
				attribute vec2 aExtra;
				uniform float uFall, uAmount, uPixelRatio;
				uniform vec3 uCenter;
				varying float vA;
				void main() {
					vec3 p = position;
					p.y = mod(p.y - uFall * aExtra.x, ${HEIGHT}.0);
					p.x += uFall * 0.06;   // a slight slant
					p.xz = uCenter.xz + mod(p.xz - uCenter.xz + ${BOX / 2}.0, ${BOX}.0) - ${BOX / 2}.0;
					p.y += uCenter.y - 40.0;
					vec4 mv = modelViewMatrix * vec4(p, 1.0);
					float dist = -mv.z;
					gl_PointSize = aExtra.y * 320.0 * uPixelRatio / max(dist, 1.0);
					float show = step(1.0 - uAmount, fract(aExtra.y * 5.13 + aExtra.x * 2.71));
					vA = show * min(uAmount * 1.2, 1.0) * (1.0 - smoothstep(15.0, 110.0, dist)) * 1.1;
					gl_Position = projectionMatrix * mv;
				}`,
			fragmentShader: /* glsl */`
				varying float vA;
				void main() {
					vec2 c = gl_PointCoord - 0.5;
					float streak = (1.0 - smoothstep(0.0, 0.06, abs(c.x))) * (1.0 - smoothstep(0.3, 0.5, abs(c.y)));
					float a = streak * vA;
					gl_FragColor = vec4(vec3(0.6, 0.7, 0.9) * a, a);
				}`,
		}));
		this.points.frustumCulled = false;
		this.points.visible = false;
		scene.add(this.points);
		this.amount = 0;
	}

	update(dt, cameraPos, renderer) {
		this.amount = damp(this.amount, this.shared.state.rain || 0, 0.6, dt);
		this.shared.state.rainVisible = this.amount;
		this.points.visible = this.amount > 0.01;
		const u = this.uniforms;
		u.uFall.value += dt * 75;
		u.uAmount.value = this.amount;
		u.uCenter.value.copy(cameraPos);
		u.uPixelRatio.value = renderer.getPixelRatio();
	}
}
