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
				const o = i * S, x = d[o], z = d[o + 1], wl = d[o + RV.WL], w = d[o + RV.W];
				const length = Math.hypot(d[o + S] - x, d[o + S + 1] - z) || 1, tx = (d[o + S] - x) / length, tz = (d[o + S + 1] - z) / length;
				if (d[o + RV.BAR] > 0.82) wakes.push(d[o + RV.ALONG], 0, w * 0.11);
				if (wl < 2 || wl > 700 || d[o + RV.KIND] !== 0 || rnd.next() > 0.3) continue;
				const side = Math.sign(d[o + RV.BEND]) || (rnd.next() < 0.5 ? -1 : 1);
				const edge = surfaceHalfWidth(w, d[o + RV.D], d[o + RV.BANK], side, d[o + RV.BEND]);
				let ax, az, ay, H;
				for (let q = 0; q < 6; q++) {
					ax = x - tz * side * (edge + 1 + q * 2); az = z + tx * side * (edge + 1 + q * 2);
					ay = hm.sample(ax, az); H = ay - Math.max(wl, hm._water);
					if (H > 0.6) break;
				}
				const forest = hm.forestDensity(ax, az);
				if (H < 0.5 || H > 10 || (forest < 0.12 && rnd.next() > 0.25)) continue;
				const root = { type: 'roots', a: [ax, ay + 0.2, az], b: [ax + tz * side * 4, Math.max(wl + 0.2, ay - 4.5), az - tx * side * 4], radius: rnd.range(0.5, 1.1), seed: rnd.next() * 1000, river: r.id, sample: i };
				add(root);
				const crossing = w < 55 && rnd.next() < 0.55;
				const across = crossing ? -side * (edge + 2) : -side * rnd.range(0.05, 0.6) * w;
				const along = rnd.range(0.12, 0.55) * w;
				const bx = x - tz * across + tx * along, bz = z + tx * across + tz * along;
				const by = hm.sample(bx, bz), radius = rnd.range(0.65, 1.55);
				if (by > ay + 8 || Math.hypot(bx - ax, bz - az) > 100) continue;
				const endY = Math.max(by + radius * 0.45, wl - radius * 0.25);
				const log = { type: 'fallen', a: [ax, ay + radius * 0.6, az], b: [bx, endY, bz], radius, seed: rnd.next() * 1000, river: r.id, sample: i };
				// Reject trunks intersecting high terrain between their supported endpoints.
				let blocked = false;
				for (let q = 1; q < 6; q++) { const t = q / 6; if (hm.height(ax + (bx - ax) * t, az + (bz - az) * t) > log.a[1] + (endY - log.a[1]) * t + radius * 0.3) blocked = true; }
				if (blocked) continue;
				add(log);
				// Only immersed sections obstruct flow; a bridge above the water has no fake wake.
				for (let q = 1; q <= 5; q++) {
					const t = q / 6, px = ax + (bx - ax) * t, pz = az + (bz - az) * t, py = log.a[1] + (endY - log.a[1]) * t;
					if (py - radius > wl || hm.depthAt(px, pz) < 0.15) continue;
					wakes.push(d[o + RV.ALONG] + (px - x) * tx + (pz - z) * tz, (px - x) * -tz + (pz - z) * tx, radius * 1.6);
				}
				// Smaller transported branches collect upstream of the grounded end.
				if (endY < wl + radius && rnd.next() < 0.75) for (let q = 0; q < 3; q++) {
					const off = rnd.range(-3, 3), cx = bx - tx * (2 + q) - tz * off, cz = bz - tz * (2 + q) + tx * off;
					if (hm.depthAt(cx, cz) < 0.2) continue;
					const len = rnd.range(4, 10), dx = -tz + tx * rnd.range(-0.4, 0.4), dz = tx + tz * rnd.range(-0.4, 0.4);
					add({ type: 'jam', a: [cx - dx * len / 2, wl + 0.1, cz - dz * len / 2], b: [cx + dx * len / 2, wl + 0.2, cz + dz * len / 2], radius: rnd.range(0.18, 0.4), seed: rnd.next() * 1000, river: r.id, sample: i });
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
