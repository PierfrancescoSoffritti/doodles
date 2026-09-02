import * as THREE from 'three';

// A coarse two-channel texture of the terrain around the player: R = ground height, G = the local
// water surface (sea, lake or river). Water shaders read depth from it; the terrain reads its
// wet shoreline band from it.
const RES = 384, SIZE = 3072, ROWS_PER_FRAME = 6;

export class ShoreMap {
	constructor(heightmap) {
		this.heightmap = heightmap;
		// float32: half floats only resolve 1 m above 1000 m, which would fake shallows in mountain lakes
		this.data = new Float32Array(RES * RES * 2);
		this.texture = new THREE.DataTexture(this.data, RES, RES, THREE.RGFormat, THREE.FloatType);
		this.texture.magFilter = THREE.LinearFilter;
		this.texture.minFilter = THREE.LinearFilter;
		this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping;
		this.origin = new THREE.Vector2(NaN, NaN);
		this.pendingOrigin = null;
		this.row = RES;
		this.uniforms = {
			uShoreMap: { value: this.texture },
			uShoreOrigin: { value: new THREE.Vector2() },
			uShoreSize: { value: SIZE },
		};
		this.glsl = /* glsl */`
			uniform sampler2D uShoreMap;
			uniform vec2 uShoreOrigin;
			uniform float uShoreSize;
			vec2 shoreSample(vec2 p) {
				vec2 uv = (p - uShoreOrigin) / uShoreSize + 0.5;
				if (any(lessThan(uv, vec2(0.003))) || any(greaterThan(uv, vec2(0.997)))) return vec2(-1000.0, -1000.0);
				return texture2D(uShoreMap, uv).rg;
			}
			float terrainHeightAt(vec2 p) { return shoreSample(p).r; }
			float waterLevelAt(vec2 p) { return shoreSample(p).g; }`;
	}

	// Fill synchronously (used once at start so the first frame has shores).
	prime(playerPos) {
		this.update(playerPos);
		while (this.pendingOrigin) this.fillRows(RES);
	}

	update(playerPos) {
		const snap = SIZE / 4;
		const ox = Math.round(playerPos.x / snap) * snap, oz = Math.round(playerPos.z / snap) * snap;
		if ((ox !== this.origin.x || oz !== this.origin.y) && !this.pendingOrigin) {
			this.pendingOrigin = new THREE.Vector2(ox, oz);
			this.next = new Float32Array(RES * RES * 2);
			this.row = 0;
		}
		if (this.pendingOrigin) this.fillRows(ROWS_PER_FRAME);
	}

	fillRows(count) {
		const o = this.pendingOrigin, hm = this.heightmap;
		const end = Math.min(RES, this.row + count);
		for (let j = this.row; j < end; j++) {
			const z = o.y + (j / (RES - 1) - 0.5) * SIZE;
			for (let i = 0; i < RES; i++) {
				const x = o.x + (i / (RES - 1) - 0.5) * SIZE;
				const h = hm.sample(x, z);
				const k = (j * RES + i) * 2;
				this.next[k] = h;
				this.next[k + 1] = hm._water;
			}
		}
		this.row = end;
		if (this.row >= RES) {
			this.data.set(this.next);
			this.texture.needsUpdate = true;
			this.origin.copy(o);
			this.uniforms.uShoreOrigin.value.copy(o);
			this.pendingOrigin = null;
		}
	}
}
