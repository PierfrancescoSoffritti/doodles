import * as THREE from 'three';
import { config } from './core/Config.js';
import { bus, Events } from './core/EventBus.js';
import { damp } from './core/Utils.js';
import { Heightmap } from './world/Heightmap.js';
import { Ripples } from './world/Ripples.js';
import { ShoreMap } from './world/ShoreMap.js';
import { Terrain } from './world/Terrain.js';
import { Water } from './world/Water.js';
import { Sky } from './world/Sky.js';
import { Snow } from './world/Snow.js';
import { Rain } from './world/Rain.js';
import { Fireflies } from './world/Fireflies.js';
import { Sprouts } from './world/Sprouts.js';
import { Landmarks } from './landmarks/Landmarks.js';
import { Player } from './player/Player.js';
import { HUD } from './ui/HUD.js';
import { EventDirector } from './events/Events.js';
import { PostProcessing } from './fx/PostProcessing.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { Conductor } from './audio/Conductor.js';

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, config.isTouch ? 1.25 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#2a1046', 0.00082);
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.5, config.world.far);

// Shared world state every module reads from.
const shared = {
	scene, camera, renderer,
	hue: 0.82,
	time: 0,
	moon: { dir: new THREE.Vector3(0, 1, 0), height: 1, intensity: 1 },
	sun: { dir: new THREE.Vector3(0, -1, 0), height: -1, intensity: 0 },
	fogColor: new THREE.Color('#2a1046'),
	state: { snow: 0, rain: 0, aurora: 0, eclipse: 0, hum: 0, meteors: 0, snowVisible: 0, rainVisible: 0 },
	audio: null,
	conductor: null,
	wandererProximity: 0,
	colliders: [],
};

const hud = new HUD();
shared.hud = hud;
const heightmap = new Heightmap(config.seed);
shared.heightmap = heightmap;
const ripples = new Ripples();
shared.ripples = ripples;
const shoreMap = new ShoreMap(heightmap);
shared.shoreMap = shoreMap;
const terrain = new Terrain(scene, heightmap, shared);
const water = new Water(scene, shared, heightmap.waterLevel);
const sky = new Sky(scene, shared);
const snow = new Snow(scene, shared);
const rain = new Rain(scene, shared);
const fireflies = new Fireflies(scene, heightmap, shared);
const sprouts = new Sprouts(scene, heightmap, shared);
const player = new Player(camera, canvas, heightmap, shared);
shared.player = player;
const landmarks = new Landmarks(scene, heightmap, shared, camera);
landmarks.addFireflies(fireflies);
const director = new EventDirector(shared);
const post = new PostProcessing(renderer, scene, camera);
const pmrem = new THREE.PMREMGenerator(renderer);
let envTimer = 0, envTarget = null;

// ---- events ----
bus.on(Events.RIPPLE, ({ x, z, size, hue, saturation }) => ripples.add(x, z, size, hue % 1, saturation));
bus.on(Events.NOTE, (n) => {
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

// ---- enter ----
let started = false;
hud.onEnter(async () => {
	if (started) return;
	started = true;
	const engine = new AudioEngine();
	await engine.resume();
	const conductor = new Conductor(engine);
	shared.audio = engine;
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
let hueDrift = 0;

function frame() {
	requestAnimationFrame(frame);
	const now = performance.now();
	const dt = Math.min((now - lastFrame) / 1000, 0.05);
	lastFrame = now;
	const worldDt = dt * shared.timeFactor;
	shared.time += worldDt;
	const t = shared.time;

	hueDrift += dt * 0.004;
	shared.hue = (shared.hue + dt * 0.004) % 1;

	player.update(dt, t);
	shoreMap.update(player.position);
	terrain.update(player.position, dt);
	ripples.update(t);
	sky.update(t, dt, camera.position, renderer);
	scene.fog.color.copy(shared.fogColor);
	water.update(t, camera.position, shared);
	snow.update(t, dt, camera.position, renderer);
	rain.update(dt, camera.position, renderer);
	fireflies.update(t, dt, player.position, renderer);
	sprouts.update(t);
	landmarks.update(dt, shared);
	director.update(dt);

	if (shared.audio) {
		shared.audio.update(dt);
		shared.audio.updateListener(camera.position, player.forward, listenerUp);
		shared.conductor.update(dt, shared);
	}

	// terrain uniforms
	const u = terrain.material.uniforms;
	u.uTime.value = t;
	u.uMoonDir.value.copy(shared.moon.dir);
	u.uMoonIntensity.value = shared.moon.intensity;
	u.uHue.value = shared.hue;
	u.uCameraPos.value.copy(camera.position);
	u.uSnow.value = damp(u.uSnow.value, shared.state.snowVisible * 0.85, shared.state.snowVisible > u.uSnow.value ? 0.05 : 0.03, dt);
	u.uHum.value = shared.state.hum;
	u.uNight.value = shared.night || 0;
	u.uRain.value = shared.state.rainVisible || 0;
	water.uniforms.uRain.value = shared.state.rainVisible || 0;
	scene.fog.density = 0.00082 * (1 + 0.5 * (shared.state.rainVisible || 0) + 0.25 * (shared.state.snowVisible || 0));
	u.uWaterLevel.value = heightmap.waterLevel;
	const dim = shared.skyDim || 1;
	shared.night = 1 - Math.max(shared.moon.intensity, shared.sun.intensity * 0.35);
	u.uSkyColor.value.set('#2b1a5e').lerp(new THREE.Color('#5a1a3a'), shared.sun.intensity * 0.2).multiplyScalar(dim);
	u.uGroundColor.value.set('#06040f').lerp(new THREE.Color('#14060c'), shared.sun.intensity * 0.5).multiplyScalar(dim);
	u.uSunDir.value.copy(shared.sun.dir);
	u.uSunIntensity.value = shared.sun.intensity;
	if (shared.audio) { u.uBass.value = shared.audio.analysis.bass; u.uLevel.value = shared.audio.analysis.attack; }

	// environment map for mirrors and stones, refreshed occasionally from the player's position
	envTimer -= dt;
	if (envTimer <= 0) {
		envTimer = 5;
		water.mesh.visible = false;
		const old = envTarget;
		envTarget = pmrem.fromScene(scene, 0.02, 1, config.world.far, { size: 128, position: camera.position });
		scene.environment = envTarget.texture;
		scene.environmentIntensity = 0.55;
		water.mesh.visible = true;
		if (old) old.dispose();
	}

	// glare: how squarely we are looking at the red dwarf, and whether hills hide it
	{
		const sun = shared.sun;
		const facing = player.forward.dot(sun.dir);
		let glare = 0;
		if (sun.intensity > 0.01 && facing > 0.7) {
			const ndc = sun.dir.clone().multiplyScalar(4000).add(camera.position).project(camera);
			shared.sunScreen = shared.sunScreen || new THREE.Vector2();
			shared.sunScreen.set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5);
			// march toward the sun to see if the terrain blocks it
			let blocked = false;
			for (let k = 1; k <= 24 && !blocked; k++) {
				const dist = k * 60;
				const px = camera.position.x + sun.dir.x * dist, py = camera.position.y + sun.dir.y * dist, pz = camera.position.z + sun.dir.z * dist;
				if (heightmap.height(px, pz) > py) blocked = true;
			}
			const onScreen = Math.max(0, 1 - Math.max(Math.abs(ndc.x), Math.abs(ndc.y)) * 0.8);
			glare = blocked ? 0 : sun.intensity * Math.pow(Math.max(0, (facing - 0.7) / 0.3), 1.5) * onScreen;
		}
		shared.sunGlare = damp(shared.sunGlare || 0, glare, 5, dt);
	}

	post.render(t, shared);
}
window.__debug = { scene, renderer, camera, shared, post, terrain, player, landmarksList: landmarks.list, director, shoreMap, water };
frame();
