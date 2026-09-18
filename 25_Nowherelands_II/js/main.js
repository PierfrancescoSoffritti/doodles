import { compactStaticWater } from './world/StaticWaterCopy.js?v=stable-30-21';
import { HeightSampleCache } from './world/HeightSampleCache.js?v=stable-30-3';
import { PlantBatches } from './world/PlantBatches.js?v=stable-30-27';
import { mobileDetail, lowMemoryMobile, mobileOption } from './core/MobileDetail.js?v=stable-30-3';
import { MobilePointLights } from './fx/MobilePointLights.js?v=stable-30-3';
import { ReplyOutlinePass } from './fx/ReplyOutlinePass.js?v=stable-30-3';
import { PlayerNotes } from './player/PlayerNotes.js?v=stable-30-3';
import * as THREE from 'three';
import { FramePacer } from './core/FramePacer.js';
import { EnvironmentProbe } from './fx/EnvironmentProbe.js?v=stable-30-3';
import { config } from './core/Config.js?v=stable-30-3';
import { bus, Events } from './core/EventBus.js';
import { damp } from './core/Utils.js';
import { Heightmap } from './world/Heightmap.js?v=stable-30-28';
import { Ripples } from './world/Ripples.js?v=player-notes-13';
import { SurfaceWork } from './world/SurfaceWork.js?v=stable-30-25';
import { ShoreMap } from './world/ShoreMap.js?v=water-float-filter-1';
import { Terrain } from './world/Terrain.js?v=stable-30-26';
import { Water } from './world/Water.js?v=stable-30-3';
import { CoastalSpray } from './world/CoastalSpray.js?v=player-notes-13';
import { InlandWater } from './world/InlandWater.js?v=pool-life-2';
import { Waterfalls } from './world/Waterfalls.js?v=stable-30-5';
import { WatersideLife } from './world/WatersideLife.js?v=pool-life-1';
import { WorldWaterLife } from './world/WorldWaterLife.js?v=pool-life-7';
import { WatersideAmbience } from './audio/WatersideAmbience.js';
import { WatersideFeatures } from './world/WatersideFeatures.js';
import { RiverDrift } from './world/RiverDrift.js?v=stable-30-10';
import { createFogUniforms } from './world/FogGlsl.js';
import { Sky } from './world/Sky.js?v=stable-30-3';
import { RainCurtains } from './world/weather/RainCurtains.js';
import { Weather } from './world/weather/Weather.js?v=stable-30-10';
import { Precipitation } from './world/weather/Precipitation.js';
import { Snow } from './world/Snow.js';
import { Rain } from './world/Rain.js';
import { Fireflies } from './world/Fireflies.js?v=stable-30-3';
import { Sprouts } from './world/Sprouts.js';
import { Landmarks } from './landmarks/Landmarks.js?v=pool-life-2';
import { dispatchPress } from './landmarks/TargetPicking.js';
import { Player } from './player/Player.js?v=touch-run-3';
import { HUD } from './ui/HUD.js?v=touch-run-3';
import { Caves } from './world/caves/Caves.js?v=stable-30-28';
import { WeatherSurvey } from './ui/WeatherSurvey.js?v=stable-30-10';
import { CaveSurvey } from './ui/CaveSurvey.js';
import { MovementProfile } from './ui/MovementProfile.js';
import { RiverSurvey } from './ui/RiverSurvey.js';
import { EventDirector } from './events/Events.js';
import { PostProcessing } from './fx/PostProcessing.js?v=pool-life-2';
import { FoliageDepthPrepass } from './fx/FoliageDepthPrepass.js?v=stable-30-3';
import { installBoundedPointLights } from './fx/BoundedPointLights.js?v=stable-30-3';
import { AudioEngine } from './audio/AudioEngine.js?v=reed-retrigger-1';
import { Conductor } from './audio/Conductor.js?v=pendant-click-1';
import { Fauna } from './world/fauna/Fauna.js?v=stable-30-30';
import { WorldReedWalkers } from './world/fauna/WorldReedWalkers.js?v=stable-30-3';
import { WorldLanternMites } from './world/fauna/WorldLanternMites.js?v=stable-30-22';
import { WorldBirds } from './world/fauna/WorldBirds.js?v=stable-30-3';
import { WorldPlants } from './world/WorldPlants.js?v=reed-chorus-1';

import { FaunaMenu } from './ui/FaunaMenu.js?v=pool-life-6';

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const maliGraphics = config.isTouch && FoliageDepthPrepass.supported(renderer);
if (maliGraphics) installBoundedPointLights();
renderer.setPixelRatio(Math.min(devicePixelRatio, lowMemoryMobile ? .875 : config.isTouch ? 1.25 : 1.75));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.updateMatrix();
scene.matrixAutoUpdate = false;
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
const worker = new Worker(new URL('./world/gen/WorldGenWorker.js?v=stable-30-8', import.meta.url), { type: 'module' });
worker.postMessage({ seed: config.seed, opts: config.isTouch ? { res: 512 } : {} });
worker.onmessage = (e) => {
	if (e.data.type === 'progress') { hud.setLoading(e.data.label, e.data.p); return; }
	worker.terminate();
	hud.setLoading('growing the forests', 1);
	// Chrome can leave the deserialized world on a deprecated object layout.
 // Reads then repeatedly deoptimize terrain queries and river updates. A
 // dictionary record keeps those reads stable; every value/typed array is shared.
 // Let the label paint before the synchronous build work.
	requestAnimationFrame(() => requestAnimationFrame(() => start(Object.assign(Object.create(null), e.data.world),e.data.caveMeshes)));
};

async function start(world,caveMeshes) {
	const heightmap = new Heightmap(config.seed, world);
	shared.heightmap = heightmap;
	shared.waterside = new WatersideFeatures(heightmap, config.seed);
	shared.renderer = renderer;
	shared.world = world;
	const ripples = new Ripples();
	shared.ripples = ripples;
	const surfaceWork = new SurfaceWork(heightmap, config.seed);
	shared.surfaceWork = surfaceWork;
	const shoreMap = new ShoreMap(heightmap, surfaceWork, renderer);
	shared.shoreMap = shoreMap;
	const atmosphere = new Weather(scene, heightmap, shared);
	const terrain = new Terrain(scene, heightmap, shared);
	const foliageDepth = maliGraphics ? new FoliageDepthPrepass(renderer, scene, terrain.vegetation.leafMaterial) : null;
	const plantBatches = mobileOption('plantBatches') ? new PlantBatches(renderer, scene, {cullInstances:!mobileOption('plantChunkCulling')}) : null;
	const water = new Water(scene, shared, heightmap.waterLevel);
	const coastalSpray = new CoastalSpray(scene, shared);
	const inland = new InlandWater(scene, heightmap, shared);
	const waterfalls = new Waterfalls(scene, world, shared);
	const staticWaterCopies = mobileOption('staticWaterCopies') ? compactStaticWater([inland.mesh, waterfalls.sheet, waterfalls.plunge, waterfalls.points]) : null;
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
	shared.playerNotes = new PlayerNotes(shared);
	const birds = new WorldBirds(scene,heightmap,shared,terrain.vegetation,config.seedHash);
	shared.birds = birds;
	const walkers = new WorldReedWalkers(scene,heightmap,shared,fauna,config.seed); shared.walkers=walkers;
	const mites = new WorldLanternMites(scene,heightmap,shared,terrain.vegetation,config.seed,terrain.material); shared.mites=mites;
	const plants = new WorldPlants(scene,heightmap,shared,fauna.lakes,config.seed,{small:mobileDetail});shared.plants=plants;
	const waterLife = new WorldWaterLife(scene,heightmap,shared,fauna.lakes,config.seed,{small:mobileDetail});shared.waterLife=waterLife;
	const landmarks = new Landmarks(scene, heightmap, shared, camera);
	landmarks.addFireflies(fireflies);
	const localLights = mobileDetail ? new MobilePointLights(scene) : null;
	shared.localLights = localLights;
	const director = new EventDirector(shared);
	const post = new PostProcessing(renderer, scene, camera);
	const replyOutlines = new ReplyOutlinePass();
	const pmrem = new THREE.PMREMGenerator(renderer);
	const environment = new EnvironmentProbe(renderer, scene, camera, shared, pmrem,
		() => [water.far, ...water.levels, inland.mesh, inland.near, drift.points, watersideLife.points, fauna.meshes.root, birds.root, walkers.root, mites.root, plants.root, waterLife.root, ...caves.waterMeshes],
		(target) => {
			scene.environment = target.texture; scene.environmentIntensity = .55;
			const image = target.texture.image;
			inland.uniforms.uEnvironment.value = target.texture;
			inland.uniforms.uEnvironmentSize.value.set(1/image.width, 1/image.height, Math.log2(image.height)-2);
			inland.uniforms.uHasEnvironment.value = 1;
		});

	// ---- events ----
	bus.on(Events.RIPPLE, ({ x, z, size, hue, saturation }) => ripples.add(x, z, size, hue % 1, saturation));
	bus.on(Events.NOTE, (n) => {
		if(n.layer==='plant-reply'||n.layer==='pendant')return;
		if(n.layer==='player-note'){waterLife.hearNote(n);shared.playerNotes.hear(n);if(n.position)terrain.vegetation.noteAt(n.position.x,n.position.z,.5+(n.velocity||.3));return;}
		mites.hearNote(n);
		walkers.hearNote(n);birds.hearNote(n);
		if (n.position) terrain.vegetation.noteAt(n.position.x, n.position.z, 0.5 + (n.velocity || 0.3));
		if (n.position && n.layer !== 'sequencer') ripples.add(n.position.x, n.position.z, 0.6 + n.velocity * 2, (shared.hue + 0.15) % 1);
		else if (n.layer === 'sequencer') ripples.add(n.position.x, n.position.z, 0.5, (shared.hue + 0.05) % 1);
	});
	bus.on(Events.KEY_CHANGE, () => { shared.hue = (shared.hue + 0.11 + Math.random() * 0.1) % 1; });
	bus.on(Events.PRESS_END, ({duration}) => dispatchPress(landmarks,shared.playerNotes,duration));
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
	await fauna.startSimulationWorker();
	birds.prime();
	walkers.update(0);
	mites.update(0);
	plants.stream(true);plants.update(0);
	waterLife.stream(true);waterLife.update(0);
	// Finish the first environment and streamed-material driver setup while the
	// loading screen is still visible, before entering starts music and movement.
	hud.setLoading('lighting the forest', 1);
	sky.update(0, 0, camera.position, renderer, true);
	localLights?.update(camera, 0);
	await environment.prewarm();
	await mites.prewarm();
	await walkers.prewarm();
	const weatherSurvey=new URLSearchParams(location.search).has('weather') ? new WeatherSurvey(shared, sky) : null;
	const caveSurvey=!weatherSurvey && new URLSearchParams(location.search).has('caves') ? new CaveSurvey(shared) : null;
	const survey = !weatherSurvey && !caveSurvey && new URLSearchParams(location.search).has('rivers') ? new RiverSurvey(shared, terrain) : null;
	const profile = survey && new URLSearchParams(location.search).has('profile') ? new MovementProfile(shared, survey, { terrain, inland, shoreMap, pmrem, watersideLife, post }) : null;
	const faunaMenu = !weatherSurvey && !caveSurvey && !survey ? new FaunaMenu(shared) : null;
	faunaMenu?.prepareForest();
	hud.ready();
 if (staticWaterCopies) setTimeout(() => staticWaterCopies.finishWarmup(), 1000);

	// ---- enter ----
	let started = false;
	hud.onEnter(async ({ capture = true } = {}) => {
		if (started) return;
		started = true;
		// A 5 ms callback buffer repeatedly underruns on the Samsung under load.
		// Give mobile playback headroom without changing the mix or spatial audio.
		const requestedRate = Number(new URLSearchParams(location.search).get('audioRate'));
  const sampleRate = [32000, 44100, 48000].includes(requestedRate) ? requestedRate : lowMemoryMobile ? 32000 : undefined;
  const engine = new AudioEngine(null, Math.random, {
   latencyHint: config.isTouch ? 0.04 : 'interactive', sampleRate,
   blockSpatial: mobileOption('audioBlockSpatial'),
  });
		await engine.resume();
		const conductor = new Conductor(engine);
		shared.audio = engine;
		shared.playerNotes.prepareAudio();
		shared.watersideAmbience = new WatersideAmbience(engine, heightmap, shared.waterside);
		shared.conductor = conductor;
		fauna.prepareAudio();
		walkers.prepareAudio();
		await mites.prepareAudio();
		conductor.start();
		hud.enter();
		player.enabled = true;
		if (capture && !config.isTouch) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* unsupported */ } }
	});

	// Reconcile sizes after world generation, including resizes during loading.
	let presentation=null;
	const resize = () => {
		const width = canvas.clientWidth, height = canvas.clientHeight;
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		post.setSize(width, height);
  presentation?.resize();
	};
	new ResizeObserver(resize).observe(canvas);
	resize();

	// ---- loop ----
	let lastFrame = performance.now();
	const pacer = new FramePacer();
 const heightCache = mobileOption('heightCache') ? new HeightSampleCache(heightmap) : null;
	const listenerUp = new THREE.Vector3(0, 1, 0);

 const useAux = water.deferReflection, timedAux = useAux && mobileOption('auxTimer');
 let auxTimer = null;
 const auxiliary = () => {
  auxTimer = null;
  if (!water.deferReflection || document.hidden || pacer.next - performance.now() <= 9) return;
  if (timedAux && atmosphere.model.advancePending()) return;
  if (!water.prepareReflection(renderer, scene, camera) && pacer.next-performance.now() > (environment.face===6?14:12)) environment.update(0, true);
 };

	let advanceTimer = null;
 function advance(renderFrame,fixedStep=null) {
   const now=performance.now();
		const previousFrame = lastFrame;
		const dt = fixedStep ?? Math.min((now - lastFrame) / 1000, 0.05);
		lastFrame = now;
		const worldDt = dt * shared.timeFactor;
		shared.time += worldDt;
		const t = shared.time;

		shared.hue = (shared.hue + dt * 0.004) % 1;

		profile?.begin(now, now - previousFrame);
		caveSurvey?.guide(now);
		faunaMenu?.guide(dt);
		player.update(dt, t);
		caves.update(t,player.position);
		atmosphere.update(worldDt, dt, camera.position);
		director.update(dt);
		// Resume before daylight is reached so the outside view has time to stream.
		const surfaceNearby=atmosphere.nearEntrance || !shared.caveColumn || heightmap.height(player.position.x,player.position.z)-player.position.y<96;
		shared.surfaceStreaming=surfaceNearby;
		if(surfaceNearby){shoreMap.update(player.position);terrain.update(player.position,dt);}
		ripples.update(t);
		sky.update(t, dt, camera.position, renderer, renderFrame);
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
		fauna.update(dt, renderFrame);
		shared.playerNotes.update();
		birds.update(dt);
		walkers.update(dt);
		mites.update(dt);
		plants.update(dt);
		waterLife.update(dt);
		localLights?.update(camera, dt);

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

		environment.update(dt, renderFrame && !water.deferReflection);

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
		if (renderFrame) {
			post.render(t, shared);
			if(shared.playerNotes.highlights.size||plants.hasReplyHighlights){
    if(post.buffered)renderer.setRenderTarget(post.composer.readBuffer);
    replyOutlines.render(renderer,scene,camera);
    if(post.buffered)renderer.setRenderTarget(null);
   }
			if(!post.buffered)hud.recordFrame(performance.now());
		}
		caveSurvey?.update(now-previousFrame);
		weatherSurvey?.update(now-previousFrame);
		if (survey) survey.update(now - previousFrame);
		faunaMenu?.update(now - previousFrame);
  if(timedAux && water.deferReflection && renderFrame && auxTimer===null) auxTimer=setTimeout(auxiliary,0);
		profile?.end();
 }
	function frame(timestamp = performance.now()) {
		requestAnimationFrame(frame);
		if (document.hidden) { presentation?.suspend();pacer.reset(); lastFrame=performance.now(); return; }
		if (advanceTimer !== null) return;
		water.deferReflection=useAux && hud.frameRate===30;
		atmosphere.model.deferSteps=timedAux && water.deferReflection;
  if(presentation&&presentation.healthy()&&hud.frameRate===30){presentation.resume();if(water.deferReflection&&!timedAux)auxiliary();return;}
  if(presentation?.active){presentation.suspend();pacer.reset();lastFrame=performance.now();}
		const renderFrame = pacer.accept(timestamp, hud.frameRate);
		// At the mobile 30 Hz target, advance the world once per presented frame.
		// Fixed-step fauna and the audio clock still own their timing; skipped
		// display callbacks no longer repeat world traversal and streaming work.
		if (mobileDetail && hud.frameRate === 30 && !renderFrame) {
   if(water.deferReflection && !timedAux) auxiliary();
   return;
  }

  if(post.buffered && renderFrame){
   if(post.present())hud.recordFrame(performance.now());
   advanceTimer=setTimeout(()=>{advanceTimer=null;if(document.hidden){lastFrame=performance.now();pacer.reset();return;}advance(renderFrame);},0);
  }else advance(renderFrame);
	}
 if(post.buffered&&mobileOption('workerPresent')) {
  const {BufferedPresentation}=await import('./fx/BufferedPresentation.js?v=stable-30-28');
  presentation=await BufferedPresentation.create({source:canvas,
   produce:dt=>{pacer.next=performance.now()+1000/30;advance(true,dt);},
   present:()=>post.present(),onFrame:at=>hud.recordFrame(at),depth:4});
 }
	window.__debug = { waterLife, presentation, staticWaterCopies, heightCache, fireflies, plantBatches, localLights, foliageDepth, environment, pacer, hud, atmosphere, sky, snow, rain, hail, scene, renderer, camera, shared, post, terrain, player, landmarksList: landmarks.list, director, shoreMap, water, inland, waterfalls, drift, heightmap, world, coastalSpray, fauna, faunaMenu, birds, walkers, mites };
	frame();
}
