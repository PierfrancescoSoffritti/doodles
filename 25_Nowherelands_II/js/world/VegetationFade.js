import * as THREE from 'three';
import { config } from '../core/Config.js';

// The nearest unloaded chunk starts radius * chunkSize from the player. Finish
// before that boundary, with a quarter-chunk margin for streaming during travel.
export function vegetationFadeUniforms(shared) {
	if (!shared.vegetationFade) {
		const { chunkSize: size, vegetationRadius: radius } = config.world;
		shared.vegetationFade = {
			uVegetationCamera: { value: new THREE.Vector2() },
			uVegetationRange: { value: new THREE.Vector2(size * (radius - 1.5), size * (radius - 0.25)) },
		};
	}
	return shared.vegetationFade;
}

export const vegetationFadeGlsl = /* glsl */`
	uniform vec2 uVegetationCamera, uVegetationRange;
	float vegetationFade(vec2 base) {
		// Fixed per plant, never per frame or per vertex: patches thin at different
		// rates without changing placement, growth state or the nearby density.
		float variation = fract(dot(base, vec2(0.013, 0.017)));
		float end = mix(uVegetationRange.y, mix(uVegetationRange.x, uVegetationRange.y, 0.8), variation);
		return 1.0 - smoothstep(uVegetationRange.x, end, distance(base, uVegetationCamera));
	}`;

// Apply after growth and wind, so even a bent plant collapses completely to its
// base. No transparency, extra draw, per-instance uploads or changed bounds.
export function fadeSmallPlantMaterial(material, shared) {
	material.userData.distanceFaded = true;
	const compile = material.onBeforeCompile;
	const cacheKey = material.customProgramCacheKey();
	material.onBeforeCompile = function (shader, renderer) {
		compile.call(this, shader, renderer);
		Object.assign(shader.uniforms, vegetationFadeUniforms(shared));
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', '#include <common>\n' + vegetationFadeGlsl)
			.replaceAll('cameraPosition.xz', 'uVegetationCamera')
			.replace('#include <project_vertex>', 'transformed *= vegetationFade(instanceMatrix[3].xz);\n#include <project_vertex>');
	};
	material.customProgramCacheKey = () => cacheKey + ':small-plant-fade';
	return material;
}
