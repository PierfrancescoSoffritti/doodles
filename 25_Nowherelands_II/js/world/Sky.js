import * as THREE from 'three';
import { Random } from '../core/Random.js';
import { config } from '../core/Config.js';
import { Aurora } from './Aurora.js';
import { ShootingStars } from './ShootingStars.js';
import { Clouds } from './Clouds.js';
import { damp, clamp01, smoothstep } from '../core/Utils.js';

// Sky dome, moon, stars, aurora and meteors. The whole group follows the camera.
export class Sky {
	constructor(scene, shared) {
		this.shared = shared;
		this.group = new THREE.Group();
		this.group.scale.setScalar(4);   // sky bodies sit beyond the farthest terrain
		scene.add(this.group);

		this.zenith = new THREE.Color('#080418');
		this.horizon = new THREE.Color('#3a1460');
		this.band = new THREE.Color('#ff5fcf');

		this.domeUniforms = {
			uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
			uMoonColor: { value: new THREE.Color('#ffd7f3') },
			uMoonIntensity: { value: 1 },
			uZenith: { value: this.zenith.clone() },
			uHorizon: { value: this.horizon.clone() },
			uBand: { value: this.band.clone() },
			uTime: { value: 0 },
			uEclipse: { value: 0 },
			uSunDir: { value: new THREE.Vector3(0, -1, 0) },
			uSunIntensity: { value: 0 },
			uDayZenith: { value: new THREE.Color('#14071e') },
			uDayHorizon: { value: new THREE.Color('#4a1438') },
		};
		const dome = new THREE.Mesh(
			new THREE.SphereGeometry(6000, 48, 24),
			new THREE.ShaderMaterial({
				uniforms: this.domeUniforms,
				side: THREE.BackSide,
				depthWrite: false,
				vertexShader: /* glsl */`
					varying vec3 vDir;
					void main() {
						vDir = normalize(position);
						gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
					}`,
				fragmentShader: /* glsl */`
					uniform vec3 uMoonDir, uMoonColor, uZenith, uHorizon, uBand, uSunDir, uDayZenith, uDayHorizon;
					uniform float uMoonIntensity, uTime, uEclipse, uSunIntensity;
					varying vec3 vDir;
					void main() {
						vec3 d = normalize(vDir);
						float t = clamp(d.y, -0.2, 1.0);
						vec3 night = mix(uHorizon, uZenith, pow(clamp(t, 0.0, 1.0), 0.55));
						vec3 day = mix(uDayHorizon, uDayZenith, pow(clamp(t, 0.0, 1.0), 0.6));
						vec3 col = mix(night, day, uSunIntensity * 0.6);
						float bandW = exp(-abs(d.y - 0.015) * 16.0);
						// the horizon band bleeds red on the sun's side
						float sunSide = 0.5 + 0.5 * dot(normalize(vec2(d.x, d.z)), normalize(vec2(uSunDir.x, uSunDir.z)));
						vec3 band = mix(uBand, vec3(0.9, 0.12, 0.12), uSunIntensity * sunSide * 0.35);
						col += band * bandW * 0.32;
						// a dim red dwarf: a wide, low ember glow, no daylight
						float s = max(dot(d, uSunDir), 0.0);
						col += vec3(0.7, 0.08, 0.1) * (pow(s, 12.0) * 0.2 + pow(s, 60.0) * 0.3 + pow(s, 3.0) * 0.05) * uSunIntensity;
						float m = max(dot(d, uMoonDir), 0.0);
						col += uMoonColor * (pow(m, 400.0) * 0.5 + pow(m, 24.0) * 0.1) * uMoonIntensity;
						col = mix(col, col * vec3(0.5, 0.35, 0.45), uEclipse * 0.6);
						gl_FragColor = vec4(col, 1.0);
					}`,
			})
		);
		dome.renderOrder = -10;
		dome.frustumCulled = false;
		this.group.add(dome);

		// moon
		this.moonColor = new THREE.Color('#ffd9f4');
		this.moonUniforms = { uColor: { value: this.moonColor.clone().multiplyScalar(1.15) }, uLightDir: { value: new THREE.Vector3(0.4, 0.3, 1).normalize() } };
		this.moonMaterial = new THREE.ShaderMaterial({
			uniforms: this.moonUniforms,
			vertexShader: /* glsl */`
				varying vec3 vN; varying vec3 vP;
				void main() { vN = normal; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
			fragmentShader: /* glsl */`
				uniform vec3 uColor, uLightDir;
				varying vec3 vN; varying vec3 vP;
				float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
				float vnoise(vec3 p) {
					vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
					return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
						mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
				}
				void main() {
					vec3 p = normalize(vP);
					float m = vnoise(p * 3.0) * 0.6 + vnoise(p * 7.0) * 0.3 + vnoise(p * 15.0) * 0.1;
					float maria = smoothstep(0.42, 0.62, m);
					float shade = 0.72 + 0.28 * max(dot(normalize(vN), uLightDir), 0.0);
					vec3 col = uColor * mix(1.0, 0.5, maria) * shade;
					gl_FragColor = vec4(col, 1.0);
				}`,
		});
		this.moonMaterial.depthWrite = false;
		this.moon = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 32), this.moonMaterial);
		this.moon.renderOrder = -9;
		this.group.add(this.moon);

		// sun: a dim red dwarf as a soft-rimmed disc that always faces the viewer
		this.sunUniforms = { uTime: { value: 0 }, uIntensity: { value: 1 } };
		this.sun = new THREE.Mesh(new THREE.CircleGeometry(760, 64), new THREE.ShaderMaterial({
			uniforms: this.sunUniforms,
			fog: false, transparent: true, depthWrite: false,
			vertexShader: /* glsl */`
				varying vec2 vUv;
				void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
			fragmentShader: /* glsl */`
				uniform float uTime, uIntensity;
				varying vec2 vUv;
				void main() {
					float y = vUv.y;
					vec2 c = vUv - 0.5;
					float r = length(c) * 2.0;
					vec3 top = vec3(1.0, 0.18, 0.13), bottom = vec3(0.5, 0.03, 0.1);
					vec3 col = mix(bottom, top, y);
					// slow dark bands crossing the disc, like weather on a dim star
					float bands = 0.82 + 0.18 * sin(y * 22.0 + sin(y * 7.0 + uTime * 0.05) * 2.0 - uTime * 0.02);
					col *= bands;
					// darker limb
					col *= 1.0 - smoothstep(0.55, 1.0, r) * 0.5;
					// soft, hazy rim so the disc sits in the sky rather than on it
					float alpha = 1.0 - smoothstep(0.86, 1.0, r);
					gl_FragColor = vec4(col * 0.9 * uIntensity, alpha * 0.95);
				}`,
		}));
		this.sun.renderOrder = -9;
		this.group.add(this.sun);
		this.sunDir = new THREE.Vector3();
		this.sunIntensitySmooth = 0;

		// stars
		const rnd = new Random(config.seed + ':stars');
		const N = 2600;
		const pos = new Float32Array(N * 3), attr = new Float32Array(N * 3);
		for (let i = 0; i < N; i++) {
			const u = rnd.range(-0.15, 1), phi = rnd.range(0, Math.PI * 2);
			const r = 5600, y = u, s = Math.sqrt(1 - u * u);
			pos[i * 3] = Math.cos(phi) * s * r; pos[i * 3 + 1] = y * r; pos[i * 3 + 2] = Math.sin(phi) * s * r;
			attr[i * 3] = Math.pow(rnd.next(), 3) * 1.5 + 0.25;   // brightness/size
			attr[i * 3 + 1] = rnd.range(0, Math.PI * 2);            // phase
			attr[i * 3 + 2] = rnd.next();                           // tint
		}
		const starGeom = new THREE.BufferGeometry();
		starGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		starGeom.setAttribute('aStar', new THREE.BufferAttribute(attr, 3));
		this.starUniforms = { uVisibility: { value: 1 }, uTime: { value: 0 }, uHigh: { value: 0 }, uNight: { value: 0 }, uDay: { value: 0 }, uPointScale: { value: new THREE.Vector2(1, 1) }, uReflectionIntensity: { value: 1 } };
		this.stars = new THREE.Points(starGeom, new THREE.ShaderMaterial({
			uniforms: this.starUniforms,
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
			vertexShader: /* glsl */`
				attribute vec3 aStar;
				uniform float uTime, uHigh, uNight, uDay, uVisibility;
				uniform vec2 uPointScale;
				varying vec2 vPointAspect;
				varying float vAlpha;
				varying vec3 vTint;
				void main() {
					float tw = 0.55 + 0.45 * sin(uTime * (1.2 + aStar.z * 2.0) + aStar.y);
					tw += uHigh * 0.8 * step(0.7, aStar.z);
					vAlpha = uVisibility * tw * min(aStar.x, 1.3) * (0.7 + 0.9 * uNight) * (1.0 - uDay * 0.3);   // the red dwarf barely dims the stars
					vTint = mix(vec3(0.75, 0.85, 1.0), mix(vec3(1.0, 0.75, 0.9), vec3(1.0), aStar.z), step(0.5, aStar.z));
					vec4 mv = modelViewMatrix * vec4(position, 1.0);
					vec2 size = (4.0 + aStar.x * 10.0) * uPointScale;
					gl_PointSize = max(1.0, max(size.x, size.y));
					vPointAspect = vec2(gl_PointSize) / size;
					gl_Position = projectionMatrix * mv;
				}`,
			fragmentShader: /* glsl */`
				uniform float uReflectionIntensity;
				varying vec2 vPointAspect;
				varying float vAlpha;
				varying vec3 vTint;
				void main() {
					float d = length((gl_PointCoord - 0.5) * vPointAspect) * 2.0;
					float a = pow(max(1.0 - d, 0.0), 2.2);
					gl_FragColor = vec4(vTint * a * vAlpha * 1.6 * uReflectionIntensity, a * vAlpha);
				}`,
		}));
		const starViewport = new THREE.Vector4(), screenSize = new THREE.Vector2();
		this.stars.onBeforeRender = (renderer, scene, camera) => {
			// Dim only the sea capture; scale RGB once because additive blending also uses alpha.
			const isSeaReflection = shared.sea && renderer.getRenderTarget()?.texture === shared.sea.tDiffuse.value;
			this.starUniforms.uReflectionIntensity.value = isSeaReflection ? 0.3 : 1;
			// Point sizes are framebuffer pixels. Recompute for every pass so the
			// small sea mirror and environment probe preserve the stars' angular size.
			renderer.getCurrentViewport(starViewport);
			renderer.getSize(screenSize);
			const reference = screenSize.y * shared.camera.projectionMatrix.elements[5];
			const projection = camera.projectionMatrix.elements;
			this.starUniforms.uPointScale.value.set(
				starViewport.z * Math.abs(projection[0]) / reference,
				starViewport.w * Math.abs(projection[5]) / reference,
			);
			this.stars.material.uniformsNeedUpdate = true;
			// A square reflection target has unequal X/Y scales on a wide camera;
			// the fragment shader compensates inside the square point sprite.
		};
		this.stars.frustumCulled = false;
		this.stars.renderOrder = -9.5;   // before the sun disc, so the disc covers them
		this.group.add(this.stars);

		this.aurora = new Aurora(this.group, shared);
		this.meteors = new ShootingStars(this.group, shared);
		this.clouds = new Clouds(this.group, shared);

		// lights
		this.moonLight = new THREE.DirectionalLight(this.moonColor, 1.2);
		scene.add(this.moonLight);
		scene.add(this.moonLight.target);
		this.sunColor = new THREE.Color('#ff3b22');
		this.sunLight = new THREE.DirectionalLight(this.sunColor, 0);
		scene.add(this.sunLight);
		scene.add(this.sunLight.target);
		this.hemi = new THREE.HemisphereLight('#3b2070', '#06040f', 1.0);
		scene.add(this.hemi);

		this.moonAngle = Math.PI;   // TEMP: start with the red dwarf up and straight ahead (was rnd.range(-0.6, 0.3))
		this.moonIntensitySmooth = 1;
		this.moonDir = new THREE.Vector3();
	}

	update(worldTime, dt, cameraPos, renderer) {
		const shared = this.shared;
		this.group.position.copy(cameraPos);

		// moon orbit: tilted so it dips below the horizon only briefly
		const a = this.moonAngle + worldTime * 0.011;
		this.moonDir.set(Math.sin(a), Math.cos(a) * 0.85 + 0.12, -0.55).normalize();
		const height = this.moonDir.y;
		const above = smoothstep(-0.08, 0.12, height);
		const eclipse = shared.state.eclipse;
		const intensity = above * (1 - eclipse * 0.85);
		this.moonIntensitySmooth = damp(this.moonIntensitySmooth, intensity, 2, dt);

		// the sun sits opposite the moon: it rises as the moon sets
		// the red dwarf rises as the moon sets, but never climbs far above the horizon
		const rawUp = -(Math.cos(a) * 0.85 + 0.12);
		this.sunDir.set(-this.moonDir.x, rawUp * 0.32, 0.55).normalize();
		const sunHeight = this.sunDir.y;
		const sunUp = smoothstep(-0.04, 0.1, sunHeight);
		this.sunIntensitySmooth = damp(this.sunIntensitySmooth, sunUp, 2, dt);
		this.sun.position.copy(this.sunDir).multiplyScalar(5000);
		this.sun.lookAt(cameraPos);
		this.sun.visible = sunHeight > -0.16;
		this.sunUniforms.uTime.value = worldTime;
		this.sunUniforms.uIntensity.value = 0.8 + 0.2 * this.sunIntensitySmooth;
		this.sunLight.position.copy(this.sunDir).multiplyScalar(1000).add(cameraPos);
		this.sunLight.target.position.copy(cameraPos);
		const storm = shared.state.storm || 0;
		this.sunUniforms.uIntensity.value *= 1 - storm * 0.94;
		const cloudShade = (1 - (shared.state.cloudCover || 0) * 0.55) * (1 - storm * 0.5);
		this.sunLight.intensity = 0.5 * this.sunIntensitySmooth * cloudShade;
		shared.sun.dir.copy(this.sunDir);
		shared.sun.height = sunHeight;
		shared.sun.intensity = this.sunIntensitySmooth * cloudShade;
		const light = Math.max(this.moonIntensitySmooth, this.sunIntensitySmooth * 0.35);

		this.moon.position.copy(this.moonDir).multiplyScalar(5200);
		this.moonUniforms.uColor.value.copy(this.moonColor).lerp(new THREE.Color('#5a0f1a'), eclipse).multiplyScalar((1.15 - eclipse * 0.8) * (1 - storm * 0.9));
		this.moon.lookAt(cameraPos);
		this.moonLight.position.copy(this.moonDir).multiplyScalar(1000).add(cameraPos);
		this.moonLight.target.position.copy(cameraPos);
		this.moonLight.intensity = 1.3 * this.moonIntensitySmooth * cloudShade;
		this.hemi.intensity = 0.25 + 0.75 * this.moonIntensitySmooth + 0.3 * this.sunIntensitySmooth;
		this.hemi.color.set('#3b2070').lerp(new THREE.Color('#4a1a3a'), this.sunIntensitySmooth * 0.3);
		this.hemi.groundColor.set('#06040f').lerp(new THREE.Color('#14060c'), this.sunIntensitySmooth * 0.5);

		shared.moon.dir.copy(this.moonDir);
		shared.moon.height = height;
		shared.moon.intensity = this.moonIntensitySmooth * cloudShade;

		const u = this.domeUniforms;
		u.uMoonDir.value.copy(this.moonDir);
		u.uMoonIntensity.value = this.moonIntensitySmooth * (1 - storm * 0.96);
		u.uTime.value = worldTime;
		u.uEclipse.value = eclipse;
		u.uSunDir.value.copy(this.sunDir);
		u.uSunIntensity.value = this.sunIntensitySmooth * (1 - storm * 0.96);
		const dim = (0.16 + 0.84 * light) * (1 - eclipse * 0.35) * (1 - (shared.state.storm || 0) * 0.3);
		// dusk and dawn: the horizon band warms while the moon is low
		const dusk = smoothstep(0.35, 0.0, Math.abs(height - 0.05)) * (1 - eclipse);
		shared.skyDim = dim;
		u.uZenith.value.copy(this.zenith).multiplyScalar(dim);
		u.uHorizon.value.copy(this.horizon).multiplyScalar(dim);
		u.uBand.value.copy(this.band).lerp(new THREE.Color('#ff9a4a'), dusk * 0.7).multiplyScalar(0.35 + 0.65 * dim + dusk * 0.6);
		u.uHorizon.value.lerp(new THREE.Color('#5a2a3a'), dusk * 0.5);
		// A storm closes the luminous horizon as well as the overhead sky.
		const stormTone = new THREE.Color('#343847');
		u.uZenith.value.lerp(new THREE.Color('#171b2b'), storm * 0.88);
		u.uHorizon.value.lerp(stormTone, storm * 0.94);
		u.uBand.value.multiplyScalar(1 - storm * 0.94);
		shared.fogColor.copy(this.horizon).multiplyScalar(dim * 0.8).lerp(new THREE.Color('#3a0e26'), this.sunIntensitySmooth * 0.3).lerp(stormTone, storm * 0.94);
		this.starUniforms.uVisibility.value = 1 - storm * 0.995;

		this.stars.rotation.y = worldTime * 0.004;
		this.starUniforms.uTime.value = worldTime;
		this.starUniforms.uHigh.value = shared.audio ? shared.audio.analysis.high : 0;
		this.starUniforms.uNight.value = 1 - light;
		this.starUniforms.uDay.value = this.sunIntensitySmooth;

		this.aurora.update(worldTime, dt);
		this.clouds.update(worldTime, dt, shared, dim);
		this.meteors.update(dt);
	}
}
