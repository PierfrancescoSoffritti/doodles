import * as THREE from 'three';
import { Ripples } from './Ripples.js';
import { hslGlsl, noiseGlsl } from './TerrainMaterial.js';
import { fogGlsl } from './FogGlsl.js';
import { shoreWaveGlsl } from './ShoreWaves.js';

// The sea's surface.
//
// Open water is a sum of Gerstner waves (Finch, GPU Gems 1 ch. 1: the trochoidal profile the
// big engines' water systems still use, and what an FFT ocean spectrum reduces to per component):
// six wind-aligned components spread over wavelengths from 64 m swell to 4 m chop, each with the
// deep-water dispersion w = sqrt(g k), sharing a total steepness under 1 so crests never loop.
// The vertex shader displaces the mesh with them; the fragment shader shades the facets flat.
// The Jacobian of the displacement (how much the surface folds at a crest) marks the whitecaps,
// the same test an FFT ocean uses for its foam.
//
// Near the coast the swell hands over to a second system driven by the signed distance to the
// shore (which a river mouth narrows, so the swell dies away up the channel of itself): crest lines parallel to the coast, growing as they shoal, breaking over the last few
// metres and leaving foam behind them that thins out before the next wave, then running up the
// beach as a sheet (drawn by the terrain shader from the same phase).

export const NWAVES = 6;

// The wave set for a wind blowing along `windAngle`: (dir.x, dir.y, k, amplitude) and (omega, Q).
// Q_i = STEEP / (k_i A_i N) so the components' steepness sums to STEEP (Finch's rule).
export function buildWaves(windAngle) {
	const G = 9.81, STEEP = 0.62;
	const set = [
		{ lambda: 64, amp: 0.5, turn: 0.15 },
		{ lambda: 37, amp: 0.4, turn: -0.4 },
		{ lambda: 21, amp: 0.27, turn: 0.55 },
		{ lambda: 12.5, amp: 0.16, turn: -0.25 },
		{ lambda: 7.2, amp: 0.09, turn: 0.8 },
		{ lambda: 4.3, amp: 0.05, turn: -0.65 },
	];
	const waves = [], waves2 = [];
	for (const w of set) {
		const a = windAngle + w.turn;
		const k = (2 * Math.PI) / w.lambda;
		waves.push(new THREE.Vector4(Math.cos(a), Math.sin(a), k, w.amp));
		waves2.push(new THREE.Vector2(Math.sqrt(G * k), STEEP / (k * w.amp * set.length)));
	}
	return { waves, waves2 };
}

export function createSeaUniforms(shared, waterLevel, windAngle) {
	const { waves, waves2 } = buildWaves(windAngle);
	const uniforms = {
		uTime: { value: 0 },
		uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
		uMoonColor: { value: new THREE.Color('#ffd7f3') },
		uMoonIntensity: { value: 1 },
		uSunDir: { value: new THREE.Vector3(0, -1, 0) },
		uSunIntensity: { value: 0 },
		uCameraPos: { value: new THREE.Vector3() },
		uWaterLevel: { value: waterLevel },
		uRain: { value: 0 },
		uSkyTone: { value: new THREE.Color('#3a1460') },
		uWaves: { value: waves },
		uWaves2: { value: waves2 },
		uSwell: { value: 1 },
		uDisplace: { value: 1 },
		uReflMatrix: { value: new THREE.Matrix4() },
		tDiffuse: { value: null },
		textureMatrix: { value: new THREE.Matrix4() },   // Reflector fills these two
	};
	Object.assign(uniforms, shared.ripples.uniforms, shared.shoreMap.uniforms, shared.fogUniforms);
	return uniforms;
}

export const seaWaveGlsl = /* glsl */`
	uniform vec4 uWaves[${NWAVES}];
	uniform vec2 uWaves2[${NWAVES}];
	uniform float uSwell;
	// the ocean swell gives way to the breakers over the last metres before a shore; it keeps its
	// height up a river mouth, where a still surface would mirror the sky as one pale slab
	float deepEnv(float d) { return smoothstep(1.0, 18.0, d); }
	// Gerstner sum at grid point p: displacement, and the analytic normal and Jacobian of the surface
	vec3 gerstner(vec2 p, float t, float d, float scale, out vec3 nrm, out float jac) {
		vec3 disp = vec3(0.0);
		float nx = 0.0, nz = 0.0;
		jac = 1.0;
		float env = deepEnv(d) * uSwell * scale;
		for (int i = 0; i < ${NWAVES}; i++) {
			vec2 D = uWaves[i].xy;
			float k = uWaves[i].z, A = uWaves[i].w * env, w = uWaves2[i].x, Q = uWaves2[i].y;
			float ph = k * dot(D, p) - w * t;
			float s = sin(ph), c = cos(ph);
			disp.xz += Q * A * D * c;
			disp.y += A * s;
			nx += D.x * k * A * c;
			nz += D.y * k * A * c;
			jac -= Q * k * A * s;
		}
		nrm = normalize(vec3(-nx, jac, -nz));
		return disp;
	}`;

// The sea's colour at a surface point: the body by depth and the facet's light in flat bands, the
// mirror by a banded Fresnel, hard glints. Shared with the rivers, which take this look on as they
// run out into the sea, so the two meet in one colour.
export const seaShadeGlsl = /* glsl */`
	uniform sampler2D tDiffuse;
	uniform vec3 uMoonDir, uMoonColor, uCameraPos, uSunDir, uSkyTone;
	uniform float uSunIntensity, uMoonIntensity, uWaterLevel;
	vec3 seaShade(vec3 wp, vec3 n, vec3 V, float depth, float dist, vec4 uv4, out float fres) {
		// body colour: the shallows over sand are a lit teal, the deep a violet-blue; facets
		// turned to the moon or the red dwarf take their light in flat bands
		vec3 deepCol = vec3(0.025, 0.03, 0.115), shallowCol = vec3(0.05, 0.14, 0.21);
		vec3 body = mix(shallowCol, deepCol, 1.0 - exp(-max(depth, 0.0) * 0.3));
		body += uSkyTone * 0.22;                                  // the sky's own hue lights the water from above
		float ml = clamp(dot(n, uMoonDir) * 0.85 + 0.15, 0.0, 1.0);
		float band = floor(ml * 3.0 + 0.5) / 3.0;
		body *= 0.6 + 0.55 * band * uMoonIntensity + 0.2 * (1.0 - uMoonIntensity);
		float sl = clamp(dot(n, uSunDir), 0.0, 1.0);
		body += vec3(0.3, 0.06, 0.05) * floor(sl * 2.0 + 0.5) * 0.5 * uSunIntensity;
		// crests let light through: a paler teal on the tops of the waves
		float crest = clamp((wp.y - uWaterLevel) / 1.3, 0.0, 1.0);
		body = mix(body, vec3(0.1, 0.3, 0.36), crest * crest * 0.4 * (0.4 + 0.6 * uMoonIntensity));

		// the reflection, broken up by the facets; strongest at a grazing angle, never a full mirror
		float NdV = clamp(dot(n, V), 0.0, 1.0);
		fres = 0.04 + 0.55 * pow(1.0 - NdV, 3.0);
		fres = mix(fres, floor(fres * 6.0 + 0.5) / 6.0, 0.6);       // mostly flat tones per facet
		// a facet turned to the eye shows more of the body and a little lighter, like the rivers' facets
		float tilt = clamp(floor((NdV - clamp(V.y, 0.0, 1.0)) * 10.0 + 0.5), -2.0, 2.0);
		body *= 1.0 + 0.1 * tilt * (1.0 - smoothstep(700.0, 1600.0, dist));
		vec3 coord = uv4.xyz / max(uv4.w, 1e-4);
		coord.xy += n.xz * 0.06 / (1.0 + dist * 0.003);   // a nudge only: a large one reads below the mirrored horizon
		// the moon's disc is far brighter than white in the mirror; unclamped it burns through even a
		// near-transparent facet as a pale blot
		vec3 refl = min(texture2D(tDiffuse, clamp(coord.xy, 0.001, 0.999)).rgb, vec3(1.3));
		vec3 col = mix(body, refl * 0.85, fres);

		// glints: a hard fleck where a facet mirrors the moon, a red one for the dwarf star
		vec3 R = reflect(-V, n);
		float ms = max(dot(R, uMoonDir), 0.0);
		float glintFade = 1.0 - smoothstep(2500.0, 6000.0, dist);
		col += uMoonColor * (step(0.35, pow(ms, 160.0)) * 0.45 * glintFade + pow(ms, 24.0) * 0.06) * uMoonIntensity;
		float ss = max(dot(R, uSunDir), 0.0);
		col += vec3(1.0, 0.25, 0.1) * (step(0.3, pow(ss, 200.0)) * 0.9 + pow(ss, 12.0) * 0.15) * uSunIntensity;

		return col;
	}`;

export function seaVertexShader(shared) {
	return /* glsl */`
	uniform float uTime, uDisplace;
	uniform vec3 uCameraPos;
	uniform mat4 uReflMatrix;
	varying vec4 vUv4;
	varying vec3 vWorldPos, vNrm;
	varying float vJac, vShoreD, vRiver;
	${noiseGlsl}
	${shared.shoreMap.glsl}
	${shoreWaveGlsl}
	${seaWaveGlsl}
	vec3 surface(vec2 p, out vec3 nrm, out float jac, out float d, out float river) {
		vec4 sh = shoreSample(p);
		d = sh.b;
		river = sh.a;                                  // no breakers on a river's banks; the swell runs in and dies of the narrowing
		vec3 disp = gerstner(p, uTime, d, 1.0, nrm, jac);
		disp.y += shoreLift(d, p, uTime) * (1.0 - river);
		return disp;
	}
	void main() {
		vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
		vec2 p = wp.xz;
		vec3 nrm; float jac, d, river;
		vec3 disp = surface(p, nrm, jac, d, river);
		// the far rim eases down to the flat horizon plane
		float fade = uDisplace * (1.0 - smoothstep(5200.0, 7600.0, distance(p, uCameraPos.xz)));
		wp += disp * fade;
		vWorldPos = wp;
		vNrm = nrm;
		vJac = jac;
		vShoreD = d;
		vRiver = river;
		vUv4 = uReflMatrix * vec4(wp, 1.0);
		gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
	}`;
}

export function seaFragmentShader(shared) {
	return /* glsl */`
	uniform float uTime, uRain;
	varying vec4 vUv4;
	varying vec3 vWorldPos, vNrm;
	varying float vJac, vShoreD, vRiver;
	${hslGlsl}
	${seaShadeGlsl}
	${noiseGlsl}
	${Ripples.glsl()}
	${shared.shoreMap.glsl}
	${fogGlsl}
	${shoreWaveGlsl}
	${seaWaveGlsl}
	void main() {
		vec2 p = vWorldPos.xz;
		float t = uTime;
		float dist = distance(vWorldPos, uCameraPos);
		vec3 V = normalize(uCameraPos - vWorldPos);

		// the surface normal: the flat facet of the mesh close by, the analytic wave normal far
		// off where the facets are smaller than a pixel (damped with distance so the horizon does
		// not sparkle)
		vec3 gn = cross(dFdx(vWorldPos), dFdy(vWorldPos));
		gn = dot(gn, gn) > 1e-12 ? normalize(gn) : vec3(0.0, 1.0, 0.0);
		if (gn.y < 0.0) gn = -gn;
		vec3 an = normalize(mix(vec3(0.0, 1.0, 0.0), normalize(vNrm), 1.0 / (1.0 + dist / 3000.0)));
		vec3 n = normalize(mix(gn, an, smoothstep(700.0, 1600.0, dist)));

		// the bed, read four times a few metres apart so a carved channel's bank does not print the
		// map's texels as stairs in the water's clarity
		float ground = 0.25 * (terrainHeightAt(p + vec2(3.0, 1.0)) + terrainHeightAt(p + vec2(-1.0, 3.0)) + terrainHeightAt(p + vec2(-3.0, -1.0)) + terrainHeightAt(p + vec2(1.0, -3.0)));
		float depth = vWorldPos.y - ground;                       // how deep the water is under this point
		depth = mix(depth, 1000.0, smoothstep(900.0, 1400.0, dist)); // the map ends out there; the far sea is simply deep
		float d = vShoreD;
		float set = shoreSet(p, t);

		float fres;
		vec3 col = seaShade(vWorldPos, n, V, depth, dist, vUv4, fres);

		// ---- foam ----
		// foam takes the light of the hour: moon-white at night, ember-tinted under the red dwarf
		vec3 foamCol = vec3(0.5, 0.53, 0.66) * (0.55 + 0.45 * uMoonIntensity) + vec3(0.4, 0.14, 0.1) * uSunIntensity;
		float nearF = 1.0 - smoothstep(900.0, 2200.0, dist);
		// whitecaps where the swell folds over
		float capN = vnoise(p * 0.3 + t * 0.15) * 0.6 + vnoise(p * 0.09 - t * 0.05) * 0.4;
		float cap = step(vJac, 0.5 + 0.2 * capN) * nearF * deepEnv(d);
		// breakers: a solid lip on the face of the wave where it breaks, then a torn trail behind it
		float ph = shorePhase(d, p, t);
		float age = shoreAge(ph);
		float brk = shoreBreak(d);
		// the lip is torn along the shore: a wave never breaks all at once
		float lipN = vnoise(p * 0.12 + t * 0.05) * 0.6 + vnoise(p * 0.4) * 0.4;
		float lip = step(0.84 - 0.1 * set, sin(ph)) * step(0.4, brk) * step(0.8 - 0.35 * set, lipN);
		float trailN = vnoise(p * 0.15 + vec2(0.0, t * 0.12)) * 0.55 + vnoise(p * 0.05 + 4.0) * 0.45;
		float cover = exp(-age * 2.6) * brk * (0.3 + 0.35 * set);
		float trail = step(1.0 - cover, trailN);
		// the waterline: a thin broken seam where the water meets the sand
		float lap = (1.0 - smoothstep(0.0, 0.5, abs(d))) * step(0.35, vnoise(p * 0.45 + t * 0.12));
		float foam = clamp(cap + lip + trail + lap, 0.0, 1.0) * (1.0 - vRiver);
		col = mix(col, foamCol, foam * 0.85);

		col += rippleGlow(p, t) * 1.2;

		// raindrop rings: each cell spawns an expanding ring on its own phase
		if (uRain > 0.02) {
			float rainNear = 1.0 - smoothstep(40.0, 170.0, dist);
			float density = pow(uRain, 1.6) * 0.7;
			vec2 cell = floor(p / 8.0), cf = fract(p / 8.0) - 0.5;
			float phr = hash21(cell * 1.3);
			float life = fract(t + phr);
			vec2 c = vec2(hash21(cell + 1.7), hash21(cell + 3.1)) - 0.5;
			float r = life * 0.42;
			float ring = step(abs(length(cf - c) - r), 0.025) * (1.0 - life) * step(hash21(cell + 9.1), density);
			col += vec3(0.5, 0.55, 0.7) * ring * 0.8 * rainNear;
		}

		// open water carries the sky at the horizon rather than the dark silhouette tone of the land
		col = max(col, 0.0);
		{
			float hf = heightFog(vWorldPos, uCameraPos);
			float x = dist * uFogDistance;
			float df = 1.0 - exp(-x * x * 1.4);
			col = mix(col, uFogColor, hf);
			col = mix(col, mix(uFogColor, uFogFar, 0.4), df);
		}
		// the shallows are see-through down to the sand; foam and a grazing view close them up
		float clear = exp(-max(depth, 0.0) * 0.55);
		float alpha = 1.0 - clear * (1.0 - fres);
		alpha = max(alpha, foam * 0.95);
		gl_FragColor = vec4(col, alpha);
	}`;
}

export function updateSeaUniforms(u, time, cameraPos, shared) {
	u.uTime.value = time;
	u.uCameraPos.value.copy(cameraPos);
	u.uMoonDir.value.copy(shared.moon.dir);
	u.uMoonIntensity.value = shared.moon.intensity;
	u.uSunDir.value.copy(shared.sun.dir);
	u.uSunIntensity.value = shared.sun.intensity;
	u.uRain.value = shared.state.rainVisible || 0;
	u.uSwell.value = 1 + 0.5 * (shared.state.rainVisible || 0);
	u.uSkyTone.value.copy(shared.fogColor).multiplyScalar(0.9);
}
