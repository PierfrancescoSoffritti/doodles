import { smoothstep, clamp } from '../../core/Utils.js';
import { RIVER_STRIDE, RV } from './Rivers.js';

// Where things can grow. One pass over the baked grid turns the landscape into four bytes a cell:
//   forest  tree suitability: soil, water, altitude and two scales of noise, sharpened into stands
//   wet     wetness: the topographic wetness index (catchment over slope) plus a riparian halo
//           around rivers and lakes that only reaches ground close to the water's own level
//   coast   wind exposure near the sea (trees stunt and lean inland)
//   alt     altitude factor: 1 in the lowland, 0 above a ragged, aspect-dependent tree line
// Vegetation samples it for placement and size, the terrain shader tints the far slopes with it,
// so what the near chunks fill with trees is what the far hills already show.

const COLD = [0.0, -1.0];   // slopes facing this way are the shaded side: the tree line sits lower there

// Two-pass chamfer distance transform from the marked cells, in cells, carrying the source cell
// along so a point knows the height of the water nearest it.
function chamfer(mark, N, dist, src) {
	const M = N * N;
	for (let k = 0; k < M; k++) { dist[k] = mark[k] ? 0 : 1e9; src[k] = mark[k] ? k : -1; }
	const relax = (k, n, w) => { const d = dist[n] + w; if (d < dist[k]) { dist[k] = d; src[k] = src[n]; } };
	for (let j = 1; j < N; j++) for (let i = 0; i < N; i++) {
		const k = j * N + i;
		relax(k, k - N, 1);
		if (i > 0) { relax(k, k - 1, 1); relax(k, k - N - 1, Math.SQRT2); }
		if (i < N - 1) relax(k, k - N + 1, Math.SQRT2);
	}
	for (let j = N - 2; j >= 0; j--) for (let i = N - 1; i >= 0; i--) {
		const k = j * N + i;
		relax(k, k + N, 1);
		if (i < N - 1) { relax(k, k + 1, 1); relax(k, k + N + 1, Math.SQRT2); }
		if (i > 0) relax(k, k + N - 1, Math.SQRT2);
	}
}

export function computeHabitat({ h, area, lakeId, lakeLevel, hard, rivers, N, cell, size, waterLevel }, noise) {
	const M = N * N;
	const hab = new Uint8Array(M * 4);

	// water cells: the sea, the lakes, the rivers rasterised from their shaped centrelines
	const sea = new Uint8Array(M), water = new Uint8Array(M), waterH = new Float32Array(M);
	for (let k = 0; k < M; k++) {
		if (h[k] < waterLevel) { sea[k] = 1; water[k] = 1; waterH[k] = waterLevel; }
		else if (lakeId[k] >= 0) { water[k] = 1; waterH[k] = lakeLevel[k]; }
	}
	const half = size / 2;
	for (const r of rivers) {
		const d = r.data;
		for (let i = 0; i < r.count; i++) {
			const o = i * RIVER_STRIDE;
			const gx = (d[o + RV.X] + half) / cell, gz = (d[o + RV.Z] + half) / cell;
			const rad = Math.max(0, Math.ceil(d[o + RV.W] * 0.5 / cell) - 0.5);
			const ci = Math.round(gx), cj = Math.round(gz);
			for (let jj = Math.max(0, Math.ceil(cj - rad)); jj <= Math.min(N - 1, Math.floor(cj + rad)); jj++)
				for (let ii = Math.max(0, Math.ceil(ci - rad)); ii <= Math.min(N - 1, Math.floor(ci + rad)); ii++) {
					if ((ii - gx) * (ii - gx) + (jj - gz) * (jj - gz) > (rad + 0.5) * (rad + 0.5)) continue;
					const k = jj * N + ii;
					if (!water[k]) { water[k] = 1; waterH[k] = d[o + RV.WL]; }
				}
		}
	}
	const dist = new Float32Array(M), src = new Int32Array(M);
	chamfer(sea, N, dist, src);
	const seaDist = dist;
	const wDist = new Float32Array(M), wSrc = new Int32Array(M);
	chamfer(water, N, wDist, wSrc);

	const cellArea = cell * cell;
	for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
		const k = j * N + i;
		const o = k * 4;
		const hh = h[k];
		if (water[k] || hh < waterLevel + 0.5) { hab[o] = 0; hab[o + 1] = water[k] ? 255 : 200; hab[o + 2] = 255; hab[o + 3] = 255; continue; }
		const i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, N - 1), j0 = Math.max(j - 1, 0), j1 = Math.min(j + 1, N - 1);
		const gx = (h[j * N + i1] - h[j * N + i0]) / ((i1 - i0) * cell), gz = (h[j1 * N + i] - h[j0 * N + i]) / ((j1 - j0) * cell);
		const slope = Math.hypot(gx, gz);
		const x = i * cell - half, z = j * cell - half;

		// wetness: specific catchment area over slope, then the floodplain halo
		const twi = Math.log((area[k] * cellArea / cell) / Math.max(slope, 0.006));
		let wet = smoothstep(5.0, 10.5, twi);
		const wd = wDist[k] * cell, above = hh - waterH[wSrc[k]];
		const riparian = (1 - smoothstep(25, 110, wd)) * (1 - smoothstep(3, 22, above));
		wet = Math.max(wet, riparian);
		wet *= 1 - 0.35 * smoothstep(0.35, 0.9, slope);

		// thin soil on hard rock and on the steep faces
		const soil = (1 - 0.6 * clamp(hard[k], 0, 1)) * (1 - smoothstep(0.5, 1.05, slope));

		// exposure to the sea wind, decaying inland
		const coast = 1 - smoothstep(0, 420, seaDist[k] * cell);

		// the tree line: lower on the shaded side and near the coast, ragged with noise
		const gl = slope > 1e-4 ? 1 / slope : 0;
		const shade = (gx * COLD[0] + gz * COLD[1]) * gl * smoothstep(0.05, 0.3, slope);   // +1 facing the cold way
		const treeline = 660 - 90 * shade - 110 * coast + 150 * noise.forest.noise(x / 1700 + 31.7, z / 1700 - 12.3);
		const alt = 1 - smoothstep(treeline - 240, treeline, hh - waterLevel);

		// stands: a broad biome field, a fine stand field, water and shelter pull trees in, wind and altitude push them out
		const biome = smoothstep(-0.15, 0.5, noise.forest.fbm(x / 900, z / 900, 3));
		const stand = noise.stand.noise(x / 140, z / 140) * 0.5 + 0.5;
		const score = 0.45 * biome + 0.22 * stand + 0.5 * wet + 0.08 - 0.4 * coast * (1 - 0.5 * wet) - 0.15 * smoothstep(150, 600, hh - waterLevel);
		let forest = soil * alt * smoothstep(0.32, 0.72, score);
		// clearings: openings a few hundred metres across cut out of the woods, with sharp edges
		forest *= 1 - smoothstep(0.28, 0.42, noise.clearing.noise(x / 520 + 3.3, z / 520 - 7.1) + 0.35 * noise.clearing.noise(x / 170, z / 170));
		forest *= smoothstep(1.5, 5, hh - waterH[wSrc[k]]);   // nothing but reeds at the waterline
		forest *= 1 - 0.85 * smoothstep(0.95, 1.0, wet) * (1 - smoothstep(2.5, 6, above)) * (wd < 200 ? 1 : 0);   // marsh, not woods, on the wettest flats

		hab[o] = Math.round(clamp(forest, 0, 1) * 255);
		hab[o + 1] = Math.round(clamp(wet, 0, 1) * 255);
		hab[o + 2] = Math.round(clamp(coast, 0, 1) * 255);
		hab[o + 3] = Math.round(clamp(alt, 0, 1) * 255);
	}
	return hab;
}
