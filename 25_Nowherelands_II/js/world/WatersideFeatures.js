import { Random } from '../core/Random.js';
import { RIVER_STRIDE as S, RV, surfaceHalfWidth } from './gen/Rivers.js';

// World-stable large wood. One plan supplies chunk geometry, current obstacles and the
// inspection tour. It is built before the water caches its wakes; chunk reloads never add wakes.
export class WatersideFeatures {
	constructor(hm, seed) {
		this.items = []; this.cells = new Map(); this.shoreCells = new Map();
		const rnd = new Random(seed + ':large-wood');
		const add = item => {
			this.items.push(item);
			const key = `${Math.floor(item.a[0] / 256)},${Math.floor(item.a[2] / 256)}`;
			if (!this.cells.has(key)) this.cells.set(key, []);
			this.cells.get(key).push(item);
		};
		for (const r of hm.world.rivers) {
			const wakes = Array.from(r.wakes), d = r.data;
			for (let i = 8; i < r.count - 8; i += 11) {
				const o = i * S;
				if (d[o + RV.BAR] > 0.82) wakes.push(d[o + RV.ALONG], 0, d[o + RV.W] * 0.11);
			}
			// Windthrow recruits groups along wooded reaches, with open gaps between them.
			for (let i = 8; i < r.count - 8; i += 5) {
				for (const side of [-1, 1]) {
					if (rnd.next() > 0.85) continue;
					const count = rnd.int(1, 3);
					for (let j = 0; j < count; j++) this.fallen(hm, r, i + j, side, rnd, add, wakes);
				}
			}
			r.wakes = Float32Array.from(wakes);
		}
		// Boundary samples also cover island shores; they are bucketed for local recruitment.
		for (const lake of hm.world.lakes) for (const k of hm.lakes.cells[lake.id] || []) {
			const i = k % hm.N, j = Math.floor(k / hm.N), x = i * hm.cell - hm.size / 2 - hm.ox, z = j * hm.cell - hm.size / 2 - hm.oz;
			const y = hm.sample(x, z);
			if (Math.abs(y - lake.level) > 4 || hm._riverSeg >= 0) continue;
			const hard = hm._hardness, slope = hm._slope;
			const fetch = this.fetch(hm, lake.id, x, z);
			const shore = { x, z, y, level: lake.level, lake: lake.id, fetch, hard, slope };
			const key = `${Math.floor(x / 256)},${Math.floor(z / 256)}`;
			if (!this.shoreCells.has(key)) this.shoreCells.set(key, []);
			this.shoreCells.get(key).push(shore);
			if (y < lake.level - 0.4 && y > lake.level - 3.5 && fetch < 0.5 && lake.level < 600 && rnd.next() < 0.035) {
				add({ type: 'snag', a: [x, y, z], b: [x + rnd.range(-3, 3), y + rnd.range(9, 22), z + rnd.range(-3, 3)], radius: rnd.range(0.55, 1.3), seed: rnd.next() * 1000, lake: lake.id });
			}
		}
	}
	fallen(hm, r, i, side, rnd, add, wakes) {
		const d = r.data, o = i * S, x = d[o], z = d[o + 1], wl = d[o + RV.WL], w = d[o + RV.W];
		if (wl < 2 || wl > 700 || d[o + RV.KIND] !== 0) return;
		const step = Math.hypot(d[o + S] - x, d[o + S + 1] - z) || 1;
		const tx = (d[o + S] - x) / step, tz = (d[o + S + 1] - z) / step;
		const nx = -tz * side, nz = tx * side;
		const edge = surfaceHalfWidth(w, d[o + RV.D], d[o + RV.BANK], side, d[o + RV.BEND]);
		let ax, az, ay, H;
		for (let q = 0; q < 10; q++) {
			ax = x + nx * (edge + 2 + q * 3); az = z + nz * (edge + 2 + q * 3);
			ay = hm.sample(ax, az); H = ay - Math.max(wl, hm._water);
			if (H > 1.2) break;
		}
		if (H < 1 || H > 16) return;
		// The bank must adjoin a real stand, not an isolated speck of habitat or a
		// forest field over submerged ground. Use the same suitability as live trees.
		const habitat = { ...hm.habitat(ax, az) };
		if (habitat.forest < 0.18 || habitat.alt < 0.25) return;
		let woodland = 0, forest = 0;
		for (const along of [-24, 0, 24]) {
			const px = ax + nx * 28 + tx * along, pz = az + nz * 28 + tz * along;
			const y = hm.sample(px, pz), f = hm.forestDensity(px, pz);
			if (y - hm._water > 3 && hm._slope < 0.7 && f >= 0.24) { woodland++; forest += f; }
		}
		if (woodland < 2) return;
		forest /= woodland;
		if (rnd.next() > 0.45 + 0.55 * forest) return;
		// Tree size is independent of river width: smaller trees stop in the channel;
		// mature inland trees can span it and leave their crown on the opposite bank.
		const inland = Math.min(1, Math.max(0, (ay - hm.waterLevel - 25) / 195)) * (1 - 0.6 * habitat.coast);
		const age = rnd.next();
		const length = (age < 0.28 ? rnd.range(20, 42) : age < 0.78 ? rnd.range(48, 100) : rnd.range(115, 210)) * (0.65 + 0.35 * inland);
		const radius = Math.max(0.7, length * rnd.range(0.025, 0.043));
		const sweep = rnd.range(-0.25, 0.85), norm = Math.hypot(1, sweep);
		const bx = ax + (-nx + tx * sweep) / norm * length, bz = az + (-nz + tz * sweep) / norm * length;
		const by = hm.height(bx, bz), taper = rnd.range(0.24, 0.48);
		if (by > ay + Math.min(35, length * 0.3)) return;
		const endY = Math.max(by + radius * taper * 0.6, wl - radius * taper * 0.25);
		const log = { type: 'fallen', a: [ax, ay + radius * 0.6, az], b: [bx, endY, bz], radius, taper, seed: rnd.next() * 1000, river: r.id, sample: i };
		// Longer trunks need more terrain probes, including the far bank, and must
		// actually reach water. Keep only the immersed parts as current obstacles.
		const probes = Math.max(6, Math.ceil(length / 6)), obstacles = [];
		let overWater = false;
		for (let q = 1; q < probes; q++) {
			const t = q / probes, px = ax + (bx - ax) * t, pz = az + (bz - az) * t, py = log.a[1] + (endY - log.a[1]) * t;
			const localRadius = radius * (1 + (taper - 1) * t);
			const ground = hm.sample(px, pz), water = hm._water;
			if (ground > py + localRadius * 0.3) return;
			if (water - ground < 0.15) continue;
			overWater = true;
			if (py - localRadius <= water) obstacles.push(d[o + RV.ALONG] + (px - x) * tx + (pz - z) * tz, (px - x) * -tz + (pz - z) * tx, localRadius * 1.6);
		}
		if (!overWater) return;
		add(log); wakes.push(...obstacles);
		add({ type: 'roots', a: [ax, ay + 0.2, az], b: [ax - nx * 4, Math.max(wl + 0.2, ay - 4.5), az - nz * 4], radius: Math.min(2, radius * 0.6), seed: rnd.next() * 1000, river: r.id, sample: i });
		// Accumulate mixed broken wood where a submerged trunk catches it, rather
		// than always attaching three identical twigs to its far endpoint.
		if (!obstacles.length || rnd.next() > 0.85) return;
		const k = rnd.int(0, obstacles.length / 3 - 1) * 3;
		const along = obstacles[k] - d[o + RV.ALONG], across = obstacles[k + 1];
		const cx = x + tx * along - tz * across, cz = z + tz * along + tx * across;
		for (let q = 0, count = rnd.int(3, 7); q < count; q++) {
			const off = rnd.range(-radius * 2, radius * 2), jx = cx - tx * (2 + q * 1.5) - tz * off, jz = cz - tz * (2 + q * 1.5) + tx * off;
			const len = rnd.range(6, Math.min(30, length * 0.6)), yaw = rnd.range(-0.8, 0.8), dx = -tz * Math.cos(yaw) + tx * Math.sin(yaw), dz = tx * Math.cos(yaw) + tz * Math.sin(yaw);
			const a = [jx - dx * len / 2, 0, jz - dz * len / 2], b = [jx + dx * len / 2, 0, jz + dz * len / 2];
			if ([a, [jx, 0, jz], b].some(p => hm.depthAt(p[0], p[2]) < 0.2)) continue;
			const level = hm.waterAt(jx, jz), smallRadius = rnd.range(0.25, Math.min(1.2, radius * 0.5));
			a[1] = level + smallRadius * 0.2; b[1] = level + smallRadius * 0.3;
			add({ type: 'jam', a, b, radius: smallRadius, seed: rnd.next() * 1000, river: r.id, sample: i });
		}
	}

	fetch(hm, id, x, z) {
		let open = 0;
		for (let i = 1; i <= 5; i++) { const d = i * 45; if (hm.lakes.levelAt(x - d * 0.83, z - d * 0.55) < hm.world.lakes[id].level - 0.1) break; open++; }
		return open / 5;
	}
	query(map, x0, z0, x1, z1) {
		const out = [];
		for (let z = Math.floor(z0 / 256); z <= Math.floor(z1 / 256); z++) for (let x = Math.floor(x0 / 256); x <= Math.floor(x1 / 256); x++) for (const f of map.get(`${x},${z}`) || []) {
			const px = f.a ? f.a[0] : f.x, pz = f.a ? f.a[2] : f.z;
			if (px >= x0 && px < x1 && pz >= z0 && pz < z1) out.push(f);
		}
		return out;
	}
}
