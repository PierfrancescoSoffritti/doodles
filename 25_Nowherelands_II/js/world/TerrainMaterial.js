import * as THREE from 'three';
import { Ripples } from './Ripples.js';

export const hslGlsl = /* glsl */`
vec3 hsl2rgb(vec3 c) {
	vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
	return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
}`;

export function createTerrainMaterial(shared) {
	const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
	Object.assign(uniforms, {
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
		uWaterLevel: { value: 0 },
		uCameraPos: { value: new THREE.Vector3() },
	}, shared.ripples.uniforms, shared.shoreMap.uniforms);

	const material = new THREE.ShaderMaterial({
		uniforms,
		fog: true,
		vertexShader: /* glsl */`
			#include <fog_pars_vertex>
			varying vec3 vWorldPos;
			void main() {
				vec4 worldPosition = modelMatrix * vec4(position, 1.0);
				vWorldPos = worldPosition.xyz;
				vec4 mvPosition = viewMatrix * worldPosition;
				gl_Position = projectionMatrix * mvPosition;
				#include <fog_vertex>
			}`,
		fragmentShader: /* glsl */`
			#include <fog_pars_fragment>
			uniform float uTime, uMoonIntensity, uHue, uBass, uLevel, uSnow, uHum, uWaterLevel, uNight, uRain;
			uniform vec3 uMoonDir, uMoonColor, uSkyColor, uGroundColor, uCameraPos, uSunDir, uSunColor;
			uniform float uSunIntensity;
			varying vec3 vWorldPos;
			${hslGlsl}
			${Ripples.glsl()}

			float gridLine(vec2 p, float cell) {
				vec2 q = p / cell;
				vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
				return 1.0 - smoothstep(0.35, 1.1, min(g.x, g.y));
			}

			void main() {
				vec3 nc = cross(dFdx(vWorldPos), dFdy(vWorldPos));
				vec3 n = dot(nc, nc) > 1e-12 ? normalize(nc) : vec3(0.0, 1.0, 0.0);
				float h = vWorldPos.y - uWaterLevel;
				float dist = distance(vWorldPos, uCameraPos);

				// height-banded base colour
				vec3 deep = vec3(0.02, 0.014, 0.07);
				vec3 mid = vec3(0.075, 0.035, 0.17);
				vec3 high = vec3(0.24, 0.12, 0.3);
				vec3 peak = vec3(0.5, 0.34, 0.56);
				vec3 albedo = mix(deep, mid, smoothstep(-2.0, 45.0, h));
				albedo = mix(albedo, high, smoothstep(45.0, 120.0, h));
				albedo = mix(albedo, peak, smoothstep(120.0, 190.0, h));
				albedo *= 0.75 + 0.25 * n.y;

				// snow settles on gentle slopes
				float snowMask = smoothstep(0.55, 0.9, n.y) * smoothstep(1.0, 16.0, h) * uSnow;
				albedo = mix(albedo, vec3(0.62, 0.62, 0.8), snowMask * 0.85);

				// lighting: moon + hemisphere
				float diff = max(dot(n, uMoonDir), 0.0);
				vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
				float sunDiff = max(dot(n, uSunDir), 0.0);
				vec3 color = albedo * (hemi * 1.1 + uMoonColor * diff * uMoonIntensity * 0.9 + uSunColor * pow(sunDiff, 2.0) * uSunIntensity * 0.45);

				// rain darkens and glosses the ground
				color *= 1.0 - uRain * 0.3;
				color += uMoonColor * pow(max(dot(reflect(-uMoonDir, n), normalize(uCameraPos - vWorldPos)), 0.0), 24.0) * uRain * 0.25 * uMoonIntensity;

				// glowing grid + contours
				float lineFade = exp(-dist / 380.0) * smoothstep(2.0, 12.0, dist);
				float grid = gridLine(vWorldPos.xz, 16.0) * lineFade;
				float cq = h / 10.0;
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
				float washN = fract(sin(dot(floor(vWorldPos.xz * 0.6), vec2(12.9898, 78.233))) * 43758.5453);
				float wash = (1.0 - smoothstep(0.0, 0.9 + 0.5 * sin(uTime * 1.6 + vWorldPos.x * 0.07 + vWorldPos.z * 0.05), h)) * step(0.0, h);
				color += vec3(0.7, 0.75, 0.9) * wash * (0.35 + 0.3 * washN) * (0.5 + 0.5 * uMoonIntensity);

				// valley haze
				float haze = (1.0 - smoothstep(-4.0, 28.0, h)) * 0.45;
				color = mix(color, fogColor * 1.2, haze);

				gl_FragColor = vec4(color, 1.0);
				#include <fog_fragment>
			}`,
	});

	return material;
}
