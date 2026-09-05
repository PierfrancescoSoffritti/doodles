import * as THREE from 'three';
import { Random } from '../core/Random.js';
import { crestOffset } from './RiverGeometry.js';
import { noiseGlsl } from './TerrainMaterial.js';
import { fogGlsl } from './FogGlsl.js';
import { RIVER_STRIDE, RV, RIVER_KIND, fallFaceRun, surfaceHalfWidth } from './gen/Rivers.js';

// Waterfalls as solid things. The sheet leaves the lip with a rounded brow, hugs the rock face
// the heightmap shapes under it (the same face function on both sides), bulges out a little in
// the middle and closes back onto the rock at its sides, so there is nothing to see behind or
// under it. It accelerates and aerates on the way down, with a deforming surface,
// ragged edges, radial impact boils, thrown spray and a slow mist; every
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
		const pos = [], uv = [], info = [], idx = [], flow = [];
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
					const s = (row.gap !== undefined ? row.s - row.gap * Math.pow(Math.abs(u), 5) : row.s) + crestOffset(u * row.wf, f.skew || 0, f.bow || 0);
					const x = f.x + fx * s + rx * u * (w / 2) * row.wf;
					const z = f.z + fz * s + rz * u * (w / 2) * row.wf;
					pos.push(x, row.y, z);
					uv.push(u, row.v);
					info.push(drop, w, f.seed, 0);
					flow.push(fx, fz);
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
		geometry.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
		geometry.setIndex(idx);
		geometry.computeBoundingSphere();
		this.sheet = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			side: THREE.DoubleSide,
			vertexShader: /* glsl */`
				attribute vec4 aInfo;
				attribute vec2 aFlow;
				uniform float uTime;
				varying vec2 vUv; varying vec4 vInfo; varying vec3 vWorldPos;
				void main() {
					vUv = uv; vInfo = aInfo;
					vec3 p = position;
					float v = clamp(uv.y, 0.0, 1.0);
					float wave = sin(uv.x * aInfo.y * 1.4 + aInfo.z + uTime * 1.8) * 0.16
						+ sin(uv.x * aInfo.y * 0.6 - sqrt(v + 0.01) * 14.0 + uTime * 5.0) * 0.14;
					p.xz += aFlow * wave * sin(v * 3.14159) * (1.0 - pow(abs(uv.x), 4.0));
					vec4 wp = modelMatrix * vec4(p, 1.0);
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
					float drop = vInfo.x, w = vInfo.y, seed = vInfo.z;
					float u = vUv.x, v = clamp(vUv.y, 0.0, 1.0);
					// Ballistic travel time gives continuous acceleration from the brow to impact.
					float travel = (sqrt(4.0 + 19.6 * drop * v) - 2.0) / 9.8;
					float ribbon = u * w * 0.5;
					vec2 uv = vec2(ribbon, (travel - uTime) * 6.0);
					float broad = vnoise(uv * vec2(0.8, 0.55) + seed);
					float fine = vnoise(uv * vec2(2.8, 1.8) + seed * 0.7);
					float strands = broad * 0.58 + fine * 0.42;
					float aeration = smoothstep(0.0, 0.85, v) * 0.55 + 0.18;
					float foam = smoothstep(0.68 - aeration * 0.25, 0.82 - aeration * 0.25, strands);
					vec3 n = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
					float light = 0.6 + abs(dot(n, uMoonDir)) * uMoonIntensity * 0.4;
					vec3 body = mix(vec3(0.035, 0.12, 0.17), vec3(0.2, 0.34, 0.39), strands * 0.6 + aeration * 0.4);
					vec3 white = mix(vec3(0.62, 0.73, 0.76), uSunColor * 0.6 + vec3(0.3), uSunIntensity * 0.18);
					vec3 col = mix(body, white, foam * 0.75 + aeration * 0.15) * light;
					float edge = 1.0 - abs(u);
					if (v > 0.08 && v < 0.94 && edge < 0.025 && fine < 0.32) discard;
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
				uv.push(Math.cos(a), Math.sin(a)); info.push(f.drop, f.w, f.seed, 0);
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
					float r = length(vUv), ang = atan(vUv.y, vUv.x);
					float light = 0.45 + 0.55 * uMoonIntensity + 0.25 * uSunIntensity;
					vec3 tint = mix(vec3(0.6, 0.64, 0.78), uSunColor, uSunIntensity * 0.3);
					// Broken aerated boils radiate from the impact and stretch downstream.
					vec2 flow = vUv * (1.0 + 0.12 * sin(uTime * 1.2));
					float bubbles = vnoise(flow * 9.0 + vec2(seed, -uTime * 1.4));
					float boil = sin(r * 22.0 - uTime * 3.0 + bubbles * 4.0) * 0.5 + 0.5;
					float foam = smoothstep(0.48, 0.8, bubbles * 0.65 + boil * 0.35) * (1.0 - smoothstep(0.2, 1.0, r));
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
		const rnd = new Random('river-spray:' + world.spawn.x + ':' + world.spawn.z);
		for (const f of falls) {
			const fx = f.dx, fz = f.dz, rx = -fz, rz = fx;
			const run = fallFaceRun(f.drop);
			const ix = f.x + fx * (run + 1.2), iz = f.z + fz * (run + 1.2);
			const nSpray = Math.min(260, Math.round(40 + f.w * 3 + f.drop * 3));
			const nMist = Math.min(80, Math.round(14 + f.w * 0.8 + f.drop * 0.7));
			for (let k = 0; k < nSpray; k++) {
				const u = rnd.next() * 2 - 1;
				base.push(ix + rx * u * f.w * 0.46, f.bottom, iz + rz * u * f.w * 0.46);
				const up = 3.5 + rnd.next() * (4 + Math.min(f.drop, 40) * 0.15);
				const out = 0.8 + rnd.next() * 3, side = (rnd.next() - 0.5) * 3;
				vel.push(fx * out + rx * side, up, fz * out + rz * side);
				// phase, life, size, kind
				info.push(rnd.next(), 0.5 + rnd.next() * 0.55, 0.22 + rnd.next() * 0.5, 0);
			}
			for (let k = 0; k < nMist; k++) {
				const a = rnd.next() * Math.PI * 2, r = Math.sqrt(rnd.next());
				base.push(ix + rx * Math.cos(a) * r * (f.w * 0.55 + 3) + fx * Math.sin(a) * r * 3, f.bottom + 0.5, iz + rz * Math.cos(a) * r * (f.w * 0.55 + 3) + fz * Math.sin(a) * r * 3);
				vel.push(fx * (0.4 + rnd.next() * 0.8) + rx * (rnd.next() - 0.5) * 0.8, 0.5 + rnd.next() * 0.8, fz * (0.4 + rnd.next() * 0.8) + rz * (rnd.next() - 0.5) * 0.8);
				info.push(rnd.next(), 2.5 + rnd.next() * 2.5, 2.2 + rnd.next() * 3.8 + f.drop * 0.07, 1);
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
					const u = rnd.next() * 2 - 1;
					base.push(x + rx * u * w * 0.42, d[o2 + RV.WL], z + rz * u * w * 0.42);
					vel.push(tx * (0.5 + rnd.next() * 1.5) + rx * (rnd.next() - 0.5), 1.0 + rnd.next() * (1.0 + step * 0.8), tz * (0.5 + rnd.next() * 1.5) + rz * (rnd.next() - 0.5));
					info.push(rnd.next(), 0.4 + rnd.next() * 0.4, 0.08 + rnd.next() * 0.14, 0);
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
