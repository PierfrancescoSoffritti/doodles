import * as THREE from 'three';

// Height fog shared by the terrain and water shaders: a haze that pools in the valleys and thins
// with altitude, plus a long distance fade so far ranges stand as silhouettes on the horizon.
export function createFogUniforms() {
	return {
		uFogDensity: { value: 2.4e-4 },
		uFogFalloff: { value: 1 / 320 },
		uFogDistance: { value: 1 / 15000 },
		uFogColor: { value: new THREE.Color('#2a1046') },
		uFogFar: { value: new THREE.Color('#120720') },
	};
}

export const fogGlsl = /* glsl */`
	uniform float uFogDensity, uFogFalloff, uFogDistance;
	uniform vec3 uFogColor, uFogFar;
	float heightFog(vec3 p, vec3 cam) {
		vec3 d = p - cam;
		float dist = length(d);
		float b = uFogFalloff;
		float dy = d.y;
		float integ = abs(dy) < 1.0 ? 1.0 : (1.0 - exp(-dy * b)) / (dy * b);
		float f = uFogDensity * exp(-max(cam.y, -20.0) * b) * integ * dist;
		return 1.0 - exp(-f);
	}
	vec3 applyFog(vec3 col, vec3 p, vec3 cam) {
		float dist = distance(p, cam);
		float hf = heightFog(p, cam);
		float x = dist * uFogDistance;
		float df = 1.0 - exp(-x * x * 1.4);
		col = mix(col, uFogColor, hf);
		col = mix(col, uFogFar, df);
		return col;
	}`;
