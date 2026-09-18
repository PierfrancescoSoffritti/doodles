import * as THREE from 'three';
import { Random } from '../core/Random.js';
import { fogGlsl } from './FogGlsl.js';

// A small fixed budget of bank insects; scarlet fish live in WorldWaterLife. Habitat is resampled only after moving;
// all hovering and wing flicker runs in one GPU draw.
export class WatersideLife {
	constructor(scene, hm, shared) {
		this.hm = hm; this.shared = shared; this.x = this.z = 1e9;
		this.positions = new Float32Array(132 * 3); this.info = new Float32Array(132 * 3);
		const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3)); g.setAttribute('aLife', new THREE.BufferAttribute(this.info, 3));
		const uniforms = { uTime: shared.terrainUniforms.uTime, uCameraPos: shared.terrainUniforms.uCameraPos, uPixelRatio: { value: shared.renderer.getPixelRatio() }, ...shared.shoreMap.uniforms, ...shared.fogUniforms };
		this.points = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false,
			vertexShader: `attribute vec3 aLife;
			uniform float uTime, uPixelRatio; uniform vec3 uCameraPos;
			varying vec3 vWorldPos; varying vec3 vLife; varying float vAlpha;
			${shared.shoreMap.glsl}
			void main() {
				vec3 p = position; float phase = aLife.z * 100.0 + uTime * 1.8;
				p.x += sin(phase) * 0.65; p.z += cos(phase * 0.83) * 0.65;
				p.y += sin(phase * 2.0) * 0.35;
				float bed = terrainHeightAt(p.xz), wl = waterLevelAt(p.xz);
				vAlpha = aLife.y > 0.0 ? 1.0 - smoothstep(80.0, 160.0, distance(p, uCameraPos)) : 0.0;
				if (p.y < max(bed, wl) + 0.2) vAlpha = 0.0;
				vWorldPos = p; vLife = vec3(aLife.xy, phase);
				vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
				gl_PointSize = clamp(aLife.y * uPixelRatio * 560.0 / max(1.0, -mv.z), 1.0, 80.0);
			}`,
			fragmentShader: `uniform vec3 uCameraPos; varying vec3 vWorldPos, vLife; varying float vAlpha;
			${fogGlsl}
			void main() {
				if (vAlpha < 0.01) discard;
				vec2 p = gl_PointCoord - 0.5; vec3 col;
				if (length(p * vec2(1.0, 2.2)) > 0.43) discard;
				col = mix(vec3(0.12, 0.13, 0.2), vec3(0.56, 0.5, 0.61), pow(max(0.0, sin(vLife.z * 16.0)), 8.0));
				gl_FragColor = vec4(applyFog(col, vWorldPos, uCameraPos), vAlpha * 0.85);
			}` }));
		this.points.name = 'waterside-life'; this.points.renderOrder = 0; this.points.frustumCulled = false; scene.add(this.points);
	}
	update(camera) {
		if (Math.hypot(camera.x - this.x, camera.z - this.z) < 45) return;
		this.x = camera.x; this.z = camera.z;
		const rnd = new Random(`river-life:${Math.round(camera.x / 40)}:${Math.round(camera.z / 40)}`), hm = this.hm;
		this.info.fill(0); let count = 0, insects = 0;
		for (let attempt = 0; attempt < 400 && count < 132; attempt++) {
			const a = rnd.range(0, Math.PI * 2), r = rnd.range(8, 150), x = camera.x + Math.cos(a) * r, z = camera.z + Math.sin(a) * r;
			const bed = hm.sample(x, z), wl = hm._water, depth = wl - bed, foam = hm._foam;
			if (wl < 1 || wl > 650) continue;
			const isInsect = depth > -3 && depth < 0.7 && foam < 0.15 && insects < 132;
			if (!isInsect) continue;
			this.positions.set([x, Math.max(bed, wl) + rnd.range(1, 3.5), z], count * 3);
			this.info.set([1, rnd.range(0.12, 0.26), rnd.next()], count * 3);
			count++; insects++;
		}
		this.points.userData.population = { fish: 0, insects };
		this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.aLife.needsUpdate = true;
	}
}
