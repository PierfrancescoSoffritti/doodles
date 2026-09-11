import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { config } from '../core/Config.js';
import { createSeaUniforms, seaVertexShader, seaFragmentShader, updateSeaUniforms } from './SeaShader.js?v=player-notes-13';

// The sea: a clipmap of concentric square rings around the player, 2 m cells at the feet doubling
// to 64 m four kilometres out, displaced by the waves in the vertex shader, and beyond it a flat
// ring to the horizon that is also the mirror rendering the reflection every ring reads.
// Everything snaps to the coarsest cell so the vertices never swim as the player walks.
const LEVELS = 6, CELL0 = 2, CELLS = 128;
const SNAP = CELL0 << (LEVELS - 1);
const RIM = (CELL0 * CELLS << (LEVELS - 1)) / 2;    // 4096 m: half-width of the waved square
const FAR = 65536;

export class Water {
	constructor(scene, shared, waterLevel) {
		const windAngle = ((config.seedHash % 1000) / 1000) * Math.PI * 2;
		const uniforms = createSeaUniforms(shared, waterLevel, windAngle);
		// The player can be half a snap cell away from the mesh centre. A fade
		// measured from the player stays continuous across mesh snaps and still
		// finishes before every side of the waved square.
		uniforms.uSeaExtent.value = RIM - SNAP / 2;
		this.uniforms = uniforms;
		const vertexShader = seaVertexShader(shared), fragmentShader = seaFragmentShader(shared);

		// the far ring and mirror
		uniforms.color = { value: new THREE.Color('#ffffff') };   // Reflector expects one
		const farUniforms = { ...uniforms, uDisplace: { value: 0 } };
		const shader = { name: 'NowhereSea', uniforms: farUniforms, vertexShader, fragmentShader };
		this.far = new Reflector(ringGeometry(RIM, FAR / RIM, 2, true), { textureWidth: 768, textureHeight: 768, clipBias: 0.02, shader, multisample: 0 });
		// Reflector clones its uniforms; share the live ones and take its texture and matrix
		for (const k of Object.keys(uniforms)) if (k !== 'uDisplace' && k !== 'tDiffuse' && k !== 'textureMatrix') this.far.material.uniforms[k] = uniforms[k];
		// Reflector updates its private matrix object in place. Replacing that
		// uniform with our initial identity matrix disconnects the projection,
		// making most of the sea sample one clamped corner of the mirror image.
		uniforms.textureMatrix = this.far.material.uniforms.textureMatrix;
		uniforms.tDiffuse = this.far.material.uniforms.tDiffuse;
		// the rivers ride the waves and take the sea's look at their mouths
		shared.sea = { uWaves: uniforms.uWaves, uWaves2: uniforms.uWaves2, uSwell: uniforms.uSwell, tDiffuse: uniforms.tDiffuse, uReflMatrix: uniforms.uReflMatrix };
		this.far.material.transparent = true;
		this.far.rotation.x = -Math.PI / 2;
		this.far.frustumCulled = false;
		this.far.renderOrder = -1;
		scene.add(this.far);

		// the waved rings
		this.material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true });
		this.levels = [];
		for (let L = 0; L < LEVELS; L++) {
			const cell = CELL0 << L;
			// each ring's hole is one cell wider than the finer ring, which fills the gap with its stitch strip
			const mesh = new THREE.Mesh(ringGeometry(cell, CELLS, L === 0 ? 0 : CELLS / 2 + 2, false, L < LEVELS - 1), this.material);
			mesh.frustumCulled = false;
			mesh.renderOrder = 0;
			mesh.position.y = waterLevel;
			scene.add(mesh);
			this.levels.push(mesh);
		}
		this.far.position.y = waterLevel;

		// the rings must not appear in their own reflection, nor may anything that reads the mirror
		// (the rivers do at their mouths) be drawn into it; the world-to-mirror matrix is read off the
		// reflector once it has rendered
		shared.mirrorHide = new Set(this.levels);
		const orig = this.far.onBeforeRender;
		const far = this.far, inv = new THREE.Matrix4();
		const capturePosition = new THREE.Vector3(), captureRotation = new THREE.Quaternion();
		let capturedAt = -Infinity;
		this.reflectionStats = { captures: 0, reused: 0 };
		const stats = this.reflectionStats;
		this.far.onBeforeRender = function (renderer, scene, camera, ...rest) {
			// Other reflectors and the environment probe reuse the previous texture.
			if (camera !== shared.camera || camera.position.y < far.position.y) return;
			const now = performance.now(), distance = camera.position.distanceTo(capturePosition);
			const angle = camera.quaternion.angleTo(captureRotation);
			const interval = distance > .1 || angle > .002 ? 1000 / 30 : 1000 / 15;
			if (now - capturedAt < interval - 1 && distance < 6 && angle < .12) { stats.reused++; return; }
			const hidden = Array.from(shared.mirrorHide, m => [m, m.visible]);
			try {
				for (const [m] of hidden) m.visible = false;
				orig.call(far, renderer, scene, camera, ...rest);
			} finally { for (const [m, visible] of hidden) m.visible = visible; }
			capturedAt = now; capturePosition.copy(camera.position); captureRotation.copy(camera.quaternion); stats.captures++;
			inv.copy(far.matrixWorld).invert();
			uniforms.uReflMatrix.value.copy(far.material.uniforms.textureMatrix.value).multiply(inv);
		};
		this.visible = true;
	}

	setVisible(v) {
		this.visible = v;
		this.far.visible = v;
		for (const m of this.levels) m.visible = v;
	}

	update(time, playerPos, shared) {
		const x = Math.round(playerPos.x / SNAP) * SNAP, z = Math.round(playerPos.z / SNAP) * SNAP;
		for (const m of this.levels) { m.position.x = x; m.position.z = z; }
		this.far.position.x = x; this.far.position.z = z;
		updateSeaUniforms(this.uniforms, time, playerPos, shared);
	}
}

// A square grid of `cells` cells of size `cell`, with a hole of `hole` cells in the middle, on the
// XZ plane (or XY for the reflector, whose mirror normal is its local Z). With `stitch` the grid
// gains a strip one coarser cell wide around its rim whose outer vertices are spaced two cells
// apart, matching the next ring's hole edge vertex for vertex: no edge ends in the middle of
// another (a T-junction), which would leave a hairline of pinholes along the seam.
function ringGeometry(cell, cells, hole, xy, stitch) {
	const n = cells + 1, half = cells * cell / 2;
	const pos = [];
	const vert = (x, z) => { if (xy) pos.push(x, -z, 0); else pos.push(x, 0, z); return pos.length / 3 - 1; };
	// a triangle wound counter-clockwise seen from the water's top, whichever order it is given in
	const idx = [];
	const tri = (a, b, c) => {
		const ax = pos[a * 3], bx = pos[b * 3], cx = pos[c * 3];
		const az = xy ? -pos[a * 3 + 1] : pos[a * 3 + 2], bz = xy ? -pos[b * 3 + 1] : pos[b * 3 + 2], cz = xy ? -pos[c * 3 + 1] : pos[c * 3 + 2];
		const cross = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
		if (cross < 0) idx.push(a, b, c); else idx.push(a, c, b);
	};
	for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) vert(i * cell - half, j * cell - half);
	const h0 = (cells - hole) / 2, h1 = h0 + hole;
	for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
		if (hole && i >= h0 && i < h1 && j >= h0 && j < h1) continue;
		const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
		// alternate the diagonal so the facets are not all cut the same way
		if (((i * 7 + j * 13 + i * j) & 3) < 2) { tri(a, d, b); tri(a, c, d); } else { tri(a, c, b); tri(b, c, d); }
	}
	if (stitch) {
		const c2 = cell * 2, outer = half + c2, M = cells / 2 + 2;
		// each side: the rim's fine vertices F (existing) against a new coarse row C one coarse cell out
		const sides = [
			{ F: (i) => i, C: (k) => vert(-outer + k * c2, -outer) },                          // z = -half
			{ F: (i) => cells * n + i, C: (k) => vert(-outer + k * c2, outer) },               // z = +half
			{ F: (i) => i * n, C: (k) => vert(-outer, -outer + k * c2) },                      // x = -half
			{ F: (i) => i * n + cells, C: (k) => vert(outer, -outer + k * c2) },               // x = +half
		];
		for (const side of sides) {
			const C = []; for (let k = 0; k <= M; k++) C.push(side.C(k));
			tri(side.F(0), C[1], C[0]);
			tri(side.F(cells), C[M], C[M - 1]);
			for (let m = 0; m < cells / 2; m++) {
				const f0 = side.F(2 * m), f1 = side.F(2 * m + 1), f2 = side.F(2 * m + 2);
				tri(f0, f1, C[m + 1]); tri(f1, C[m + 2], C[m + 1]); tri(f1, f2, C[m + 2]);
			}
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setIndex(idx);
	return g;
}
