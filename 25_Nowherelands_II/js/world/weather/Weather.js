import * as THREE from 'three';
import { config } from '../../core/Config.js';
import { WeatherModel, smooth } from './WeatherModel.js';
import { Random } from '../../core/Random.js';
import { bus, Events } from '../../core/EventBus.js';

export class Weather {
	constructor(scene, heightmap, shared) {
		this.shared = shared;
		const size = heightmap.world.size + 8000;
		this.model = new WeatherModel(config.seed, { size, res: config.isTouch ? 48 : 64, originX: -heightmap.ox - size / 2, originZ: -heightmap.oz - size / 2, height: (x, z) => heightmap.height(x, z) });
		const m = this.model;
		const texture = data => {
			const t = new THREE.DataTexture(data, m.res, m.res, THREE.RGBAFormat);
			t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
		};
		this.motion = {}; this.controls = {}; this.lightningPhase = 0;
		this.uniforms = {
			uWeatherPrevious: { value: texture(m.previousWeatherData) }, uSurfacePrevious: { value: texture(m.previousSurfaceData) },
			uWeatherBlend: { value: 0 }, uWeatherPrecip: { value: new THREE.Vector4() },
			uWeatherMap: { value: texture(m.weatherData) }, uWeatherSurface: { value: texture(m.surfaceData) },
			uWeatherOrigin: { value: new THREE.Vector2(m.originX, m.originZ) }, uWeatherSize: { value: m.size }, uWeatherRes: { value: m.res },
			uWeatherWind: { value: new THREE.Vector2(m.wind.x, m.wind.z) }, uWeatherOffset: { value: new THREE.Vector2() },
			uWeatherTime: { value: 0 }, uLightning: { value: 0 }, uSurfEnergy: { value: 1 },
		};
		shared.weather = this;
		this.entrances = (heightmap.world.caves || []).flatMap(cave => cave.entrances || [cave.entrance]);
		this.particleLayers = {}; this.local = {}; this.exposure = 1; this.wind = new THREE.Vector2(); this.travel = new THREE.Vector2();
		this.flashAge = 10; this.flashStrength = 0; this.thunder = []; this.audioClock = 0; this.swell = 1; this.lastName = ''; this.toastTimer = 0;
		this.light = new THREE.DirectionalLight('#b9cfff', 0); scene.add(this.light, this.light.target);
		this.bolt = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#dbe6ff', transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
		this.bolt.frustumCulled = false; this.bolt.visible = false; scene.add(this.bolt);
	}

	strike(event, position) {
		const { shared } = this, rnd = new Random(event.seed);
		const ground = Math.max(0, shared.heightmap.height(event.x, event.z));
		const top = Math.max(1800, ground + 1000), points = [];
		let x = event.x + rnd.range(-180, 180), y = top, z = event.z + rnd.range(-180, 180);
		for (let i = 1; i <= 18; i++) {
			const nx = event.x + rnd.range(-90, 90) * (1 - i / 19), ny = top + (ground - top) * i / 18, nz = event.z + rnd.range(-90, 90);
			points.push(x, y, z, nx, ny, nz);
			if (i > 3 && i < 13 && rnd.chance(0.35)) points.push(nx, ny, nz, nx + rnd.range(-180, 180), ny - 100, nz + rnd.range(-180, 180));
			x = nx; y = ny; z = nz;
		}
		this.bolt.geometry.dispose(); this.bolt.geometry = new THREE.BufferGeometry();
		this.bolt.geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
		const distance = Math.hypot(event.x - position.x, top * 0.65 - position.y, event.z - position.z);
		this.flashAge = 0; this.flashStrength = event.strength * (this.controls.brightness ?? 1) / (1 + distance / 5500);
		this.light.position.set(event.x, top, event.z); this.light.target.position.copy(position);
		// Audio stays in real seconds, even when the time monolith accelerates the weather.
		if (shared.audio && distance < 15000) this.thunder.push({ due: this.audioClock + distance / 343, distance, position: { x: event.x, y: top * 0.65, z: event.z }, seed: event.seed });
	}

	playThunder(event) {
		const engine = this.shared.audio;
		if (!engine || (this.controls.thunder ?? 1) < 0.001) return;
		if (!this.thunderBus) { this.thunderBus = engine.ctx.createGain(); this.thunderBus.connect(engine.master); }
		const ctx = engine.ctx, t = engine.now, rnd = new Random(event.seed), duration = 4 + Math.min(5, event.distance / 1800);
		const src = ctx.createBufferSource(); src.buffer = engine.noiseBuffer; src.loop = true;
		const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 180 + 1300 / (1 + event.distance / 1200);
		const gain = ctx.createGain(), level = (0.25 + 0.65 / (1 + event.distance / 2200)) * (0.18 + this.exposure * 0.82);
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.exponentialRampToValueAtTime(level, t + 0.06 + event.distance / 18000);
		for (let i = 1; i <= 6; i++) gain.gain.exponentialRampToValueAtTime(Math.max(0.001, level * rnd.range(0.18, 0.85) * (1 - i / 7)), t + 0.35 + (duration - 0.5) * i / 7);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
		const pan = engine.makePanner(event.position); pan.refDistance = 3000; pan.rolloffFactor = 0.35;
		src.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(this.thunderBus);
		src.start(t); src.stop(t + duration + 0.1);
		src.onended = () => { src.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect(); };
	}

	update(worldDt, dt, position) {
		const { model: m, shared: s, uniforms: u } = this;
		if (m.update(worldDt)) for (const key of ['uWeatherMap', 'uWeatherSurface', 'uWeatherPrevious', 'uSurfacePrevious']) u[key].value.needsUpdate = true;
		m.renderControls(this.controls); m.renderMotion(this.motion);
		const c = this.controls;
		if (this.thunderBus) this.thunderBus.gain.value = c.thunder < 0.001 ? 0 : c.thunder;
		u.uWeatherBlend.value = m.blend; u.uWeatherPrecip.value.set(c.rain, c.snow, c.hail, c.weight);
		m.sample(position.x, position.y, position.z, this.local, true);
		const l = this.local;
		this.precipitationNearby = m.hasPrecipitation(position.x, position.z);
		this.nearEntrance = this.entrances.some(e => Math.hypot(e.x-position.x, e.y-position.y, e.z-position.z) < 220);
		// Terrain above the listener is authoritative at entrances; caveAmount smooths the sound.
		const roof = s.heightmap.height(position.x, position.z) > position.y + 3;
		this.exposure = roof ? 0 : 1 - smooth(0.08, 0.45, s.caveAmount || 0);
		for (const key of ['rain', 'snow', 'hail']) s.state[key] = l[key] * this.exposure;
		s.state.storm = l.storm; s.state.cloudCover = l.coverage;
		s.state.wind = l.windSpeed / 13 * this.exposure;
		this.swell += (1 + l.windSpeed / 13 * 0.18 + l.storm * 0.4 - this.swell) * (1 - Math.exp(-worldDt / 25));
		this.uniforms.uSurfEnergy.value = this.swell;
		this.wind.set(l.windX, l.windZ); this.travel.addScaledVector(this.wind, worldDt);
		u.uWeatherTime.value = m.renderTime;
		u.uWeatherWind.value.set(this.motion.windx, this.motion.windz);
		u.uWeatherOffset.value.set(this.motion.x, this.motion.z);
		// Survey strike rate is independent of rain and storm strength; natural cells retain their lifecycle.
		if (m.controls && m.controls.lightning > 0) {
			this.lightningPhase += worldDt * c.lightning * c.weight / 60;
			if (this.lightningPhase >= 1) {
				this.lightningPhase %= 1;
				const angle = m.random.range(0, Math.PI * 2), distance = m.random.range(500, 2400);
				this.strike({ x: position.x + Math.cos(angle) * distance, z: position.z + Math.sin(angle) * distance, strength: 1, seed: m.random.int(0, 1e9) }, position);
			}
		} else this.lightningPhase = 0;
		this.audioClock += dt; this.flashAge += dt;
		for (const strike of m.strikes.splice(0)) this.strike(strike, position);
		const flash = this.flashStrength * (Math.exp(-this.flashAge * 19) + 0.55 * Math.exp(-Math.pow((this.flashAge - 0.16) / 0.035, 2)));
		// Flash the outdoor scene even when viewed by a sheltered listener. Cave rock uses its own daylight mask.
		u.uLightning.value = flash; this.light.intensity = flash * 3;
		this.bolt.visible = this.flashAge < 0.4; this.bolt.material.opacity = Math.min(1, flash * 2);
		for (const event of this.thunder) if (event.due <= this.audioClock) { this.playThunder(event); event.done = true; }
		this.thunder = this.thunder.filter(e => !e.done);
		this.toastTimer -= dt;
		const name = s.state.hail > 0.1 ? 'hail' : l.storm > 0.4 ? 'thunderstorm' : s.state.snow > 0.12 ? 'mountain snow' : s.state.rain > 0.12 ? 'rain' : '';
		if (name !== this.lastName && this.toastTimer <= 0) { if (name) bus.emit(Events.TOAST, { text: name }); this.lastName = name; this.toastTimer = 35; }
	}
}
