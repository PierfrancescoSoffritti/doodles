import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { config } from '../core/Config.js';
import { createSeaUniforms, seaVertexShader, seaFragmentShader, updateSeaUniforms } from './SeaShader.js';

// The sea: a clipmap of concentric square rings around the player, 2 m cells at the feet doubling
// to 64 m eight kilometres out, displaced by the waves in the vertex shader, and beyond it a flat
// ring to the horizon that is also the mirror rendering the reflection every ring reads.
// Everything snaps to the coarsest cell so the vertices never swim as the player walks.
const LEVELS = 6, CELL0 = 2, CELLS = 128;
const SNAP = CELL0 << (LEVELS - 1);
const RIM = CELL0 * CELLS << (LEVELS - 1);    // 8192 m: where the clipmap ends
const FAR = 65536;

export class Water {
	constructor(scene, shared, waterLevel) {
		const windAngle = ((config.seedHash % 1000) / 1000) * Math.PI * 2;
		const uniforms = createSeaUniforms(shared, waterLevel, windAngle);
		this.uniforms = uniforms;
		const vertexShader = seaVertexShader(shared), fragmentShader = seaFragmentShader(shared);

		// the far ring and mirror
		uniforms.color = { value: new THREE.Color('#ffffff') };   // Reflector expects one
		const farUniforms = { ...uniforms, uDisplace: { value: 0 } };
		const shader = { name: 'NowhereSea', uniforms: farUniforms, vertexShader, fragmentShader };
		this.far = new Reflector(ringGeometry(RIM / 2, FAR / (RIM / 2), 2, true), { textureWidth: 768, textureHeight: 768, clipBias: 0.02, shader, multisample: 0 });
		// Reflector clones its uniforms; share the live ones and take its texture and matrix
		for (const k of Object.keys(uniforms)) if (k !== 'uDisplace' && k !== 'tDiffuse') this.far.material.uniforms[k] = uniforms[k];
		uniforms.tDiffuse = this.far.material.uniforms.tDiffuse;
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
			const mesh = new THREE.Mesh(ringGeometry(cell, CELLS, L === 0 ? 0 : CELLS / 2, false), this.material);
			mesh.frustumCulled = false;
			mesh.renderOrder = 0;
			mesh.position.y = waterLevel;
			scene.add(mesh);
			this.levels.push(mesh);
		}
		this.far.position.y = waterLevel;

		// the rings must not appear in their own reflection; the world-to-mirror matrix is read off
		// the reflector once it has rendered
		const orig = this.far.onBeforeRender;
		const far = this.far, levels = this.levels, inv = new THREE.Matrix4();
		this.far.onBeforeRender = function (renderer, scene, camera, ...rest) {
			for (const m of levels) m.visible = false;
			orig.call(far, renderer, scene, camera, ...rest);
			for (const m of levels) m.visible = true;
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
// XZ plane (or XY for the reflector, whose mirror normal is its local Z). The odd vertices on the
// outer rim carry the offset to their neighbours along the edge (aMorph) so the vertex shader can
// place them on the coarser ring's edge.
function ringGeometry(cell, cells, hole, xy) {
	const n = cells + 1, half = cells * cell / 2;
	const pos = new Float32Array(n * n * 3), morph = new Float32Array(n * n * 2);
	for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
		const k = j * n + i, x = i * cell - half, z = j * cell - half;
		if (xy) { pos[k * 3] = x; pos[k * 3 + 1] = -z; pos[k * 3 + 2] = 0; }
		else { pos[k * 3] = x; pos[k * 3 + 1] = 0; pos[k * 3 + 2] = z; }
		const onX = i === 0 || i === cells, onZ = j === 0 || j === cells;
		if (onX && (j & 1)) { morph[k * 2 + 1] = cell; }
		else if (onZ && (i & 1)) { morph[k * 2] = cell; }
	}
	const idx = [];
	const h0 = (cells - hole) / 2, h1 = h0 + hole;
	for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
		if (hole && i >= h0 && i < h1 && j >= h0 && j < h1) continue;
		const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
		// alternate the diagonal so the facets are not all cut the same way
		const flip = ((i * 7 + j * 13 + i * j) & 3) < 2;
		// counter-clockwise seen from the water's top (the same in both frames)
		if (flip) idx.push(a, d, b, a, c, d); else idx.push(a, c, b, b, c, d);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	g.setAttribute('aMorph', new THREE.BufferAttribute(morph, 2));
	g.setIndex(idx);
	return g;
}
