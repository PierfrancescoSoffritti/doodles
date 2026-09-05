import * as THREE from 'three';

// Snapshot the already-rendered world before inland surfaces draw. This is a GPU copy,
// not another scene render. Both near and far water read exactly the same linear HDR image.
export class WaterOptics {
	constructor(shared, uniforms) {
		this.shared = shared;
		this.uniforms = uniforms;
		this.texture = null;
		this.captured = false;
	}
	beginFrame() { this.captured = false; }
	capture(renderer, scene, camera) {
		if (camera !== this.shared.camera || this.captured) return;
		const target = renderer.getRenderTarget();
		if (!target) return;
		const { width, height } = target;
		if (!this.texture || this.texture.image.width !== width || this.texture.image.height !== height) {
			this.texture?.dispose();
			this.texture = new THREE.FramebufferTexture(width, height);
			this.texture.type = target.texture.type;
			this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;
			this.uniforms.uSceneColor.value = this.texture;
			this.uniforms.uResolution.value.set(width, height);
		}
		renderer.copyFramebufferToTexture(this.texture);
		this.uniforms.uHasScene.value = 1;
		this.captured = true;
	}
}
