import * as THREE from 'three';

// A coarse height texture of the terrain around the player so the water shader
// knows how deep it is: foam, shallows and caustics all come from this.
const RES = 256, SIZE = 2048, ROWS_PER_FRAME = 12;

export class ShoreMap {
	constructor(heightmap) {
		this.heightmap = heightmap;
		this.data = new Uint16Array(RES * RES);
		this.texture = new THREE.DataTexture(this.data, RES, RES, THREE.RedFormat, THREE.HalfFloatType);
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
			float terrainHeightAt(vec2 p) {
				vec2 uv = (p - uShoreOrigin) / uShoreSize + 0.5;
				return texture2D(uShoreMap, uv).r;
			}`;
	}

	update(playerPos) {
		const snap = SIZE / 4;
		const ox = Math.round(playerPos.x / snap) * snap, oz = Math.round(playerPos.z / snap) * snap;
		if ((ox !== this.origin.x || oz !== this.origin.y) && !this.pendingOrigin) {
			this.pendingOrigin = new THREE.Vector2(ox, oz);
			this.next = new Uint16Array(RES * RES);
			this.row = 0;
		}
		if (this.pendingOrigin) {
			const o = this.pendingOrigin, hm = this.heightmap;
			const end = Math.min(RES, this.row + ROWS_PER_FRAME);
			for (let j = this.row; j < end; j++) {
				const z = o.y + (j / (RES - 1) - 0.5) * SIZE;
				for (let i = 0; i < RES; i++) {
					const x = o.x + (i / (RES - 1) - 0.5) * SIZE;
					this.next[j * RES + i] = THREE.DataUtils.toHalfFloat(hm.height(x, z));
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
}
