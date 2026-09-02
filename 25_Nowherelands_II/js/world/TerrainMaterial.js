import * as THREE from 'three';
import { Ripples } from './Ripples.js';
import { fogGlsl } from './FogGlsl.js';

export const hslGlsl = /* glsl */`
vec3 hsl2rgb(vec3 c) {
	vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
	return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
}`;

export const noiseGlsl = /* glsl */`
// integer-safe hash: sin-based hashes fall apart on world coordinates in the thousands
float hash21(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
	vec2 i = mod(floor(p), 1024.0), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float fbm2(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += vnoise(p) * a; p *= 2.03; a *= 0.5; } return s; }`;

// Lighting shared with the boulders so rocks match the ground they sit on.
export const terrainLightGlsl = /* glsl */`
vec3 terrainLight(vec3 albedo, vec3 n) {
	float diff = max(dot(n, uMoonDir), 0.0);
	vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
	float sunDiff = max(dot(n, uSunDir), 0.0);
	return albedo * (hemi * 1.1 + uMoonColor * diff * uMoonIntensity * 0.65 + uSunColor * pow(sunDiff, 2.0) * uSunIntensity * 0.12);
}`;

// Boulders: instanced, flat-shaded with the terrain's own lighting and fog so they belong to the ground.
export function createRockMaterial(shared, terrainUniforms) {
	const uniforms = {};
	for (const k of ['uMoonDir', 'uMoonColor', 'uMoonIntensity', 'uSunDir', 'uSunColor', 'uSunIntensity', 'uSkyColor', 'uGroundColor', 'uCameraPos', 'uRain']) uniforms[k] = terrainUniforms[k];
	Object.assign(uniforms, shared.fogUniforms);
	return new THREE.ShaderMaterial({
		uniforms,
		vertexShader: /* glsl */`
			attribute float aBorn;
			varying vec3 vWorldPos;
			void main() {
				vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
				vWorldPos = worldPosition.xyz;
				gl_Position = projectionMatrix * viewMatrix * worldPosition;
			}`,
		fragmentShader: /* glsl */`
			uniform float uMoonIntensity, uSunIntensity, uRain;
			uniform vec3 uMoonDir, uMoonColor, uSkyColor, uGroundColor, uCameraPos, uSunDir, uSunColor;
			varying vec3 vWorldPos;
			${noiseGlsl}
			${fogGlsl}
			${terrainLightGlsl}
			void main() {
				vec3 nc = cross(dFdx(vWorldPos), dFdy(vWorldPos));
				vec3 n = dot(nc, nc) > 1e-12 ? normalize(nc) : vec3(0.0, 1.0, 0.0);
				float grain = vnoise(vWorldPos.xz * 0.7 + vWorldPos.y * 0.3);
				vec3 albedo = mix(vec3(0.11, 0.075, 0.18), vec3(0.24, 0.18, 0.29), grain * 0.6 + 0.2);
				vec3 color = terrainLight(albedo, n) * (1.0 - uRain * 0.3);
				color = applyFog(color, vWorldPos, uCameraPos);
				gl_FragColor = vec4(color, 1.0);
			}`,
	});
}

export function createTerrainMaterial(shared, heightmap) {
	const world = heightmap.world;
	const rockTex = new THREE.DataTexture(world.rock, world.res, world.res, THREE.RedFormat, THREE.UnsignedByteType);
	rockTex.magFilter = THREE.LinearFilter;
	rockTex.minFilter = THREE.LinearFilter;
	rockTex.wrapS = rockTex.wrapT = THREE.ClampToEdgeWrapping;
	rockTex.needsUpdate = true;

	const uniforms = {
		uTime: { value: 0 },
		uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
		uMoonColor: { value: new THREE.Color('#ffd7f3') },
		uMoonIntensity: { value: 1 },
		uSunDir: { value: new THREE.Vector3(0, -1, 0) },
		uSunColor: { value: new THREE.Color('#ff3b22') },
		uSunIntensity: { value: 0 },
		uSkyColor: { value: new THREE.Color('#2b1a5e') },
		uGroundColor: { value: new THREE.Color('#06040f') },
		uHue: { value: 0.8 },
		uBass: { value: 0 },
		uLevel: { value: 0 },
		uSnow: { value: 0 },
		uHum: { value: 0 },
		uNight: { value: 0 },
		uRain: { value: 0 },
		uWaterLevel: { value: heightmap.waterLevel },
		uCameraPos: { value: new THREE.Vector3() },
		uRockMap: { value: rockTex },
		uRockOrigin: { value: new THREE.Vector2(-heightmap.ox, -heightmap.oz) },
		uRockSize: { value: world.size },
	};
	Object.assign(uniforms, shared.ripples.uniforms, shared.shoreMap.uniforms, shared.fogUniforms);

	const material = new THREE.ShaderMaterial({
		uniforms,
		vertexShader: /* glsl */`
			varying vec3 vWorldPos;
			void main() {
				vec4 worldPosition = modelMatrix * vec4(position, 1.0);
				vWorldPos = worldPosition.xyz;
				gl_Position = projectionMatrix * viewMatrix * worldPosition;
			}`,
		fragmentShader: /* glsl */`
			uniform float uTime, uMoonIntensity, uHue, uBass, uLevel, uSnow, uHum, uWaterLevel, uNight, uRain, uRockSize;
			uniform vec3 uMoonDir, uMoonColor, uSkyColor, uGroundColor, uCameraPos, uSunDir, uSunColor;
			uniform float uSunIntensity;
			uniform sampler2D uRockMap;
			uniform vec2 uRockOrigin;
			varying vec3 vWorldPos;
			${hslGlsl}
			${noiseGlsl}
			${Ripples.glsl()}
			${shared.shoreMap.glsl}
			${fogGlsl}
			${terrainLightGlsl}

			float gridLine(vec2 p, float cell) {
				vec2 q = p / cell;
				vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
				return 1.0 - smoothstep(0.35, 1.1, min(g.x, g.y));
			}

			void main() {
				vec3 nc = cross(dFdx(vWorldPos), dFdy(vWorldPos));
				vec3 n = dot(nc, nc) > 1e-12 ? normalize(nc) : vec3(0.0, 1.0, 0.0);
				float hSea = vWorldPos.y - uWaterLevel;
				float waterY = max(waterLevelAt(vWorldPos.xz), uWaterLevel);
				float h = vWorldPos.y - waterY;          // above the local water (sea, lake or river)
				float dist = distance(vWorldPos, uCameraPos);
				float hard = texture2D(uRockMap, (vWorldPos.xz - uRockOrigin) / uRockSize + 0.5).r;

				// height-banded base colour
				vec3 deep = vec3(0.02, 0.014, 0.07);
				vec3 mid = vec3(0.075, 0.035, 0.17);
				vec3 high = vec3(0.19, 0.1, 0.25);
				vec3 peak = vec3(0.3, 0.2, 0.36);
				vec3 albedo = mix(deep, mid, smoothstep(-2.0, 140.0, hSea));
				albedo = mix(albedo, high, smoothstep(160.0, 560.0, hSea));
				albedo = mix(albedo, peak, smoothstep(600.0, 1150.0, hSea));
				albedo *= 0.75 + 0.25 * n.y;

				// bare rock on the steep faces: layered strata, lighter where the rock is hard
				float steep = 1.0 - smoothstep(0.42, 0.7, n.y);
				float strataN = vnoise(vWorldPos.xz * 0.05) * 9.0 + vnoise(vWorldPos.xz * 0.6) * 1.5;
				float band = 0.5 + 0.5 * sin((vWorldPos.y + strataN) * 0.45);
				vec3 rockDark = vec3(0.1, 0.065, 0.16), rockLight = vec3(0.34, 0.25, 0.38);
				vec3 rock = mix(rockDark, rockLight, band * 0.5 + hard * 0.45);
				albedo = mix(albedo, rock, steep * 0.85);
				// scree fans below the cliffs
				float scree = smoothstep(0.7, 0.82, n.y) * (1.0 - smoothstep(0.86, 0.95, n.y)) * smoothstep(80.0, 400.0, hSea);
				albedo = mix(albedo, rockDark * 1.4, scree * 0.5);

				// snow: seasonal on gentle ground, permanent above the snow line
				float snowLine = 780.0 + (vnoise(vWorldPos.xz * 0.003) - 0.5) * 220.0;
				float caps = smoothstep(snowLine - 60.0, snowLine + 90.0, hSea) * smoothstep(0.4, 0.8, n.y);
				float snowMask = max(smoothstep(0.55, 0.9, n.y) * smoothstep(1.0, 16.0, h) * uSnow, caps);
				albedo = mix(albedo, vec3(0.4, 0.4, 0.56), snowMask * 0.65);

				vec3 color = terrainLight(albedo, n);
				// cliff faces catch a little moonlight glint so they read even when turned away
				color += uMoonColor * pow(max(dot(reflect(-uMoonDir, n), normalize(uCameraPos - vWorldPos)), 0.0), 6.0) * steep * 0.05 * uMoonIntensity;

				// rain darkens and glosses the ground
				color *= 1.0 - uRain * 0.3;
				color += uMoonColor * pow(max(dot(reflect(-uMoonDir, n), normalize(uCameraPos - vWorldPos)), 0.0), 24.0) * uRain * 0.25 * uMoonIntensity;

				// glowing grid + contours
				float lineFade = exp(-dist / 380.0) * smoothstep(2.0, 12.0, dist);
				float grid = gridLine(vWorldPos.xz, 16.0) * lineFade * smoothstep(0.35, 0.65, n.y);   // the grid is drawn on the ground, not up the cliffs
				float cq = hSea / 10.0;
				float contour = (1.0 - min(abs(fract(cq - 0.5) - 0.5) / fwidth(cq), 1.0)) * lineFade * step(1.0, h);
				vec3 lineColor = hsl2rgb(vec3(uHue, 0.55, 0.55));
				vec3 contourColor = hsl2rgb(vec3(fract(uHue + 0.45), 0.9, 0.62));
				float pulse = (0.045 + 0.07 * uBass + 0.16 * uLevel) * (1.0 + 0.5 * uNight) * (1.0 - 0.15 * uSunIntensity) + 0.35 * uHum * (0.5 + 0.5 * sin(uTime * 2.0 - dist * 0.02));
				color += lineColor * grid * pulse;
				color += contourColor * contour * (0.03 + 0.1 * uLevel);

				// ripples from notes and footsteps
				color += rippleGlow(vWorldPos.xz, uTime) * 1.4;

				// wet sand and foam wash just above the water line
				float wet = (1.0 - smoothstep(0.0, 2.5, h)) * step(0.0, h);
				color *= 1.0 - wet * 0.45;
				float washN = hash21(mod(floor(vWorldPos.xz * 0.6), 1024.0));
				float wash = (1.0 - smoothstep(0.0, 0.45 + 0.3 * sin(uTime * 1.6 + vWorldPos.x * 0.07 + vWorldPos.z * 0.05), h)) * step(0.0, h);
				color += vec3(0.7, 0.75, 0.9) * wash * (0.25 + 0.25 * washN) * (0.5 + 0.5 * uMoonIntensity);

				color = applyFog(color, vWorldPos, uCameraPos);
				gl_FragColor = vec4(color, 1.0);
			}`,
	});

	return material;
}
