function smoothstep(a, b, x) { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); }

// Signed Euclidean distance to the shoreline, in place of the water mask in channel B.
// Felzenszwalb & Huttenlocher's 1D squared-distance transform, run over rows then columns,
// once for the sea and once for the land.
export function shoreDistance(data, res, texel) {
	const INF = 1e12;
	const sea = new Float64Array(res * res), land = new Float64Array(res * res);
	for (let k = 0; k < res * res; k++) { const s = data[k * 4 + 2] > 0.5; sea[k] = s ? INF : 0; land[k] = s ? 0 : INF; }
	edt2d(sea, res); edt2d(land, res);
	for (let k = 0; k < res * res; k++) {
		const s = data[k * 4 + 2] > 0.5;
		// distance from a sea texel to the nearest land texel, minus half a texel so the line sits between them
		const d = (Math.sqrt(s ? sea[k] : land[k]) - 0.5) * texel;
		data[k * 4 + 2] = s ? d : -d;
	}
}

// The river-mouth factor: 1 in a channel, falling to 0 forty metres from its edge.
export function riverReach(data, res, texel) {
	const INF = 1e12;
	const f = new Float64Array(res * res);
	for (let k = 0; k < res * res; k++) f[k] = data[k * 4 + 3] > 0.5 ? 0 : INF;
	edt2d(f, res);
	for (let k = 0; k < res * res; k++) data[k * 4 + 3] = 1 - smoothstep(0, 40 / texel, Math.sqrt(f[k]));
}

function edt2d(f, res) {
	const line = new Float64Array(res), out = new Float64Array(res);
	const v = new Int32Array(res), z = new Float64Array(res + 1);
	for (let j = 0; j < res; j++) {
		for (let i = 0; i < res; i++) line[i] = f[j * res + i];
		edt1d(line, out, res, v, z);
		for (let i = 0; i < res; i++) f[j * res + i] = out[i];
	}
	for (let i = 0; i < res; i++) {
		for (let j = 0; j < res; j++) line[j] = f[j * res + i];
		edt1d(line, out, res, v, z);
		for (let j = 0; j < res; j++) f[j * res + i] = out[j];
	}
}

function edt1d(f, d, n, v, z) {
	let k = 0;
	v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
	for (let q = 1; q < n; q++) {
		let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
		while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
		k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
	}
	k = 0;
	for (let q = 0; q < n; q++) {
		while (z[k + 1] < q) k++;
		const dq = q - v[k];
		d[q] = dq * dq + f[v[k]];
	}
}

// A stationary overview made from the generated world, not repeated heightmap sampling.
// Only used outside the detailed moving maps. Lakes retain their level and never get sea surf.
export function buildCoastOverview(world, seaLevel = 0) {
	const res = Math.min(512, world.res), data = new Float32Array(res * res * 4);
	for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
		const x = Math.round(i * (world.res - 1) / (res - 1));
		const z = Math.round(j * (world.res - 1) / (res - 1));
		const source = z * world.res + x, k = (j * res + i) * 4;
		const level = Math.max(seaLevel, world.lakeLevel[source]);
		data[k] = world.height[source];
		data[k + 1] = level;
		data[k + 2] = data[k] < level - 0.02 ? 1 : 0;
		data[k + 3] = level > seaLevel + 0.3 ? 1 : 0;
	}
	shoreDistance(data, res, world.size / (res - 1));
	return { data, res };
}
