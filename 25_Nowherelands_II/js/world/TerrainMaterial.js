import * as THREE from 'three';
import { Ripples } from './Ripples.js';
import { fogGlsl } from './FogGlsl.js';
import { shoreWaveGlsl } from './ShoreWaves.js';

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
	// moon and red dwarf both wrap a little past the terminator so slopes facing away still read;
	// the sky itself lights everything, steep faces included
	float diff = max(dot(n, uMoonDir) * 0.9 + 0.1, 0.0);
	vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.4 + 0.6);
	float sunDiff = max(dot(n, uSunDir) * 0.8 + 0.2, 0.0);
	vec3 ambient = uSkyColor * 0.22 + vec3(0.06, 0.04, 0.1) + uSunColor * 0.09 * uSunIntensity;   // the red dwarf leaves an ember glow on everything
	return albedo * (ambient + hemi * 1.0 + uMoonColor * diff * uMoonIntensity * 0.95 + uSunColor * pow(sunDiff, 1.3) * uSunIntensity * 1.1);
}`;

// Boulders: instanced, flat-shaded with the terrain's own lighting and fog so they belong to the ground.
export function createRockMaterial(shared, terrainUniforms) {
	const uniforms = {};
	for (const k of ['uMoonDir', 'uMoonColor', 'uMoonIntensity', 'uSunDir', 'uSunColor', 'uSunIntensity', 'uSkyColor', 'uGroundColor', 'uCameraPos', 'uRain']) uniforms[k] = terrainUniforms[k];
	Object.assign(uniforms, shared.fogUniforms, shared.shoreMap.uniforms);
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
			${shared.shoreMap.glsl}
			${fogGlsl}
			${terrainLightGlsl}
			void main() {
				vec3 nc = cross(dFdx(vWorldPos), dFdy(vWorldPos));
				vec3 n = dot(nc, nc) > 1e-12 ? normalize(nc) : vec3(0.0, 1.0, 0.0);
				float grain = vnoise(vWorldPos.xz * 0.7 + vWorldPos.y * 0.3);
				vec3 albedo = mix(vec3(0.11, 0.075, 0.18), vec3(0.24, 0.18, 0.29), grain * 0.6 + 0.2);
				float water = waterLevelAt(vWorldPos.xz), H = vWorldPos.y - water;
				float dampBand = (1.0 - smoothstep(0.2, 0.9, H)) * step(0.3, water);
				albedo *= 1.0 - dampBand * 0.35;
				float mineral = (1.0 - smoothstep(0.08, 0.28, abs(H - 1.15))) * step(0.3, water);
				albedo += vec3(0.04, 0.035, 0.045) * mineral;
				float moss = smoothstep(0.2, 0.65, H) * (1.0 - smoothstep(1.8, 3.5, H)) * smoothstep(0.5, 0.85, n.y) * smoothstep(0.35, 0.65, grain) * step(0.3, water);
				albedo = mix(albedo, vec3(0.09, 0.15, 0.13), moss * 0.65);
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
	const habTex = new THREE.DataTexture(world.habitat, world.res, world.res, THREE.RGBAFormat, THREE.UnsignedByteType);
	habTex.magFilter = THREE.LinearFilter;
	habTex.minFilter = THREE.LinearFilter;
	habTex.wrapS = habTex.wrapT = THREE.ClampToEdgeWrapping;
	habTex.needsUpdate = true;

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
		uHabitatMap: { value: habTex },
		uRockOrigin: { value: new THREE.Vector2(-heightmap.ox, -heightmap.oz) },
		uRockSize: { value: world.size },
	};
	Object.assign(uniforms, shared.ripples.uniforms, shared.shoreMap.uniforms, shared.fogUniforms);

	const material = new THREE.ShaderMaterial({
		uniforms,
		vertexShader: /* glsl */`
			attribute float aCave;
			attribute float aApron;
			varying vec3 vWorldPos;
			varying float vCave;
			varying float vApron;
			void main() {
				vec4 worldPosition = modelMatrix * vec4(position, 1.0);
				vWorldPos = worldPosition.xyz;
			vCave=aCave;vApron=aApron;
				gl_Position = projectionMatrix * viewMatrix * worldPosition;
			}`,
		fragmentShader: /* glsl */`
			uniform float uTime, uMoonIntensity, uHue, uBass, uLevel, uSnow, uHum, uWaterLevel, uNight, uRain, uRockSize;
			uniform vec3 uMoonDir, uMoonColor, uSkyColor, uGroundColor, uCameraPos, uSunDir, uSunColor;
			uniform float uSunIntensity;
			uniform sampler2D uRockMap, uHabitatMap;
			uniform vec2 uRockOrigin;
			varying vec3 vWorldPos;
			varying float vCave;
			varying float vApron;
			${hslGlsl}
			${noiseGlsl}
			${Ripples.glsl()}
			${shared.shoreMap.glsl}
			${shoreWaveGlsl}
			${fogGlsl}
			${terrainLightGlsl}

			float gridLine(vec2 p, float cell) {
				vec2 q = p / cell;
				vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
				return 1.0 - smoothstep(0.35, 1.1, min(g.x, g.y));
			}

			void main() {
				// A small overlap covers interpolation differences between the terrain LOD
				// and the fixed-grid cavity shell, especially on an uneven entrance floor.
				if(vCave>1.25) discard;
				vec3 nc = cross(dFdx(vWorldPos), dFdy(vWorldPos));
				vec3 n = dot(nc, nc) > 1e-12 ? normalize(nc) : vec3(0.0, 1.0, 0.0);
				float hSea = vWorldPos.y - uWaterLevel;
				float waterY = max(waterLevelAt(vWorldPos.xz), uWaterLevel);
				float h = vWorldPos.y - waterY;          // above the local water (sea, lake or river)
				float dist = distance(vWorldPos, uCameraPos);
				vec2 mapUv = (vWorldPos.xz - uRockOrigin) / uRockSize + 0.5;
				float hard = texture2D(uRockMap, mapUv).r;
				vec4 hab = texture2D(uHabitatMap, mapUv);   // forest, wet, coast, alt

				// height-banded base colour
				vec3 deep = vec3(0.03, 0.02, 0.09);
				vec3 mid = vec3(0.095, 0.05, 0.2);
				vec3 high = vec3(0.21, 0.12, 0.28);
				vec3 peak = vec3(0.32, 0.22, 0.38);
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

				// the forests, seen from afar: the ground darkens under the stands, broken by a canopy-scale
				// speckle, so the far slopes carry the same pattern the near chunks fill with trees.
				// Wet meadows lean a little toward blue-green, dry ground stays the bare purple.
				float gentle = 1.0 - steep;
				float forestT = hab.r * gentle;
				float fdist = smoothstep(120.0, 900.0, dist);
				float speck = vnoise(vWorldPos.xz * 0.055) * 0.6 + vnoise(vWorldPos.xz * 0.19) * 0.4;
				vec3 forestCol = albedo * vec3(0.3, 0.27, 0.45);
				albedo = mix(albedo, forestCol, forestT * (0.45 + 0.5 * fdist) * (0.5 + 0.5 * speck));
				albedo = mix(albedo, albedo * vec3(0.8, 0.98, 1.02), hab.g * (1.0 - forestT) * gentle * 0.45 * smoothstep(1.0, 8.0, h));

				// Gravel and sand follow the exposed bed and low bars beside inland channels.
				float riverBed = riverMouthAt(vWorldPos.xz) * smoothstep(0.3, 1.5, waterY - uWaterLevel);
				float lakeShore = smoothstep(0.3, 1.5, waterY - uWaterLevel) * (1.0 - riverBed) * (1.0 - smoothstep(1.5, 5.0, abs(h)));
				float sediment = max(riverBed * (1.0 - smoothstep(0.4, 3.2, h)), lakeShore) * gentle;
				vec2 pebbleCell = floor(vWorldPos.xz * 1.1);
				vec2 pebbleUv = fract(vWorldPos.xz * 1.1) - 0.5;
				float pebble = smoothstep(0.52, 0.22, length(pebbleUv * vec2(1.0, 1.25)));
				float grain = vnoise(vWorldPos.xz * 1.8) * 0.45 + hash21(pebbleCell) * 0.35 + pebble * 0.2;
				vec3 gravel = mix(vec3(0.16, 0.14, 0.2), vec3(0.32, 0.28, 0.33), smoothstep(0.3, 0.7, grain));
				vec3 sand = vec3(0.25, 0.21, 0.25) * (0.9 + 0.2 * grain);
				albedo = mix(albedo, mix(sand, gravel, hard * 0.6 + 0.25), sediment * 0.94);

				// Old water marks and damp moss break up the bank above today's water level.
				float shoreBand = max(riverBed, lakeShore);
				float oldLevel = 1.4 + vnoise(vWorldPos.xz * 0.018) * 1.6;
				float strand = (1.0 - smoothstep(0.15, 0.65, abs(h - oldLevel))) * shoreBand;
				albedo *= 1.0 - strand * 0.18;
				float moss = hab.r * shoreBand * smoothstep(0.25, 0.8, h) * (1.0 - smoothstep(2.0, 5.0, h)) * smoothstep(0.35, 0.7, vnoise(vWorldPos.xz * 0.3));
				albedo = mix(albedo, vec3(0.095, 0.16, 0.14), moss * 0.55);

				// snow: seasonal on gentle ground, permanent above the snow line
				float snowLine = 780.0 + (vnoise(vWorldPos.xz * 0.003) - 0.5) * 220.0;
				float caps = smoothstep(snowLine - 60.0, snowLine + 90.0, hSea) * smoothstep(0.4, 0.8, n.y);
				float snowMask = max(smoothstep(0.55, 0.9, n.y) * smoothstep(1.0, 16.0, h) * uSnow, caps);
				albedo = mix(albedo, vec3(0.4, 0.4, 0.56), snowMask * 0.55);

				// Eroded limestone at the opening interrupts the soil cover and blends the
				// cavity shell into an irregular band of exposed mountain rock.
				float caveRim = smoothstep(-8.0, -0.2, vCave - vnoise(vWorldPos.xz * .24) * 2.5);
				vec3 exposedRock=mix(vec3(.19,.16,.22),vec3(.39,.34,.38),vnoise(vWorldPos.xz*.085 + hSea*.031));
				exposedRock*=.86+.14*band;
				float soilPocket=smoothstep(.55,.8,n.y)*smoothstep(.48,.72,vnoise(vWorldPos.xz*.16));
				exposedRock=mix(exposedRock,vec3(.10,.145,.12),soilPocket*.48);
				albedo = mix(albedo, exposedRock, max(caveRim*.96,smoothstep(.08,.75,vApron)*.97));
				vec3 color = terrainLight(albedo, n);
				// cliff faces catch a little moonlight glint so they read even when turned away
				color += uMoonColor * pow(max(dot(reflect(-uMoonDir, n), normalize(uCameraPos - vWorldPos)), 0.0), 6.0) * steep * 0.05 * uMoonIntensity;

				// rain darkens and glosses the ground
				color *= 1.0 - uRain * 0.3;
				color += uMoonColor * pow(max(dot(reflect(-uMoonDir, n), normalize(uCameraPos - vWorldPos)), 0.0), 24.0) * uRain * 0.25 * uMoonIntensity;

				// glowing grid + contours
				float lineFade = (1.0-vApron*.95)*exp(-dist / 380.0) * smoothstep(2.0, 12.0, dist);
				float grid = gridLine(vWorldPos.xz, 16.0) * lineFade * smoothstep(0.35, 0.65, n.y);   // the grid is drawn on the ground, not up the cliffs
				float cq = hSea / 10.0;
				float contour = (1.0 - min(abs(fract(cq - 0.5) - 0.5) / fwidth(cq), 1.0)) * lineFade * step(1.0, h);
				vec3 lineColor = hsl2rgb(vec3(uHue, 0.55, 0.55));
				vec3 contourColor = hsl2rgb(vec3(fract(uHue + 0.45), 0.9, 0.62));
				float pulse = (0.045 + 0.07 * uBass + 0.16 * uLevel) * (1.0 + 0.5 * uNight) * (1.0 - 0.15 * uSunIntensity) + 0.35 * uHum * (0.5 + 0.5 * sin(uTime * 2.0 - dist * 0.02));
				color += lineColor * grid * pulse * (1.0 - riverBed * 0.95) * (1.0 - 0.6 * clamp(-h / 1.5, 0.0, 1.0));   // dimmer through the water
				color += contourColor * contour * (0.03 + 0.1 * uLevel);

				// ripples from notes and footsteps
				color += rippleGlow(vWorldPos.xz, uTime) * 1.4;

				// the bed under the water darkens and blues with depth (seen through the near river surface)
				float under = clamp(-h / 2.5, 0.0, 1.0);
				color = mix(color, color * vec3(0.45, 0.55, 0.85) * 0.55, under * 0.85 * (1.0 - riverBed));
				// wet ground just above any water line
				float wetHeight = 0.35 + vnoise(vWorldPos.xz * 0.35) * 0.45;
				float wet = (1.0 - smoothstep(0.0, mix(2.5, wetHeight, riverBed), h)) * step(0.0, h);
				color *= 1.0 - wet * 0.32;
				color += uMoonColor * pow(max(dot(reflect(-uMoonDir, n), normalize(uCameraPos - vWorldPos)), 0.0), 40.0) * wet * 0.08 * uMoonIntensity;
				// the sea's swash: after each breaker hits the waterline a sheet of foam runs up the sand
				// and drains back, keeping time with the breakers; it never climbs cliffs
				float sd = shoreDistAt(vWorldPos.xz);           // negative on land
				float offRiver = 1.0 - riverMouthAt(vWorldPos.xz);
				float onSea = step(waterY, uWaterLevel + 0.3);
				vec3 foamCol = vec3(0.5, 0.53, 0.66) * (0.55 + 0.45 * uMoonIntensity) + vec3(0.4, 0.14, 0.1) * uSunIntensity;
				float beach = step(-40.0, sd) * step(sd, 1.0) * (1.0 - smoothstep(1.0, 2.2, hSea)) * smoothstep(0.55, 0.8, n.y) * offRiver * onSea;
				// a lake's shore: the wind lap runs a hand's breadth up the bank and darkens it
				float lakeBeach = step(-12.0, sd) * step(sd, 1.0) * (1.0 - onSea) * (1.0 - smoothstep(0.6, 1.4, h)) * smoothstep(0.55, 0.8, n.y) * offRiver;
				if (lakeBeach > 0.001) {
					float up = -sd;
					float run = lakeRunUp(vWorldPos.xz, uTime);
					float wobble = (vnoise(vWorldPos.xz * 0.8) - 0.5) * 0.8;
					float front = step(up + wobble, run) * step(-0.2, up);   // on the bank, not under the water
					float edge = step(run - 0.3, up + wobble) * front * step(0.4, vnoise(vWorldPos.xz * 1.5 + 3.0));
					float damp = (1.0 - smoothstep(1.0, 2.2, up)) * step(0.0, up);
					color *= 1.0 - damp * 0.15;
					color = mix(color, foamCol, lakeBeach * edge * 0.8);
				}
				if (beach > 0.001) {
					float up = -sd;                                  // metres up the beach from the waterline
					float run = shoreRunUp(vWorldPos.xz, uTime);
					float wobble = (vnoise(vWorldPos.xz * 0.35) - 0.5) * 2.5;
					float front = step(up + wobble, run) * step(-0.2, up);   // under the sheet, on the sand
					float edge = step(run - 0.6, up + wobble) * front * step(0.45, vnoise(vWorldPos.xz * 0.9 + 3.0));   // its torn leading edge
					float body = front * step(0.66, vnoise(vWorldPos.xz * 0.5 + uTime * 0.15)) * step(0.0, up);
					float reach = 7.5 * shoreSet(vWorldPos.xz, uTime);
					float damp = (1.0 - smoothstep(reach * 0.6, reach + 1.0, up)) * step(0.0, up);   // sand the sea has reached stays dark
					color *= 1.0 - damp * 0.18;
					color = mix(color, foamCol, beach * max(edge, body * 0.6));
				}
				color = applyFog(color, vWorldPos, uCameraPos);
				gl_FragColor = vec4(color, 1.0);
			}`,
	});

	return material;
}
