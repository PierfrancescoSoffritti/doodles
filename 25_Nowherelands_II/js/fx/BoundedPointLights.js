import { ShaderChunk } from 'three';

export const originalPointLightChunk = ShaderChunk.lights_fragment_begin;

// Three's finite-distance attenuation is exactly zero beyond the light's range.
// Skip the remaining lighting work there, retaining the original math inside it.
export function boundedPointLightChunk(chunk = originalPointLightChunk) {
	const start = 'pointLight = pointLights[ i ];';
	const end = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
	return chunk
		.replace(start, `${start}
		if (any(notEqual(pointLight.color, vec3(0.0))) &&
			(pointLight.distance <= 0.0 || length(pointLight.position - geometryPosition) <= pointLight.distance)) {`)
		.replace(end, `${end}\n\t\t}`);
}

export function boundedPointLights(shader) {
	shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', boundedPointLightChunk());
}

// Install before any programs compile so streamed meshes use the same path.
export function installBoundedPointLights() {
	ShaderChunk.lights_fragment_begin = boundedPointLightChunk();
}
