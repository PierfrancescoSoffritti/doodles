import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Ripples } from './Ripples.js';
import { hslGlsl } from './TerrainMaterial.js';

export class Water {
	constructor(scene, shared, waterLevel) {
		const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
		Object.assign(uniforms, {
			color: { value: new THREE.Color('#ffffff') },
			tDiffuse: { value: null },
			textureMatrix: { value: new THREE.Matrix4() },
			uTime: { value: 0 },
			uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
			uMoonColor: { value: new THREE.Color('#ffd7f3') },
			uMoonIntensity: { value: 1 },
			uSunDir: { value: new THREE.Vector3(0, -1, 0) },
			uSunIntensity: { value: 0 },
			uCameraPos: { value: new THREE.Vector3() },
			uHue: { value: 0.8 },
			uBass: { value: 0 },
			uWaterLevel: { value: waterLevel },
			uRain: { value: 0 },
		}, shared.ripples.uniforms, shared.shoreMap.uniforms);

		const shader = {
			name: 'NowhereWater',
			uniforms,
			vertexShader: /* glsl */`
				#include <fog_pars_vertex>
				uniform mat4 textureMatrix;
				varying vec4 vUv4;
				varying vec3 vWorldPos;
				void main() {
					vec4 worldPosition = modelMatrix * vec4(position, 1.0);
					vWorldPos = worldPosition.xyz;
					vUv4 = textureMatrix * vec4(position, 1.0);
					vec4 mvPosition = viewMatrix * worldPosition;
					gl_Position = projectionMatrix * mvPosition;
					#include <fog_vertex>
				}`,
			fragmentShader: /* glsl */`
				#include <fog_pars_fragment>
				uniform sampler2D tDiffuse;
				uniform vec3 color, uMoonDir, uMoonColor, uCameraPos, uSunDir;
				uniform float uSunIntensity;
				uniform float uTime, uMoonIntensity, uHue, uBass, uWaterLevel, uRain;
				varying vec4 vUv4;
				varying vec3 vWorldPos;
				${hslGlsl}
				${Ripples.glsl()}
				${shared.shoreMap.glsl}
				float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
				float vnoise(vec2 p) {
					vec2 i = floor(p), f = fract(p);
					f = f * f * (3.0 - 2.0 * f);
					return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
				}
				float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += vnoise(p) * a; p *= 2.03; a *= 0.5; } return s; }
				void main() {
					vec2 p = vWorldPos.xz;
					float w1 = sin(p.x * 0.09 + uTime * 0.6) + sin(p.y * 0.07 - uTime * 0.45);
					float w2 = sin((p.x + p.y) * 0.05 + uTime * 0.35);
					vec3 n = normalize(vec3(w1 * 0.006, 1.0, w2 * 0.006));
					vec3 V = normalize(uCameraPos - vWorldPos);
					vec3 R = reflect(-V, n);
					float fresnel = pow(clamp(1.0 - dot(V, n), 0.0, 1.0), 2.5);

					float depth = uWaterLevel - terrainHeightAt(p);        // how deep the water is here
					float shallow = 1.0 - smoothstep(0.0, 6.0, depth);

					vec3 ripple = rippleGlow(p, uTime);
					vec3 coord = vUv4.xyz / max(vUv4.w, 1e-4);
					coord.xy += n.xz * 0.12;
					vec3 refl = texture2D(tDiffuse, coord.xy).rgb;

					// flat stylized water: a deep violet-blue with only a hint of the reflection
					vec3 base = vec3(0.03, 0.03, 0.11);
					vec3 col = mix(base, refl * 0.6, 0.18 + 0.3 * fresnel);
					col = mix(col, vec3(0.06, 0.16, 0.24), shallow * 0.35);
					col = mix(col, vec3(0.12, 0.04, 0.11), uSunIntensity * 0.2);
					// a long red glitter path under the low sun
					float sunSpec = pow(max(dot(R, uSunDir), 0.0), 220.0) * 2.2 + pow(max(dot(R, uSunDir), 0.0), 10.0) * 0.2;
					col += vec3(1.0, 0.25, 0.1) * sunSpec * uSunIntensity;

					// cel-shaded foam: hard-edged outline rings that follow the shore and drift slowly
					float wobble = vnoise(p * 0.11 + uTime * 0.08) * 1.0 + vnoise(p * 0.03 - uTime * 0.04) * 1.2;
					float dd = depth + wobble - 1.4;
					float edge = 1.0 - step(0.4, dd);                                  // solid band at the waterline
					float ring1 = step(abs(dd - 1.55), 0.16);
					float ring2 = step(abs(dd - 2.75), 0.11) * step(0.35, vnoise(p * 0.3 + uTime * 0.05));
					float gapNoise = step(0.28, vnoise(p * 0.22 - uTime * 0.06));     // breaks the rings into dashes
					float foam = clamp(edge + (ring1 + ring2) * gapNoise, 0.0, 1.0) * step(0.0, depth + 0.3);
					col = mix(col, vec3(0.56, 0.6, 0.72), foam);

					float spec = pow(max(dot(R, uMoonDir), 0.0), 500.0) * 2.5 + pow(max(dot(R, uMoonDir), 0.0), 24.0) * 0.18;
					col += uMoonColor * spec * uMoonIntensity;


					col += ripple * 1.2;

					// raindrop rings: each cell spawns an expanding ring on its own phase
					if (uRain > 0.02) {
						float rainNear = 1.0 - smoothstep(40.0, 170.0, distance(vWorldPos, uCameraPos));
						float density = pow(uRain, 1.6) * 0.7;
						vec2 cell = floor(p / 8.0), cf = fract(p / 8.0) - 0.5;
						float ph = hash(cell * 1.3);
						float life = fract(uTime * 1.0 + ph);
						vec2 c = vec2(hash(cell + 1.7), hash(cell + 3.1)) - 0.5;
						float r = life * 0.42;
						float ring = step(abs(length(cf - c) - r), 0.025) * (1.0 - life) * step(hash(cell + 9.1), density);
						col += vec3(0.5, 0.55, 0.7) * ring * 0.8 * rainNear;
					}

					gl_FragColor = vec4(max(col, 0.0), 1.0);
					#include <fog_fragment>
				}`,
		};

		const geometry = new THREE.PlaneGeometry(14000, 14000);
		this.mesh = new Reflector(geometry, { textureWidth: 768, textureHeight: 768, clipBias: 0.02, shader, multisample: 0 });
		this.mesh.material.fog = true;
		this.mesh.rotation.x = -Math.PI / 2;
		this.mesh.position.y = waterLevel;
		this.uniforms = this.mesh.material.uniforms;
		// Reflector clones its uniforms (textures included); share the live shore-map uniforms instead
		Object.assign(this.uniforms, shared.shoreMap.uniforms);
		scene.add(this.mesh);
	}

	update(time, playerPos, shared) {
		this.mesh.position.x = Math.round(playerPos.x / 64) * 64;
		this.mesh.position.z = Math.round(playerPos.z / 64) * 64;
		const u = this.uniforms;
		u.uTime.value = time;
		u.uCameraPos.value.copy(playerPos);
		u.uMoonDir.value.copy(shared.moon.dir);
		u.uMoonIntensity.value = shared.moon.intensity;
		u.uSunDir.value.copy(shared.sun.dir);
		u.uSunIntensity.value = shared.sun.intensity;
		u.uHue.value = shared.hue;
		u.uBass.value = shared.audio ? shared.audio.analysis.bass : 0;
	}
}
