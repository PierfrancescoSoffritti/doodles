import { lumenLightUniforms, lumenLightGlsl } from './fauna/LumenLight.js';
import { weatherGlsl } from './weather/WeatherGlsl.js';
import * as THREE from 'three';
import { riverFlowGlsl } from './RiverFlow.js';
import { Ripples } from './Ripples.js';
import { hslGlsl, noiseGlsl } from './TerrainMaterial.js';
import { fogGlsl } from './FogGlsl.js';
import { shoreWaveGlsl } from './ShoreWaves.js';
import { seaWaveGlsl, seaShadeGlsl } from './SeaShader.js';

// The inland water look, shared by the lakes and the rivers (the sea has its own, SeaShader.js):
// the local environment supplies reflections; flow and channel shape come per vertex.
export function createWaterUniforms(shared, waterLevel) {
	const uniforms = {
		uTime: { value: 0 },
		uSceneColor: { value: null },
		uResolution: { value: new THREE.Vector2(1, 1) },
		uHasScene: { value: 0 },
		uEnvironment: { value: null },
		uEnvironmentSize: { value: new THREE.Vector3(1, 1, 0) },
		uHasEnvironment: { value: 0 },
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
	for (const key of ['uHabitatMap', 'uRockOrigin', 'uRockSize']) uniforms[key] = shared.terrainUniforms[key];
	Object.assign(uniforms, lumenLightUniforms(shared), shared.ripples.uniforms, shared.shoreMap.uniforms, shared.weather.uniforms, shared.fogUniforms, shared.sea);
	return uniforms;
}

// Lift of the waved near surface at a point of a river, in metres. Shared by the water vertex
// shader and the drifting foam so the clumps ride exactly on the surface.
// info0: foam, depth, across (1 at the channel edge), width. info1: along, speed, step, integrated travel time.
export const riverWaveGlsl = /* glsl */`
	uniform float uNearRadius;
	float riverNearFade(vec3 p, vec3 camera) { return 1.0 - smoothstep(max(0.0, uNearRadius - 50.0), max(1.0, uNearRadius), distance(p.xz, camera.xz)); }
	float riverWave(vec4 info0, vec4 info1, float fade, float t) {
		float sp = info1.y;
		float fast = smoothstep(0.6, 2.8, sp) * smoothstep(0.08, 0.65, info0.x);
		float u = info0.z, w = info0.w;
		float across = u * w * 0.5;
		float edge = 1.0 - smoothstep(0.55, 1.0, abs(u));
		float amp = min(0.025 + 0.34 * fast, info0.y * 0.2) * edge * (1.0 - 0.85 * fade);
		// longer waves on a wide river, short steep ones in a fast narrow one
		float lambda = mix(6.5, 3.6, fast) * clamp(w * 0.06, 1.0, 2.2);
		float k = 6.2832 / lambda;
		float along = info1.x;
		// travelling swell, moving with the flow
		float ph = (info1.w - t) * 3.4 + across * 0.35;
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
	uniform vec3 uCameraPos;
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
	attribute float aFade, aJoin, aWave;
	attribute vec4 aChannel;
	attribute vec3 aWake0, aWake1, aWake2;
	varying vec4 vInfo0, vInfo1;
	varying float vFade, vJoin;
	varying vec4 vChannel;
	flat varying vec3 vWake0, vWake1, vWake2;
	void main() {
		vec4 worldPosition = modelMatrix * vec4(position, 1.0);
		vLevel = worldPosition.y;
		// a river's last reaches ride the sea's swell as they run out into it
		if (aInfo0.y > 0.0) {
			vec4 shore = shoreSample(worldPosition.xz);
			float ride = (1.0 - smoothstep(0.35, 1.5, worldPosition.y - uWaterLevel))
				* smoothstep(0.0, 0.8, aFade) * oceanExposure(shore, uWaterLevel);
			// the whole displacement, sideways too: that is what sharpens the sea's crests into facets
			if (ride > 0.001) {
				vec3 nrm; float jac;
				worldPosition.xyz += gerstner(worldPosition.xz, uTime, shore.b, max(0.0, uWaterLevel - shore.r), ride, nrm, jac);
			}
		}
		#ifdef WAVES
		// the near surface heaves: a swell on calm water, short steep standing waves in the rapids,
		// nothing on the riffle ramps or at the banks, quieter where the water goes still
		if (aInfo0.y > 0.0 && aInfo1.z <= 0.0) worldPosition.y += riverWave(aInfo0, aInfo1, aFade, uTime) * riverNearFade(worldPosition.xyz, uCameraPos) * aWave;
		else if (aInfo0.y < 0.0) worldPosition.y += lakeWave(worldPosition.xz, uTime, worldPosition.y - terrainHeightAt(worldPosition.xz)) * aWave * riverNearFade(worldPosition.xyz, uCameraPos);
		#endif
		vWorldPos = worldPosition.xyz;
		vUv4 = uReflMatrix * vec4(worldPosition.xyz, 1.0);
		vInfo0 = aInfo0;
		vInfo1 = aInfo1;
		vFade = aFade; vJoin = aJoin;
		vChannel = aChannel;
		vWake0 = aWake0; vWake1 = aWake1; vWake2 = aWake2;
		gl_Position = projectionMatrix * viewMatrix * worldPosition;
	}`;
}

export function waterFragmentShader(shared) {
	return /* glsl */`
	uniform float uNearRadius, uTime, uHue, uBass, uRain, uHasEnvironment, uHasScene;
	uniform sampler2D uEnvironment, uSceneColor, uHabitatMap;
	uniform vec2 uRockOrigin; uniform float uRockSize;
	uniform vec2 uResolution;
	uniform vec3 uEnvironmentSize;
	#define ENVMAP_TYPE_CUBE_UV
	#define CUBEUV_TEXEL_WIDTH uEnvironmentSize.x
	#define CUBEUV_TEXEL_HEIGHT uEnvironmentSize.y
	#define CUBEUV_MAX_MIP uEnvironmentSize.z
	#include <cube_uv_reflection_fragment>
	varying vec3 vWorldPos;
	varying float vLevel;
	varying vec4 vUv4, vInfo0, vInfo1, vChannel;
	varying float vFade, vJoin;
	flat varying vec3 vWake0, vWake1, vWake2;
	${hslGlsl}
	${noiseGlsl}
	${Ripples.glsl()}
	${shared.shoreMap.glsl}
	${shoreWaveGlsl}
	${seaShadeGlsl}
	${weatherGlsl}
	${fogGlsl}
	${lumenLightGlsl}
	${riverFlowGlsl}
	vec2 uv0, uv1;
	float blend;
	float advectNoise(vec2 scale, vec2 offset) {
		return mix(vnoise(uv0 * scale + offset), vnoise(uv1 * scale + offset), blend);
	}
	float wakeFoam(vec2 p, vec3 rock) {
		if (rock.z < 0.01) return 0.0;
		vec2 q = (p - rock.xy) / rock.z;
		float radius = length(q);
		float bow = (1.0 - smoothstep(0.12, 0.48, abs(radius - 1.05))) * (1.0 - smoothstep(-0.2, 0.7, q.x));
		float trail = smoothstep(0.0, 0.5, q.x) * (1.0 - smoothstep(3.0, 12.0, q.x));
		float arms = 1.0 - smoothstep(0.12, 0.55, abs(abs(q.y) - (0.5 + q.x * 0.16)));
		float churn = advectNoise(vec2(0.7, 1.2), rock.xy * 0.2);
		return max(bow * 0.7, trail * arms * smoothstep(0.32, 0.7, churn));
	}
	void main() {
		vec2 p = vWorldPos.xz;
		float cameraDistance = distance(p, uCameraPos.xz);
		#ifdef NEAR_CULL
		if (cameraDistance < uNearRadius) discard;
		#else
		if (cameraDistance >= uNearRadius) discard;
		#endif
		bool river = vInfo0.y > 0.0;
		if (river && vLevel < uWaterLevel + 0.35) discard;
		float depth = max(0.0, vWorldPos.y - (river ? vChannel.y : terrainHeightAt(p)));
		if (depth < 0.008) discard;
		float foamEnergy = vInfo0.x;
		float speed = vInfo1.y;
		float across = vInfo0.z * vInfo0.w * 0.5;
		float live = river ? 1.0 - vFade : 0.0;
		float fast = smoothstep(0.7, 3.8, speed) * smoothstep(0.05, 0.65, foamEnergy);
		vec2 channel = vec2(vInfo1.x, across);
		vec2 current = river ? riverCurrent(channel, vInfo0.w, speed, vChannel.x, vWake0, vWake1, vWake2) : vec2(0.4, 0.17);
		// Seconds-long overlapping phases reveal travel; tiny phase periods look stationary.
		float period = 3.8;
		float phase = fract(uTime / period);
		vec2 anchor = river ? channel : p;
		float age0 = phase * period, age1 = fract(phase + 0.5) * period;
		vec2 meanFlow = river ? vec2(speed, 0.0) : current;
		vec2 shear = current - meanFlow;
		float distortionLimit = river ? clamp(vInfo0.w * 0.075, 0.6, 3.0) : 1.0;
		// Limit local deformation around small rocks independently of downstream travel.
		// Otherwise a fast torrent stretches one foam texel into an aliased spiral.
		uv0 = anchor - meanFlow * age0 - shear * age0 / (1.0 + length(shear) * age0 / distortionLimit);
		uv1 = anchor - meanFlow * age1 - shear * age1 / (1.0 + length(shear) * age1 / distortionLimit);
		blend = abs(phase * 2.0 - 1.0);
		float grain = advectNoise(vec2(0.32, 0.95), vec2(0.0));
		float fine = advectNoise(vec2(0.8, 1.9), vec2(19.0));
		float crossRipple = advectNoise(vec2(0.65, 0.35), vec2(7.0));
		vec3 geometric = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
		if (geometric.y < 0.0) geometric = -geometric;
		vec2 tangent = river ? normalize(vChannel.zw) : vec2(0.83, 0.55);
		float roughness = mix(0.055, 0.24, fast) + weatherAt(p).b * 0.12;
		vec2 disturbance = tangent * ((grain - 0.5) + (fine - 0.5) * 0.4) + vec2(-tangent.y, tangent.x) * (crossRipple - 0.5);
		vec3 n = normalize(geometric + vec3(disturbance.x, 0.0, disturbance.y) * roughness);
		vec3 V = normalize(uCameraPos - vWorldPos), R = reflect(-V, n);
		float facing = clamp(dot(n, V), 0.0, 1.0);
		float fresnel = 0.0204 + 0.9796 * pow(1.0 - facing, 5.0);
		vec3 reflection = mix(uSkyTone * 0.55, uSkyTone * 1.3, smoothstep(-0.15, 0.7, R.y));
		if (uHasEnvironment > 0.5) reflection = mix(reflection, min(textureCubeUV(uEnvironment, R, 0.28 + fast * 0.55).rgb, vec3(0.38)), 0.55);

		// Beer-Lambert absorption along the refracted ray: real bed and submerged plants
		// remain visible in shallows; deep pools acquire a blue-green body under the violet sky.
		float refractedCos = sqrt(1.0 - (1.0 - facing * facing) / (1.333 * 1.333));
		float thickness = min(depth / max(refractedCos, 0.3), 36.0);
		// Tree suitability is zero in water cells; read the banks for canopy-derived tannins.
		vec2 canopyOffset = river ? vec2(-tangent.y, tangent.x) * (vInfo0.w * 0.6 + 24.0) : vec2(40.0, 25.0);
		float forest = max(texture2D(uHabitatMap, (p + canopyOffset - uRockOrigin) / uRockSize + 0.5).r, texture2D(uHabitatMap, (p - canopyOffset - uRockOrigin) / uRockSize + 0.5).r);
		float lowland = 1.0 - smoothstep(65.0, 400.0, vLevel);
		float wetRain = weatherRain(vWorldPos);
		float sediment = river ? lowland * (0.06 + smoothstep(20.0, 90.0, vInfo0.w) * 0.32 + wetRain * 0.28) : 0.06 + wetRain * 0.1;
		float tannin = lowland * forest * (1.0 - fast) * 0.6;
		vec3 absorption = vec3(0.32, 0.095, 0.055) + sediment * vec3(0.2, 0.18, 0.24) + tannin * vec3(0.03, 0.19, 0.3);
		vec3 transmission = exp(-absorption * thickness);
		vec2 screen = gl_FragCoord.xy / uResolution;
		vec3 viewNormal = mat3(viewMatrix) * n;
		float refraction = smoothstep(0.0, 0.65, depth) * min(thickness, 7.0) * 0.0018;
		// Bound distortion near shore and obstructing boulders, where screen-space refraction
		// cannot see behind foreground geometry. No off-screen or negative UV sampling.
		float obstruction = max(wakeFoam(channel, vWake0), max(wakeFoam(channel, vWake1), wakeFoam(channel, vWake2)));
		vec2 sampleUv = clamp(screen + viewNormal.xy * refraction * (1.0 - obstruction), vec2(0.002), vec2(0.998));
		vec3 bed = vec3(0.11, 0.09, 0.16);
		if (uHasScene > 0.5) bed = texture2D(uSceneColor, sampleUv).rgb;
		vec3 body = mix(vec3(0.022, 0.105, 0.13), vec3(0.05, 0.085, 0.12), sediment);
		body = mix(body, vec3(0.075, 0.066, 0.055), clamp(sediment + tannin, 0.0, 0.75));
		body *= 0.65 + 0.35 * uMoonIntensity;
		body += uSkyTone * 0.06;
		// Soft refracted light on the bed, attenuated before it reaches deep pools.
		float caustic = pow(max(0.0, 1.0 - abs(grain - crossRipple) * 9.0), 4.0);
		bed += vec3(0.04, 0.07, 0.07) * caustic * exp(-depth * 0.45) * uMoonIntensity;
		// Entrained microbubbles scatter light in torrents even where the bed is shallow.
		transmission *= exp(-fast * thickness * 0.16);
		vec3 col = mix(bed * transmission + body * (1.0 - transmission), reflection, fresnel * (1.0 - fast * 0.35));

		float foam = 0.0;
		vec3 foamColor = vec3(0.56, 0.67, 0.72) * (0.65 + 0.35 * uMoonIntensity);
		if (river) {
			float streak = advectNoise(vec2(0.16, 0.72), vec2(3.0, 1.0));
			float bubbles = advectNoise(vec2(0.35, 1.3), vec2(11.0));
			float turbulence = streak * 0.62 + bubbles * 0.38;
			float threshold = 0.86 - foamEnergy * 0.25;
			float aa = max(fwidth(turbulence), 0.018);
			foam = smoothstep(threshold - aa, threshold + aa, turbulence) * smoothstep(0.03, 0.22, foamEnergy);
			foam = max(foam, obstruction);
			// A few streaks persist between rapids; banks and eddies gather torn rafts.
			float margin = smoothstep(0.5, 0.95, abs(vInfo0.z));
			float raft = smoothstep(0.76, 0.86, streak) * smoothstep(0.6, 0.8, bubbles) * margin;
			foam = max(foam, raft * 0.6);
			float slope = 1.0 - geometric.y;
			foam = max(foam, smoothstep(0.05, 0.28, slope) * fast * smoothstep(0.35, 0.65, grain));
			if (vInfo1.z > 0.02) foam = max(foam, smoothstep(0.25, 0.65, bubbles) * 0.85);
			foam *= smoothstep(0.0, 0.18, depth) * live;
			col += vec3(0.055, 0.075, 0.085) * smoothstep(0.72, 0.86, streak) * live * (1.0 - fresnel);
		} else {
			float shore = shoreDistAt(p);
			float ph = lakePhase(shore, p, uTime);
			foam = smoothstep(0.88, 0.98, sin(ph)) * (1.0 - smoothstep(0.3, 3.0, depth)) * smoothstep(0.45, 0.7, fine) * 0.6;
		}
		col = mix(col, foamColor, foam * 0.78);
		float moonSpec = pow(max(dot(R, uMoonDir), 0.0), mix(380.0, 65.0, fast));
		float sunSpec = pow(max(dot(R, uSunDir), 0.0), 180.0);
		col += uMoonColor * moonSpec * uMoonIntensity * 0.45 * (1.0 - foam * 0.8);
		col += vec3(1.0, 0.25, 0.1) * sunSpec * uSunIntensity * 0.6;
		col += rippleGlow(p, uTime) * 0.8;
		float localRain = weatherRain(vWorldPos);
		if (localRain > 0.02) {
			vec2 cell = floor(p / 5.0), local = fract(p / 5.0) - 0.5;
			float age = fract(uTime * 1.4 + hash21(cell));
			float ring = 1.0 - smoothstep(0.01, 0.035, abs(length(local) - age * 0.45));
			col += vec3(0.07, 0.09, 0.12) * ring * (1.0 - age) * localRain * (1.0 - smoothstep(80.0, 220.0, cameraDistance));
		}
		float seaMix = river ? (1.0 - smoothstep(1.5, 3.5, vLevel - uWaterLevel)) * smoothstep(0.0, 0.5, vFade) : 0.0;
		if (seaMix > 0.001) {
			float fr;
			col = mix(col, seaShade(vWorldPos, n, V, depth, distance(vWorldPos, uCameraPos), vUv4, fr), seaMix);
		}
		col += lumenIllumination(vWorldPos,n,V,1.0);
		col += vec3(0.1,0.14,0.22)*uLightning;
		float hf = heightFog(vWorldPos, uCameraPos);
		float df = 1.0 - exp(-pow(distance(vWorldPos, uCameraPos) * uFogDistance, 2.0) * 1.4);
		// Captured bed already includes fog. Only add fog to the light contributed by water.
		float waterBody = 1.0 - dot(transmission, vec3(0.3333)) * (1.0 - fresnel) * (1.0 - foam);
		col = mix(col, uFogColor, hf * waterBody);
		col = mix(col, mix(uFogColor, uFogFar, 0.4), df * waterBody);
		float alpha = smoothstep(0.0, 0.12, depth);
		if (river) {
			alpha *= 1.0 - vJoin;
			alpha *= mix(smoothstep(0.35, 0.6, vLevel - uWaterLevel), smoothstep(0.35, 1.5, vLevel - uWaterLevel), smoothstep(0.0, 0.5, vFade));
		}
		if (alpha < 0.005) discard;
		gl_FragColor = vec4(max(col, 0.0), alpha);
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
