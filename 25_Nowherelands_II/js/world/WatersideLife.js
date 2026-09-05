import * as THREE from 'three';
import { Random } from '../core/Random.js';
import { RIVER_STRIDE as S, RV } from './gen/Rivers.js';
import { fogGlsl } from './FogGlsl.js';

// A small fixed budget of fish and bank insects. Habitat is resampled only after moving;
// all swimming, hovering and wing flicker runs in one GPU draw.
export class WatersideLife {
	constructor(scene, hm, shared) {
		this.hm = hm; this.shared = shared; this.x = this.z = 1e9;
		this.positions = new Float32Array(160 * 3); this.info = new Float32Array(160 * 3);
		const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3)); g.setAttribute('aLife', new THREE.BufferAttribute(this.info, 3));
		const uniforms = { uTime: shared.terrainUniforms.uTime, uCameraPos: shared.terrainUniforms.uCameraPos, uPixelRatio: { value: shared.renderer.getPixelRatio() }, ...shared.shoreMap.uniforms, ...shared.fogUniforms };
		this.points = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false,
			vertexShader: `attribute vec3 aLife;
			uniform float uTime, uPixelRatio; uniform vec3 uCameraPos;
			varying vec3 vWorldPos; varying vec3 vLife; varying float vAlpha;
			${shared.shoreMap.glsl}
			void main() {
				vec3 p = position; float phase = aLife.z * 100.0 + uTime * (aLife.x < 0.5 ? 0.35 : 1.8);
				p.x += sin(phase) * (aLife.x < 0.5 ? 2.0 : 0.65); p.z += cos(phase * 0.83) * (aLife.x < 0.5 ? 1.5 : 0.65);
				p.y += sin(phase * 2.0) * (aLife.x < 0.5 ? 0.12 : 0.35);
				float bed = terrainHeightAt(p.xz), wl = waterLevelAt(p.xz);
				vAlpha = aLife.y > 0.0 ? 1.0 - smoothstep(80.0, 160.0, distance(p, uCameraPos)) : 0.0;
				if (aLife.x < 0.5 && (p.y < bed + 0.15 || p.y > wl - 0.2)) vAlpha = 0.0;
				if (aLife.x > 0.5 && p.y < max(bed, wl) + 0.2) vAlpha = 0.0;
				vWorldPos = p; vLife = vec3(aLife.xy, phase);
				vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
				gl_PointSize = clamp(aLife.y * uPixelRatio * 560.0 / max(1.0, -mv.z), 1.0, 80.0);
			}`,
			fragmentShader: `uniform vec3 uCameraPos; varying vec3 vWorldPos, vLife; varying float vAlpha;
			${fogGlsl}
			void main() {
				if (vAlpha < 0.01) discard;
				vec2 p = gl_PointCoord - 0.5; vec3 col;
				if (vLife.x < 0.5) {
					float angle = sin(vLife.z) * 0.25; p = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;
					float body = length(p * vec2(2.7, 7.0));
					bool tail = p.x < -0.2 && p.x > -0.48 && abs(p.y + sin(vLife.z * 12.0) * 0.025) < (-p.x - 0.18) * 0.65;
					if (body > 1.0 && !tail) discard; col = vec3(0.018, 0.03, 0.035);
				} else {
					if (length(p * vec2(1.0, 2.2)) > 0.43) discard;
					col = mix(vec3(0.12, 0.13, 0.2), vec3(0.56, 0.5, 0.61), pow(max(0.0, sin(vLife.z * 16.0)), 8.0));
				}
				gl_FragColor = vec4(applyFog(col, vWorldPos, uCameraPos), vAlpha * 0.85);
			}` }));
		this.points.name = 'waterside-life'; this.points.renderOrder = 0; this.points.frustumCulled = false; scene.add(this.points);
	}
	update(camera) {
		if (Math.hypot(camera.x - this.x, camera.z - this.z) < 45) return;
		this.x = camera.x; this.z = camera.z;
		const rnd = new Random(`river-life:${Math.round(camera.x / 40)}:${Math.round(camera.z / 40)}`), hm = this.hm;
		this.info.fill(0); let count = 0, fish = 0, insects = 0;
		for (let attempt = 0; attempt < 400 && count < 160; attempt++) {
			const a = rnd.range(0, Math.PI * 2), r = rnd.range(8, 150), x = camera.x + Math.cos(a) * r, z = camera.z + Math.sin(a) * r;
			const bed = hm.sample(x, z), wl = hm._water, depth = wl - bed, seg = hm._riverSeg, foam = hm._foam;
			if (wl < 1 || wl > 650) continue;
			let speed = 0;
			if (seg >= 0) { const river = hm.world.rivers[hm.rivers.segRiver[seg]]; speed = river.data[hm.rivers.segIndex[seg] * S + RV.SPEED]; }
			const isFish = depth > 0.8 && depth < 5 && speed < 2.8 && foam < 0.1 && fish < 28;
			const isInsect = depth > -3 && depth < 0.7 && foam < 0.15 && insects < 132;
			if (!isFish && !isInsect) continue;
			this.positions.set([x, isFish ? wl - Math.min(1.5, depth * 0.55) : Math.max(bed, wl) + rnd.range(1, 3.5), z], count * 3);
			this.info.set([isFish ? 0 : 1, isFish ? rnd.range(0.9, 1.8) : rnd.range(0.12, 0.26), rnd.next()], count * 3);
			count++; if (isFish) fish++; else insects++;
		}
		this.points.userData.population = { fish, insects };
		this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.aLife.needsUpdate = true;
	}
}
