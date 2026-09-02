import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createWaterUniforms, waterVertexShader, waterFragmentShader, updateWaterUniforms } from './WaterShader.js';

// The sea: one huge reflective plane at sea level that follows the player.
export class Water {
	constructor(scene, shared, waterLevel) {
		const uniforms = createWaterUniforms(shared, waterLevel);
		const shader = { name: 'NowhereSea', uniforms, vertexShader: waterVertexShader, fragmentShader: waterFragmentShader(shared) };
		const geometry = new THREE.PlaneGeometry(64000, 64000);
		this.mesh = new Reflector(geometry, { textureWidth: 768, textureHeight: 768, clipBias: 0.02, shader, multisample: 0 });
		this.mesh.material.defines = { REFLECTIVE: '' };
		this.mesh.material.needsUpdate = true;
		this.mesh.rotation.x = -Math.PI / 2;
		this.mesh.position.y = waterLevel;
		this.uniforms = this.mesh.material.uniforms;
		// Reflector clones its uniforms (textures included); share the live ones instead
		Object.assign(this.uniforms, shared.shoreMap.uniforms, shared.ripples.uniforms, shared.fogUniforms);
		scene.add(this.mesh);
	}

	update(time, playerPos, shared) {
		this.mesh.position.x = Math.round(playerPos.x / 64) * 64;
		this.mesh.position.z = Math.round(playerPos.z / 64) * 64;
		updateWaterUniforms(this.uniforms, time, playerPos, shared);
	}
}
