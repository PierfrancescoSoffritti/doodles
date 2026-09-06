import * as THREE from 'three';
import { damp } from '../core/Utils.js';

export class Aurora {
	constructor(parent, shared) {
		this.shared = shared;
		this.uniforms = { uTime: { value: 0 }, uIntensity: { value: 0.3 }, uAudio: { value: 0 } };
		const geometry = new THREE.PlaneGeometry(7600, 1900, 128, 8);
		const pos = geometry.attributes.position;
		for (let i = 0; i < pos.count; i++) {
			const x = pos.getX(i);
			pos.setZ(i, -(x * x) * 0.00009);   // gentle arc bending away from the viewer
		}
		this.mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
			vertexShader: /* glsl */`
				varying vec2 vUv;
				void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
			fragmentShader: /* glsl */`
				uniform float uTime, uIntensity, uAudio;
				varying vec2 vUv;
				float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
				float vnoise(vec2 p) {
					vec2 i = floor(p), f = fract(p);
					f = f * f * (3.0 - 2.0 * f);
					return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
				}
				float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += vnoise(p) * a; p *= 2.1; a *= 0.5; } return s; }
				void main() {
					float u = vUv.x, v = vUv.y;
					float t = uTime * 0.06;
					float curtain = fbm(vec2(u * 5.0 + t, t * 0.6));
					float streak = 0.5 + 0.5 * sin(u * 140.0 + curtain * 14.0 + uTime * 0.4);
					streak = pow(streak, 2.0);
					float shape = smoothstep(0.0, 0.08, v) * pow(clamp(1.0 - v, 0.0, 1.0), 1.6) * smoothstep(0.0, 0.15, u) * (1.0 - smoothstep(0.85, 1.0, u));
					float wave = smoothstep(0.25, 0.75, curtain + 0.25 * sin(u * 9.0 - uTime * 0.2));
					float a = shape * wave * (0.5 + 0.5 * streak) * uIntensity * (1.0 + uAudio * 0.8);
					vec3 c1 = vec3(0.25, 1.0, 0.65), c2 = vec3(0.6, 0.35, 1.0), c3 = vec3(1.0, 0.4, 0.8);
					vec3 col = mix(c1, c2, v);
					col = mix(col, c3, uAudio * 0.5 * v);
					gl_FragColor = vec4(col * a * 1.3, a);
				}`,
		}));
		this.mesh.position.set(0, 2300, -3000);
		this.mesh.rotation.x = -0.45;
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = -7;
		parent.add(this.mesh);
		this.intensity = 0.3;
	}

	update(time, dt) {
		const target = 0.22 + this.shared.state.aurora * 0.7;
		this.intensity = damp(this.intensity, target, 0.5, dt);
		this.uniforms.uTime.value = time;
		this.uniforms.uIntensity.value = this.intensity * (1 - (this.shared.state.storm || 0) * 0.98);
		this.uniforms.uAudio.value = this.shared.audio ? this.shared.audio.analysis.high : 0;
	}
}
