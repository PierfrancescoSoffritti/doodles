import * as THREE from 'three';
import { config } from './core/Config.js';
import { bus, Events } from './core/EventBus.js';
import { damp } from './core/Utils.js';
import { Heightmap } from './world/Heightmap.js';
import { Ripples } from './world/Ripples.js';
import { ShoreMap } from './world/ShoreMap.js';
import { Terrain } from './world/Terrain.js';
import { Water } from './world/Water.js';
import { CoastalSpray } from './world/CoastalSpray.js';
import { InlandWater } from './world/InlandWater.js';
import { Waterfalls } from './world/Waterfalls.js';
import { WatersideLife } from './world/WatersideLife.js';
import { WatersideAmbience } from './audio/WatersideAmbience.js';
import { WatersideFeatures } from './world/WatersideFeatures.js';
import { RiverDrift } from './world/RiverDrift.js';
import { createFogUniforms } from './world/FogGlsl.js';
import { Sky } from './world/Sky.js';
import { RainCurtains } from './world/weather/RainCurtains.js';
import { Weather } from './world/weather/Weather.js';
import { Precipitation } from './world/weather/Precipitation.js';
import { Snow } from './world/Snow.js';
import { Rain } from './world/Rain.js';
import { Fireflies } from './world/Fireflies.js';
import { Sprouts } from './world/Sprouts.js';
import { Landmarks } from './landmarks/Landmarks.js';
import { Player } from './player/Player.js';
import { HUD } from './ui/HUD.js';
import { Caves } from './world/caves/Caves.js';
import { WeatherSurvey } from './ui/WeatherSurvey.js';
import { CaveSurvey } from './ui/CaveSurvey.js';
import { MovementProfile } from './ui/MovementProfile.js';
import { RiverSurvey } from './ui/RiverSurvey.js';
import { EventDirector } from './events/Events.js';
import { PostProcessing } from './fx/PostProcessing.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { Conductor } from './audio/Conductor.js';
import { Fauna } from './world/fauna/Fauna.js';
import { FaunaSurvey } from './ui/FaunaSurvey.js';

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, config.isTouch ? 1.25 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
// built-in materials (trees, snow) only ever render close by; the terrain and water carry their own height fog
const FOG_NEAR = 0.00045;
scene.fog = new THREE.FogExp2('#2a1046', FOG_NEAR);
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.8, config.world.far);

// Shared world state every module reads from.
const shared = {
	scene, camera, renderer,
	hue: 0.82,
	time: 0,
	moon: { dir: new THREE.Vector3(0, 1, 0), height: 1, intensity: 1 },
	sun: { dir: new THREE.Vector3(0, -1, 0), height: -1, intensity: 0 },
	fogColor: new THREE.Color('#2a1046'),
	fogUniforms: createFogUniforms(),
	state: { snow: 0, rain: 0, aurora: 0, eclipse: 0, hum: 0, meteors: 0, snowVisible: 0, rainVisible: 0 },
	audio: null,
	conductor: null,
	wandererProximity: 0,
	colliders: [],
};

const hud = new HUD();
shared.hud = hud;

// ---- bake the world off-thread, then build everything on top of it ----
hud.setLoading('shaping the land', 0);
const worker = new Worker(new URL('./world/gen/WorldGenWorker.js', import.meta.url), { type: 'module' });
worker.postMessage({ seed: config.seed, opts: config.isTouch ? { res: 512 } : {} });
worker.onmessage = (e) => {
	if (e.data.type === 'progress') { hud.setLoading(e.data.label, e.data.p); return; }
	worker.terminate();
	hud.setLoading('growing the forests', 1);
	// let the label paint before the synchronous build work
	requestAnimationFrame(() => requestAnimationFrame(() => start(e.data.world,e.data.caveMeshes)));
};

function start(world,caveMeshes) {
	const heightmap = new Heightmap(config.seed, world);
	shared.heightmap = heightmap;
	shared.waterside = new WatersideFeatures(heightmap, config.seed);
	shared.renderer = renderer;
	shared.world = world;
	const ripples = new Ripples();
	shared.ripples = ripples;
	const shoreMap = new ShoreMap(heightmap);
	shared.shoreMap = shoreMap;
	const atmosphere = new Weather(scene, heightmap, shared);
	const terrain = new Terrain(scene, heightmap, shared);
	const water = new Water(scene, shared, heightmap.waterLevel);
	const coastalSpray = new CoastalSpray(scene, shared);
	const inland = new InlandWater(scene, heightmap, shared);
	const waterfalls = new Waterfalls(scene, world, shared);
	const drift = new RiverDrift(scene, heightmap, shared);
	const caves=new Caves(scene,heightmap,shared,caveMeshes);
	const watersideLife = new WatersideLife(scene, heightmap, shared);
	const sky = new Sky(scene, shared);
	const rainCurtains = new RainCurtains(scene, shared);
	const snow = new Snow(scene, shared);
	const rain = new Rain(scene, shared);
	const hail = new Precipitation(scene, shared, 'hail');
	const fireflies = new Fireflies(scene, heightmap, shared);
	const sprouts = new Sprouts(scene, heightmap, shared);
	const player = new Player(camera, canvas, heightmap, shared);
	shared.player = player;
	const fauna = new Fauna(scene, heightmap, shared);
	shared.fauna = fauna;
	const landmarks = new Landmarks(scene, heightmap, shared, camera);
	landmarks.addFireflies(fireflies);
	const director = new EventDirector(shared);
	const post = new PostProcessing(renderer, scene, camera);
	const pmrem = new THREE.PMREMGenerator(renderer);
	let envTimer = 0, envTarget = null;

	// ---- events ----
	bus.on(Events.RIPPLE, ({ x, z, size, hue, saturation }) => ripples.add(x, z, size, hue % 1, saturation));
	bus.on(Events.NOTE, (n) => {
		if (n.position) terrain.vegetation.noteAt(n.position.x, n.position.z, 0.5 + (n.velocity || 0.3));
		if (n.position && n.layer !== 'sequencer') ripples.add(n.position.x, n.position.z, 0.6 + n.velocity * 2, (shared.hue + 0.15) % 1);
		else if (n.layer === 'sequencer') ripples.add(n.position.x, n.position.z, 0.5, (shared.hue + 0.05) % 1);
	});
	bus.on(Events.KEY_CHANGE, () => { shared.hue = (shared.hue + 0.11 + Math.random() * 0.1) % 1; });
	bus.on('plant', ({ x, z }) => { if (sprouts.add(x, z, shared.time)) ripples.add(x, z, 0.5, shared.hue, 0.8); });
	bus.on('footstep', ({ inWater }) => { if (shared.conductor) shared.conductor.footstep(inWater); });
	bus.on('meteor', () => { if (shared.conductor) shared.conductor.meteor(); });
	bus.on('record', () => { if (shared.audio) hud.setRecording(shared.audio.toggleRecording()); });
	bus.on(Events.TOGGLE_TIME, ({ fast }) => { shared.timeFactor = fast ? 6 : 1; });
	shared.timeFactor = 1;

	// first view: shores, terrain and the nearby forest before the intro lifts
	player.update(0, 0);
	shoreMap.prime(player.position);
	terrain.prewarm(player.position);
	fauna.prime(player.position, config.seed);
	hud.ready();
	const weatherSurvey=new URLSearchParams(location.search).has('weather') ? new WeatherSurvey(shared, sky) : null;
	const caveSurvey=!weatherSurvey && new URLSearchParams(location.search).has('caves') ? new CaveSurvey(shared) : null;
	const survey = !weatherSurvey && !caveSurvey && new URLSearchParams(location.search).has('rivers') ? new RiverSurvey(shared, terrain) : null;
	const profile = survey && new URLSearchParams(location.search).has('profile') ? new MovementProfile(shared, survey, { terrain, inland, shoreMap, pmrem, watersideLife, post }) : null;
	const faunaSurvey = new URLSearchParams(location.search).has('fauna') ? new FaunaSurvey(shared, fauna) : null;

	// ---- enter ----
	let started = false;
	hud.onEnter(async () => {
		if (started) return;
		started = true;
		const engine = new AudioEngine();
		await engine.resume();
		const conductor = new Conductor(engine);
		shared.audio = engine;
		shared.watersideAmbience = new WatersideAmbience(engine, heightmap, shared.waterside);
		shared.conductor = conductor;
		conductor.start();
		hud.enter();
		player.enabled = true;
		if (!config.isTouch) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* unsupported */ } }
	});

	// ---- resize ----
	addEventListener('resize', () => {
		renderer.setSize(innerWidth, innerHeight);
		camera.aspect = innerWidth / innerHeight;
		camera.updateProjectionMatrix();
		post.setSize(innerWidth, innerHeight);
	});

	// ---- loop ----
	let lastFrame = performance.now();
	const listenerUp = new THREE.Vector3(0, 1, 0);

	function frame() {
		requestAnimationFrame(frame);
		const now = performance.now();
		const previousFrame = lastFrame;
		const dt = Math.min((now - lastFrame) / 1000, 0.05);
		lastFrame = now;
		const worldDt = dt * shared.timeFactor;
		shared.time += worldDt;
		const t = shared.time;

		shared.hue = (shared.hue + dt * 0.004) % 1;

		profile?.begin(now, now - previousFrame);
		caveSurvey?.guide(now);
		faunaSurvey?.guide(dt);
		player.update(dt, t);
		caves.update(t,player.position);
		atmosphere.update(worldDt, dt, camera.position);
		director.update(dt);
		// Resume before daylight is reached so the outside view has time to stream.
		const surfaceNearby=atmosphere.nearEntrance || !shared.caveColumn || heightmap.height(player.position.x,player.position.z)-player.position.y<96;
		shared.surfaceStreaming=surfaceNearby;
		if(surfaceNearby){shoreMap.update(player.position);terrain.update(player.position,dt);}
		ripples.update(t);
		sky.update(t, dt, camera.position, renderer);
		rainCurtains.update(camera.position, sky.clouds.uniforms.uCloudBase.value);
		scene.fog.color.copy(shared.fogColor);
		water.update(t, camera.position, shared);
		coastalSpray.update(t, camera.position);
		inland.update(t, camera.position, shared);
		waterfalls.update(t, camera.position);
		drift.update(worldDt, camera.position);
		watersideLife.update(camera.position);
		snow.update(t, dt, camera.position, renderer);
		rain.update(dt, camera.position, renderer);
		hail.advance(worldDt, dt, camera.position);
		fireflies.update(t, dt, player.position, renderer);
		sprouts.update(t);
		landmarks.update(dt, shared);

		if (shared.audio) {
			shared.audio.update(dt);
			shared.watersideAmbience.update(dt, shared);
			shared.audio.updateListener(camera.position, player.forward, listenerUp);
			shared.conductor.update(dt, shared);
		}
		fauna.update(dt);

		// fog: valley haze thickens with weather; far ranges fade to a tone darker than the sky
		const weather = 1 + 0.9 * (shared.state.rainVisible || 0) + 0.5 * (shared.state.snowVisible || 0) + 0.9 * (shared.state.storm || 0) * atmosphere.exposure;
		const fu = shared.fogUniforms;
		fu.uFogDensity.value = 2.4e-4 * weather;
		fu.uFogDistance.value = (1 / 15000) * (1 + 0.6 * (weather - 1));
		fu.uRainExtinction.value = atmosphere.exposure * (0.00008 * (shared.state.rainVisible || 0)
			+ 0.0005 * (shared.state.storm || 0) * Math.max(shared.state.rainVisible || 0, shared.state.snowVisible || 0));
		fu.uFogColor.value.copy(shared.fogColor);
		fu.uFogFar.value.copy(shared.fogColor).multiplyScalar(0.62);
		scene.fog.density = FOG_NEAR * weather;

		// terrain uniforms
		const u = terrain.material.uniforms;
		u.uTime.value = t;
		u.uMoonDir.value.copy(shared.moon.dir);
		u.uMoonIntensity.value = shared.moon.intensity;
		u.uHue.value = shared.hue;
		u.uCameraPos.value.copy(camera.position);
		u.uSnow.value = atmosphere.local.snowpack;
		u.uHum.value = shared.state.hum;
		u.uNight.value = shared.night || 0;
		u.uRain.value = shared.state.rainVisible || 0;
		const dim = shared.skyDim || 1;
		shared.night = 1 - Math.max(shared.moon.intensity, shared.sun.intensity * 0.35);
		u.uSkyColor.value.set('#2b1a5e').lerp(new THREE.Color('#5a1a3a'), shared.sun.intensity * 0.2).multiplyScalar(dim);
		u.uGroundColor.value.set('#06040f').lerp(new THREE.Color('#14060c'), shared.sun.intensity * 0.5).multiplyScalar(dim);
		u.uSunDir.value.copy(shared.sun.dir);
		u.uSunIntensity.value = shared.sun.intensity;
		if (shared.audio) { u.uBass.value = shared.audio.analysis.bass; u.uLevel.value = shared.audio.analysis.attack; }

		// environment map for mirrors and stones, refreshed occasionally from the player's position
		envTimer -= dt;
		if (envTimer <= 0 && shared.caveAmount < .05) {
			envTimer = 5;
			water.setVisible(false);
			const old = envTarget;
			const hidden = [inland.mesh, inland.near, drift.points, watersideLife.points, fauna.meshes.root, ...caves.waterMeshes].filter(Boolean).map(mesh => [mesh, mesh.visible]);
			for (const [mesh] of hidden) mesh.visible = false;
			envTarget = pmrem.fromScene(scene, 0.02, 1, config.world.far, { size: 128, position: camera.position });
			for (const [mesh, visible] of hidden) mesh.visible = visible;
			scene.environment = envTarget.texture;
			const envImage = envTarget.texture.image;
			inland.uniforms.uEnvironment.value = envTarget.texture;
			inland.uniforms.uEnvironmentSize.value.set(1 / envImage.width, 1 / envImage.height, Math.log2(envImage.height) - 2);
			inland.uniforms.uHasEnvironment.value = 1;
			scene.environmentIntensity = 0.55;
			water.setVisible(true);
			if (old) old.dispose();
		}

		// glare: how squarely we are looking at the red dwarf, and whether hills hide it
		{
			const sun = shared.sun;
			const facing = shared.caveAmount > .1 ? -1 : player.forward.dot(sun.dir);
			let glare = 0;
			if (sun.intensity > 0.01 && facing > 0.7) {
				const ndc = sun.dir.clone().multiplyScalar(4000).add(camera.position).project(camera);
				shared.sunScreen = shared.sunScreen || new THREE.Vector2();
				shared.sunScreen.set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5);
				// march toward the sun to see if the terrain blocks it
				let blocked = false;
				for (let k = 1; k <= 40 && !blocked; k++) {
					const dist = k * k * 12;
					const px = camera.position.x + sun.dir.x * dist, py = camera.position.y + sun.dir.y * dist, pz = camera.position.z + sun.dir.z * dist;
					if (heightmap.height(px, pz) > py) blocked = true;
				}
				const onScreen = Math.max(0, 1 - Math.max(Math.abs(ndc.x), Math.abs(ndc.y)) * 0.8);
				glare = blocked ? 0 : (1 - atmosphere.local.coverage * 0.85) * sun.intensity * Math.pow(Math.max(0, (facing - 0.7) / 0.3), 1.5) * onScreen;
			}
			shared.sunGlare = damp(shared.sunGlare || 0, glare, 5, dt);
		}

		fireflies.points.visible=shared.caveAmount<=.4;
		post.render(t, shared);
		caveSurvey?.update(now-previousFrame);
		weatherSurvey?.update(now-previousFrame);
		if (survey) survey.update(now - previousFrame);
		faunaSurvey?.update(now - previousFrame);
		profile?.end();
	}
	window.__debug = { atmosphere, sky, snow, rain, hail, scene, renderer, camera, shared, post, terrain, player, landmarksList: landmarks.list, director, shoreMap, water, inland, waterfalls, drift, heightmap, world, coastalSpray, fauna, faunaSurvey };
	frame();
}
