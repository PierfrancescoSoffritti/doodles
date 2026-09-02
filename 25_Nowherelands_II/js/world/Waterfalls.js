import * as THREE from 'three';

// Mist at the foot of every waterfall: a cloud of soft sprites rising and spreading from the
// plunge pool, animated entirely on the GPU from a phase per particle.
export class Waterfalls {
	constructor(scene, world, shared) {
		const falls = world.rivers.flatMap((r) => r.falls).filter((f) => f.drop >= 5);
		this.count = falls.length;
		const base = [], info = [];
		for (const f of falls) {
			const n = Math.min(90, 14 + Math.round(f.w * 0.8 + f.drop * 1.2));
			for (let k = 0; k < n; k++) {
				const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
				base.push(f.x, f.bottom, f.z);
				// phase, spread x, spread z, scale
				info.push(Math.random(), Math.cos(a) * r * (f.w * 0.7 + 4), Math.sin(a) * r * (f.w * 0.7 + 4), 0.6 + f.drop * 0.02);
			}
		}
		this.uniforms = { uTime: { value: 0 }, uCameraPos: { value: new THREE.Vector3() }, uPixelRatio: { value: shared.renderer.getPixelRatio() }, uFogColor: shared.fogUniforms.uFogColor };
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(base, 3));
		geometry.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 4));
		this.points = new THREE.Points(geometry, new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
			vertexShader: /* glsl */`
				attribute vec4 aInfo;
				uniform float uTime, uPixelRatio;
				uniform vec3 uCameraPos;
				varying float vAlpha;
				void main() {
					float t = fract(uTime * 0.22 + aInfo.x);
					// spray stays low: it billows out from the plunge pool and settles
					float rise = t * (2.0 + aInfo.w * 4.0) * (1.0 - t * 0.4);
					vec3 p = position + vec3(aInfo.y * (0.3 + t * 1.1), rise, aInfo.z * (0.3 + t * 1.1));
					float dist = distance(p, uCameraPos);
					vAlpha = sin(t * 3.14159) * 0.12 * (1.0 - smoothstep(200.0, 500.0, dist)) * smoothstep(4.0, 12.0, dist);
					vec4 mv = viewMatrix * vec4(p, 1.0);
					gl_PointSize = (1.5 + t * 3.5) * aInfo.w * uPixelRatio * 260.0 / max(-mv.z, 1.0);
					gl_Position = projectionMatrix * mv;
				}`,
			fragmentShader: /* glsl */`
				uniform vec3 uFogColor;
				varying float vAlpha;
				void main() {
					float d = length(gl_PointCoord - 0.5) * 2.0;
					float a = pow(max(1.0 - d, 0.0), 1.8) * vAlpha;
					gl_FragColor = vec4(mix(vec3(0.55, 0.6, 0.78), uFogColor * 2.0, 0.35), a);   // additive blending applies the alpha itself
				}`,
		}));
		this.points.frustumCulled = false;
		if (this.count) scene.add(this.points);
	}

	update(time, cameraPos) {
		this.uniforms.uTime.value = time;
		this.uniforms.uCameraPos.value.copy(cameraPos);
	}
}
