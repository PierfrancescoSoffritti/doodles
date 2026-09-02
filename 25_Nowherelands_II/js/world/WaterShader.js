import * as THREE from 'three';
import { Ripples } from './Ripples.js';
import { hslGlsl, noiseGlsl } from './TerrainMaterial.js';
import { fogGlsl } from './FogGlsl.js';

// One water look for the sea, the lakes and the rivers. The sea reflects the scene (REFLECTIVE);
// inland water fakes its reflection from the sky tone and carries flow and foam per vertex (FLOW).
export function createWaterUniforms(shared, waterLevel) {
	const uniforms = {
		color: { value: new THREE.Color('#ffffff') },
		tDiffuse: { value: null },
		textureMatrix: { value: new THREE.Matrix4() },
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
	Object.assign(uniforms, shared.ripples.uniforms, shared.shoreMap.uniforms, shared.fogUniforms);
	return uniforms;
}

export const waterVertexShader = /* glsl */`
	uniform mat4 textureMatrix;
	varying vec4 vUv4;
	varying vec3 vWorldPos;
	#ifdef FLOW
	attribute float aFoam, aDepth, aAcross, aFall, aBase, aAlong, aWidth;
	attribute vec2 aFlow;
	varying float vFoam, vDepth, vAcross, vFall, vBase, vAlong, vWidth;
	varying vec2 vFlow;
	#endif
	void main() {
		vec4 worldPosition = modelMatrix * vec4(position, 1.0);
		vWorldPos = worldPosition.xyz;
		vUv4 = textureMatrix * vec4(position, 1.0);
		#ifdef FLOW
		vFoam = aFoam;
		vFlow = aFlow;
		vDepth = aDepth;
		vAcross = aAcross;
		vFall = aFall;
		vBase = aBase;
		vAlong = aAlong;
		vWidth = aWidth;
		#endif
		gl_Position = projectionMatrix * viewMatrix * worldPosition;
	}`;

export function waterFragmentShader(shared) {
	return /* glsl */`
	uniform sampler2D tDiffuse;
	uniform vec3 color, uMoonDir, uMoonColor, uCameraPos, uSunDir, uSkyTone;
	uniform float uSunIntensity;
	uniform float uTime, uMoonIntensity, uHue, uBass, uWaterLevel, uRain;
	varying vec4 vUv4;
	varying vec3 vWorldPos;
	#ifdef FLOW
	varying float vFoam, vDepth, vAcross, vFall, vBase, vAlong, vWidth;
	varying vec2 vFlow;
	#endif
	${hslGlsl}
	${noiseGlsl}
	${Ripples.glsl()}
	${shared.shoreMap.glsl}
	${fogGlsl}
	void main() {
		vec2 p = vWorldPos.xz;
		#ifdef FLOW
		// rivers are textured in their own space: metres along the channel (scrolling with the
		// current) by metres across it. Scrolling world coordinates by a per-vertex flow direction
		// shears the pattern into streaks as time passes; this does not.
		bool river = vDepth > 0.0;
		float speed = 2.2 + vWidth * 0.02;
		vec2 fuv = river ? vec2(vAlong - uTime * speed, vAcross * vWidth * 0.5) : p;
		vec2 pd = fuv;
		#else
		vec2 pd = p;
		#endif
		float w1 = sin(pd.x * 0.09 + uTime * 0.6) + sin(pd.y * 0.07 - uTime * 0.45);
		float w2 = sin((pd.x + pd.y) * 0.05 + uTime * 0.35);
		#ifdef FLOW
		vec3 n;
		if (river) {
			// running water is rougher: small tumbling ripples travelling with the current, turned into the flow frame
			float r1 = vnoise(fuv * 0.7) - 0.5, r2 = vnoise(fuv * 0.7 + 13.0) - 0.5;
			float r3 = vnoise(fuv * 2.1 + 5.0) - 0.5;
			vec2 perp = vec2(-vFlow.y, vFlow.x);
			vec2 slope = vFlow * (r1 * 0.05 + r3 * 0.02) + perp * (r2 * 0.05);
			n = normalize(vec3(slope.x, 1.0, slope.y));
		} else n = normalize(vec3(w1 * 0.004, 1.0, w2 * 0.004));
		#else
		vec3 n = normalize(vec3(w1 * 0.006, 1.0, w2 * 0.006));
		#endif
		vec3 V = normalize(uCameraPos - vWorldPos);
		vec3 R = reflect(-V, n);
		float fresnel = pow(clamp(1.0 - dot(V, n), 0.0, 1.0), 2.5);

		float depth = vWorldPos.y - terrainHeightAt(p);          // how deep the water is here
		#ifdef FLOW
		if (vDepth > 0.0) {
			// rivers know their own channel: deep in the middle, foam only along the banks
			float u = abs(vAcross);
			depth = (u < 1.0 ? 0.15 + 0.85 * sqrt(1.0 - u * u) : 0.15 - (u - 1.0) * 2.0) * 6.0;
		}
		#endif
		float shallow = 1.0 - smoothstep(0.0, 6.0, depth);

		vec3 ripple = rippleGlow(p, uTime);
		#ifdef REFLECTIVE
		vec3 coord = vUv4.xyz / max(vUv4.w, 1e-4);
		coord.xy += n.xz * 0.12;
		vec3 refl = texture2D(tDiffuse, coord.xy).rgb;
		#else
		vec3 refl = uSkyTone * (0.7 + 0.3 * fresnel);
		#endif

		// flat stylized water: a deep violet-blue with only a hint of the reflection
		vec3 base = vec3(0.03, 0.03, 0.11);
		#ifdef FLOW
		vec3 col = mix(vec3(0.02, 0.02, 0.08), refl * 0.45, 0.14 + 0.24 * fresnel);
		#else
		vec3 col = mix(base, refl * 0.6, 0.18 + 0.3 * fresnel);
		#endif
		#ifdef FLOW
		col = mix(col, vec3(0.06, 0.16, 0.24), shallow * (vDepth < 0.0 ? 0.12 : 0.2));
		#else
		col = mix(col, vec3(0.06, 0.16, 0.24), shallow * 0.35);
		#endif
		col = mix(col, vec3(0.12, 0.04, 0.11), uSunIntensity * 0.2);
		// a long red glitter path under the low sun; rivers are narrow and broken up, so theirs is a thin one
		#ifdef FLOW
		float sunSpec = pow(max(dot(R, uSunDir), 0.0), 220.0) * 0.5 + pow(max(dot(R, uSunDir), 0.0), 40.0) * 0.04;
		#else
		float sunSpec = pow(max(dot(R, uSunDir), 0.0), 220.0) * 2.2 + pow(max(dot(R, uSunDir), 0.0), 10.0) * 0.2;
		#endif
		col += vec3(1.0, 0.25, 0.1) * sunSpec * uSunIntensity;

		// cel-shaded foam: hard-edged outline rings that follow the shore and drift slowly
		float wobble = vnoise(pd * 0.11 + uTime * 0.08) * 1.0 + vnoise(pd * 0.03 - uTime * 0.04) * 1.2;
		float dd = depth + wobble - 1.4;
		float edge = 1.0 - step(0.4, dd);                                  // solid band at the waterline
		float ring1 = step(abs(dd - 1.55), 0.16);
		float ring2 = step(abs(dd - 2.75), 0.11) * step(0.35, vnoise(pd * 0.3 + uTime * 0.05));
		float gapNoise = step(0.28, vnoise(pd * 0.22 - uTime * 0.06));     // breaks the rings into dashes
		float foam = clamp(edge + (ring1 + ring2) * gapNoise, 0.0, 1.0) * step(0.0, depth + 0.3);
		#ifdef FLOW
		if (!river) {
			// still water: a thin lap right at the shore and nothing else
			float lap = (1.0 - smoothstep(0.0, 0.35, depth + wobble * 0.1)) * step(0.0, depth + 0.3);
			col = mix(col, vec3(0.3, 0.33, 0.46), lap * 0.6);
		} else {
			// rivers: a thin broken line where the water actually meets the bank
			float shoreDepth = vWorldPos.y - terrainHeightAt(p);
			float edgeR = (1.0 - smoothstep(0.0, 0.3, shoreDepth)) * step(-0.3, shoreDepth) * step(0.35, vnoise(vec2(fuv.x * 0.5, 7.0)));
			col = mix(col, vec3(0.3, 0.33, 0.46), edgeR * 0.5);
		}
		#else
		col = mix(col, vec3(0.56, 0.6, 0.72), foam);
		#endif

		#ifdef FLOW
		if (river) {
		// running water: streaks stretched along the flow, white water below each drop
		float along = fuv.x, across = fuv.y;
		float streak = vnoise(vec2(along * 0.07, across * 0.3));
		float streak2 = vnoise(vec2(along * 0.16 - uTime * 0.6 + 7.0, across * 0.55));
		float grazing = 1.0 - 0.75 * fresnel;   // seen along the surface the river is a dark mirror of a dark sky
		col += vec3(0.42, 0.47, 0.62) * smoothstep(0.62, 0.8, streak) * 0.02 * grazing;
		// white water is streaky, not a wash: a hard-thresholded turbulence pattern gated by the foam weight
		float turb = vnoise(vec2(along * 0.3 - uTime * 1.5, across * 0.7)) * 0.6 + vnoise(vec2(along * 0.12 - uTime * 0.5 + 7.0, across * 0.35)) * 0.4;
		float white = vFoam * (1.0 - 0.5 * fresnel) * smoothstep(0.58, 0.72, turb + vFoam * 0.12);
		col = mix(col, vec3(0.52, 0.55, 0.68), clamp(white, 0.0, 1.0) * 0.7);
		// small flecks of foam drifting downstream
		float patches = smoothstep(0.6, 0.82, vnoise(vec2(along * 0.14, across * 0.5)) * 0.6 + vnoise(vec2(along * 0.4 - uTime * 0.4 + 5.0, across * 1.2)) * 0.4);
		col = mix(col, vec3(0.45, 0.48, 0.6), patches * 0.06 * grazing);
		// falling water: a coherent sheet leaving the lip that breaks into strands and spray on the way down.
		// Only the vertical face is the fall; the flat pool quads beside it just carry its foam.
		vec3 gn = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
		float vertical = 1.0 - smoothstep(0.3, 0.7, abs(gn.y));
		if (vFall > 0.02 && vertical > 0.01) {
			float frac = clamp((vWorldPos.y - vBase) / max(vFall, 0.5), 0.0, 1.0);   // 1 at the lip, 0 in the pool
			float fy = vWorldPos.y * 0.6 + uTime * 10.0;
			float sheet = vnoise(vec2(across * 0.9, fy * 0.05)) * 0.6 + vnoise(vec2(across * 2.4 + 5.0, fy * 0.2)) * 0.4;
			float strands = vnoise(vec2(across * 4.0 + 9.0, fy * 0.35)) * 0.5 + vnoise(vec2(across * 8.0 + 2.0, fy * 0.6)) * 0.5;
			float turbulence = mix(strands, sheet, frac);
			float white = smoothstep(0.42, 0.62, turbulence + (1.0 - frac) * 0.15);
			float tall = smoothstep(0.6, 4.0, vFall);
			float sides = 1.0 - smoothstep(0.7, 1.0, abs(vAcross)) * 0.5;
			vec3 fallCol = mix(vec3(0.16, 0.18, 0.3), vec3(0.58, 0.61, 0.74), white * sides);
			col = mix(col, fallCol, (0.55 + 0.45 * tall) * vertical);
		}
		}
		#endif

		#ifdef FLOW
		float spec = pow(max(dot(R, uMoonDir), 0.0), 500.0) * 0.8 + pow(max(dot(R, uMoonDir), 0.0), 60.0) * 0.04;
		#else
		float spec = pow(max(dot(R, uMoonDir), 0.0), 500.0) * 2.5 + pow(max(dot(R, uMoonDir), 0.0), 24.0) * 0.18;
		#endif
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
		gl_FragColor = vec4(col, 1.0);
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
