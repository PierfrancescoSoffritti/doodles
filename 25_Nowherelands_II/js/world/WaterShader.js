import * as THREE from 'three';
import { Ripples } from './Ripples.js';
import { hslGlsl, noiseGlsl } from './TerrainMaterial.js';
import { fogGlsl } from './FogGlsl.js';
import { shoreWaveGlsl } from './ShoreWaves.js';
import { seaWaveGlsl, seaShadeGlsl } from './SeaShader.js';

// The inland water look, shared by the lakes and the rivers (the sea has its own, SeaShader.js):
// the reflection is faked from the sky tone; flow and foam come per vertex.
export function createWaterUniforms(shared, waterLevel) {
	const uniforms = {
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
		uSkyTone: { value: new THREE.Color('#3a1460') },
	};
	Object.assign(uniforms, shared.ripples.uniforms, shared.shoreMap.uniforms, shared.fogUniforms, shared.sea);
	return uniforms;
}

// Lift of the waved near surface at a point of a river, in metres. Shared by the water vertex
// shader and the drifting foam so the clumps ride exactly on the surface.
// info0: foam, depth, across (1 at the channel edge), width. info1: along, speed, step, base.
export const riverWaveGlsl = /* glsl */`
	float riverWave(vec4 info0, vec4 info1, float fade, float t) {
		float sp = info1.y;
		float fast = clamp((sp - 0.3) / 2.7, 0.0, 1.0);
		float u = info0.z, w = info0.w;
		float across = u * w * 0.5;
		float edge = 1.0 - smoothstep(0.55, 1.0, abs(u));
		float amp = mix(0.3, 0.5, fast) * edge * (1.0 - 0.75 * fade) * clamp(w * 0.1, 0.35, 1.0);
		// longer waves on a wide river, short steep ones in a fast narrow one
		float lambda = mix(6.5, 3.6, fast) * clamp(w * 0.06, 1.0, 2.2);
		float k = 6.2832 / lambda;
		float along = info1.x;
		// travelling swell, moving with the flow
		float ph = along * k - t * k * (0.6 + sp * 1.3) + across * 0.35;
		float y = sin(ph) * 0.6 + sin(ph * 1.63 + across * 1.1 + t * 0.7) * 0.4;
		// a slower cross swell so the facets are diamonds, not corrugations
		y += 0.5 * sin(across * k * 0.9 + along * k * 0.3 - t * 1.1);
		// standing waves in the rapids, rocking in place
		y += fast * 0.9 * sin(along * k * 1.37 + across * 0.8) * (0.6 + 0.4 * sin(t * 2.6 + along * 0.4));
		return amp * y;
	}`;

// Wind ripples on a lake: four short deep-water waves, gusting, dying out in the shallows.
export const lakeWaveGlsl = /* glsl */`
	float lakeWave(vec2 p, float t, float depth) {
		float gust = 0.55 + 0.45 * vnoise(p * 0.015 + t * 0.04);
		float y = sin(dot(p, vec2(0.83, 0.55)) * 0.55 - t * 2.3) * 0.09
			+ sin(dot(p, vec2(0.3, -0.95)) * 0.95 - t * 3.05 + 1.7) * 0.06
			+ sin(dot(p, vec2(-0.6, 0.8)) * 1.6 - t * 3.96 + 0.4) * 0.035
			+ sin(dot(p, vec2(0.95, 0.3)) * 2.4 - t * 4.85) * 0.02;
		return y * 0.85 * gust * smoothstep(0.0, 1.2, depth);
	}`;

export function waterVertexShader(shared) {
	return /* glsl */`
	uniform float uTime, uWaterLevel;
	uniform mat4 uReflMatrix;
	${noiseGlsl}
	${shared.shoreMap.glsl}
	${seaWaveGlsl}
	${riverWaveGlsl}
	${lakeWaveGlsl}
	varying vec3 vWorldPos;
	varying float vLevel;
	varying vec4 vUv4;
	attribute vec4 aInfo0, aInfo1;
	attribute float aFade;
	attribute vec3 aWake0, aWake1, aWake2;
	varying vec4 vInfo0, vInfo1;
	varying float vFade;
	flat varying vec3 vWake0, vWake1, vWake2;
	void main() {
		vec4 worldPosition = modelMatrix * vec4(position, 1.0);
		vLevel = worldPosition.y;
		// a river's last reaches ride the sea's swell as they run out into it
		if (aInfo0.y > 0.0) {
			float ride = 1.0 - smoothstep(1.5, 3.0, worldPosition.y - uWaterLevel);
			if (ride > 0.001) { vec3 nrm; float jac; worldPosition.y += gerstner(worldPosition.xz, uTime, shoreDistAt(worldPosition.xz), ride, nrm, jac).y; }
		}
		#ifdef WAVES
		// the near surface heaves: a swell on calm water, short steep standing waves in the rapids,
		// nothing on the riffle ramps or at the banks, quieter where the water goes still
		if (aInfo0.y > 0.0 && aInfo1.z <= 0.0) worldPosition.y += riverWave(aInfo0, aInfo1, aFade, uTime);
		else if (aInfo0.y < 0.0) worldPosition.y += lakeWave(worldPosition.xz, uTime, worldPosition.y - terrainHeightAt(worldPosition.xz));
		#endif
		vWorldPos = worldPosition.xyz;
		vUv4 = uReflMatrix * vec4(worldPosition.xyz, 1.0);
		vInfo0 = aInfo0;
		vInfo1 = aInfo1;
		vFade = aFade;
		vWake0 = aWake0; vWake1 = aWake1; vWake2 = aWake2;
		gl_Position = projectionMatrix * viewMatrix * worldPosition;
	}`;
}

export function waterFragmentShader(shared) {
	return /* glsl */`
	uniform float uNearRadius, uTime, uHue, uBass, uRain;
	varying vec3 vWorldPos;
	varying float vLevel;
	varying vec4 vUv4;
	varying vec4 vInfo0, vInfo1;
	varying float vFade;
	flat varying vec3 vWake0, vWake1, vWake2;
	${hslGlsl}
	${noiseGlsl}
	${Ripples.glsl()}
	${shared.shoreMap.glsl}
	${shoreWaveGlsl}
	${seaShadeGlsl}
	${fogGlsl}
	// foam around a rock in the channel: rock = (along, across, radius)
	float rockWake(float along, float across, vec3 rock, float flowAlong) {
		if (rock.z <= 0.0) return 0.0;
		float dl = along - rock.x, dc = abs(across - rock.y), rad = rock.z;
		float bow = step(-rad * 1.2, dl) * step(dl, -rad * 0.2) * step(dc, rad * 0.95);
		float len = rad * 5.0;
		float halfW = rad * 0.45 + dl * 0.13;
		float inV = step(0.0, dl) * step(dl, len) * step(dc, halfW);
		float fade = 1.0 - dl / len;
		float tex = vnoise(vec2(flowAlong * 0.45 + rock.x, across * 1.1));
		return max(bow, inV * step(0.58 - 0.35 * fade, tex));
	}
	void main() {
		vec2 p = vWorldPos.xz;
		#ifdef NEAR_CULL
		// inside the near radius the waved mesh draws the water instead
		if (distance(vWorldPos.xz, uCameraPos.xz) < uNearRadius) discard;
		#endif
		// rivers are textured in their own space: metres along the channel (scrolling with the
		// current) by metres across it. Scrolling world coordinates by a per-vertex flow direction
		// shears the pattern into streaks as time passes; this does not.
		float vFoam = vInfo0.x, vDepth = vInfo0.y, vAcross = vInfo0.z, vWidth = vInfo0.w;
		float vAlong = vInfo1.x, vSpeed = vInfo1.y, vFall = vInfo1.z, vBase = vInfo1.w;
		bool river = vDepth > 0.0;
		// a river that has run out under the sea is the sea's from there on
		if (river && vLevel < uWaterLevel + 0.2) discard;
		float speed = 0.6 + vSpeed * 2.2;      // metres per second the pattern travels: 1.3 in a pool, 7 in a chute
		float across = vAcross * vWidth * 0.5;
		vec2 fuv = river ? vec2(vAlong - uTime * speed, across) : p;
		vec2 pd = fuv;
		float w1 = sin(pd.x * 0.09 + uTime * 0.6) + sin(pd.y * 0.07 - uTime * 0.45);
		float w2 = sin((pd.x + pd.y) * 0.05 + uTime * 0.35);
		vec3 n;
		if (river) {
			// running water is rougher: small tumbling ripples travelling with the current
			float r1 = vnoise(fuv * 0.7) - 0.5, r2 = vnoise(fuv * 0.7 + 13.0) - 0.5;
			float r3 = vnoise(fuv * 2.1 + 5.0) - 0.5;
			float rough = 0.6 + 0.5 * vInfo1.y;          // fast water is rougher
			n = normalize(vec3((r1 * 0.05 + r3 * 0.02) * rough, 1.0, r2 * 0.05 * rough));
		} else n = normalize(vec3(w1 * 0.004, 1.0, w2 * 0.004));
		vec3 V = normalize(uCameraPos - vWorldPos);
		vec3 R = reflect(-V, n);
		float fresnel = pow(clamp(1.0 - dot(V, n), 0.0, 1.0), 2.5);

		float depth = vWorldPos.y - terrainHeightAt(p);          // how deep the water is here
		float channelDepth = 0.0;
		if (river) {
			// rivers know their own channel: deep in the middle, shallow along the banks
			float u = abs(vAcross);
			// beyond the channel edge the surface runs over the foot of the bank: shallows
			channelDepth = u < 1.0 ? (0.4 + 0.6 * sqrt(1.0 - u * u)) * vDepth : 0.3;
			depth = channelDepth * 2.0;
		}
		float shallow = 1.0 - smoothstep(0.0, 6.0, depth);

		vec3 ripple = rippleGlow(p, uTime);
		vec3 refl = uSkyTone * (0.7 + 0.3 * fresnel);

		// flat stylized water: a deep violet-blue with only a hint of the reflection
		vec3 base = vec3(0.03, 0.03, 0.11);
		// running water carries a little more body than a still lake, so it reads as water from above
		vec3 stillCol = mix(vec3(0.02, 0.02, 0.08), refl * 0.45, 0.14 + 0.24 * fresnel);
		vec3 col = river ? mix(mix(vec3(0.07, 0.085, 0.24), refl * 0.6, 0.15 + 0.35 * fresnel), stillCol, vFade) : stillCol;
		col = mix(col, vec3(0.06, 0.16, 0.24), shallow * (vDepth < 0.0 ? 0.12 : 0.2));
		col = mix(col, vec3(0.12, 0.04, 0.11), uSunIntensity * 0.2);
		// a long red glitter path under the low sun; rivers are narrow and broken up, so theirs is a thin one
		float sunSpec = pow(max(dot(R, uSunDir), 0.0), 220.0) * 0.5 + pow(max(dot(R, uSunDir), 0.0), 40.0) * 0.04;
		col += vec3(1.0, 0.25, 0.1) * sunSpec * uSunIntensity;

		if (!river) {
			// a lake's shore: wind lap. Short crests arrive every few seconds, break into a torn line
			// at the waterline and leave a few flecks behind them, the sea's breakers writ small
			float d = shoreDistAt(p);
			float ph = lakePhase(d, p, uTime);
			float age = shoreAge(ph);
			float nearShore = (1.0 - smoothstep(1.0, 5.0, d)) * step(-0.3, d);
			float crestL = step(0.9, sin(ph)) * nearShore * step(0.62, vnoise(p * 0.45 + 3.0));
			float trailN = vnoise(p * 0.6 + vec2(0.0, uTime * 0.2)) * 0.6 + vnoise(p * 0.2 + 4.0) * 0.4;
			float trailL = step(1.0 - exp(-age * 3.5) * nearShore * 0.3, trailN);
			float seam = (1.0 - smoothstep(0.0, 0.3, abs(d))) * step(0.55, vnoise(p * 0.7 + uTime * 0.15));
			float foamL = clamp(seam + crestL + trailL, 0.0, 1.0) * (1.0 - smoothstep(600.0, 1500.0, distance(vWorldPos, uCameraPos)));
			vec3 lapCol = vec3(0.5, 0.53, 0.66) * (0.55 + 0.45 * uMoonIntensity) + vec3(0.4, 0.14, 0.1) * uSunIntensity;
			col = mix(col, lapCol, foamL * 0.7);
		} else {
			// rivers: a thin broken line where the water actually meets the bank
			float shoreDepth = vWorldPos.y - terrainHeightAt(p);
			float edgeR = (1.0 - smoothstep(0.0, 0.25, shoreDepth)) * step(-0.3, shoreDepth) * step(0.35, vnoise(vec2(fuv.x * 0.5, 7.0)));
			col = mix(col, vec3(0.42, 0.45, 0.58), edgeR * 0.6);
		}

		float whiteOut = 0.0;      // how much foam covers this point, for the near surface's opacity
		vec3 foamCol = vec3(0.55, 0.58, 0.7);
		float live = river ? 1.0 - vFade : 0.0;   // running-water features die away into still water
		float fast = river ? clamp((vSpeed - 0.3) / 2.7, 0.0, 1.0) : 0.0;
		vec3 gn = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
		if (river) {
			// running water in three flat tones: the deep channel, a pale band in the shallows, foam
			float along = fuv.x;
			float grazing = 1.0 - 0.75 * fresnel;   // seen along the surface the river is a dark mirror of a dark sky
			float wob = vnoise(vec2(along * 0.09, across * 0.3)) - 0.5;
			float shallowBand = 1.0 - step(0.85, channelDepth + wob * 0.7);
			col = mix(col, vec3(0.11, 0.23, 0.33), shallowBand * 0.55 * grazing * live);
			// flow lines: thin bright streaks drifting with the current
			// fast water draws more and longer streaks
			float ln = vnoise(vec2(along * (0.06 - 0.03 * fast), across * 0.8 + 3.0));
			float lines = step(0.77 - 0.06 * fast, ln) * smoothstep(0.0, 0.02, channelDepth);
			col += vec3(0.22, 0.25, 0.38) * lines * 0.18 * grazing * live;
			// white water below every drop and in the chutes: hard-edged blobs torn by the current
			// finer on a narrow stream, streaked along the flow
			float fs = 1.0 / clamp(vWidth * 0.12, 0.55, 1.0);
			float fn = vnoise(vec2(along * 0.1 * fs, across * 1.4 * fs)) * 0.55 + vnoise(vec2(along * 0.035 * fs + 9.0, across * 0.55 * fs)) * 0.45;
			float inChannel = step(abs(vAcross), 1.0);
			float white = step(0.8 - 0.3 * vFoam, fn) * step(0.05, vFoam) * inChannel;
			// wakes: a bow of foam ahead of every rock that breaks the surface, a V behind it
			white = max(white, rockWake(vAlong, across, vWake0, along));
			white = max(white, rockWake(vAlong, across, vWake1, along));
			white = max(white, rockWake(vAlong, across, vWake2, along));
			// flecks of foam drifting downstream, sparse on calm water, dense below the rapids
			{
				vec2 fc = vec2(along / 4.0, across / 2.2);
				vec2 ci = floor(fc), cf = fract(fc) - 0.5;
				vec2 off = vec2(hash21(ci + 7.1), hash21(ci + 3.7)) - 0.5;
				float keep = step(0.94 - 0.28 * vFoam - 0.05 * fast, hash21(ci * 1.7));
				float fleck = step(length((cf - off * 0.6) * vec2(1.0, 1.8)), 0.14) * keep;
				white = max(white, fleck * inChannel);
			}
			col = mix(col, foamCol, white * 0.8 * (1.0 - 0.35 * fresnel) * live);
			whiteOut = white * live;
			// the riffle ramps: steep quads where the surface drops a step, all white water
			float steepness = 1.0 - smoothstep(0.7, 0.92, abs(gn.y));
			if (vFall > 0.02 && steepness > 0.01) {
				float frac = clamp((vWorldPos.y - vBase) / max(vFall, 0.3), 0.0, 1.0);
				float strands = vnoise(vec2(across * 1.4 + 9.0, vWorldPos.y * 0.8 + uTime * 6.0)) * 0.55 + vnoise(vec2(across * 3.0, vWorldPos.y * 1.5 + uTime * 9.0)) * 0.45;
				float sheet = step(0.36, strands + frac * 0.1);
				vec3 fallCol = mix(vec3(0.28, 0.32, 0.46), foamCol, sheet);
				col = mix(col, fallCol, steepness);
			}
		}

		// a river running out into the sea takes on the sea's own look over its last metres of fall,
		// so the two meet in one colour where the ribbon dissolves
		float seaMix = river ? 1.0 - smoothstep(0.2, 2.5, vLevel - uWaterLevel) : 0.0;
		if (seaMix > 0.001) {
			vec3 sn = gn.y < 0.0 ? -gn : gn;
			float fr;
			vec3 seaCol = seaShade(vWorldPos, sn, V, vWorldPos.y - terrainHeightAt(p), distance(vWorldPos, uCameraPos), vUv4, fr);
			col = mix(col, seaCol, seaMix);
		}
		#ifdef WAVES
		// the facets of the waved surface: those turned away from the eye show the sky, those
		// turned toward it show the deep, in flat bands; a flat facet keeps the far mesh's colour
		// so the two meet without a seam. Facets that mirror the moon glint. A lake's ripples are
		// small, so its bands are cut finer.
		{
			vec3 Vv = normalize(uCameraPos - vWorldPos);
			float tilt = dot(gn, Vv) - clamp(Vv.y, 0.0, 1.0);
			// a lake's facets fade out before the far mesh takes over, so no line marks the hand-over
			float reach = river ? 1.0 : 1.0 - smoothstep(170.0, 250.0, distance(vWorldPos.xz, uCameraPos.xz));
			float band = clamp(floor(tilt * (river ? 14.0 : 18.0) + 0.5), -2.0, 2.0) * reach * (1.0 - seaMix);
			if (!river) col *= 1.0 + clamp(tilt, -0.15, 0.15) * 1.2 * reach;   // every ripple facet shades a little
			vec3 skyGlimpse = mix(vec3(0.3, 0.34, 0.52), uSkyTone * 1.8, 0.3);
			col = mix(col, skyGlimpse, clamp(-band, 0.0, 2.0) * (river ? 0.36 : 0.16));
			col *= 1.0 + clamp(band, 0.0, 2.0) * (river ? 0.16 : 0.09);
			// on flat water (a lake, a river gone slow) every facet near the moon's mirror point would
			// glint at once, one pale blot; only a few do, and they change from moment to moment. Fast
			// water's facets are steep enough to glint one by one.
			float g = pow(max(dot(reflect(-Vv, gn), uMoonDir), 0.0), mix(40.0, 12.0, fast));
			float twinkle = step(0.72 * (1.0 - fast), hash21(floor(p / 2.6) + floor(uTime * 2.5) * 0.37));
			// only a tilted facet glitters; flat water keeps the soft highlight and never a hard blot
			float glint = step(0.28, g) * uMoonIntensity * (1.0 - 0.5 * vFade) * twinkle * reach * smoothstep(0.015, 0.05, 1.0 - gn.y);
			col = mix(col, uMoonColor * 0.85, glint * 0.55);
			// white breaks only on the genuinely steep faces of fast water
			float crest = (1.0 - smoothstep(0.6, 0.72, gn.y)) * fast * live * (1.0 - step(0.02, vFall));
			col = mix(col, foamCol, crest * 0.6);
		}
		#endif

		float spec = pow(max(dot(R, uMoonDir), 0.0), 500.0) * 0.8 + pow(max(dot(R, uMoonDir), 0.0), 60.0) * 0.04;
		col += uMoonColor * spec * uMoonIntensity;
		col += ripple * 1.2;

		// raindrop rings: each cell spawns an expanding ring on its own phase
		if (uRain > 0.02) {
			float rainNear = 1.0 - smoothstep(40.0, 170.0, distance(vWorldPos, uCameraPos));
			float density = pow(uRain, 1.6) * 0.7;
			vec2 cell = floor(p / 8.0), cf = fract(p / 8.0) - 0.5;
			float ph = hash21(cell * 1.3);
			float life = fract(uTime * 1.0 + ph);
			vec2 c = vec2(hash21(cell + 1.7), hash21(cell + 3.1)) - 0.5;
			float r = life * 0.42;
			float ring = step(abs(length(cf - c) - r), 0.025) * (1.0 - life) * step(hash21(cell + 9.1), density);
			col += vec3(0.5, 0.55, 0.7) * ring * 0.8 * rainNear;
		}

		// open water carries the sky at the horizon rather than the dark silhouette tone of the land
		col = max(col, 0.0);
		{
			float dist = distance(vWorldPos, uCameraPos);
			float hf = heightFog(vWorldPos, uCameraPos);
			float x = dist * uFogDistance;
			float df = 1.0 - exp(-x * x * 1.4);
			col = mix(col, uFogColor, hf);
			col = mix(col, mix(uFogColor, uFogFar, 0.4), df);
		}
		float alpha = 1.0;
		#ifdef WAVES
		// close up the shallows are see-through: the cobbled bed shows under the surface
		alpha = river ? mix(0.55, 1.0, smoothstep(0.25, 1.6, channelDepth)) + 0.45 * whiteOut : mix(0.5, 1.0, smoothstep(0.2, 3.0, depth));
		alpha = min(alpha + vFade * 0.5, 1.0);
		#endif
		// a river dissolves into the sea, which lies just under it riding the same swell, over the last
		// metre of its fall to sea level
		if (river) alpha *= smoothstep(0.2, 1.2, vLevel - uWaterLevel);
		gl_FragColor = vec4(col, alpha);
	}`;
}

export function updateWaterUniforms(u, time, cameraPos, shared) {
	u.uTime.value = time;
	u.uCameraPos.value.copy(cameraPos);
	u.uMoonDir.value.copy(shared.moon.dir);
	u.uMoonIntensity.value = shared.moon.intensity;
	u.uSunDir.value.copy(shared.sun.dir);
	u.uSunIntensity.value = shared.sun.intensity;
	u.uHue.value = shared.hue;
	u.uBass.value = shared.audio ? shared.audio.analysis.bass : 0;
	u.uRain.value = shared.state.rainVisible || 0;
	u.uSkyTone.value.copy(shared.fogColor).multiplyScalar(0.9);
}
