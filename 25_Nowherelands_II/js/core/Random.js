// Seeded PRNG (mulberry32) and a 2D simplex noise built on it.

export function hashString(str) {
	let h = 1779033703 ^ str.length;
	for (let i = 0; i < str.length; i++) {
		h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
		h = (h << 13) | (h >>> 19);
	}
	h = Math.imul(h ^ (h >>> 16), 2246822507);
	h = Math.imul(h ^ (h >>> 13), 3266489909);
	return (h ^= h >>> 16) >>> 0;
}

export class Random {
	constructor(seed) {
		this.state = (typeof seed === 'string' ? hashString(seed) : (seed >>> 0)) || 0x9e3779b9;
	}
	next() {
		let t = (this.state += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}
	range(min, max) { return min + this.next() * (max - min); }
	int(min, max) { return Math.floor(this.range(min, max + 1)); }
	pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
	chance(p) { return this.next() < p; }
}

const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export class Simplex2D {
	constructor(random) {
		const p = new Uint8Array(256);
		for (let i = 0; i < 256; i++) p[i] = i;
		for (let i = 255; i > 0; i--) {
			const j = Math.floor(random.next() * (i + 1));
			const t = p[i]; p[i] = p[j]; p[j] = t;
		}
		this.perm = new Uint8Array(512);
		for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
	}

	noise(x, y) {
		const perm = this.perm;
		const s = (x + y) * F2;
		const i = Math.floor(x + s), j = Math.floor(y + s);
		const t = (i + j) * G2;
		const x0 = x - (i - t), y0 = y - (j - t);
		const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
		const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
		const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
		const ii = i & 255, jj = j & 255;
		let n = 0;
		let t0 = 0.5 - x0 * x0 - y0 * y0;
		if (t0 > 0) { const g = GRAD[perm[ii + perm[jj]] & 7]; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
		let t1 = 0.5 - x1 * x1 - y1 * y1;
		if (t1 > 0) { const g = GRAD[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
		let t2 = 0.5 - x2 * x2 - y2 * y2;
		if (t2 > 0) { const g = GRAD[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
		return 70 * n;
	}

	fbm(x, y, octaves = 5, lacunarity = 2, gain = 0.5) {
		let sum = 0, amp = 1, freq = 1, norm = 0;
		for (let o = 0; o < octaves; o++) {
			sum += this.noise(x * freq, y * freq) * amp;
			norm += amp;
			amp *= gain;
			freq *= lacunarity;
		}
		return sum / norm;
	}
}
