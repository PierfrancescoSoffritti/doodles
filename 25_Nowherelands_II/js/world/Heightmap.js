import { Random, Simplex2D } from '../core/Random.js';
import { config } from '../core/Config.js';
import { smoothstep } from '../core/Utils.js';

// Analytic, seeded terrain. Height is a pure function of (x, z), so collision,
// placement and chunk generation all sample the same source in constant time.
export class Heightmap {
	constructor(seed) {
		const rnd = new Random(seed + ':terrain');
		this.noise = new Simplex2D(rnd);
		this.detail = new Simplex2D(new Random(seed + ':detail'));
		this.forestNoise = new Simplex2D(new Random(seed + ':forest'));
		this.warp = new Simplex2D(new Random(seed + ':warp'));
		this.plateau = new Simplex2D(new Random(seed + ':plateau'));
		this.waterLevel = config.world.waterLevel;
	}

	height(x, z) {
		const n = this.noise;
		// domain warp: bends every feature so nothing reads as a noise grid
		const wx = x + this.warp.fbm(x / 1900, z / 1900, 3) * 480;
		const wz = z + this.warp.fbm(x / 1900 + 37.1, z / 1900 - 11.4, 3) * 480;

		const continent = n.fbm(wx / 5200, wz / 5200, 3, 2.1, 0.55);            // -1..1 basins and highlands, kilometres across
		const hills = n.fbm(wx / 950 + 13.7, wz / 950 - 4.2, 5, 2.0, 0.5);      // rolling hills
		const crest = 1 - Math.abs(this.detail.noise(wx / 2400 + 100, wz / 2400 - 50));   // long sharp ranges
		const spur = 1 - Math.abs(this.detail.noise(wx / 720 + 7, wz / 720 + 3));         // side ridges
		const highland = smoothstep(-0.05, 0.6, continent);
		const mountains = (Math.pow(crest, 1.7) * 260 + spur * crest * 70) * highland;

		let h = continent * 60 + hills * 70 + mountains + 8;

		// terraced plateaus on some of the high ground
		const plateau = smoothstep(0.3, 0.8, this.plateau.fbm(wx / 1600, wz / 1600, 2)) * highland;
		if (plateau > 0.001 && h > 40) {
			const step = 42;
			const f = h / step;
			const terraced = (Math.floor(f) + smoothstep(0.2, 0.8, f - Math.floor(f))) * step;
			h += (terraced - h) * plateau;
		}

		// Shallow lake beds: pull everything under the water line down gently so shores read as beaches.
		if (h < 3) h = 3 - (3 - h) * 0.55 - 1.5;

		// Spawn plateau: guarantee dry land around the origin.
		const d = Math.hypot(x, z);
		if (d < 220) {
			const t = smoothstep(220, 60, d);
			h = h + (Math.max(h, 14) - h) * t;
		}
		return h;
	}

	normal(x, z, out) {
		const e = 1.5;
		const hl = this.height(x - e, z), hr = this.height(x + e, z);
		const hd = this.height(x, z - e), hu = this.height(x, z + e);
		out.set(hl - hr, 2 * e, hd - hu).normalize();
		return out;
	}

	slope(x, z) {
		const e = 2;
		const dx = (this.height(x + e, z) - this.height(x - e, z)) / (2 * e);
		const dz = (this.height(x, z + e) - this.height(x, z - e)) / (2 * e);
		return Math.hypot(dx, dz);
	}

	forestDensity(x, z) {
		return smoothstep(-0.15, 0.5, this.forestNoise.fbm(x / 900, z / 900, 3));
	}

	isLand(x, z, margin = 3) { return this.height(x, z) > this.waterLevel + margin; }

	// Is there open water within `reach` of this point?
	nearWater(x, z, reach = 40) {
		for (let k = 0; k < 8; k++) {
			const a = (k / 8) * Math.PI * 2;
			if (this.height(x + Math.cos(a) * reach, z + Math.sin(a) * reach) < this.waterLevel - 1) return true;
		}
		return false;
	}

	// The water's edge itself: a gentle spot straddling the waterline.
	findWaterEdgeSpot(rnd, cx, cz, radius) {
		for (let i = 0; i < 800; i++) {
			const a = rnd.next() * Math.PI * 2;
			const r = Math.sqrt(rnd.next()) * radius * (1 + Math.floor(i / 200));
			const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
			const h = this.height(x, z) - this.waterLevel;
			if (h < -3 || h > 1.5 || this.slope(x, z) > 0.3) continue;
			if (!this.nearWater(x, z, 25)) continue;
			return { x, z, edge: true };
		}
		return this.findShoreSpot(rnd, cx, cz, radius);
	}

	// A flat piece of shore: low, gentle, and with water close by. Falls back to any flat spot.
	findShoreSpot(rnd, cx, cz, radius, flatRadius = 0) {
		for (let i = 0; i < 600; i++) {
			const a = rnd.next() * Math.PI * 2;
			const r = Math.sqrt(rnd.next()) * radius * (1 + Math.floor(i / 150));
			const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
			const h = this.height(x, z) - this.waterLevel;
			if (h < 2.5 || h > 9 || this.slope(x, z) > 0.25 || !this.nearWater(x, z)) continue;
			if (flatRadius > 0) {
				let ok = true;
				for (let k = 0; k < 6 && ok; k++) {
					const b = (k / 6) * Math.PI * 2;
					const hx = x + Math.cos(b) * flatRadius, hz = z + Math.sin(b) * flatRadius;
					const hh = this.height(hx, hz) - this.waterLevel;
					if (hh < 1.5 || hh > 12 || this.slope(hx, hz) > 0.35) ok = false;
				}
				if (!ok) continue;
			}
			return { x, z };
		}
		return this.findFlatSpot(rnd, cx, cz, radius);
	}

	// Find a flat dry spot near a target using a seeded spiral search.
	findFlatSpot(rnd, cx, cz, radius, maxSlope = 0.35, minHeight = 6) {
		for (let i = 0; i < 400; i++) {
			const a = rnd.next() * Math.PI * 2;
			const r = Math.sqrt(rnd.next()) * radius * (1 + Math.floor(i / 100));
			const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
			if (this.height(x, z) > this.waterLevel + minHeight && this.slope(x, z) < maxSlope) return { x, z };
		}
		return { x: cx, z: cz };
	}
}
