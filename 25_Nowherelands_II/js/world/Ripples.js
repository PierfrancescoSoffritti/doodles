import * as THREE from 'three';
import {RIPPLE_LIFETIME,rippleMaxRadius,rippleWidth} from './RippleWave.js?v=player-notes-13';

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
		this.reach=new Float32Array(MAX_RIPPLES);
		this.cursor = 0;
		this.time = 0;
		this.uniforms = {
			uRipples: { value: this.data },
   uRippleReach: {value:this.reach},
			uRippleColors: { value: this.colors },
		};
	}

	add(x, z, size = 1, hue = 0.85, saturation = 0.9, maxRadius = rippleMaxRadius(size)) {
		const i = this.cursor;
		this.cursor = (this.cursor + 1) % MAX_RIPPLES;
		this.data[i].set(x, z, this.time, size);
		const c = new THREE.Color().setHSL(hue, saturation, 0.6);
		this.colors[i].set(c.r, c.g, c.b);
  this.reach[i]=maxRadius;
	}

	update(time) { this.time = time; }


	static glsl() {
		return /* glsl */`
		uniform vec4 uRipples[${MAX_RIPPLES}];
  uniform float uRippleReach[${MAX_RIPPLES}];
		uniform vec3 uRippleColors[${MAX_RIPPLES}];
		vec3 rippleGlow(vec2 p, float time) {
			vec3 acc = vec3(0.0);
			for (int i = 0; i < ${MAX_RIPPLES}; i++) {
				vec4 r = uRipples[i];
				float age = time - r.z;
				if (age < 0.0 || age > ${RIPPLE_LIFETIME.toFixed(1)}) continue;
				float progress=clamp(age/${RIPPLE_LIFETIME.toFixed(1)},0.0,1.0);
    float eased=1.3*progress-.3*progress*progress;
    float radius=uRippleReach[i]*eased;
				float d = distance(p, r.xy);
    if(d>uRippleReach[i])continue;
				float width = ${rippleWidth(0).toFixed(1)} + ${(rippleWidth(1)-rippleWidth(0)).toFixed(1)} * min(r.w, 3.0);
				float ring = 1.0 - smoothstep(0.0, width, abs(d - radius));
				// Charged notes carry a second, tighter ring behind the leading edge.
    if(r.w>2.1){float echoRadius=max(0.0,radius-4.0-4.0*progress);ring=max(ring,.6*(1.0-smoothstep(0.0,width*.65,abs(d-echoRadius))));}
    float fade = (1.0-progress*.3)*(1.0-smoothstep(.82,1.0,progress));
				acc += uRippleColors[i] * ring * fade * clamp(r.w * 0.8, 0.12, 1.5);
			}
			return acc;
		}`;
	}
}
