import * as THREE from 'three';
import { noiseGlsl } from './TerrainMaterial.js';
import { fogGlsl } from './FogGlsl.js';
import { FALL_MESH_MIN } from './InlandWater.js';

// Waterfalls as things with volume: a sheet of water that leaves the lip on a parabola with a
// convex cross-section and a darker sheet behind it for parallax, a plunge disc where foam rings
// spread, fast spray thrown up from the impact line, and a slow mist drifting off the pool.
// The sheet is textured in its own space (across, along) so the streaks accelerate and aerate on
// the way down instead of scrolling a world-space pattern.

const g = 9.8;

export class Waterfalls {
	constructor(scene, world, shared) {
		this.shared = shared;
		const falls = world.rivers.flatMap((r) => r.falls).filter((f) => f.drop >= FALL_MESH_MIN);
		this.count = falls.length;
		this.uniforms = {
			uTime: { value: 0 },
			uCameraPos: { value: new THREE.Vector3() },
			uPixelRatio: { value: shared.renderer.getPixelRatio() },
			uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
			uMoonIntensity: { value: 1 },
			uSunIntensity: { value: 0 },
			uSkyColor: { value: new THREE.Color('#2b1a5e') },
			uSunColor: { value: new THREE.Color('#ff3b22') },
		};
		Object.assign(this.uniforms, shared.fogUniforms);
		this.buildSheets(scene, falls);
		this.buildSpray(scene, falls);
	}

	// ---------- sheets and plunge discs ----------
	buildSheets(scene, falls) {
		const pos = [], uv = [], info = [], idx = [];
		let seed = 0;
		for (const f of falls) {
			const fx = f.dx, fz = f.dz, rx = -fz, rz = fx;
			const w = f.w, drop = f.drop;
			const reach = 1.2 + drop * 0.2 + w * 0.02;
			const bulge = 0.5 + w * 0.035;
			const nC = Math.max(7, Math.round(w / 1.4) + 1), nR = 16;
			seed += 0.37;
			const sheet = (back) => {
				const base = pos.length / 3;
				for (let j = 0; j <= nR; j++) {
					const s = -0.06 + 1.06 * (j / nR);
					const sc = Math.max(s, 0);
					for (let i = 0; i <= nC; i++) {
						const u = (i / nC) * 2 - 1;
						const wf = 1 - 0.06 * sc + 0.16 * sc * sc;
						let forward = reach * sc + bulge * (1 - u * u) * (0.3 + 0.7 * sc) - Math.pow(Math.abs(u), 6) * 0.9;
						if (s < 0) forward = s * 4;                      // the roll over the lip
						if (back) forward -= 1.0 + w * 0.02;
						const down = drop * sc * sc;
						const x = f.x + fx * forward + rx * u * (w / 2) * wf;
						const z = f.z + fz * forward + rz * u * (w / 2) * wf;
						pos.push(x, f.top - down + (s < 0 ? 0.05 : 0), z);
						uv.push((u + 1) / 2, s);
						info.push(drop, w, back ? 1 : 0, seed);
					}
				}
				for (let j = 0; j < nR; j++) for (let i = 0; i < nC; i++) {
					const a = base + j * (nC + 1) + i, b = a + 1, c = a + nC + 1, d = c + 1;
					idx.push(a, c, b, b, c, d);
				}
			};
			sheet(true);
			sheet(false);
			// plunge disc: a fan on the pool, stretched along the flow
			{
				const cx = f.x + fx * (reach + 1), cz = f.z + fz * (reach + 1);
				const rad = w * 0.6 + 3 + drop * 0.08;
				const base = pos.length / 3;
				const segs = 18;
				pos.push(cx, f.bottom + 0.06, cz); uv.push(0, 0); info.push(drop, w, 2, seed);
				for (let k = 0; k <= segs; k++) {
					const a = (k / segs) * Math.PI * 2;
					const ox = Math.cos(a) * rad, oz = Math.sin(a) * rad;
					const along = ox * 1.35, side = oz;
					pos.push(cx + fx * along + rx * side, f.bottom + 0.06, cz + fz * along + rz * side);
					uv.push(k / segs, 1); info.push(drop, w, 2, seed);
				}
				for (let k = 0; k < segs; k++) idx.push(base, base + 1 + k, base + 2 + k);
			}
		}
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
		geometry.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 4));
		geometry.setIndex(idx);
		geometry.computeBoundingSphere();
		this.sheet = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			transparent: true, depthWrite: false, side: THREE.DoubleSide,
			vertexShader: /* glsl */`
				attribute vec4 aInfo;
				varying vec2 vUv; varying vec4 vInfo; varying vec3 vWorldPos;
				void main() {
					vUv = uv; vInfo = aInfo;
					vec4 wp = modelMatrix * vec4(position, 1.0);
					vWorldPos = wp.xyz;
					gl_Position = projectionMatrix * viewMatrix * wp;
				}`,
			fragmentShader: /* glsl */`
				uniform float uTime, uMoonIntensity, uSunIntensity;
				uniform vec3 uCameraPos, uMoonDir, uSkyColor, uSunColor;
				varying vec2 vUv; varying vec4 vInfo; varying vec3 vWorldPos;
				${noiseGlsl}
				${fogGlsl}
				void main() {
					float drop = vInfo.x, w = vInfo.y, part = vInfo.z, seed = vInfo.w * 37.0;
					float u = vUv.x, v = vUv.y;
					float light = 0.45 + 0.55 * uMoonIntensity + 0.25 * uSunIntensity;
					vec3 tint = mix(vec3(0.62, 0.68, 0.85), uSunColor, uSunIntensity * 0.35);
					vec3 col; float alpha;
					if (part < 1.5) {
						// falling sheet: water speeds up on the way down, so the texture stretches and pans faster
						float vv = pow(max(v, 0.0), 0.65) * (0.35 + drop * 0.045);
						float speed = 2.2 + drop * 0.09;
						float t = uTime * speed;
						float s1 = vnoise(vec2(u * w * 0.7 + seed, (vv - t * 0.25) * 4.0));
						float s2 = vnoise(vec2(u * w * 1.9 + seed * 3.1, (vv - t * 0.42) * 9.0 + 3.0));
						float s3 = vnoise(vec2(u * w * 0.28 + 9.0, (vv - t * 0.12) * 1.6));
						float ribs = vnoise(vec2(u * w * 4.5 + 2.0, (vv - t * 0.7) * 22.0));
						float n = s1 * 0.42 + s2 * 0.3 + s3 * 0.18 + ribs * 0.1;
						float aer = clamp(v * 0.9 + 0.1, 0.0, 1.0);                       // aeration grows downward
						float foam = smoothstep(0.42 - aer * 0.18, 0.62 - aer * 0.1, n);
						float fray = 0.1 + 0.22 * v;
						float edge = smoothstep(0.0, fray, u) * smoothstep(0.0, fray, 1.0 - u);
						edge *= 0.55 + 0.45 * smoothstep(0.3, 0.7, vnoise(vec2(u * 7.0 + seed, v * 4.0 - uTime * 1.5)));
						float top = smoothstep(-0.06, 0.03, v);
						float bottom = 1.0 - smoothstep(0.86, 1.0, v) * (0.35 + 0.35 * vnoise(vec2(u * 9.0, uTime * 3.0)));
						vec3 water = mix(vec3(0.1, 0.13, 0.26), uSkyColor * 1.5, 0.3);
						vec3 white = tint * (0.85 + 0.2 * v);
						col = mix(water, white, foam * (0.55 + 0.45 * aer)) * light;
						alpha = edge * top * bottom * (0.82 + 0.18 * foam);
						if (part > 0.5) { col *= 0.55; alpha *= 0.85; }
					} else {
						// plunge disc: rings of foam spreading from the impact, torn by turbulence
						float r = v, ang = u * 6.2832;
						float ring = smoothstep(0.55, 0.9, fract(r * 3.2 - uTime * 1.3 + vnoise(vec2(ang * 1.5, seed)) * 0.4));
						float chop = vnoise(vec2(cos(ang) * 6.0 + seed, sin(ang) * 6.0 + r * 5.0 - uTime * 2.5));
						float core = 1.0 - smoothstep(0.0, 0.45, r);
						float foam = clamp(core * 1.2 + ring * (1.0 - r) * 0.9, 0.0, 1.0) * (0.55 + 0.45 * chop);
						col = tint * (0.6 + 0.35 * foam) * light;
						alpha = foam * (1.0 - smoothstep(0.7, 1.0, r)) * 0.85;
					}
					col = applyFog(col, vWorldPos, uCameraPos);
					gl_FragColor = vec4(col, alpha);
				}`,
		}));
		this.sheet.frustumCulled = true;
		this.sheet.renderOrder = 2;
		if (this.count) scene.add(this.sheet);
	}

	// ---------- spray and mist ----------
	buildSpray(scene, falls) {
		const base = [], vel = [], info = [];
		for (const f of falls) {
			const fx = f.dx, fz = f.dz, rx = -fz, rz = fx;
			const reach = 1.2 + f.drop * 0.2 + f.w * 0.02;
			const ix = f.x + fx * (reach + 0.6), iz = f.z + fz * (reach + 0.6);
			const nSpray = Math.min(160, Math.round(24 + f.w * 2.2 + f.drop * 2.2));
			const nMist = Math.min(60, Math.round(10 + f.w * 0.8 + f.drop * 0.6));
			for (let k = 0; k < nSpray; k++) {
				const u = Math.random() * 2 - 1;
				base.push(ix + rx * u * f.w * 0.48, f.bottom, iz + rz * u * f.w * 0.48);
				const up = 3 + Math.random() * (4 + f.drop * 0.12);
				const out = 1 + Math.random() * 3.5, side = (Math.random() - 0.5) * 3;
				vel.push(fx * out + rx * side, up, fz * out + rz * side);
				// phase, life, size, kind
				info.push(Math.random(), 0.55 + Math.random() * 0.6, 0.25 + Math.random() * 0.55, 0);
			}
			for (let k = 0; k < nMist; k++) {
				const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
				base.push(ix + rx * Math.cos(a) * r * (f.w * 0.6 + 3) + fx * Math.sin(a) * r * 3, f.bottom + 0.5, iz + rz * Math.cos(a) * r * (f.w * 0.6 + 3) + fz * Math.sin(a) * r * 3);
				vel.push(fx * (0.4 + Math.random() * 0.8) + rx * (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.8, fz * (0.4 + Math.random() * 0.8) + rz * (Math.random() - 0.5) * 0.8);
				info.push(Math.random(), 2.5 + Math.random() * 2.5, 1.5 + Math.random() * 2.5 + f.drop * 0.04, 1);
			}
		}
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(base, 3));
		geometry.setAttribute('aVel', new THREE.Float32BufferAttribute(vel, 3));
		geometry.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 4));
		this.points = new THREE.Points(geometry, new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			transparent: true, depthWrite: false,
			vertexShader: /* glsl */`
				attribute vec3 aVel;
				attribute vec4 aInfo;
				uniform float uTime, uPixelRatio;
				uniform vec3 uCameraPos;
				varying float vAlpha, vKind, vSeed;
				void main() {
					float life = aInfo.y, kind = aInfo.w;
					float t = fract(uTime / life + aInfo.x);
					float age = t * life;
					vec3 p;
					float size;
					if (kind < 0.5) {
						// spray: thrown up and out, pulled back down
						p = position + aVel * age - vec3(0.0, 0.5 * ${g.toFixed(1)} * 0.6 * age * age, 0.0);
						size = aInfo.z * (0.6 + 1.6 * t);
						vAlpha = (1.0 - t) * (1.0 - t) * 0.75;
					} else {
						// mist: drifts up and away, thinning
						p = position + aVel * age * (1.0 - 0.3 * t);
						size = aInfo.z * (0.7 + 1.3 * t);
						vAlpha = sin(t * 3.14159) * 0.14;
					}
					float dist = distance(p, uCameraPos);
					vAlpha *= (1.0 - smoothstep(220.0, 520.0, dist)) * smoothstep(3.0, 9.0, dist);
					vec4 mv = viewMatrix * vec4(p, 1.0);
					gl_PointSize = size * uPixelRatio * 520.0 / max(-mv.z, 1.0);
					gl_Position = projectionMatrix * mv;
					vKind = kind; vSeed = aInfo.x * 40.0;
				}`,
			fragmentShader: /* glsl */`
				uniform float uMoonIntensity, uSunIntensity, uTime;
				uniform vec3 uSunColor;
				varying float vAlpha, vKind, vSeed;
				${noiseGlsl}
				void main() {
					vec2 c = gl_PointCoord - 0.5;
					float d = length(c) * 2.0;
					// ragged droplets rather than perfect discs
					float rag = vnoise(c * 5.0 + vSeed + uTime * 0.5);
					float a = smoothstep(1.0, 0.25, d + (rag - 0.5) * 0.5) * vAlpha;
					float light = 0.5 + 0.5 * uMoonIntensity + 0.25 * uSunIntensity;
					vec3 col = mix(vec3(0.72, 0.78, 0.92), uSunColor, uSunIntensity * 0.3) * light;
					gl_FragColor = vec4(col, a);
				}`,
		}));
		this.points.frustumCulled = false;
		this.points.renderOrder = 3;
		if (this.count) scene.add(this.points);
	}

	update(time, cameraPos) {
		const u = this.uniforms, s = this.shared;
		u.uTime.value = time;
		u.uCameraPos.value.copy(cameraPos);
		u.uMoonDir.value.copy(s.moon.dir);
		u.uMoonIntensity.value = s.moon.intensity;
		u.uSunIntensity.value = s.sun.intensity;
		u.uSkyColor.value.copy(s.terrainUniforms.uSkyColor.value);
		u.uSunColor.value.copy(s.terrainUniforms.uSunColor.value);
	}
}
