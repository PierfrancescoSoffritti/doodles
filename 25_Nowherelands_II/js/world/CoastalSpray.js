import * as THREE from 'three';
import { config } from '../core/Config.js';
import { Random } from '../core/Random.js';
import { noiseGlsl } from './TerrainMaterial.js';
import { shoreWaveGlsl } from './ShoreWaves.js';
import { fogGlsl } from './FogGlsl.js';
import { weatherGlsl } from './weather/WeatherGlsl.js';
import { coastalEmitters } from './CoastalSprayData.js';

// A bounded set of ballistic spray fans at actual sea/rock intersections. The GPU
// shares the breaker clock with the water and cliff wash; no particle simulation/readback.
export class CoastalSpray {
	constructor(scene, shared) {
		this.shared = shared;
		this.anchors = coastalEmitters(shared.world, shared.heightmap);
		this.capacity = config.isTouch ? 160 : 320;
		this.perAnchor = config.isTouch ? 10 : 16;
		this.last = new THREE.Vector2(Infinity, Infinity);
		const count = this.capacity * this.perAnchor, rnd = new Random(config.seed + ':surf-spray');
		const base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
		g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
		this.origins = new Float32Array(count * 4);
		this.directions = new Float32Array(count * 2);
		const seeds = new Float32Array(count * 4);
		for (let i = 0; i < seeds.length; i++) seeds[i] = rnd.next();
		g.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(this.origins, 4).setUsage(THREE.DynamicDrawUsage));
		g.setAttribute('aOutward', new THREE.InstancedBufferAttribute(this.directions, 2).setUsage(THREE.DynamicDrawUsage));
		g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
		g.instanceCount = 0;
		this.uniforms = { ...shared.weather.uniforms, ...shared.fogUniforms, uTime: { value: 0 } };
		this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
			uniforms: this.uniforms, transparent: true, depthWrite: false,
			vertexShader: /* glsl */`
				attribute vec4 aOrigin, aSeed;
				attribute vec2 aOutward;
				uniform float uTime;
				varying vec2 vUv;
				varying float vAlpha;
				varying vec3 vWorld;
				${noiseGlsl}
				${shoreWaveGlsl}
				${weatherGlsl}
				void main() {
					vec2 origin = aOrigin.xy;
					float energy = clamp(uSurfEnergy - 1.0, 0.0, 3.0);
					float age = cliffAge(origin, uTime) * 8.4 - aSeed.x * 0.45;
					float live = step(0.0, age); age = max(0.0, age);
					// Offshore winds tear spray back out to sea; onshore winds carry it onto rock.
					float exposure = mix(0.6, 1.0, clamp(-dot(normalize(uWeatherWind + vec2(0.001)), aOutward), 0.0, 1.0));
					float launch = (7.0 + energy * 6.0) * sqrt(aOrigin.w) * (0.65 + 0.35 * aSeed.y) * exposure;
					float y = 1.0 + launch * age - 4.9 * age * age;
					vec2 tangent = vec2(-aOutward.y, aOutward.x);
					vec2 p = origin + aOutward * (2.0 + age * (2.0 + aSeed.z * 4.0))
						+ tangent * (aSeed.w - 0.5) * (14.0 + age * 7.0) + uWeatherWind * age * age * 0.065;
					vAlpha = live * smoothstep(0.0, 0.12, age) * smoothstep(0.0, 3.0, y)
						* (1.0 - smoothstep(1.8, 3.8, age)) * smoothstep(0.1, 0.9, energy)
						* (1.0 - smoothstep(3200.0, 4500.0, distance(origin, cameraPosition.xz)));
					vec3 wp = vec3(p.x, aOrigin.z + max(0.0, y), p.y);
					vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
					vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
					float size = (0.65 + age * (1.6 + energy * 0.8)) * (0.5 + aSeed.z);
					wp += (right * position.x + up * position.y) * size;
					vUv = uv; vWorld = wp;
					gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
				}`,
			fragmentShader: /* glsl */`
				varying vec2 vUv; varying float vAlpha; varying vec3 vWorld;
				uniform float uLightning;
				${fogGlsl}
				void main() {
					vec2 p = abs(vUv * 2.0 - 1.0);
					float shape = max(p.x * 0.86 + p.y * 0.5, p.y);
					float alpha = (1.0 - smoothstep(0.25, 1.0, shape)) * vAlpha * 0.62;
					if (alpha < 0.01) discard;
					gl_FragColor = vec4(applyFog(vec3(0.46, 0.51, 0.59) + uLightning * 0.45, vWorld, cameraPosition), alpha);
				}`,
		}));
		this.mesh.renderOrder = 3; this.mesh.frustumCulled = false;
		scene.add(this.mesh);
	}
	update(time, position) {
		this.uniforms.uTime.value = time;
		this.mesh.visible = this.shared.surfaceStreaming !== false && this.shared.weather.swell > 1.1;
		if (Math.hypot(position.x - this.last.x, position.z - this.last.y) < 128) return;
		this.last.set(position.x, position.z);
		const nearby = this.anchors.map(a => ({ a, d: Math.hypot(a.x - position.x, a.z - position.z) }))
			.filter(v => v.d < 4500).sort((a, b) => a.d - b.d).slice(0, this.capacity);
		let i = 0;
		for (const { a } of nearby) for (let j = 0; j < this.perAnchor; j++, i++) {
			this.origins.set([a.x, a.z, 0, a.strength], i * 4);
			this.directions.set([a.nx, a.nz], i * 2);
		}
		this.mesh.geometry.instanceCount = i;
		this.mesh.geometry.attributes.aOrigin.needsUpdate = true;
		this.mesh.geometry.attributes.aOutward.needsUpdate = true;
	}
}
