import { Random, Simplex2D } from '../../core/Random.js';

export const MIN_SNOW_HEIGHT = 700;
export const WEATHER_STEP = 0.5;
const sampledFields = ['temperature', 'coverage', 'precipitation', 'convection', 'hail', 'snowLine', 'wetness', 'snowpack'];
export const weatherPresets = {
 clear: { coverage: 0, rain: 0, snow: 0, hail: 0, wind: 3, gust: 0.1, storm: 0, lightning: 0 },
 scattered: { coverage: 0.3, rain: 0, snow: 0, hail: 0, wind: 8, gust: 0.25, storm: 0, lightning: 0 },
 rain: { coverage: 0.85, rain: 0.65, snow: 0.65, hail: 0, wind: 15, gust: 0.4, storm: 0.2, lightning: 0 },
 snow: { coverage: 0.75, rain: 0, snow: 0.8, hail: 0, wind: 9, gust: 0.3, storm: 0, lightning: 0 },
 storm: { coverage: 0.95, rain: 1, snow: 0.85, hail: 0, wind: 38, gust: 0.8, storm: 1, lightning: 8 },
 hail: { coverage: 0.95, rain: 0.6, snow: 0.4, hail: 0.75, wind: 32, gust: 0.7, storm: 1, lightning: 6 },
};
export const vegetationWind = speed => Math.min(8, Math.pow(Math.max(0, speed) / 12, 1.45));
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export function snowFraction(height, snowLine) {
	return smooth(MIN_SNOW_HEIGHT, MIN_SNOW_HEIGHT + 70, height) * smooth(snowLine - 45, snowLine + 65, height);
}
// Saturation proxy, normalized at 10 C. World heights use a deliberately compressed climate.
export const saturation = temperature => Math.exp(0.055 * (temperature - 10));
export function condense(vapor, liquid, capacity, dt) {
	const exchange = vapor > capacity ? (vapor - capacity) * (1 - Math.exp(-dt * 0.12))
		: -Math.min(liquid, (capacity - vapor) * (1 - Math.exp(-dt * 0.045)));
	return [vapor - exchange, liquid + exchange];
}
export function stormEnvelope(age, duration) {
	return smooth(20, 100, age) * (1 - smooth(duration - 110, duration, age));
}

// A fixed-step column model: advected vapor/cloud water, temperature profiles, terrain lift,
// precipitation fallout and persistent surface reservoirs. Small-scale turbulence is rendered.
// Boundary air is prescribed; water is conserved during phase changes, not across the open domain.
export class WeatherModel {
	constructor(seed, { size = 24000, res = 64, originX = -12000, originZ = -12000, height = () => 0 } = {}) {
		Object.assign(this, { size, res, originX, originZ });
		this.cell = size / (res - 1);
		this.random = new Random(seed + ':weather');
		this.noise = new Simplex2D(new Random(seed + ':atmosphere'));
		this.time = 0; this.accumulator = 0; this.version = 0;
		this.angle = this.random.range(0, Math.PI * 2);
		this.wind = { x: Math.cos(this.angle) * 13, z: Math.sin(this.angle) * 13 };
		this.offset = { x: 0, z: 0 };
		this.storms = []; this.strikes = []; this.stormTimer = 70; this.hailCooldown = 0;
		this.serial = 0; this.controls = null;
		this.controlState = { ...weatherPresets.clear, brightness: 1, thunder: 1, weight: 0 };
		this.previous = {}; this.previousControls = { ...this.controlState };
		this.previousWind = { ...this.wind }; this.previousOffset = { ...this.offset };
		const count = res * res;
		for (const name of ['ground', 'vapor', 'liquid', 'nextVapor', 'nextLiquid', 'temperature', 'coverage', 'precipitation', 'convection', 'hail', 'snowLine', 'wetness', 'snowpack']) this[name] = new Float32Array(count);
		this.weatherData = new Uint8Array(count * 4);
		this.surfaceData = new Uint8Array(count * 4);
		this.previousWeatherData = new Uint8Array(count * 4); this.previousSurfaceData = new Uint8Array(count * 4);
		for (const name of sampledFields) this.previous[name] = new Float32Array(count);
		for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) {
			const i = z * res + x, wx = originX + x * this.cell, wz = originZ + z * this.cell;
			this.ground[i] = height(wx, wz);
			const n = this.noise.fbm(wx / 3800, wz / 3800, 3);
			this.vapor[i] = 0.5 + 0.34 * n;
			this.liquid[i] = Math.max(0, -0.015 + n * 0.24);
			this.snowLine[i] = 810;
		}
		// Settle cloud formation before the first frame; simulation time still starts at zero.
		for (let i = 0; i < 100; i++) this.step(WEATHER_STEP, true);
		this.time = 0; this.offset.x = this.offset.z = 0; this.pack(); this.snapshot();
	}

	// Draw outdoor precipitation if any column touching the particle volume is wet. This
	// deliberately ignores the listener's shelter and height; the shader resolves each drop.
	hasPrecipitation(x, z, radius = 170) {
		if (this.controlState.weight > 0.001 && Math.max(this.controlState.rain, this.controlState.snow, this.controlState.hail) > 0.001) return true;
		const x0 = clamp(Math.floor((x - radius - this.originX) / this.cell), 0, this.res - 1);
		const z0 = clamp(Math.floor((z - radius - this.originZ) / this.cell), 0, this.res - 1);
		const x1 = clamp(Math.ceil((x + radius - this.originX) / this.cell), 0, this.res - 1);
		const z1 = clamp(Math.ceil((z + radius - this.originZ) / this.cell), 0, this.res - 1);
		for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
			const i = gz * this.res + gx;
			if (Math.max(this.precipitation[i], this.previous.precipitation[i]) > 0.001) return true;
		}
		return false;
	}

	gridSample(field, gx, gz) {
		gx = clamp(gx, 0, this.res - 1); gz = clamp(gz, 0, this.res - 1);
		const x = Math.min(this.res - 2, Math.floor(gx)), z = Math.min(this.res - 2, Math.floor(gz));
		const a = gx - x, b = gz - z, i = z * this.res + x, n = this.res;
		return (field[i] * (1 - a) + field[i + 1] * a) * (1 - b) + (field[i + n] * (1 - a) + field[i + n + 1] * a) * b;
	}

	get blend() { return clamp(this.accumulator / WEATHER_STEP); }
	get renderTime() { return Math.max(0, this.time - WEATHER_STEP + this.accumulator); }
	setControls(values) { this.controls = values ? { ...this.controlState, ...values, weight: 1 } : null; }
	renderControls(out = {}) {
		for (const key in this.controlState) out[key] = this.previousControls[key] + (this.controlState[key] - this.previousControls[key]) * this.blend;
		return out;
	}
	renderMotion(out = {}) {
		for (const axis of ['x', 'z']) {
			out[axis] = this.previousOffset[axis] + (this.offset[axis] - this.previousOffset[axis]) * this.blend;
			out['wind' + axis] = this.previousWind[axis] + (this.wind[axis] - this.previousWind[axis]) * this.blend;
		}
		return out;
	}
	snapshot() {
		for (const name of sampledFields) this.previous[name].set(this[name]);
		this.previousWeatherData.set(this.weatherData); this.previousSurfaceData.set(this.surfaceData);
		Object.assign(this.previousWind, this.wind); Object.assign(this.previousOffset, this.offset);
		Object.assign(this.previousControls, this.controlState);
	}
	sample(x, height, z, out = {}, interpolate = false) {
		const gx = (x - this.originX) / this.cell, gz = (z - this.originZ) / this.cell;
		const at = name => { const current = this.gridSample(this[name], gx, gz); return interpolate ? this.gridSample(this.previous[name], gx, gz) * (1 - this.blend) + current * this.blend : current; };
		const c = interpolate ? this.renderControls() : this.controlState;
		const line = at('snowLine'), snow = snowFraction(height, line), p = at('precipitation');
		out.coverage = at('coverage'); out.precipitation = p;
		out.snowLine = line; out.hail = Math.min(p, at('hail'));
		out.snow = (p - out.hail) * snow; out.rain = (p - out.hail) * (1 - snow);
		out.rain += (c.rain * (1 - snow) - out.rain) * c.weight;
		out.snow += (c.snow * snow - out.snow) * c.weight;
		out.hail += (c.hail - out.hail) * c.weight;
		out.precipitation = out.rain + out.snow + out.hail;
		out.storm = at('convection'); out.wetness = at('wetness');
		out.snowpack = at('snowpack') * smooth(MIN_SNOW_HEIGHT, MIN_SNOW_HEIGHT + 70, height);
		out.temperature = at('temperature') - height * 0.012;
		const time = interpolate ? this.renderTime : this.time;
		const wave = 0.5 + 0.32 * Math.sin(time * 0.7 + x * 0.002 + z * 0.003) + 0.18 * Math.sin(time * 1.63 + z * 0.001);
		const gust = (out.storm * (18 + 18 * wave)) * (1 - c.weight) + c.wind * c.gust * (wave - 0.25) * c.weight;
		const motion = interpolate ? this.renderMotion() : { windx: this.wind.x, windz: this.wind.z };
		out.windX = motion.windx + Math.cos(this.angle + 0.3) * gust;
		out.windZ = motion.windz + Math.sin(this.angle + 0.3) * gust;
		out.windSpeed = Math.hypot(out.windX, out.windZ);
		return out;
	}

	update(dt) {
		this.accumulator += Math.max(0, dt);
		let changed = false;
		while (this.accumulator + 1e-9 >= WEATHER_STEP) {
			this.snapshot(); this.step(WEATHER_STEP); this.pack();
			this.accumulator = Math.max(0, this.accumulator - WEATHER_STEP); changed = true;
		}
		return changed;
	}

	// Used by the weather survey as well as natural convection. Hail eligibility is drawn once
	// per cell, never per frame. A 20-minute global cooldown bounds repeated hail outbreaks.
	addStorm(x, z, { strength = 1, hail, age = 0 } = {}) {
		const eligible = this.hailCooldown <= 0 && strength >= 0.8;
		const hasHail = hail === undefined ? eligible && this.random.chance(0.035) : hail;
		if (hasHail) this.hailCooldown = 1200;
		const storm = { id: ++this.serial, x, z, age, duration: this.random.range(290, 390), radius: this.random.range(1800, 2600), strength, hail: hasHail, lightningTimer: this.random.range(5, 15) };
		this.storms.push(storm);
		return storm;
	}

	step(dt, warming = false) {
		this.time += dt;
		const t = this.time;
		const turn = this.angle + 0.2 * Math.sin(t / 210);
		const target = this.controls;
		for (const key in this.controlState) {
			const value = key === 'weight' ? (target ? 1 : 0) : (target?.[key] ?? this.controlState[key]);
			this.controlState[key] += (value - this.controlState[key]) * (1 - Math.exp(-dt * 2));
		}
		const control = this.controlState;
		const naturalSpeed = 8 + 5 * Math.sin(t / 110);
		const speed = naturalSpeed + (control.wind - naturalSpeed) * control.weight;
		this.wind.x = Math.cos(turn) * speed; this.wind.z = Math.sin(turn) * speed;
		this.offset.x += this.wind.x * dt; this.offset.z += this.wind.z * dt;
		this.hailCooldown = Math.max(0, this.hailCooldown - dt);
		for (const cell of this.storms) {
			cell.age += dt; cell.x += this.wind.x * dt * 1.2; cell.z += this.wind.z * dt * 1.2;
			const e = stormEnvelope(cell.age, cell.duration) * cell.strength;
			cell.lightningTimer -= dt;
			if (!warming && !this.controls && control.weight < 0.01 && e > 0.55 && cell.lightningTimer <= 0) {
				const angle = this.random.range(0, Math.PI * 2), r = this.random.range(0, cell.radius * 0.55);
				this.strikes.push({ x: cell.x + Math.cos(angle) * r, z: cell.z + Math.sin(angle) * r, strength: e, seed: this.random.int(0, 1e9) });
				if (this.strikes.length > 16) this.strikes.shift();
				cell.lightningTimer = this.random.range(6, 18) / Math.max(0.4, e);
			}
		}
		this.storms = this.storms.filter(c => c.age < c.duration);
		const n = this.res, dx = this.wind.x * dt / this.cell, dz = this.wind.z * dt / this.cell;
		let best = -1, bestScore = 0;
		for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
			const i = z * n + x, wx = this.originX + x * this.cell, wz = this.originZ + z * this.cell;
			const h = this.ground[i];
			const front = this.noise.fbm((wx - this.offset.x * 2) / 4300, (wz - this.offset.z * 2) / 4300, 3);
			const temp = 9.8 + 2.3 * Math.sin(t / 240) + front * 2;
			this.temperature[i] = temp;
			// Orographic vertical velocity: positive on the windward slope, negative in its lee.
			const hx = (this.ground[z * n + Math.min(n - 1, x + 1)] - this.ground[z * n + Math.max(0, x - 1)]) / (2 * this.cell);
			const hz = (this.ground[Math.min(n - 1, z + 1) * n + x] - this.ground[Math.max(0, z - 1) * n + x]) / (2 * this.cell);
			const lift = clamp(this.wind.x * hx + this.wind.z * hz, -2, 3);
			let vapor = this.gridSample(this.vapor, x - dx, z - dz);
			let liquid = this.gridSample(this.liquid, x - dx, z - dz);
			const supply = 0.51 + front * 0.62 + 0.14 * Math.sin(t / 145);
			const boundary = x === 0 || z === 0 || x === n - 1 || z === n - 1;
			vapor += (supply - vapor) * (1 - Math.exp(-dt * (boundary ? 0.08 : h <= 0 ? 0.025 : 0.007)));
			const capacity = saturation(temp - 10 - lift * 2.5 - Math.max(0, h) * 0.002);
			[vapor, liquid] = condense(vapor, liquid, capacity, dt);
			let storm = 0, hail = 0;
			for (const c of this.storms) {
				const r = Math.hypot(wx - c.x, wz - c.z) / c.radius;
				const footprint = 1 - smooth(0.2, 1, r);
				const e = stormEnvelope(c.age, c.duration) * c.strength * footprint;
				storm = Math.max(storm, e);
				if (c.hail) hail = Math.max(hail, e * (1 - smooth(0.15, 0.5, r)) * smooth(125, 133, c.age) * (1 - smooth(150, 161, c.age)));
			}
			// Convective columns replenish condensate by lifting moisture from below.
			const lifted = Math.min(vapor, storm * 0.016 * dt);
			vapor -= lifted; liquid += lifted;
			let rain = clamp((liquid - 0.075) * 3.4) * (0.55 + 0.45 * smooth(0.48, 0.8, vapor));
			liquid = Math.max(0, liquid - Math.max(0, liquid - 0.075) * dt * 0.025);
			this.nextVapor[i] = Math.max(0, vapor); this.nextLiquid[i] = liquid;
			this.coverage[i] = clamp((liquid - 0.018) * 3.2 + storm * 0.5);
			// Explicit survey fixtures only; normal worlds never set preview.
			if (this.preview) {
				rain = this.preview === 'clear' ? 0 : 0.9;
				this.coverage[i] = this.preview === 'clear' ? 0 : 0.94;
				if (this.preview === 'storm' || this.preview === 'hail') storm = Math.max(storm, 0.9);
				if (this.preview === 'hail') hail = 0.7;
			}
			this.coverage[i] += (control.coverage - this.coverage[i]) * control.weight;
			storm += (control.storm - storm) * control.weight;
			this.precipitation[i] = rain; this.convection[i] = storm; this.hail[i] = Math.min(rain, hail);
			const line = clamp((temp - (1 - clamp(vapor / saturation(temp))) * 2.5) / 0.012, 740, 1030);
			this.snowLine[i] = line;
			const snow = snowFraction(h, line), warmth = Math.max(0, temp - h * 0.012);
			const melt = Math.min(this.snowpack[i], dt * (0.00008 + warmth * 0.00013));
			const snowAmount = (rain - this.hail[i]) * snow * (1 - control.weight) + control.snow * snow * control.weight;
			const rainAmount = rain * (1 - snow) * (1 - control.weight) + control.rain * (1 - snow) * control.weight;
			this.snowpack[i] = h < MIN_SNOW_HEIGHT ? 0 : clamp(this.snowpack[i] + snowAmount * dt * 0.005 - melt);
			this.wetness[i] = clamp(this.wetness[i] + (rainAmount * 0.022 + melt / dt * 0.8 - 0.0014) * dt);
			const instability = smooth(-0.2, 0.4, front + 0.15 * Math.sin(t / 170));
			const score = liquid * (0.65 + Math.max(0, lift) * 0.35) * (0.35 + instability * 0.65) + front * 0.12;
			if (x > 6 && z > 6 && x < n - 7 && z < n - 7 && score > bestScore && !this.storms.some(c => Math.hypot(wx - c.x, wz - c.z) < c.radius * 2)) { bestScore = score; best = i; }
		}
		[this.vapor, this.nextVapor] = [this.nextVapor, this.vapor];
		[this.liquid, this.nextLiquid] = [this.nextLiquid, this.liquid];
		if (!warming) {
			this.stormTimer -= dt;
			if (this.stormTimer <= 0) {
				if (best >= 0 && bestScore > 0.19 && this.storms.length < 3) this.addStorm(this.originX + (best % n) * this.cell, this.originZ + Math.floor(best / n) * this.cell);
				this.stormTimer = this.random.range(100, 190);
			}
		}
	}

	pack() {
		for (let i = 0; i < this.ground.length; i++) {
			const j = i * 4, w = this.weatherData, s = this.surfaceData;
			w[j] = Math.round(this.coverage[i] * 255); w[j + 1] = Math.round(this.precipitation[i] * 255);
			w[j + 2] = Math.round(this.convection[i] * 255); w[j + 3] = Math.round(this.hail[i] * 255);
			s[j] = Math.round(this.wetness[i] * 255); s[j + 1] = Math.round(this.snowpack[i] * 255);
			s[j + 2] = Math.round(clamp((this.snowLine[i] - 650) / 500) * 255);
			s[j + 3] = Math.round(clamp((this.ground[i] + 500) / 3500) * 255);
		}
		this.version++;
	}
}
