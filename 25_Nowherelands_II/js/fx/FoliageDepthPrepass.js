import * as THREE from 'three';

// Alpha-tested canopies overlap heavily, including in the ocean reflection.
// Establish their exact depth with the same growth/alpha shaders before lighting them.
export class FoliageDepthPrepass {
	static supported(renderer) {
		// Keep this opt-in to the GPU family with measured gains and presentation
		// checks. Other backends can rasterize depth/lighting edges differently.
		const gl = renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
		return !!info && /\bMali-G57\b/.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
	}
	constructor(renderer, world, foliageMaterial) {
		this.enabled = true;
		this.world = world;
		this.foliageMaterial = foliageMaterial;
		this.scene = new THREE.Scene();
		this.proxies = new Map();
		this.material = new THREE.MeshDepthMaterial({
			map: foliageMaterial.map, alphaTest: Math.min(1, foliageMaterial.alphaTest + 1 / 255),
			side: foliageMaterial.side, depthPacking: THREE.BasicDepthPacking,
		});
		this.material.colorWrite = false;
		// The lighting and depth programs can round interpolated depth differently.
		// Bias provisional depth away from the camera and require slightly stronger
		// alpha coverage, avoiding false occlusion at depth/texture rounding edges.
		// The ordinary pass retains its original depth and alpha threshold.
		this.material.polygonOffset = true;
		this.material.polygonOffsetFactor = 1;
		this.material.polygonOffsetUnits = 1;
		// Vegetation's hook supplies the identical wind, growth and atlas mapping.
		this.material.onBeforeCompile = foliageMaterial.onBeforeCompile;
		this.renderer = renderer;
		this.originalRender = renderer.render;
		this.render = (scene, camera) => {
			const target = renderer.getRenderTarget();
			if (!this.enabled || scene !== world || scene.overrideMaterial || target?.depthBuffer === false) {
				return this.originalRender.call(renderer, scene, camera);
			}
			this.sync();
			const autoClear = renderer.autoClear;
			try {
				if (autoClear) renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
				renderer.autoClear = false;
				this.originalRender.call(renderer, this.scene, camera);
				return this.originalRender.call(renderer, scene, camera);
			} finally { renderer.autoClear = autoClear; }
		};
		renderer.render = this.render;
	}

	sync() {
		// Only foliage is drawn here. Updating the entire world also traverses
		// every animal and landmark, which the normal render must update again.
		const updateMatrices = this.world.matrixWorldAutoUpdate;
		if (updateMatrices) this.world.updateWorldMatrix(false, false);
		const present = new Set();
		// Vegetation publishes its instanced meshes directly into the world scene.
		for (const source of this.world.children) {
			if (source.material !== this.foliageMaterial || this.world.plantBatchSources?.has(source)) continue;
			if (updateMatrices) source.updateWorldMatrix(false, false, true);
			present.add(source);
			let proxy = this.proxies.get(source);
			if (!proxy) {
				proxy = source.clone(false);
				proxy.material = this.material;
				proxy.matrixAutoUpdate = false;
				this.proxies.set(source, proxy);
				this.scene.add(proxy);
			}
			proxy.geometry = source.geometry;
			proxy.instanceMatrix = source.instanceMatrix;
			proxy.instanceColor = source.instanceColor;
			proxy.count = source.count;
			proxy.boundingSphere = source.boundingSphere;
			proxy.frustumCulled = source.frustumCulled;
			proxy.layers.mask = source.layers.mask;
			proxy.visible = source.visible;
			proxy.matrix.copy(source.matrixWorld);
		}
		for (const [source, proxy] of this.proxies) {
			if (present.has(source)) continue;
			this.scene.remove(proxy);
			this.proxies.delete(source);
			// Geometry and instance buffers belong to the original mesh's lifetime.
		}
	}

	dispose() {
		if (this.renderer.render === this.render) this.renderer.render = this.originalRender;
		this.scene.clear();
		this.proxies.clear();
		this.material.dispose();
	}
}
