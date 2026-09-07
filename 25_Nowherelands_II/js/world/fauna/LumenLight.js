import * as THREE from 'three';

// A small stable pool lights the custom terrain/water shaders. These materials
// do not receive Three.js PointLights, so merely adding lights to the scene is
// insufficient. No shadow maps or one-light-per-creature shader expansion.
export function lumenLightUniforms(shared) {
	return shared.lumenLightUniforms ||= {
		uLumenColors: { value: Array.from({ length: 8 }, () => new THREE.Vector3(0.33,0.82,0.96)) },
		uLumenLights: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0)) },
	};
}

export const lumenLightGlsl = /* glsl */`
	uniform vec4 uLumenLights[8];
	uniform vec3 uLumenColors[8];
	vec3 lumenIllumination(vec3 p, vec3 normal, vec3 view, float water) {
		vec3 light = vec3(0.0);
		for (int i = 0; i < 8; i++) {
			vec4 source = uLumenLights[i];
			if (source.w < 0.001) continue;
			vec3 delta = source.xyz - p;
			float d2 = dot(delta, delta);
			if (d2 > 1600.0) continue;
			vec3 direction = delta * inversesqrt(max(d2, 0.01));
			float falloff = pow(max(0.0, 1.0 - d2 / 1600.0), 2.0) / (1.0 + d2 * 0.018);
			float diffuse = max(0.0, dot(normal, direction)) * 0.8 + 0.2;
			vec3 halfDirection = normalize(direction + view + vec3(0.0, 0.0001, 0.0));
			float reflection = pow(max(dot(normal, halfDirection), 0.0), 48.0) * water * 2.5;
			light += uLumenColors[i] * source.w * falloff * (diffuse + reflection);
		}
		return light;
	}
`;

export class LumenLight {
	constructor(shared) {
		this.shared = shared;
		this.sources = lumenLightUniforms(shared).uLumenLights.value;
		this.colors=lumenLightUniforms(shared).uLumenColors.value;
		this.owners = Array(8).fill(null);
	}
	update(model, dt) {
		const candidates = model.creatures.filter(c => c.kind === 'lumen' && c.size > 0.6 && Math.hypot(c.pos.x-model.listener.x,c.pos.y-model.listener.y,c.pos.z-model.listener.z)<220);
		const active = (this.shared.caveAmount || 0) < 0.4;
		for (let i=0;i<8;i++) {
			const source=this.sources[i]; let c=this.owners[i];
			if (!candidates.includes(c)) {
				source.w *= Math.exp(-dt*6);
				if(source.w>0.01) continue;
				c=candidates.find(candidate=>!this.owners.some(owner=>owner && Math.hypot(owner.pos.x-candidate.pos.x,owner.pos.z-candidate.pos.z)<10));
				this.owners[i]=c || null;
			}
			if(!c) continue;
			const p=c.renderPosition || c.pos;
			source.set(p.x,p.y,p.z,source.w);
			const distance=Math.hypot(p.x-model.listener.x,p.y-model.listener.y,p.z-model.listener.z);
			const glow=c.radiance || {r:0.33,g:0.82,b:0.96,brightness:0.61};
			this.colors[i].lerp(new THREE.Vector3(glow.r,glow.g,glow.b),1-Math.exp(-dt*5));
			const intensity=active?c.size*(0.32+c.energy*0.12)*glow.brightness*(1-Math.min(1,Math.max(0,distance-150)/70)):0;
			source.w += (intensity-source.w)*(1-Math.exp(-dt*5));
		}
	}
	dispose() { for(const light of this.sources) light.w=0; }
}
