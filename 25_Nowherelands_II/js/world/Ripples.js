import * as THREE from 'three';

// A shared pool of expanding rings drawn by the terrain and water shaders.
// Each ripple is (x, z, startTime, size) plus a colour.
export const MAX_RIPPLES = 24;

export class Ripples {
	constructor() {
		this.data = [];
		this.colors = [];
		for (let i = 0; i < MAX_RIPPLES; i++) {
			this.data.push(new THREE.Vector4(0, 0, -1000, 0));
			this.colors.push(new THREE.Vector3(1, 1, 1));
		}
		this.cursor = 0;
		this.time = 0;
		this.uniforms = {
			uRipples: { value: this.data },
			uRippleColors: { value: this.colors },
		};
	}

	add(x, z, size = 1, hue = 0.85, saturation = 0.9) {
		const i = this.cursor;
		this.cursor = (this.cursor + 1) % MAX_RIPPLES;
		this.data[i].set(x, z, this.time, size);
		const c = new THREE.Color().setHSL(hue, saturation, 0.6);
		this.colors[i].set(c.r, c.g, c.b);
	}

	update(time) { this.time = time; }

	static glsl() {
		return /* glsl */`
		uniform vec4 uRipples[${MAX_RIPPLES}];
		uniform vec3 uRippleColors[${MAX_RIPPLES}];
		vec3 rippleGlow(vec2 p, float time) {
			vec3 acc = vec3(0.0);
			for (int i = 0; i < ${MAX_RIPPLES}; i++) {
				vec4 r = uRipples[i];
				float age = time - r.z;
				if (age < 0.0 || age > 6.0) continue;
				float radius = age * (14.0 + 9.0 * r.w);
				float d = distance(p, r.xy);
				float width = 0.7 + 0.5 * min(r.w, 3.0);
				float ring = 1.0 - smoothstep(0.0, width, abs(d - radius));
				float fade = exp(-age * (1.3 - 0.18 * min(r.w, 3.0)));
				acc += uRippleColors[i] * ring * fade * clamp(r.w * 0.8, 0.12, 1.5);
			}
			return acc;
		}`;
	}
}
