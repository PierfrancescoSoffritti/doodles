import * as THREE from 'three';

// One face per frame, then filter the cubemap. Keep the last complete environment
// installed while a new capture is in progress; never expose a partially updated cube.
export class EnvironmentProbe {
	constructor(renderer, scene, camera, shared, pmrem, hidden, install) {
		Object.assign(this, { renderer, scene, camera, shared, pmrem, hidden, install });
		this.cube = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType, generateMipmaps: false });
		this.capture = new THREE.CubeCamera(1, camera.far, this.cube);
		this.face = -1; this.elapsed = Infinity; this.target = null;
		this.lastPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
		this.lastColor = new THREE.Color();
		this.stats = { faces: 0, cycles: 0, filters: 0 };
	}
	update(dt, renderFrame = true) {
		this.elapsed += dt;
		if (!renderFrame || this.shared.caveAmount >= .05) return;
		if (this.face < 0) {
			const color = this.shared.fogColor;
			const change = Math.abs(color.r-this.lastColor.r)+Math.abs(color.g-this.lastColor.g)+Math.abs(color.b-this.lastColor.b);
			if (this.target && (this.elapsed < 5 || (this.elapsed < 30 && this.camera.position.distanceToSquared(this.lastPosition) < 128**2 && change < .08))) return;
			this.capture.position.copy(this.camera.position);
			this.capture.coordinateSystem = this.renderer.coordinateSystem;
			this.capture.updateCoordinateSystem();
			this.capture.updateMatrixWorld(true);
			this.lastPosition.copy(this.camera.position); this.lastColor.copy(color);
			this.face = 0; this.elapsed = 0; this.stats.cycles++;
		}
		if (this.face === 6) {
			this.target = this.pmrem.fromCubemap(this.cube.texture, this.target);
			this.install(this.target); this.face = -1; this.stats.filters++;
			return;
		}
		const r = this.renderer, target = r.getRenderTarget(), face = r.getActiveCubeFace(), mip = r.getActiveMipmapLevel();
		const xr = r.xr.enabled, hidden = this.hidden().filter(Boolean).map(mesh => [mesh, mesh.visible]);
		try {
			for (const [mesh] of hidden) mesh.visible = false;
			r.xr.enabled = false;
			r.setRenderTarget(this.cube, this.face);
			r.render(this.scene, this.capture.children[this.face]);
			this.face++; this.stats.faces++;
		} finally {
			for (const [mesh, visible] of hidden) mesh.visible = visible;
			r.setRenderTarget(target, face, mip); r.xr.enabled = xr;
		}
	}
}
