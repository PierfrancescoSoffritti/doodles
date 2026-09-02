import * as THREE from 'three';
import { damp } from '../core/Utils.js';

// A drifting layer of flat, cel-shaded clouds projected onto the sky. Cover grows with weather.
export class Clouds {
	constructor(parent, shared) {
		this.shared = shared;
		this.uniforms = {
			uTime: { value: 0 },
			uCover: { value: 0.3 },
			uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
			uLit: { value: new THREE.Color('#7a5aa6') },
			uDark: { value: new THREE.Color('#12091f') },
			uDim: { value: 1 },
		};
		this.mesh = new THREE.Mesh(new THREE.SphereGeometry(5500, 48, 24), new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			side: THREE.BackSide, transparent: true, depthWrite: false,
			vertexShader: /* glsl */`
				varying vec3 vDir;
				void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
			fragmentShader: /* glsl */`
				uniform float uTime, uCover, uDim;
				uniform vec3 uMoonDir, uLit, uDark;
				varying vec3 vDir;
				float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
				float vnoise(vec2 p) {
					vec2 i = floor(p), f = fract(p);
					f = f * f * (3.0 - 2.0 * f);
					return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
				}
				float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += vnoise(p) * a; p = p * 2.02 + 17.0; a *= 0.5; } return s; }
				void main() {
					vec3 d = normalize(vDir);
					if (d.y < 0.02) discard;
					// project onto a flat layer overhead so the clouds read as a ceiling drifting by
					vec2 uv = d.xz / (d.y + 0.25) * 0.9 + vec2(uTime * 0.006, uTime * 0.0025);
					float n = fbm(uv * 1.6);
					float threshold = 1.0 - uCover;
					float cloud = smoothstep(threshold - 0.06, threshold + 0.08, n);
					// underside shading: sample toward the moon to find the lit edge
					float n2 = fbm(uv * 1.6 + uMoonDir.xz * 0.06);
					float lit = smoothstep(-0.05, 0.12, n2 - n);
					vec3 col = mix(uDark, uLit, lit * 0.8 + 0.1) * uDim;
					float horizon = smoothstep(0.02, 0.2, d.y);
					float a = cloud * horizon * 0.92;
					gl_FragColor = vec4(col, a);
				}`,
		}));
		this.mesh.renderOrder = -6;
		this.mesh.frustumCulled = false;
		parent.add(this.mesh);
		this.cover = 0.4;
	}

	update(time, dt, shared, dim) {
		const s = shared.state;
		const target = 0.4 + (s.rain || 0) * 0.4 + (s.snow || 0) * 0.28 + (s.eclipse || 0) * 0.1 - (s.aurora || 0) * 0.15;
		this.cover = damp(this.cover, Math.max(0.05, target), 0.08, dt);
		const u = this.uniforms;
		u.uTime.value = time;
		u.uCover.value = this.cover;
		u.uMoonDir.value.copy(shared.moon.dir);
		const sun = shared.sun ? shared.sun.intensity : 0;
		u.uDim.value = 0.35 + 0.65 * dim * Math.max(shared.moon.intensity, sun) + 0.15;
		u.uLit.value.set('#7a5aa6').lerp(new THREE.Color('#c0352a'), sun * 0.8);
		u.uDark.value.set('#12091f').lerp(new THREE.Color('#2a0a14'), sun);
		u.uMoonDir.value.copy(sun > shared.moon.intensity ? shared.sun.dir : shared.moon.dir);
	}
}
