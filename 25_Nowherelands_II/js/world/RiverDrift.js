import * as THREE from 'three';
import { RIVER_STRIDE, RV, RIVER_KIND } from './gen/Rivers.js';
import { riverWaveGlsl } from './WaterShader.js';
import { fogGlsl } from './FogGlsl.js';
import { noiseGlsl } from './TerrainMaterial.js';

// Clumps of foam that drift down the rivers near the player at the speed of the flow, riding
// the same waves as the surface, so the water is seen to move. Each clump lives on one river
// at an arc-length position; it is respawned when it reaches a fall, the river's end, or
// drifts out of range.

const COUNT = 480;
const RADIUS = 240;          // clumps live within this distance of the player
const REGATHER = 40;         // re-list the nearby reaches after moving this far

export class RiverDrift {
	constructor(scene, heightmap, shared) {
		this.heightmap = heightmap;
		this.world = heightmap.world;
		this.shared = shared;
		this.parts = [];
		for (let i = 0; i < COUNT; i++) this.parts.push({ river: -1, i: 0, along: 0, across: 0, size: 0.2, seed: Math.random() });
		this.cands = [];
		this.centre = new THREE.Vector2(1e9, 1e9);

		const g = new THREE.BufferGeometry();
		this.pos = new Float32Array(COUNT * 3);
		this.info0 = new Float32Array(COUNT * 4);
		this.info1 = new Float32Array(COUNT * 4);
		this.fade = new Float32Array(COUNT);
		this.size = new Float32Array(COUNT);
		g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
		g.setAttribute('aInfo0', new THREE.BufferAttribute(this.info0, 4));
		g.setAttribute('aInfo1', new THREE.BufferAttribute(this.info1, 4));
		g.setAttribute('aFade', new THREE.BufferAttribute(this.fade, 1));
		g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
		this.uniforms = {
			uTime: { value: 0 },
			uCameraPos: { value: new THREE.Vector3() },
			uPixelRatio: { value: shared.renderer.getPixelRatio() },
			uMoonIntensity: { value: 1 },
			uSunIntensity: { value: 0 },
			uSunColor: { value: new THREE.Color('#ff3b22') },
		};
		Object.assign(this.uniforms, shared.fogUniforms);
		this.points = new THREE.Points(g, new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			transparent: true, depthWrite: false,
			vertexShader: /* glsl */`
				attribute vec4 aInfo0, aInfo1;
				attribute float aFade, aSize;
				uniform float uTime, uPixelRatio;
				uniform vec3 uCameraPos;
				varying float vAlpha, vSeed;
				varying vec3 vWorldPos;
				${riverWaveGlsl}
				void main() {
					vec3 p = position;
					if (aSize > 0.0) p.y += riverWave(aInfo0, aInfo1, aFade, uTime) + 0.06;
					vWorldPos = p;
					float dist = distance(p, uCameraPos);
					vAlpha = aSize > 0.0 ? (1.0 - smoothstep(${(RADIUS * 0.7).toFixed(1)}, ${RADIUS.toFixed(1)}, dist)) * smoothstep(1.5, 5.0, dist) * (1.0 - 0.7 * aFade) : 0.0;
					vec4 mv = viewMatrix * vec4(p, 1.0);
					gl_PointSize = aSize * uPixelRatio * 620.0 / max(-mv.z, 1.0);
					gl_Position = projectionMatrix * mv;
					vSeed = aInfo1.x * 0.37;
				}`,
			fragmentShader: /* glsl */`
				uniform float uMoonIntensity, uSunIntensity, uTime;
				uniform vec3 uSunColor, uCameraPos;
				varying float vAlpha, vSeed;
				varying vec3 vWorldPos;
				${noiseGlsl}
				${fogGlsl}
				void main() {
					if (vAlpha <= 0.001) discard;
					vec2 c = gl_PointCoord - 0.5;
					// a ragged flat clump, hard-edged
					float rag = vnoise(c * 4.0 + vSeed) - 0.5;
					float d = length(c * vec2(1.0, 1.35)) * 2.0 + rag * 0.5;
					if (d > 0.85) discard;
					float light = 0.5 + 0.5 * uMoonIntensity + 0.25 * uSunIntensity;
					vec3 col = mix(vec3(0.66, 0.7, 0.84), uSunColor, uSunIntensity * 0.3) * light;
					col = applyFog(col, vWorldPos, uCameraPos);
					gl_FragColor = vec4(col, vAlpha * 0.9);
				}`,
		}));
		this.points.frustumCulled = false;
		this.points.renderOrder = 2;
		scene.add(this.points);
	}

	// the river samples within reach of the player, as (river, sample) pairs
	gather(px, pz) {
		const hm = this.heightmap;
		const segs = hm.rivers.segmentsIn(px - RADIUS, pz - RADIUS, px + RADIUS, pz + RADIUS);
		const cands = [];
		const r2 = RADIUS * RADIUS;
		for (const s of segs) {
			const ri = hm.rivers.segRiver[s], i = hm.rivers.segIndex[s];
			const d = this.world.rivers[ri].data, o = i * RIVER_STRIDE;
			if (d[o + RV.KIND] === RIVER_KIND.LIP) continue;
			const dx = d[o] - px, dz = d[o + 1] - pz;
			if (dx * dx + dz * dz < r2) cands.push(ri, i);
		}
		this.cands = cands;
		this.centre.set(px, pz);
	}

	spawn(p) {
		const n = this.cands.length / 2;
		if (!n) { p.river = -1; return; }
		const k = Math.floor(Math.random() * n);
		const ri = this.cands[k * 2], i = this.cands[k * 2 + 1];
		const d = this.world.rivers[ri].data, o = i * RIVER_STRIDE;
		p.river = ri; p.i = i;
		p.along = d[o + RV.ALONG] + Math.random() * Math.max(d[o + RIVER_STRIDE + RV.ALONG] - d[o + RV.ALONG], 0);
		p.across = (Math.random() * 2 - 1) * 0.8;
		// more clumps where the water is white
		p.size = (0.16 + Math.random() * 0.3) * (0.7 + 0.6 * d[o + RV.FOAM]);
	}

	update(dt, cameraPos) {
		const S = RIVER_STRIDE;
		const u = this.uniforms, s = this.shared;
		u.uTime.value = s.time;
		u.uCameraPos.value.copy(cameraPos);
		u.uMoonIntensity.value = s.moon.intensity;
		u.uSunIntensity.value = s.sun.intensity;
		u.uSunColor.value.copy(s.terrainUniforms.uSunColor.value);
		if (this.centre.distanceTo(new THREE.Vector2(cameraPos.x, cameraPos.z)) > REGATHER) this.gather(cameraPos.x, cameraPos.z);

		const rivers = this.world.rivers;
		const r2 = (RADIUS + 30) * (RADIUS + 30);
		for (let k = 0; k < this.parts.length; k++) {
			const p = this.parts[k];
			if (p.river < 0) this.spawn(p);
			if (p.river < 0) { this.size[k] = 0; continue; }
			const r = rivers[p.river], d = r.data;
			// drift with the flow: the same rate the surface pattern scrolls
			const o = p.i * S;
			const speed = 0.6 + d[o + RV.SPEED] * 2.2;
			p.along += speed * dt;
			// move to the sample the position now falls in; stop at a fall or the river's end
			while (p.i < r.count - 2 && d[(p.i + 1) * S + RV.ALONG] <= p.along) p.i++;
			const oa = p.i * S, ob = oa + S;
			const kind = d[oa + RV.KIND];
			if (p.i >= r.count - 2 || kind === RIVER_KIND.LIP) { p.river = -1; this.size[k] = 0; continue; }
			const span = Math.max(d[ob + RV.ALONG] - d[oa + RV.ALONG], 0.01);
			const t = Math.min((p.along - d[oa + RV.ALONG]) / span, 1);
			const w = d[oa + RV.W] + (d[ob + RV.W] - d[oa + RV.W]) * t;
			let x = d[oa] + (d[ob] - d[oa]) * t, z = d[oa + 1] + (d[ob + 1] - d[oa + 1]) * t;
			let tx = d[ob] - d[oa], tz = d[ob + 1] - d[oa + 1];
			const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
			const off = p.across * w * 0.5;
			x += -tz * off; z += tx * off;
			const dx = x - cameraPos.x, dz = z - cameraPos.z;
			if (dx * dx + dz * dz > r2) { p.river = -1; this.size[k] = 0; continue; }
			const y = d[oa + RV.WL] + (d[ob + RV.WL] - d[oa + RV.WL]) * t - 0.08;
			this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
			const q = k * 4;
			this.info0[q] = d[oa + RV.FOAM]; this.info0[q + 1] = d[oa + RV.D]; this.info0[q + 2] = p.across; this.info0[q + 3] = w;
			this.info1[q] = p.along; this.info1[q + 1] = d[oa + RV.SPEED]; this.info1[q + 2] = 0; this.info1[q + 3] = 0;
			this.fade[k] = d[oa + RV.FADE];
			this.size[k] = p.size;
		}
		const g = this.points.geometry;
		g.attributes.position.needsUpdate = true;
		g.attributes.aInfo0.needsUpdate = true;
		g.attributes.aInfo1.needsUpdate = true;
		g.attributes.aFade.needsUpdate = true;
		g.attributes.aSize.needsUpdate = true;
	}
}
