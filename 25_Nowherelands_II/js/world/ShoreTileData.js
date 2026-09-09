import { shoreDistance, riverReach } from './ShoreMapData.js';

export function fillShoreRows(next, hm, res, size, ox, oz, start, end) {
	for (let j = start; j < end; j++) {
		const z = oz + (j / (res - 1) - .5) * size;
		for (let i = 0; i < res; i++) {
			const x = ox + (i / (res - 1) - .5) * size, h = hm.sample(x, z), k = (j * res + i) * 4;
			const water = hm._water;
			next[k] = h; next[k+1] = water; next[k+2] = h < water - .02 ? 1 : 0;
			next[k+3] = hm._riverDist < hm._riverWidth * .5 + 1 ? 1 : 0;
		}
	}
}
export function shoreTileData(hm, { res, size, ox, oz }) {
	const data = new Float32Array(res * res * 4);
	fillShoreRows(data, hm, res, size, ox, oz, 0, res);
	shoreDistance(data, res, size / (res - 1)); riverReach(data, res, size / (res - 1));
	return { data };
}
