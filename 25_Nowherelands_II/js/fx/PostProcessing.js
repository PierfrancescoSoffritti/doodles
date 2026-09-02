import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Drops NaN/Inf pixels before bloom: a single bad pixel would otherwise blur into a black frame.
const SanitizeShader = {
	uniforms: { tDiffuse: { value: null } },
	vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
	fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = clamp(c, 0.0, 64.0); }`,
};

const FilmShader = {
	uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.022 }, uVignette: { value: 0.5 }, uAberration: { value: 0.00045 }, uPulse: { value: 0 }, uSunScreen: { value: new THREE.Vector2(0.5, 0.5) }, uGlare: { value: 0 }, uAspect: { value: 1.78 } },
	vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse;
		uniform float uTime, uGrain, uVignette, uAberration, uPulse, uGlare, uAspect;
		uniform vec2 uSunScreen;
		varying vec2 vUv;
		float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
		void main(){
			vec2 c = vUv - 0.5;
			float r2 = dot(c, c);
			vec2 dir = c * (uAberration + uPulse * 0.0012) * (1.0 + r2 * 3.0);
			vec3 col;
			col.r = texture2D(tDiffuse, vUv + dir).r;
			col.g = texture2D(tDiffuse, vUv).g;
			col.b = texture2D(tDiffuse, vUv - dir).b;
			float vig = 1.0 - smoothstep(0.25, 1.05, r2 * 2.0) * uVignette;
			col *= vig;

			// glare from the red dwarf: a soft bloom around it, ghosts along the centre line, and a faint veil
			if (uGlare > 0.001) {
				vec2 d = (vUv - uSunScreen) * vec2(uAspect, 1.0);
				float dist = length(d);
				vec3 red = vec3(1.0, 0.22, 0.14);
				float halo = pow(max(1.0 - dist * 2.4, 0.0), 3.0) * 0.14;
				float ghosts = 0.0;
				for (int i = 1; i <= 3; i++) {
					vec2 g = mix(uSunScreen, vec2(0.5), float(i) * 0.45);
					vec2 gd = (vUv - g) * vec2(uAspect, 1.0);
					ghosts += pow(max(1.0 - length(gd) * (7.0 + float(i) * 3.0), 0.0), 2.0) * 0.03;
				}
				float veil = 0.012;
				col += red * (halo + ghosts + veil) * uGlare;
			}
			col += (hash(vUv * 1000.0) - 0.5) * uGrain;
			gl_FragColor = vec4(col, 1.0);
		}`,
};

export class PostProcessing {
	constructor(renderer, scene, camera) {
		this.composer = new EffectComposer(renderer);
		this.composer.addPass(new RenderPass(scene, camera));
		this.composer.addPass(new ShaderPass(SanitizeShader));
		this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.45, 0.78);
		this.composer.addPass(this.bloom);
		this.film = new ShaderPass(FilmShader);
		this.composer.addPass(this.film);
		this.composer.addPass(new OutputPass());
	}
	setSize(w, h) { this.composer.setSize(w, h); this.bloom.setSize(w, h); }
	render(time, shared) {
		this.film.uniforms.uTime.value = time % 100;
		this.film.uniforms.uAspect.value = innerWidth / innerHeight;
		this.film.uniforms.uGlare.value = shared.sunGlare || 0;
		if (shared.sunScreen) this.film.uniforms.uSunScreen.value.copy(shared.sunScreen);
		this.film.uniforms.uPulse.value = shared.audio ? shared.audio.analysis.bass * 0.6 : 0;
		this.bloom.strength = 0.42 + (shared.audio ? shared.audio.analysis.attack * 0.15 : 0) + shared.state.eclipse * 0.12;
		this.composer.render();
	}
}
