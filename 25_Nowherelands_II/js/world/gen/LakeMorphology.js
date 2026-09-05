import { RIVER_STRIDE as S, RV } from './Rivers.js';

// Reshape only basin interiors: shallow coves, submerged inlet fans and occasional
// islands. The rim and spillway stay intact, and every fan remains underwater.
export function shapeLakeShores(h, lakes, ids, rivers, hard, N, cell, size, noise) {
	const fans = [];
	for (const r of rivers) {
		if (r.mouthType !== 'lake' || r.count < 2) continue;
		// The generator still has world-space records here.
		const o = (r.count - 1) * S, p = o - S;
		const x = r.data[o], z = r.data[o + 1], l = Math.hypot(x - r.data[p], z - r.data[p + 1]) || 1;
		const k = Math.round((z + size / 2) / cell) * N + Math.round((x + size / 2) / cell);
		if (ids[k] >= 0) fans.push({ lake: ids[k], x, z, tx: (x - r.data[p]) / l, tz: (z - r.data[p + 1]) / l, radius: Math.min(180, Math.max(45, r.data[o + RV.W] * 2.2)) });
	}
	for (const lake of lakes) {
		const candidates = [];
		for (const k of lake.cells) {
			const i = k % N, j = Math.floor(k / N), x = i * cell - size / 2, z = j * cell - size / 2;
			if (i < 2 || j < 2 || i >= N - 2 || j >= N - 2) continue;
			const interior = [k - 1, k + 1, k - N, k + N].every(n => ids[n] === lake.id);
			// Soft shores carry broad, shallow sediment shelves; hard shores stay steep.
			if (!interior && hard[k] < 0.52) {
				const patch = noise.noise(x / 170 + 8, z / 170);
				if (patch > 0) h[k] = Math.max(h[k], lake.level - 0.7 - (1 - patch) * 1.1);
			}
			for (const f of fans) {
				if (f.lake !== lake.id) continue;
				const dx = x - f.x, dz = z - f.z, along = dx * f.tx + dz * f.tz, across = dx * -f.tz + dz * f.tx;
				if (along < 0 || along > f.radius) continue;
				const width = f.radius * 0.18 + along * 0.65, v = Math.abs(across) / width;
				if (v >= 1) continue;
				const feather = Math.min(1, along / cell) * Math.min(1, (f.radius - along) / (cell * 2)) * (1 - v * v);
				const shelf = lake.level - 0.65 - along * 0.025 - v * 1.5;
				h[k] += Math.max(0, shelf - h[k]) * feather;
			}
			if (lake.cells.length > 180 && interior && [k - 2, k + 2, k - 2 * N, k + 2 * N].every(n => ids[n] === lake.id) && !fans.some(f => f.lake === lake.id && Math.hypot(x - f.x, z - f.z) < f.radius * 1.5)) {
				candidates.push({ k, x, z, value: noise.noise(x / 120 + 93, z / 120 - 21) });
			}
		}
		candidates.sort((a, b) => b.value - a.value);
		const island = candidates[0];
		if (island && island.value > 0.6 && lake.id % 3 !== 0) {
			const radius = Math.min(cell * 2.6, Math.sqrt(lake.cells.length) * cell * 0.07);
			for (const k of lake.cells) {
				const x = (k % N) * cell - size / 2, z = Math.floor(k / N) * cell - size / 2;
				const d = Math.hypot((x - island.x) / radius, (z - island.z) / (radius * 0.7));
				if (d < 1) h[k] = Math.max(h[k], lake.level + 3.5 - d * d * 6.5);
			}
			lake.island = { x: island.x, z: island.z, radius };
		}
		lake.maxDepth = Array.from(lake.cells).reduce((max, k) => Math.max(max, lake.level - h[k]), 0);
	}
	return fans;
}
