import * as THREE from 'three';

// Snapshot the already-rendered world before inland surfaces draw. This is a GPU copy,
// not another scene render. Both near and far water read exactly the same linear HDR image.
export class WaterOptics {
	constructor(shared, uniforms) {
		this.shared = shared;
		this.uniforms = uniforms;
		this.texture = null;
		this.depthTarget = null;
		this.captured = false;
	}
	beginFrame() { this.captured = false; }
	dispose(){this.texture?.dispose();this.depthTarget?.dispose();this.texture=this.depthTarget=null;}
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
		if(target.depthTexture){
			if(!this.depthTarget||this.depthTarget.width!==width||this.depthTarget.height!==height){
				this.depthTarget?.dispose();
				this.depthTarget=new THREE.WebGLRenderTarget(width,height,{depthTexture:new THREE.DepthTexture(width,height,THREE.UnsignedIntType)});
				renderer.initRenderTarget(this.depthTarget);
			}
			renderer.copyTextureToTexture(target.depthTexture,this.depthTarget.depthTexture);
			renderer.setRenderTarget(target);
			this.uniforms.uSceneDepth.value=this.depthTarget.depthTexture;
			this.uniforms.uHasSceneDepth.value=1;
			this.uniforms.uInvProjection.value.copy(camera.projectionMatrixInverse);
			this.uniforms.uCameraWorld.value.copy(camera.matrixWorld);
		}else this.uniforms.uHasSceneDepth.value=0;
		this.uniforms.uHasScene.value = 1;
		this.captured = true;
	}
}
