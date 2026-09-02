import * as THREE from 'three';

// Textures of the terrain around the player that the water and terrain shaders read:
//   R = ground height, G = the local water surface (sea, lake or river),
//   B = signed distance to the nearest shoreline in metres, positive in the water and negative on
//       land; sea, lakes and rivers all count as water, so a lake has a shore of its own and the
//       sea's swell dies away of itself in a river mouth as the shores close in,
//   A = how much a river owns the point: 1 in the channel, 0 some forty metres out. The sea's
//       breakers and the swash on the sand keep off a river's banks.
// Two tiers: a fine one a few hundred metres across for the breakers and the swash at the
// player's feet, and a coarse one out to the horizon for the far coasts. Both are refilled a few
// rows per frame as the player moves; a tier keeps showing its old map until the new one is done.
const TIERS = [
	{ res: 256, size: 640, rows: 12 },    // 2.5 m per texel
	{ res: 384, size: 3072, rows: 6 },    // 8 m per texel
];
const OUTSIDE = 1000;

// the highest lake level among the grid cells within one cell of the point
function lakeLevelNear(hm, x, z) {
	const N = hm.N, ci = Math.round(hm.gx(x)), cj = Math.round(hm.gz(z));
	let best = -Infinity;
	for (let j = Math.max(cj - 1, 0); j <= Math.min(cj + 1, N - 1); j++) for (let i = Math.max(ci - 1, 0); i <= Math.min(ci + 1, N - 1); i++) {
		const l = hm.lakeLevel[j * N + i];
		if (l > best) best = l;
	}
	return best;
}

function smoothstep(a, b, x) { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); }

class Tier {
	constructor(spec, heightmap) {
		this.spec = spec;
		this.heightmap = heightmap;
		const n = spec.res * spec.res * 4;
		// float32: half floats only resolve 1 m above 1000 m, which would fake shallows in mountain lakes
		this.data = new Float32Array(n);
		this.texture = new THREE.DataTexture(this.data, spec.res, spec.res, THREE.RGBAFormat, THREE.FloatType);
		this.texture.magFilter = THREE.LinearFilter;
		this.texture.minFilter = THREE.LinearFilter;
		this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping;
		this.origin = new THREE.Vector2(NaN, NaN);
		this.uOrigin = new THREE.Vector2();
		this.pendingOrigin = null;
		this.row = spec.res;
		this.next = null;
	}

	update(playerPos) {
		const snap = this.spec.size / 4;
		const ox = Math.round(playerPos.x / snap) * snap, oz = Math.round(playerPos.z / snap) * snap;
		if ((ox !== this.origin.x || oz !== this.origin.y) && !this.pendingOrigin) {
			this.pendingOrigin = new THREE.Vector2(ox, oz);
			this.next = new Float32Array(this.data.length);
			this.row = 0;
		}
		if (this.pendingOrigin) this.fillRows(this.spec.rows);
	}

	fillRows(count) {
		const { res, size } = this.spec;
		const o = this.pendingOrigin, hm = this.heightmap, next = this.next;
		const end = Math.min(res, this.row + count);
		for (let j = this.row; j < end; j++) {
			const z = o.y + (j / (res - 1) - 0.5) * size;
			for (let i = 0; i < res; i++) {
				const x = o.x + (i / (res - 1) - 0.5) * size;
				const h = hm.sample(x, z);
				const k = (j * res + i) * 4;
				// a lake's sheet reaches a cell past its own grid cells over any ground below its level
				// (InlandWater dilates the mask by one cell), so the water here is the highest lake
				// within a cell if the ground lies under it
				let water = hm._water;
				const lake = lakeLevelNear(hm, x, z);
				if (lake > water && h < lake - 0.02) water = lake;
				next[k] = h;
				next[k + 1] = water;
				next[k + 2] = h < water - 0.02 ? 1 : 0;   // under water of any kind
				next[k + 3] = hm._riverDist < hm._riverWidth * 0.5 + 1 ? 1 : 0;   // in a channel; dilated below
			}
		}
		this.row = end;
		if (this.row >= res) {
			shoreDistance(next, res, size / (res - 1));
			riverReach(next, res, size / (res - 1));
			this.data.set(next);
			this.texture.needsUpdate = true;
			this.origin.copy(o);
			this.uOrigin.copy(o);
			this.pendingOrigin = null;
			this.next = null;
		}
	}
}

// Signed Euclidean distance to the shoreline, in place of the water mask in channel B.
// Felzenszwalb & Huttenlocher's 1D squared-distance transform, run over rows then columns,
// once for the sea and once for the land.
function shoreDistance(data, res, texel) {
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
function riverReach(data, res, texel) {
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

export class ShoreMap {
	constructor(heightmap) {
		this.heightmap = heightmap;
		this.tiers = TIERS.map((spec) => new Tier(spec, heightmap));
		const [near, far] = this.tiers;
		this.uniforms = {
			uShoreNear: { value: near.texture },
			uShoreNearOrigin: { value: near.uOrigin },
			uShoreNearSize: { value: near.spec.size },
			uShoreFar: { value: far.texture },
			uShoreFarOrigin: { value: far.uOrigin },
			uShoreFarSize: { value: far.spec.size },
		};
		this.glsl = /* glsl */`
			uniform sampler2D uShoreNear, uShoreFar;
			uniform vec2 uShoreNearOrigin, uShoreFarOrigin;
			uniform float uShoreNearSize, uShoreFarSize;
			// ground height, water level, signed distance to the sea shore, river-mouth factor
			vec4 shoreSample(vec2 p) {
				vec2 uv = (p - uShoreFarOrigin) / uShoreFarSize + 0.5;
				vec4 far = vec4(-1000.0, -1000.0, ${OUTSIDE.toFixed(1)}, 0.0);
				if (all(greaterThan(uv, vec2(0.003))) && all(lessThan(uv, vec2(0.997)))) far = texture2D(uShoreFar, uv);
				vec2 nuv = (p - uShoreNearOrigin) / uShoreNearSize + 0.5;
				float edge = max(abs(nuv.x - 0.5), abs(nuv.y - 0.5));
				if (edge > 0.49) return far;
				vec4 near = texture2D(uShoreNear, nuv);
				// the last few texels of the fine map blend into the coarse one so its edge never shows
				return mix(near, far, smoothstep(0.44, 0.49, edge));
			}
			float terrainHeightAt(vec2 p) { return shoreSample(p).r; }
			float waterLevelAt(vec2 p) { return shoreSample(p).g; }
			float shoreDistAt(vec2 p) { return shoreSample(p).b; }
			float riverMouthAt(vec2 p) { return shoreSample(p).a; }`;
	}

	// Fill synchronously (used once at start so the first frame has shores).
	prime(playerPos) {
		for (const t of this.tiers) { t.update(playerPos); while (t.pendingOrigin) t.fillRows(t.spec.res); }
	}

	update(playerPos) {
		for (const t of this.tiers) t.update(playerPos);
	}

	// Signed distance to the nearest shore at a point, from the finest map that covers it (CPU side).
	shoreDist(x, z) {
		for (const t of this.tiers) {
			if (Number.isNaN(t.origin.x)) continue;
			const { res, size } = t.spec;
			const u = (x - t.origin.x) / size + 0.5, v = (z - t.origin.y) / size + 0.5;
			if (u < 0.01 || u > 0.99 || v < 0.01 || v > 0.99) continue;
			const i = Math.round(u * (res - 1)), j = Math.round(v * (res - 1));
			return t.data[(j * res + i) * 4 + 2];
		}
		return OUTSIDE;
	}
}
