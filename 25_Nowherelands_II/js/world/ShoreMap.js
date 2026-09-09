import { fillShoreRows } from './ShoreTileData.js';
import * as THREE from 'three';
import { shoreDistance, riverReach, buildCoastOverview } from './ShoreMapData.js';

// Textures of the terrain around the player that the water and terrain shaders read:
//   R = ground height, G = the local water surface (sea, lake or river),
//   B = signed distance to the nearest shoreline in metres, positive in the water and negative on
//       land; sea, lakes and rivers all count as water, so a lake has a shore of its own and the
//       sea's swell dies away of itself in a river mouth as the shores close in,
//   A = how much a river owns the point: 1 in the channel, 0 some forty metres out. The sea's
//       breakers and the swash on the sand keep off a river's banks.
// Two moving tiers: a fine one a few hundred metres across for the breakers and the swash at the
// player's feet, and a coarse one three kilometres across. Both are refilled a few
// rows per frame as the player moves; a tier keeps showing its old map until the new one is done.
// A static overview of the generated island keeps distant coasts visible from mountain peaks.
const TIERS = [
	{ res: 256, size: 640, rows: 12 },    // 2.5 m per texel
	{ res: 384, size: 3072, rows: 6 },    // 8 m per texel
];
const OUTSIDE = 1000;

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
		fillShoreRows(next, hm, res, size, o.x, o.y, this.row, end);
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

export class ShoreMap {
	constructor(heightmap, surfaceWork = null) {
		this.surfaceWork = surfaceWork;
		this.heightmap = heightmap;
		this.tiers = TIERS.map((spec) => new Tier(spec, heightmap));
		const [near, far] = this.tiers;
		const overview = buildCoastOverview(heightmap.world, heightmap.waterLevel);
		this.coastTexture = new THREE.DataTexture(overview.data, overview.res, overview.res, THREE.RGBAFormat, THREE.FloatType);
		this.coastTexture.minFilter = this.coastTexture.magFilter = THREE.LinearFilter;
		this.coastTexture.needsUpdate = true;
		this.uniforms = {
			uCoastMap: { value: this.coastTexture },
			uCoastOrigin: { value: new THREE.Vector2(-heightmap.ox, -heightmap.oz) },
			uCoastSize: { value: heightmap.world.size },
			uCoastRes: { value: overview.res },
			uShoreNear: { value: near.texture },
			uShoreNearOrigin: { value: near.uOrigin },
			uShoreNearSize: { value: near.spec.size },
			uShoreFar: { value: far.texture },
			uShoreFarOrigin: { value: far.uOrigin },
			uShoreFarSize: { value: far.spec.size },
		};
		this.glsl = /* glsl */`
			uniform sampler2D uShoreNear, uShoreFar, uCoastMap;
			uniform vec2 uCoastOrigin;
			uniform float uCoastSize, uCoastRes;
			uniform vec2 uShoreNearOrigin, uShoreFarOrigin;
			uniform float uShoreNearSize, uShoreFarSize;
			// ground height, water level, signed distance to the sea shore, river-mouth factor
			vec4 shoreSample(vec2 p) {
				vec2 uv = (p - uShoreFarOrigin) / uShoreFarSize + 0.5;
				vec4 far = vec4(-1000.0, -1000.0, ${OUTSIDE.toFixed(1)}, 0.0);
				float farEdge = max(abs(uv.x - 0.5), abs(uv.y - 0.5));
				if (farEdge > 0.44) {
					vec2 cuv = (p - uCoastOrigin) / uCoastSize + 0.5;
					if (all(greaterThanEqual(cuv, vec2(0.0))) && all(lessThanEqual(cuv, vec2(1.0))))
						far = texture2D(uCoastMap, cuv * (1.0 - 1.0 / uCoastRes) + 0.5 / uCoastRes);
				}
				if (farEdge < 0.497) far = mix(texture2D(uShoreFar, uv), far, smoothstep(0.44, 0.497, farEdge));
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
		for (const [i, t] of this.tiers.entries()) {
			if (!this.surfaceWork?.ready || t.pendingOrigin) { t.update(playerPos); continue; }
			const snap = t.spec.size / 4, ox = Math.round(playerPos.x/snap)*snap, oz = Math.round(playerPos.z/snap)*snap;
			if (t.origin.x === ox && t.origin.y === oz) continue;
			this.surfaceWork.request(`shore:${i}`, { type: 'shore', ...t.spec, ox, oz }, -2 + i,
				({ data }) => {
					t.data.set(data); t.texture.needsUpdate = true; t.origin.set(ox, oz); t.uOrigin.copy(t.origin);
				});
		}
	}

	// Do not render precipitation against stale or uninitialized roof heights after a teleport.
	covers(x, z, radius = 125) {
		const tier = this.tiers[0];
		return Number.isFinite(tier.origin.x) && Math.max(Math.abs(x-tier.origin.x), Math.abs(z-tier.origin.y)) + radius < tier.spec.size * 0.44;
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
