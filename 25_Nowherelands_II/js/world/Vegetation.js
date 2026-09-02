import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Random } from '../core/Random.js';
import { config } from '../core/Config.js';
import { hslGlsl, createRockMaterial } from './TerrainMaterial.js';

const UNBORN = 1e9;
const TREE_HEIGHT = 60;

// Plant kinds. `preborn` is the share that exists as soon as the chunk does (visible from afar);
// the rest grows out of the ground when the player comes within `reveal` units.
const KINDS = {
	tree:    { reveal: 460, preborn: 0.45, dur: 2.4, back: 0.15 },
	crystal: { reveal: 420, preborn: 0.7, dur: 2.0, back: 0.5 },
	blade:   { reveal: 0, preborn: 1.0, dur: 1.4, back: 1.0 },      // the distant grass: always there, hidden near the player
	tuft:    { reveal: 140, preborn: 0.35, dur: 1.5, back: 1.0 },   // wireframe grass everywhere: part there from the start, the rest rises as you approach
	reed:    { reveal: 170, preborn: 0.3, dur: 1.8, back: 0.8 },
	sprout:  { reveal: 160, preborn: 0.1, dur: 2.2, back: 1.0 },
	rock:    { reveal: 0, preborn: 1.0, dur: 0.6, back: 0.0 },      // boulders are simply there
};

// ---------- geometry builders ----------
function buildBareTree(rnd) {
	const parts = [];
	const up = new THREE.Vector3(0, 1, 0);
	function branch(origin, dir, length, radius, depth) {
		const geom = new THREE.CylinderGeometry(radius * 0.55, radius, length, 5, 1, true);
		geom.translate(0, length / 2, 0);
		geom.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()));
		geom.translate(origin.x, origin.y, origin.z);
		parts.push(geom);
		if (depth === 0) return;
		const end = origin.clone().addScaledVector(dir, length);
		const n = depth > 2 ? rnd.int(2, 3) : rnd.int(2, 4);
		for (let i = 0; i < n; i++) {
			const axis = new THREE.Vector3(rnd.range(-1, 1), rnd.range(-0.2, 0.6), rnd.range(-1, 1)).normalize();
			const nd = dir.clone().applyAxisAngle(axis, rnd.range(0.45, 0.95)).lerp(up, 0.15).normalize();
			branch(end, nd, length * rnd.range(0.55, 0.75), radius * 0.6, depth - 1);
		}
	}
	branch(new THREE.Vector3(0, -2, 0), new THREE.Vector3(rnd.range(-0.1, 0.1), 1, rnd.range(-0.1, 0.1)).normalize(), rnd.range(18, 26), rnd.range(0.9, 1.4), 4);
	const merged = mergeGeometries(parts, false);
	merged.computeVertexNormals();
	return merged;
}

// tall and slender: a long trunk that only branches near the top
function buildTallTree(rnd) {
	const parts = [];
	const up = new THREE.Vector3(0, 1, 0);
	function branch(origin, dir, length, radius, depth) {
		const geom = new THREE.CylinderGeometry(radius * 0.6, radius, length, 5, 1, true);
		geom.translate(0, length / 2, 0);
		geom.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()));
		geom.translate(origin.x, origin.y, origin.z);
		parts.push(geom);
		if (depth === 0) return;
		const end = origin.clone().addScaledVector(dir, length);
		const n = rnd.int(2, 3);
		for (let i = 0; i < n; i++) {
			const axis = new THREE.Vector3(rnd.range(-1, 1), 0, rnd.range(-1, 1)).normalize();
			const nd = dir.clone().applyAxisAngle(axis, rnd.range(0.3, 0.7)).lerp(up, 0.3).normalize();
			branch(end, nd, length * rnd.range(0.35, 0.5), radius * 0.55, depth - 1);
		}
	}
	const trunkH = rnd.range(38, 52);
	branch(new THREE.Vector3(0, -2, 0), new THREE.Vector3(rnd.range(-0.05, 0.05), 1, rnd.range(-0.05, 0.05)).normalize(), trunkH, rnd.range(0.7, 1.1), 3);
	const merged = mergeGeometries(parts, false);
	merged.computeVertexNormals();
	return merged;
}

function buildBlade() {
	const segs = 3, w = 0.35;
	const pos = [], col = [], idx = [];
	for (let i = 0; i <= segs; i++) {
		const t = i / segs, hw = w * (1 - t * 0.85);
		pos.push(-hw, t, 0, hw, t, 0);
		col.push(t, t, t, t, t, t);
	}
	for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	g.setIndex(idx);
	return g;
}

// the old sprout: a glowing ball on a stem with four dark leaves
function buildSprout() {
	const stem = new THREE.CylinderGeometry(0.08, 0.18, 4, 4, 1);
	stem.translate(0, 2, 0);
	const ball = new THREE.IcosahedronGeometry(0.9, 1);
	ball.translate(0, 4.6, 0);
	const leaves = [];
	for (let k = 0; k < 4; k++) {
		const leaf = new THREE.BufferGeometry();
		leaf.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.3, 0, 1.6, 1.4, 0.9, 1.6, 1.4, -0.9, 3.4, 0.2, 0], 3));
		leaf.setIndex([0, 1, 2, 3, 2, 1]);
		leaf.rotateY(k * Math.PI / 2);
		leaves.push(leaf.toNonIndexed());
	}
	const paint = (g, r, gg, b) => { const n = g.attributes.position.count; const c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = gg; c[i * 3 + 2] = b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('normal'); g.deleteAttribute('uv'); return g; };
	const ni = (g) => (g.index ? g.toNonIndexed() : g);
	const parts = [paint(ni(stem), 0.1, 0.06, 0.2), paint(ni(ball), 2.2, 1.3, 2.4), ...leaves.map((l) => paint(l, 0.04, 0.22, 0.12))];
	return mergeGeometries(parts, false);
}

// a boulder: a jittered icosahedron, squashed a little, flat-shaded by the material
function buildBoulder(rnd) {
	const g = new THREE.IcosahedronGeometry(1, 1);   // already non-indexed
	const pos = g.attributes.position;
	const v = new THREE.Vector3();
	const seed = [rnd.range(0, 10), rnd.range(0, 10), rnd.range(0, 10)];
	for (let i = 0; i < pos.count; i++) {
		v.fromBufferAttribute(pos, i);
		const k = 0.72 + 0.28 * Math.abs(Math.sin(v.x * 3.1 + seed[0]) * Math.cos(v.y * 2.7 + seed[1]) + Math.sin(v.z * 3.7 + seed[2]) * 0.5);
		v.multiplyScalar(k);
		v.y *= 0.72;
		pos.setXYZ(i, v.x, v.y, v.z);
	}
	g.deleteAttribute('uv');
	g.computeVertexNormals();
	return g;
}

function hexPrism(r, h) {
	const g = new THREE.CylinderGeometry(r * 0.85, r, h, 6, 1);
	g.translate(0, h / 2, 0);
	return g;
}

function edgePositions(geometry, angle = 1) { return new THREE.EdgesGeometry(geometry, angle).attributes.position.array; }

// ---------- shaders ----------
const growthGlsl = /* glsl */`
	uniform float uTime, uWind, uHeightRef, uPulse, uDur, uBack, uNearFade;
	attribute float aBorn;
	float easeOutCubic(float t) { return 1.0 - pow(1.0 - t, 3.0); }
	float easeOutBack(float t) { float c1 = 1.70158, c3 = c1 + 1.0; float u = t - 1.0; return 1.0 + c3 * u * u * u + c1 * u * u; }
	float growT() { return clamp((uTime - aBorn) / uDur, 0.0, 1.0); }
	void applyGrowth(inout vec3 p, float swayStrength, vec3 ipos) {
		float hw = clamp(p.y / uHeightRef, 0.0, 1.0);
		hw *= hw;
		float ph = ipos.x * 0.05 + ipos.z * 0.07;
		float sway = sin(uTime * 0.8 + ph) * 0.6 + sin(uTime * 2.3 + ph * 1.7) * 0.25;
		p.x += sway * hw * uWind * swayStrength;
		p.z += cos(uTime * 0.6 + ph * 1.3) * 0.4 * hw * uWind * swayStrength;
		float t = growT();
		float ey = mix(easeOutCubic(t), easeOutBack(t), uBack);
		float exz = easeOutCubic(t);
		p.xz *= 0.55 + 0.45 * exz;
		p.y = p.y * ey - (1.0 - exz) * 2.5;
		float near = mix(1.0, smoothstep(1.5, 5.0, distance(ipos.xz, cameraPosition.xz)), uNearFade);
		p *= near;
	}`;

function instancedMaterial(base, uniforms, swayStrength, extraVertex = '', extraFragment = null) {
	base.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, uniforms);
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', '#include <common>\n' + growthGlsl)
			.replace('#include <begin_vertex>', `#include <begin_vertex>\nvec3 ipos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);\n${extraVertex}\napplyGrowth(transformed, ${swayStrength.toFixed(2)}, ipos);`);
		if (extraFragment) shader.fragmentShader = extraFragment(shader.fragmentShader);
	};
	return base;
}

export class Vegetation {
	constructor(scene, heightmap, shared) {
		this.scene = scene;
		this.heightmap = heightmap;
		this.shared = shared;
		this.chunks = new Map();
		this.radius = config.world.vegetationRadius;
		this.time = 0;
		this.centerX = 0;
		this.centerZ = 0;

		const rnd = new Random(config.seed + ':flora');
		this.bareTrees = [0, 1, 2, 3].map(() => buildBareTree(rnd));
		this.tallTrees = [0, 1, 2].map(() => buildTallTree(rnd));
		this.blade = buildBlade();
		this.sprout = buildSprout();
		this.crystalSolid = hexPrism(1, 1);
		this.crystalEdges = edgePositions(hexPrism(1, 1));
		this.tuftEdges = edgePositions(new THREE.CylinderGeometry(0.2, 0.45, 1, 2).translate(0, 0.5, 0));

		const U = (dur, back, heightRef, nearFade = 1) => ({ uTime: { value: 0 }, uWind: { value: 1 }, uPulse: { value: 0 }, uHeightRef: { value: heightRef }, uDur: { value: dur }, uBack: { value: back }, uNearFade: { value: nearFade } });
		this.uniformSets = [];
		const mk = (kind, heightRef, nearFade) => { const u = U(KINDS[kind].dur, KINDS[kind].back, heightRef, nearFade); this.uniformSets.push(u); return u; };
		this.boulders = [0, 1, 2, 3].map(() => buildBoulder(rnd));
		this.rockMaterial = createRockMaterial(shared, shared.terrainUniforms);

		this.treeMaterial = instancedMaterial(new THREE.MeshStandardMaterial({ color: '#0a0716', roughness: 0.95, metalness: 0.05, flatShading: true, side: THREE.DoubleSide }), mk('tree', TREE_HEIGHT), 2.5);
		this.crystalMaterial = instancedMaterial(new THREE.MeshBasicMaterial({ color: '#05030c' }), mk('crystal', 1), 0, 'transformed.y *= 1.0 + uPulse * 0.25;');
		this.bladeMaterial = instancedMaterial(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true }), mk('blade', 1), 0.35,
			'float keep = mix(1.0, 0.3, smoothstep(50.0, 320.0, distance(ipos.xz, cameraPosition.xz)));\nvec2 hp = fract(ipos.xz * 0.0731) * 97.0;\nfloat rnd = fract(sin(dot(hp, vec2(12.9898, 78.233))) * 43758.5453);\ntransformed *= 1.0 - smoothstep(keep - 0.12, keep + 0.02, rnd);', (fs) => fs
			.replace('#include <common>', '#include <common>\nuniform float uHue, uPulse;\n' + hslGlsl)
			.replace('#include <color_fragment>', /* glsl */`
				float t = vColor.r;
				vec3 base = vec3(0.02, 0.015, 0.06);
				vec3 tip = hsl2rgb(vec3(uHue, 0.95, 0.55)) * (0.6 + 0.5 * uPulse);
				diffuseColor.rgb = mix(base, tip, pow(t, 1.8));`));
		this.bladeMaterial.onBeforeCompile = ((orig) => (shader) => { orig(shader); shader.uniforms.uHue = this.hueUniform; })(this.bladeMaterial.onBeforeCompile);
		this.hueUniform = { value: 0.8 };
		this.sproutMaterial = instancedMaterial(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true }), mk('sprout', 5), 0.4,
			'if (color.g > 0.15 && color.r < 0.1) transformed.y += sin(uTime * 1.1 + ipos.x) * 0.5 * transformed.x * 0.3;\nif (color.r > 1.0) transformed.y += sin(uTime * 0.9 + ipos.z) * 0.35;',
			(fs) => fs.replace('#include <color_fragment>', '#include <color_fragment>\nif (diffuseColor.r > 1.0) diffuseColor.rgb *= 0.8 + uPulse * 1.5;').replace('#include <common>', '#include <common>\nuniform float uPulse;'));

		// merged line plants (tufts, reeds, crystal edges) share one shader
		this.lineUniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
		Object.assign(this.lineUniforms, { uTime: { value: 0 }, uWind: { value: 1 }, uHue: { value: 0.8 }, uPulse: { value: 0 } });
		this.lineMaterial = new THREE.ShaderMaterial({
			uniforms: this.lineUniforms,
			fog: true,
			vertexShader: /* glsl */`
				#include <fog_pars_vertex>
				attribute vec3 aBase;
				attribute vec4 aInfo;    // height weight, phase, kind (0 tuft, 1 reed, 2 crystal), duration
				attribute float aBorn;
				uniform float uTime, uWind, uPulse;
				varying float vT; varying float vKind;
				float easeOutCubic(float t) { return 1.0 - pow(1.0 - t, 3.0); }
				float easeOutBack(float t) { float c1 = 1.70158, c3 = c1 + 1.0; float u = t - 1.0; return 1.0 + c3 * u * u * u + c1 * u * u; }
				void main() {
					float t = clamp((uTime - aBorn) / aInfo.w, 0.0, 1.0);
					if (aInfo.z < 0.5) {
						// grass is densest around the player and thins toward the horizon
						float keep = mix(1.0, 0.32, smoothstep(50.0, 320.0, distance(aBase.xz, cameraPosition.xz)));
						float rnd = fract(aInfo.y * 0.159155 + aBase.x * 0.013);
						t *= 1.0 - smoothstep(keep - 0.12, keep + 0.02, rnd);
					}
					float ey = aInfo.z > 1.5 ? mix(easeOutCubic(t), easeOutBack(t), 0.5) : easeOutBack(t);
					vec3 p = position;
					float hw = aInfo.x;
					p.y = aBase.y + (p.y - aBase.y) * ey;
					p.xz = aBase.xz + (p.xz - aBase.xz) * (0.6 + 0.4 * easeOutCubic(t));
					float swayAmt = aInfo.z > 1.5 ? 0.0 : (aInfo.z > 0.5 ? 0.9 : 0.45);
					float sway = sin(uTime * 1.3 + aInfo.y) * 0.35 + sin(uTime * 2.7 + aInfo.y * 1.9) * 0.15;
					p.x += sway * hw * hw * uWind * swayAmt;
					p.z += cos(uTime * 0.9 + aInfo.y) * 0.2 * hw * hw * uWind * swayAmt;
					if (aInfo.z > 1.5) p.y += (p.y - aBase.y) * uPulse * 0.25;
					float near = smoothstep(1.5, 5.0, distance(aBase.xz, cameraPosition.xz));
					p = mix(aBase, p, near);
					vT = hw; vKind = aInfo.z;
					vec4 worldPosition = vec4(p, 1.0);
					vec4 mvPosition = viewMatrix * worldPosition;
					gl_Position = projectionMatrix * mvPosition;
					#include <fog_vertex>
				}`,
			fragmentShader: /* glsl */`
				#include <fog_pars_fragment>
				uniform float uHue, uPulse;
				varying float vT; varying float vKind;
				${hslGlsl}
				void main() {
					vec3 tint = hsl2rgb(vec3(uHue, 0.7, 0.75));
					vec3 col;
					if (vKind > 1.5) col = hsl2rgb(vec3(fract(uHue + 0.5), 0.8, 0.65)) * (1.0 + 1.2 * uPulse);
					else if (vKind > 0.5) col = mix(vec3(0.2, 0.25, 0.4), vec3(0.75, 0.9, 1.0), vT) * (0.8 + 1.0 * uPulse);
					else col = mix(vec3(0.25, 0.2, 0.4), mix(tint, vec3(1.0), 0.45), vT) * (0.75 + 0.5 * uPulse);
					gl_FragColor = vec4(col, 1.0);
					#include <fog_fragment>
				}`,
		});
	}

	// ---- placement helpers ----
	spots(rnd, ox, oz, size, count, test) {
		const out = [];
		for (let i = 0; i < count * 3 && out.length < count; i++) {
			const x = ox + rnd.range(-size / 2, size / 2), z = oz + rnd.range(-size / 2, size / 2);
			if (Math.hypot(x, z) < 14) continue;
			if (test(x, z)) out.push([x, z]);
		}
		return out;
	}

	makeInstanced(geometry, material, kind, items, rnd, chunk, place) {
		if (!items.length) return;
		const geom = geometry.clone();
		const mesh = new THREE.InstancedMesh(geom, material, items.length);
		const born = new Float32Array(items.length);
		const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
		const pos = [];
		items.forEach(([x, z], i) => {
			place(x, z, p, q, s, rnd, yAxis);
			mesh.setMatrixAt(i, m.compose(p, q, s));
			born[i] = rnd.next() < KINDS[kind].preborn ? this.time + rnd.range(0, 0.8) : UNBORN;
			pos.push(x, z);
		});
		geom.setAttribute('aBorn', new THREE.InstancedBufferAttribute(born, 1));
		mesh.frustumCulled = false;
		chunk.meshes.push(mesh);
		chunk.groups.push({ kind: KINDS[kind], attr: geom.getAttribute('aBorn'), pos, ranges: null, count: items.length, pending: items.length });
	}

	key(cx, cz) { return cx + ',' + cz; }

	addChunk(key, cx, cz) {
		if (Math.abs(cx - this.centerX) > this.radius || Math.abs(cz - this.centerZ) > this.radius) return;
		if (this.chunks.has(key)) return;
		const size = config.world.chunkSize;
		const ox = cx * size, oz = cz * size;
		const rnd = new Random(config.seed + ':veg:' + key);
		const hm = this.heightmap;
		const chunk = { meshes: [], groups: [] };
		// biomes by elevation above the water: shore (reeds, sprouts), lowland meadow (grass, bare trees),
		// forest belt (tall trees), highland (sparse dead trees, crystals). Nothing but reeds right at the waterline.
		// H: height above the local water (sea, lake or river). Bands use height above the sea.
		const H = (x, z) => hm.sample(x, z) - hm._water;
		const shore = (x, z) => { const h = H(x, z); return h > -0.5 && h < 3.5 && hm.slope(x, z) < 0.6; };
		const inBand = (lo, hi, maxSlope) => (x, z) => { const h = hm.sample(x, z); const local = h - hm._water; return local > lo && h - hm.waterLevel < hi && hm._bank < 0.35 && hm.slope(x, z) < maxSlope; };
		const density = hm.forestDensity(ox, oz);
		const chunkH = hm.height(ox, oz) - hm.waterLevel;
		const lowland = chunkH < 80, highland = chunkH > 450, alpine = chunkH > 720;

		// trees: bare in the open, tall slender ones in the deep forest
		const treeCount = alpine ? 0 : Math.round((highland ? 3 : 6 + density * 34) * rnd.range(0.6, 1.3));
		const treeSpots = this.spots(rnd, ox, oz, size, treeCount, (x, z) => inBand(6, 760, 0.75)(x, z) && Math.hypot(x, z) > 60);
		const tallShare = highland ? 0 : (density > 0.55 ? 0.6 : (density > 0.3 ? 0.3 : 0.05));
		const pineSpots = treeSpots.filter(([x, z]) => H(x, z) > 45 && rnd.next() < tallShare);
		const bareSpots = treeSpots.filter((s) => !pineSpots.includes(s));
		const placeTree = (x, z, p, q, s, r, yAxis) => { const high = hm.height(x, z) - hm.waterLevel > 450; const sc = r.range(0.7, 1.5) * (high ? 0.6 : 1); p.set(x, hm.height(x, z), z); q.setFromAxisAngle(yAxis, r.range(0, Math.PI * 2)); s.set(sc, sc * r.range(1.0, 1.5), sc); };
		this.makeInstanced(rnd.pick(this.bareTrees), this.treeMaterial, 'tree', bareSpots, rnd, chunk, placeTree);
		this.makeInstanced(rnd.pick(this.tallTrees), this.treeMaterial, 'tree', pineSpots, rnd, chunk, placeTree);

		// solid blades: the meadow grass seen from afar, thinning out with altitude
		const bladeSpots = this.spots(rnd, ox, oz, size, highland ? 110 : 480, inBand(3.5, 620, 0.9));
		this.makeInstanced(this.blade, this.bladeMaterial, 'blade', bladeSpots, rnd, chunk, (x, z, p, q, s, r, yAxis) => { p.set(x, hm.height(x, z) - 0.3, z); q.setFromAxisAngle(yAxis, r.range(0, 6.3)); s.set(r.range(0.8, 1.4), r.range(2.5, 6.5), 1); });

		// glowing sprouts, rare
		if (rnd.chance(lowland ? 0.7 : 0.2)) {
			const sproutSpots = this.spots(rnd, ox, oz, size, rnd.int(2, 7), inBand(2, 25, 0.5));
			this.makeInstanced(this.sprout, this.sproutMaterial, 'sprout', sproutSpots, rnd, chunk, (x, z, p, q, s, r, yAxis) => { const sc = r.range(0.7, 1.6); p.set(x, hm.height(x, z) - 0.2, z); q.setFromAxisAngle(yAxis, r.range(0, 6.3)); s.set(sc, sc, sc); });
		}

		// crystal columns: clusters of hex prisms, the old cylinders
		const crystals = [];
		if (rnd.chance(highland ? 0.85 : (lowland ? 0.15 : 0.4))) {
			const clusters = this.spots(rnd, ox, oz, size, rnd.int(1, highland ? 3 : 2), inBand(3, 1500, 0.4));
			for (const [cx2, cz2] of clusters) {
				const n = rnd.int(3, 7);
				for (let i = 0; i < n; i++) {
					const x = cx2 + rnd.range(-9, 9), z = cz2 + rnd.range(-9, 9);
					if (!hm.isLand(x, z, 2)) continue;
					crystals.push({ x, z, y: hm.height(x, z) - 0.5, r: rnd.range(1.2, 2.6), h: rnd.range(5, 22), rot: rnd.range(0, 6.3) });
				}
			}
		}
		if (crystals.length) {
			this.makeInstanced(this.crystalSolid, this.crystalMaterial, 'crystal', crystals.map((c) => [c.x, c.z]), rnd, chunk, (x, z, p, q, s, r, yAxis) => { const c = crystals.find((c) => c.x === x && c.z === z); p.set(x, c.y, z); q.setFromAxisAngle(yAxis, c.rot); s.set(c.r, c.h, c.r); });
		}

		// merged lines: tufts, reeds by the water, crystal edges
		const verts = [], bases = [], infos = [], ranges = [], pos = [], kinds = [];
		const pushLines = (arr, x, y, z, rot, sx, sy, sz, dx, dz, h, phase, kind, dur) => {
			for (let k = 0; k < arr.length; k += 3) {
				const lx = arr[k] * sx, ly = arr[k + 1] * sy, lz = arr[k + 2] * sz;
				const rx = lx * Math.cos(rot) - lz * Math.sin(rot), rz = lx * Math.sin(rot) + lz * Math.cos(rot);
				verts.push(x + dx + rx, y + ly, z + dz + rz);
				bases.push(x, y, z);
				infos.push(ly / h, phase, kind, dur);
			}
		};
		const beginPlant = (x, z, kind) => { ranges.push([verts.length / 3, 0]); pos.push(x, z); kinds.push(kind); };
		const endPlant = () => { ranges[ranges.length - 1][1] = verts.length / 3; };

		// boulders: scree on steep ground and under cliffs, outcrops on hard rock, stones in the rapids
		{
			const rocks = [];
			for (const [x, z] of this.spots(rnd, ox, oz, size, 70, (x, z) => {
				const h = hm.sample(x, z);
				if (h < hm._water + 0.5 || hm._bank > 0.3) return false;
				const s = hm._slope;
				return s > 0.35 && rnd.next() < (s - 0.3) * (0.4 + hm._hardness);
			})) rocks.push({ x, z, r: rnd.range(0.8, 3.0) * (1 + 1.6 * Math.pow(rnd.next(), 3)), sink: 0.35 });
			if (rnd.chance(0.55)) {
				for (const [x, z] of this.spots(rnd, ox, oz, size, rnd.int(1, 3), (x, z) => { const h = hm.sample(x, z); return h > hm._water + 3 && hm._hardness > 0.6 && hm._slope > 0.15 && hm._slope < 1.3 && hm._bank < 0.2; }))
					rocks.push({ x, z, r: rnd.range(4.5, 11), sink: 0.4 });
			}
			const seg = hm.rivers.seg;
			for (const sIdx of hm.rivers.segmentsIn(ox - size / 2, oz - size / 2, ox + size / 2, oz + size / 2)) {
				const o = sIdx * 12;
				const foam = Math.max(seg[o + 10], seg[o + 11]);
				if (foam < 0.3 || rnd.next() > 0.3) continue;
				const t = rnd.next();
				const x = seg[o] + (seg[o + 2] - seg[o]) * t, z = seg[o + 1] + (seg[o + 3] - seg[o + 1]) * t;
				if (Math.abs(x - ox) > size / 2 || Math.abs(z - oz) > size / 2) continue;
				const w = seg[o + 6] + (seg[o + 7] - seg[o + 6]) * t;
				const dx = seg[o + 2] - seg[o], dz = seg[o + 3] - seg[o + 1], len = Math.hypot(dx, dz) || 1;
				const off = rnd.range(-0.42, 0.42) * w;
				rocks.push({ x: x + (-dz / len) * off, z: z + (dx / len) * off, r: rnd.range(1.0, 2.2) + w * 0.025, sink: 0.25 });
			}
			// beach cobbles and lakeside stones, sparse
			for (const [x, z] of this.spots(rnd, ox, oz, size, 8, (x, z) => { const h = H(x, z); return h > 0.2 && h < 2.5 && hm.slope(x, z) < 0.4 && hm._hardness > 0.45; })) rocks.push({ x, z, r: rnd.range(0.7, 1.8), sink: 0.4 });
			chunk.colliders = [];
			const byVariant = [[], [], [], []];
			for (const r of rocks) byVariant[rnd.int(0, 3)].push(r);
			byVariant.forEach((list, v) => {
				if (!list.length) return;
				this.makeInstanced(this.boulders[v], this.rockMaterial, 'rock', list.map((r) => [r.x, r.z]), rnd, chunk, (x, z, p, q, s, r, yAxis) => {
					const rock = list.find((c) => c.x === x && c.z === z);
					const y = hm.height(x, z) - rock.r * rock.sink;
					p.set(x, y, z);
					q.setFromEuler(new THREE.Euler(r.range(-0.4, 0.4), r.range(0, 6.3), r.range(-0.4, 0.4)));
					s.set(rock.r * r.range(0.8, 1.25), rock.r * r.range(0.7, 1.1), rock.r * r.range(0.8, 1.25));
					if (rock.r >= 3.5) { const c = { position: new THREE.Vector3(x, y, z), radius: rock.r * 0.9 }; chunk.colliders.push(c); this.shared.colliders.push(c); }
				});
			});
		}

		for (const [x, z] of this.spots(rnd, ox, oz, size, alpine ? 40 : (highland ? 160 : 560), inBand(3.5, 900, 0.9))) {
			const y = hm.height(x, z) - 0.2, h = rnd.range(2.5, 6.5), rot = rnd.range(0, 6.3), phase = rnd.range(0, 6.3);
			beginPlant(x, z, 'tuft');
			for (const [dx, dz, sh] of [[0, 0, h], [rnd.range(-2.5, 2.5), rnd.range(-2.5, 2.5), h * 0.5], [rnd.range(-2.5, 2.5), rnd.range(-2.5, 2.5), h * 0.55]])
				pushLines(this.tuftEdges, x, y, z, rot, 1, sh, 1, dx, dz, h, phase, 0, KINDS.tuft.dur);
			endPlant();
		}
		for (const [x, z] of this.spots(rnd, ox, oz, size, 90, shore)) {
			const y = hm.height(x, z) - 0.2, h = rnd.range(7, 14), phase = rnd.range(0, 6.3);
			beginPlant(x, z, 'reed');
			for (let k = 0; k < rnd.int(2, 4); k++) {
				const dx = rnd.range(-1.5, 1.5), dz = rnd.range(-1.5, 1.5), lean = rnd.range(-0.15, 0.15), rh = h * rnd.range(0.7, 1);
				const segs = [[0, 0, 0], [lean * rh * 0.4, rh * 0.45, 0], [lean * rh * 0.4, rh * 0.45, 0], [lean * rh, rh, 0], [lean * rh, rh, 0], [lean * rh + 0.5, rh + 0.8, 0.3]];
				pushLines(segs.flat(), x, y, z, rnd.range(0, 6.3), 1, 1, 1, dx, dz, h, phase, 1, KINDS.reed.dur);
			}
			endPlant();
		}
		for (const c of crystals) {
			beginPlant(c.x, c.z, 'crystal');
			pushLines(this.crystalEdges, c.x, c.y, c.z, c.rot, c.r, c.h, c.r, 0, 0, c.h, 0, 2, KINDS.crystal.dur);
			endPlant();
		}
		if (verts.length) {
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
			geometry.setAttribute('aBase', new THREE.Float32BufferAttribute(bases, 3));
			geometry.setAttribute('aInfo', new THREE.Float32BufferAttribute(infos, 4));
			const born = new Float32Array(verts.length / 3);
			ranges.forEach(([s, e], i) => { const b = rnd.next() < KINDS[kinds[i]].preborn ? this.time + rnd.range(0, 0.8) : UNBORN; for (let k = s; k < e; k++) born[k] = b; });
			geometry.setAttribute('aBorn', new THREE.BufferAttribute(born, 1));
			const lines = new THREE.LineSegments(geometry, this.lineMaterial);
			lines.frustumCulled = false;
			chunk.meshes.push(lines);
			chunk.groups.push({ kind: null, kinds: kinds.map((k) => KINDS[k]), attr: geometry.getAttribute('aBorn'), pos, ranges, count: ranges.length, pending: ranges.length });
		}

		for (const mesh of chunk.meshes) this.scene.add(mesh);
		this.chunks.set(key, chunk);
	}

	removeChunk(key) {
		const chunk = this.chunks.get(key);
		if (!chunk) return;
		for (const mesh of chunk.meshes) { this.scene.remove(mesh); mesh.geometry.dispose(); if (mesh.dispose) mesh.dispose(); }
		if (chunk.colliders && chunk.colliders.length) { const drop = new Set(chunk.colliders); this.shared.colliders = this.shared.colliders.filter((c) => !drop.has(c)); }
		this.chunks.delete(key);
	}

	// Plants grow out of the ground as the player approaches.
	reveal(chunk, px, pz) {
		const t = this.time;
		for (const g of chunk.groups) {
			if (g.pending <= 0) continue;
			const a = g.attr.array;
			let changed = false;
			for (let i = 0; i < g.count; i++) {
				const s = g.ranges ? g.ranges[i][0] : i;
				if (a[s] !== UNBORN) continue;
				const kind = g.kind || g.kinds[i];
				const dx = g.pos[i * 2] - px, dz = g.pos[i * 2 + 1] - pz;
				if (dx * dx + dz * dz < kind.reveal * kind.reveal) {
					const born = t + Math.random() * 0.4;
					if (g.ranges) { const [s0, e] = g.ranges[i]; for (let k = s0; k < e; k++) a[k] = born; } else a[i] = born;
					g.pending--; changed = true;
				}
			}
			if (changed) g.attr.needsUpdate = true;
		}
	}

	update(dt, cx, cz) {
		this.time += dt;
		this.centerX = cx;
		this.centerZ = cz;
		const a = this.shared.audio ? this.shared.audio.analysis : null;
		const pulse = a ? a.attack : 0;
		const wind = 0.7 + this.shared.state.snow * 1.2 + this.shared.state.hum * 0.5;
		for (const u of this.uniformSets) { u.uTime.value = this.time; u.uWind.value = wind; u.uPulse.value = pulse; }
		this.lineUniforms.uTime.value = this.time;
		this.lineUniforms.uWind.value = wind;
		this.lineUniforms.uPulse.value = pulse;
		this.lineUniforms.uHue.value = this.shared.hue;
		this.hueUniform.value = this.shared.hue;

		const player = this.shared.player ? this.shared.player.position : null;
		for (const [key, chunk] of this.chunks) {
			const [x, z] = key.split(',').map(Number);
			if (Math.abs(x - cx) > this.radius || Math.abs(z - cz) > this.radius) { this.removeChunk(key); continue; }
			if (player && Math.abs(x - cx) <= 2 && Math.abs(z - cz) <= 2) this.reveal(chunk, player.x, player.z);
		}
	}
}
