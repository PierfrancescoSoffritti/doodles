import * as THREE from 'three';
import { WaterOptics } from './WaterOptics.js';
import { WaterMeshData, NEAR_RADIUS, NEAR_REBUILD, nearCoverageRadius } from './WaterMeshData.js';
import { config } from '../core/Config.js';
export { NEAR_RADIUS } from './WaterMeshData.js';
import { createWaterUniforms, waterVertexShader, waterFragmentShader, updateWaterUniforms } from './WaterShader.js';

// Lakes and rivers: flat lake sheets at each lake's own level, and river ribbons that follow the
// water surface sample by sample: sloping runs, short steep riffle ramps, and gaps where a
// waterfall (its own mesh) takes over. Both share scene refraction, depth absorption and the local environment reflection.
//
// River vertices carry their position in river space (metres along the channel, signed metres
// across it) so the shader can texture the flow without smearing, and the three nearest rocks
// that break the surface so it can draw their wakes.
//
// Two meshes draw the water. A static one covers the whole continent with one quad per river
// sample and per half grid cell of lake. A near mesh, rebuilt as the player moves, covers the
// reaches and lake within NEAR_RADIUS with quads a few metres on a side; its vertices are lifted
// by waves in the vertex shader (the river's swell, a lake's wind ripples), so close up the water
// has a faceted, moving surface with real silhouettes against the banks. The static mesh discards
// its fragments inside the near radius so the two never fight.

export class InlandWater {
	constructor(scene, heightmap, shared) {
		this.scene = scene;
		this.heightmap = heightmap;
		const world = heightmap.world;
		this.world = world;
		const uniforms = createWaterUniforms(shared, heightmap.waterLevel);
		uniforms.uNearRadius = { value: NEAR_RADIUS };
		this.uniforms = uniforms;
		shared.inlandNearRadius = uniforms.uNearRadius;
		this.optics = new WaterOptics(shared, uniforms);
		this.material = new THREE.ShaderMaterial({
			uniforms,
			vertexShader: waterVertexShader(shared),
			fragmentShader: waterFragmentShader(shared),
			defines: { NEAR_CULL: '' },
			transparent: true,
		});
		this.nearMaterial = new THREE.ShaderMaterial({
			uniforms,
			vertexShader: waterVertexShader(shared),
			fragmentShader: waterFragmentShader(shared),
			defines: { WAVES: '' },
			transparent: true,
		});

		const dataBuilder = new WaterMeshData(heightmap);
		const data = dataBuilder.buildStatic();
		this.mesh = new THREE.Mesh(geometryFromData(data), this.material);
		this.mesh.frustumCulled = false;
		this.mesh.onBeforeRender = (...args) => this.optics.capture(...args);
		this.mesh.renderOrder = 1;          // over the sea, so a river mouth shows the river until it fades
		scene.add(this.mesh);
		shared.mirrorHide.add(this.mesh);   // reads the sea's mirror, so it cannot be drawn into it
		this.shared = shared;
		this.triangles = data.index.length / 3;

		this.near = null;
		this.nearCentre = new THREE.Vector2(1e9, 1e9);
		this.pending = false; this.completed = null; this.requestId = 0; this.workerReady = false;
		this.worker = new Worker(new URL('./WaterMeshWorker.js', import.meta.url), { type: 'module' });
		this.worker.onmessage = ({ data }) => {
			if (data.type === 'ready') this.workerReady = true;
			else if (data.type === 'near' && data.id === this.requestId) { this.pending = false; this.completed = data; }
		};
		this.worker.onerror = () => {
			this.workerReady = false; this.pending = false; this.worker.terminate();
			console.warn('Detailed water streaming stopped; retaining the static water surface.');
		};
		// One startup clone; all later geometry buffers return by transfer, not by copying.
		this.worker.postMessage({ type: 'init', seed: config.seed, world });
	}

	rebuildNear(px, pz) {
		if (!this.workerReady || this.pending) return;
		this.pending = true;
		this.worker.postMessage({ type: 'near', id: ++this.requestId, x: px, z: pz });
	}

	installNear(result) {
		const geometry = geometryFromData(result.data);
		if (this.near) this.near.geometry.dispose();
		else {
			this.near = new THREE.Mesh(geometry, this.nearMaterial);
			this.shared.mirrorHide.add(this.near);
			this.near.frustumCulled = false;
			this.near.onBeforeRender = (...args) => this.optics.capture(...args);
			this.near.renderOrder = 1;
			this.scene.add(this.near);
		}
		this.near.geometry = geometry;
		this.nearCentre.set(result.x, result.z);
	}

	update(time, cameraPos, shared) {
		this.optics.beginFrame();
		updateWaterUniforms(this.uniforms, time, cameraPos, shared);
		if (this.completed) { this.installNear(this.completed); this.completed = null; }
		// On a teleport or unusually fast travel, the static water fills any area not yet
		// covered by the previous detailed mesh. A worker delay must never leave a hole.
		this.uniforms.uNearRadius.value = this.near ? nearCoverageRadius(this.nearCentre.x, this.nearCentre.y, cameraPos.x, cameraPos.z) : 0;
		if (Math.hypot(this.nearCentre.x - cameraPos.x, this.nearCentre.y - cameraPos.z) > NEAR_REBUILD) this.rebuildNear(cameraPos.x, cameraPos.z);
	}
}

function geometryFromData(data) {
	const geometry = new THREE.BufferGeometry();
	for (const [name, { array, size }] of Object.entries(data.attributes)) geometry.setAttribute(name, new THREE.BufferAttribute(array, size));
	geometry.setIndex(new THREE.BufferAttribute(data.index, 1));
	return geometry;
}
