import * as THREE from 'three';
import { noiseGlsl } from './TerrainMaterial.js';
import { fogGlsl } from './FogGlsl.js';
import { RIVER_STRIDE, RV, RIVER_KIND, fallFaceRun, surfaceHalfWidth } from './gen/Rivers.js';

// Waterfalls as solid things. The sheet leaves the lip with a rounded brow, hugs the rock face
// the heightmap shapes under it (the same face function on both sides), bulges out a little in
// the middle and closes back onto the rock at its sides, so there is nothing to see behind or
// under it. It is opaque, shaded in three flat tones that stretch and whiten on the way down,
// with ragged edges. Below it a plunge disc of foam rings, thrown spray and a slow mist; every
// riffle step in the rivers gets a few splashes of its own.

const g = 9.8;

export class Waterfalls {
	constructor(scene, world, shared) {
		this.shared = shared;
		const falls = world.rivers.flatMap((r) => r.falls);
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
		this.buildPlunge(scene, falls);
		this.buildSpray(scene, falls, world);
	}

	// ---------- the sheets ----------
	buildSheets(scene, falls) {
		const pos = [], uv = [], info = [], idx = [];
		for (const f of falls) {
			const fx = f.dx, fz = f.dz, rx = -fz, rz = fx;
			const w = f.w, drop = f.drop, run = fallFaceRun(drop);
			const topWidth = 2 * surfaceHalfWidth(w, f.dTop, f.bankTop), bottomWidth = 2 * surfaceHalfWidth(f.wBottom || w, f.dBot, f.bankBot);
			const bulge = 0.5 + Math.min(w, 40) * 0.03 + Math.min(drop, 30) * 0.03;
			const nC = Math.max(8, Math.round(w / 1.6) + 1), nR = Math.max(10, Math.min(24, Math.round(drop / 1.6) + 6));
			const base = pos.length / 3;
			// rows: the brow over the lip, then down the face to just under the pool surface
			const rows = [];
			rows.push({ s: -0.9, y: f.top - 0.08, v: -0.05, wf: topWidth / w });
			rows.push({ s: 0, y: f.top - 0.08, v: 0.0, wf: topWidth / w });
			for (let j = 1; j <= nR; j++) {
				const t = j / nR;
				const y = f.top - 0.08 - drop * t;
				const face = run * t;                                   // where the rock is
				const gap = 0.35 + bulge * Math.pow(Math.sin(t * Math.PI), 0.7) + 0.25 * t;
				rows.push({ s: t < 1 ? face + gap : run + 1.5, y: t < 1 ? y : f.bottom - 0.08, v: t, wf: (topWidth + (bottomWidth - topWidth) * t) / w, gap: t < 1 ? gap : 0 });
			}
			for (const row of rows) {
				for (let i = 0; i <= nC; i++) {
					const u = (i / nC) * 2 - 1;
					// the sheet closes onto the rock at its sides
					const s = row.gap !== undefined ? row.s - row.gap * Math.pow(Math.abs(u), 5) : row.s;
					const x = f.x + fx * s + rx * u * (w / 2) * row.wf;
					const z = f.z + fz * s + rz * u * (w / 2) * row.wf;
					pos.push(x, row.y, z);
					uv.push(u, row.v);
					info.push(drop, w, f.seed, 0);
				}
			}
			const rowsN = rows.length;
			for (let j = 0; j < rowsN - 1; j++) for (let i = 0; i < nC; i++) {
				const a = base + j * (nC + 1) + i, b = a + 1, c = a + nC + 1, d = c + 1;
				idx.push(a, c, b, b, c, d);
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
			side: THREE.DoubleSide,
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
					float drop = vInfo.x, w = vInfo.y, seed = vInfo.z * 37.0;
					float u = vUv.x, v = max(vUv.y, 0.0);
					float light = 0.45 + 0.55 * uMoonIntensity + 0.25 * uSunIntensity;
					vec3 tint = mix(vec3(0.68, 0.72, 0.88), uSunColor, uSunIntensity * 0.35);
					// the water speeds up on the way down, so the pattern stretches and pans faster
					float vv = pow(v, 0.7) * (1.5 + drop * 0.12);
					float t = uTime * (1.6 + drop * 0.05);
					// streaks: fine across, long along the drop
					float n1 = vnoise(vec2(u * w * 0.7 + seed, vv * 0.9 - t * 0.28));
					float n2 = vnoise(vec2(u * w * 1.6 + seed * 2.1, vv * 2.2 - t * 0.5 + 3.0));
					float n3 = vnoise(vec2(u * w * 0.25 + 9.0, vv * 0.5 - t * 0.12));
					float n = n1 * 0.5 + n2 * 0.35 + n3 * 0.15;
					float aer = 0.15 + 0.85 * v;                        // aeration grows downward
					// three flat tones
					vec3 dark = mix(vec3(0.09, 0.11, 0.24), uSkyColor * 1.3, 0.3);
					vec3 mid = vec3(0.3, 0.34, 0.5);
					vec3 white = tint * (0.85 + 0.15 * v);
					float m1 = step(0.5 - 0.14 * aer, n), m2 = step(0.68 - 0.2 * aer, n);
					vec3 col = mix(dark, mid, m1);
					col = mix(col, white, m2);
					// the brow of the lip glints
					col = mix(col, white, (1.0 - smoothstep(0.0, 0.05, v)) * 0.55);
					// ragged sides and a torn hem where the sheet meets the pool
					float edge = 1.0 - abs(u);
					float rag = vnoise(vec2(u * 7.0 + seed, v * 6.0 - uTime * 1.3));
					float side = step(0.55 - edge * 4.0, rag);
					float hem = step(v * 1.15 - 0.15 + (rag - 0.5) * 0.25, 1.0);
					if (v > 0.08 && v < 0.92 && side * hem < 0.5) discard;
					col *= light;
					col = applyFog(col, vWorldPos, uCameraPos);
					gl_FragColor = vec4(col, 1.0);
				}`,
		}));
		this.sheet.frustumCulled = true;
		this.sheet.renderOrder = 1;
		if (this.count) scene.add(this.sheet);
	}

	// ---------- plunge pools ----------
	buildPlunge(scene, falls) {
		const pos = [], uv = [], info = [], idx = [];
		for (const f of falls) {
			const fx = f.dx, fz = f.dz, rx = -fz, rz = fx;
			const run = fallFaceRun(f.drop);
			const cx = f.x + fx * (run + 1.5), cz = f.z + fz * (run + 1.5);
			const rad = f.w * 0.55 + 2.5 + f.drop * 0.08;
			const base = pos.length / 3;
			const segs = 20;
			pos.push(cx, f.bottom + 0.04, cz); uv.push(0, 0); info.push(f.drop, f.w, f.seed, 0);
			for (let k = 0; k <= segs; k++) {
				const a = (k / segs) * Math.PI * 2;
				const ox = Math.cos(a) * rad, oz = Math.sin(a) * rad;
				const along = ox * 1.4 + rad * 0.3, side = oz;
				pos.push(cx + fx * along + rx * side, f.bottom + 0.04, cz + fz * along + rz * side);
				uv.push(k / segs, 1); info.push(f.drop, f.w, f.seed, 0);
			}
			for (let k = 0; k < segs; k++) idx.push(base, base + 1 + k, base + 2 + k);
		}
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
		geometry.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 4));
		geometry.setIndex(idx);
		geometry.computeBoundingSphere();
		this.plunge = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			transparent: true, depthWrite: false,
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
				uniform vec3 uCameraPos, uSunColor;
				varying vec2 vUv; varying vec4 vInfo; varying vec3 vWorldPos;
				${noiseGlsl}
				${fogGlsl}
				void main() {
					float seed = vInfo.z * 37.0;
					float r = vUv.y, ang = vUv.x * 6.2832;
					float light = 0.45 + 0.55 * uMoonIntensity + 0.25 * uSunIntensity;
					vec3 tint = mix(vec3(0.6, 0.64, 0.78), uSunColor, uSunIntensity * 0.3);
					// hard-edged rings of foam spreading from the impact, broken up as they go
					float wobble = vnoise(vec2(cos(ang) * 4.0 + seed, sin(ang) * 4.0)) * 0.35;
					float ring = step(0.6, fract(r * 2.6 - uTime * 0.9 + wobble));
					float gaps = step(0.3, vnoise(vec2(ang * 2.5 + seed, r * 6.0 - uTime * 1.2)));
					float core = 1.0 - step(0.35, r + wobble * 0.5);
					float foam = max(core, ring * gaps) * (1.0 - smoothstep(0.55, 1.0, r));
					vec3 col = tint * light;
					col = applyFog(col, vWorldPos, uCameraPos);
					gl_FragColor = vec4(col, foam * 0.85);
				}`,
		}));
		this.plunge.frustumCulled = true;
		this.plunge.renderOrder = 2;
		if (this.count) scene.add(this.plunge);
	}

	// ---------- spray, mist, splashes ----------
	buildSpray(scene, falls, world) {
		const base = [], vel = [], info = [];
		for (const f of falls) {
			const fx = f.dx, fz = f.dz, rx = -fz, rz = fx;
			const run = fallFaceRun(f.drop);
			const ix = f.x + fx * (run + 1.2), iz = f.z + fz * (run + 1.2);
			const nSpray = Math.min(260, Math.round(40 + f.w * 3 + f.drop * 3));
			const nMist = Math.min(80, Math.round(14 + f.w * 0.8 + f.drop * 0.7));
			for (let k = 0; k < nSpray; k++) {
				const u = Math.random() * 2 - 1;
				base.push(ix + rx * u * f.w * 0.46, f.bottom, iz + rz * u * f.w * 0.46);
				const up = 3.5 + Math.random() * (4 + Math.min(f.drop, 40) * 0.15);
				const out = 0.8 + Math.random() * 3, side = (Math.random() - 0.5) * 3;
				vel.push(fx * out + rx * side, up, fz * out + rz * side);
				// phase, life, size, kind
				info.push(Math.random(), 0.5 + Math.random() * 0.55, 0.22 + Math.random() * 0.5, 0);
			}
			for (let k = 0; k < nMist; k++) {
				const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
				base.push(ix + rx * Math.cos(a) * r * (f.w * 0.55 + 3) + fx * Math.sin(a) * r * 3, f.bottom + 0.5, iz + rz * Math.cos(a) * r * (f.w * 0.55 + 3) + fz * Math.sin(a) * r * 3);
				vel.push(fx * (0.4 + Math.random() * 0.8) + rx * (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.8, fz * (0.4 + Math.random() * 0.8) + rz * (Math.random() - 0.5) * 0.8);
				info.push(Math.random(), 2.5 + Math.random() * 2.5, 2.2 + Math.random() * 3.8 + f.drop * 0.07, 1);
			}
		}
		// splashes at the riffle steps
		const S = RIVER_STRIDE;
		for (const r of world.rivers) {
			const d = r.data;
			for (let i = 0; i < r.count - 1; i++) {
				if (d[i * S + RV.KIND] !== RIVER_KIND.STEP_TOP) continue;
				const o = i * S, o2 = o + S;
				const step = d[o + RV.WL] - d[o2 + RV.WL];
				if (step < 0.45) continue;
				const x = d[o2 + RV.X], z = d[o2 + RV.Z], w = d[o + RV.W];
				let tx = x - d[o + RV.X], tz = z - d[o + RV.Z];
				const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
				const rx = -tz, rz = tx;
				const n = Math.min(24, Math.round(3 + w * 0.3 + step * 3));
				for (let k = 0; k < n; k++) {
					const u = Math.random() * 2 - 1;
					base.push(x + rx * u * w * 0.42, d[o2 + RV.WL], z + rz * u * w * 0.42);
					vel.push(tx * (0.5 + Math.random() * 1.5) + rx * (Math.random() - 0.5), 1.0 + Math.random() * (1.0 + step * 0.8), tz * (0.5 + Math.random() * 1.5) + rz * (Math.random() - 0.5));
					info.push(Math.random(), 0.4 + Math.random() * 0.4, 0.08 + Math.random() * 0.14, 0);
				}
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
						size = aInfo.z * (0.6 + 1.4 * t);
						vAlpha = (1.0 - t) * (1.0 - t) * 0.8;
					} else {
						// mist: drifts up and away, thinning
						p = position + aVel * age * (1.0 - 0.3 * t);
						size = aInfo.z * (0.7 + 1.3 * t);
						vAlpha = sin(t * 3.14159) * 0.2;
					}
					float dist = distance(p, uCameraPos);
					vAlpha *= (1.0 - smoothstep(200.0, 480.0, dist)) * smoothstep(2.0, 7.0, dist);
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
					float light = 0.5 + 0.5 * uMoonIntensity + 0.25 * uSunIntensity;
					vec3 col = mix(vec3(0.72, 0.78, 0.92), uSunColor, uSunIntensity * 0.3) * light;
					float a;
					if (vKind < 0.5) a = (1.0 - step(0.9, d)) * vAlpha;      // hard-edged droplets
					else { float rag = vnoise(c * 5.0 + vSeed + uTime * 0.5); a = smoothstep(1.0, 0.25, d + (rag - 0.5) * 0.5) * vAlpha; }
					gl_FragColor = vec4(col, a);
				}`,
		}));
		this.points.frustumCulled = false;
		this.points.renderOrder = 3;
		if (base.length) scene.add(this.points);
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
