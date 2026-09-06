import * as THREE from 'three';
import { weatherGlsl } from './weather/WeatherGlsl.js';

const cloudGlsl = /* glsl */`
	${weatherGlsl}
	uniform vec3 uLightDir, uSunDir, uMoonDir, uLit, uDark;
	uniform float uCloudBase, uSun, uMoon, uDim, uDetail;
	float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
	float vnoise(vec2 p) {
		vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
		return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
	}
	float fbm(vec2 p) {
		float sum=0.0, amplitude=0.5;
		for(int i=0;i<5;i++) { if(float(i)>=uDetail)break; sum+=vnoise(p)*amplitude; p=p*2.02+17.0; amplitude*=0.5; }
		return sum;
	}
	float cloudNoise(vec2 p) {
		float t=uWeatherTime*0.018;
		// Independent slow eddies bend, grow and erode the shapes instead of sliding a fixed map.
		vec2 flow=vec2(sin(p.y*1.7+t)+cos(p.x*1.1-t*0.7),cos(p.x*1.5+t*0.8)-sin(p.y*1.3-t*0.6));
		vec2 warped=p+flow*0.19;
		return fbm(warped)*0.82+fbm(p*1.8-flow*0.13+vec2(t*0.07,-t*0.045))*0.18;
	}
	vec4 cloudColor(vec3 d, vec3 eye) {
		if(d.y<0.02)return vec4(0);
		float height=max(150.0,uCloudBase-eye.y);
		vec2 world=eye.xz+d.xz*height/max(d.y,0.035);
		vec4 w=weatherAt(world); if(w.r<0.001)return vec4(0);
		// Keep the original broad overhead silhouette and horizon compression.
		vec2 uv=d.xz/(d.y+0.25)*1.44+eye.xz*0.00012-uWeatherOffset*0.00055;
		float n=cloudNoise(uv);
		float threshold=mix(0.78,0.30,pow(w.r,0.8));
		float cloud=smoothstep(threshold-0.06,threshold+0.08,n)*smoothstep(0.0,0.08,w.r);
		cloud=max(cloud,w.b*w.r*(0.86+0.14*n));
		float n2=cloudNoise(uv+uLightDir.xz*0.06);
		float lit=smoothstep(-0.05,0.12,n2-n);
		float textureTone=smoothstep(0.30,0.72,n);
		vec3 col=mix(uDark,uLit,clamp(lit*0.8+0.1+textureTone*0.16,0.0,1.0))*uDim;
		float sunFacing=pow(max(dot(d,uSunDir),0.0),6.0)*uSun;
		float moonFacing=pow(max(dot(d,uMoonDir),0.0),10.0)*uMoon;
		// Warm red edges toward the dwarf, violet/silver edges toward the moon.
		col+=vec3(0.20,0.018,0.032)*sunFacing*(0.35+lit);
		col+=vec3(0.085,0.07,0.16)*moonFacing*(0.25+lit);
		col=mix(col,vec3(0.025,0.034,0.052)*(0.65+lit*0.75+textureTone*0.25),w.b*0.95);
		col+=vec3(0.4,0.5,0.8)*uLightning*(0.25+w.b);
		float horizon=smoothstep(0.02,mix(0.2,0.055,w.b),d.y);
		float opacity=mix(0.82,0.94,w.b);
		return vec4(col,cloud*horizon*opacity);
	}`;

// The original layered, cel-shaded sky treatment, with continuously evolving noise and
// shared weather coverage. Translucent undersides leave the red dwarf and moon visible.
export class Clouds {
	constructor(parent, shared) {
		this.shared = shared;
		this.size = new THREE.Vector2(); this.viewport = new THREE.Vector4();
		this.uniforms = { ...shared.weather.uniforms,
			uViewInverse: { value: new THREE.Matrix4() }, uProjectionInverse: { value: new THREE.Matrix4() }, uEye: { value: new THREE.Vector3() },
			uCloudTexture: { value: null }, uResolution: { value: new THREE.Vector2() }, uMainView: { value: true },
			uLightDir: { value: new THREE.Vector3(0, 1, 0) },
			uSunDir: { value: new THREE.Vector3(0, -1, 0) }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
			uSun: { value: 0 }, uMoon: { value: 0 }, uDim: { value: 1 }, uDetail: { value: 5 },
			uLit: { value: new THREE.Color('#7a5aa6') }, uDark: { value: new THREE.Color('#12091f') },
			uCloudBase: { value: Math.max(1450, (shared.world.stats?.maxH || 1000) + 150) },
		};
		this.target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
		this.uniforms.uCloudTexture.value = this.target.texture;
		this.passScene = new THREE.Scene(); this.passCamera = new THREE.Camera();
		this.passScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
			uniforms: this.uniforms, depthTest: false, depthWrite: false,
			vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
			fragmentShader: /* glsl */`
				varying vec2 vUv;
				uniform mat4 uViewInverse,uProjectionInverse;
				uniform vec3 uEye;
				${cloudGlsl}
				void main(){
					vec4 view=uProjectionInverse*vec4(vUv*2.0-1.0,1.0,1.0);
					gl_FragColor=cloudColor(normalize(mat3(uViewInverse)*view.xyz),uEye);
				}`,
		})));
		this.sunLit = new THREE.Color('#c0352a'); this.sunDark = new THREE.Color('#2a0a14');
		this.mesh = new THREE.Mesh(new THREE.SphereGeometry(5500, 48, 24), new THREE.ShaderMaterial({
			uniforms: this.uniforms, side: THREE.BackSide, transparent: true, depthWrite: false,
			vertexShader: /* glsl */`
				varying vec3 vDir;
				void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
			fragmentShader: /* glsl */`
				varying vec3 vDir;
				uniform bool uMainView;
				uniform sampler2D uCloudTexture;
				uniform vec2 uResolution;
				${cloudGlsl}
				void main() {
					gl_FragColor=uMainView ? texture2D(uCloudTexture,gl_FragCoord.xy/uResolution) : cloudColor(normalize(vDir),cameraPosition);
				}`,
		}));
		this.mesh.onBeforeRender = (renderer, scene, camera) => { this.uniforms.uMainView.value = camera === shared.camera; };
		this.mesh.renderOrder = -6; this.mesh.frustumCulled = false; parent.add(this.mesh);
	}

	update(time, dt, shared, dim) {
		this.mesh.visible = !this.disabled;
		if (this.disabled) return;
		const u = this.uniforms;
		// Color follows the celestial source before ground-level cloud attenuation is applied.
		const shade = Math.max(0.1, 1 - (shared.state.cloudCover || 0) * 0.55);
		const sun = Math.min(1, shared.sun.intensity / shade), moon = Math.min(1, shared.moon.intensity / shade);
		u.uLightDir.value.copy(sun > moon ? shared.sun.dir : shared.moon.dir);
		u.uSunDir.value.copy(shared.sun.dir); u.uMoonDir.value.copy(shared.moon.dir);
		u.uSun.value = sun; u.uMoon.value = moon;
		u.uDim.value = 0.5 + 0.65 * dim * Math.max(moon, sun);
		u.uLit.value.set('#7a5aa6').lerp(this.sunLit, sun * 0.8);
		u.uDark.value.set('#12091f').lerp(this.sunDark, sun);
		const renderer=shared.renderer,camera=shared.camera;
		camera.updateMatrixWorld();
		u.uViewInverse.value.copy(camera.matrixWorld); u.uProjectionInverse.value.copy(camera.projectionMatrixInverse); u.uEye.value.copy(camera.position);
		renderer.getDrawingBufferSize(this.size); u.uResolution.value.copy(this.size);
		const scale=Math.min(0.6,960/this.size.x),width=Math.max(1,Math.round(this.size.x*scale)),height=Math.max(1,Math.round(this.size.y*scale));
		if(this.target.width!==width || this.target.height!==height)this.target.setSize(width,height);
		const oldTarget=renderer.getRenderTarget();renderer.getViewport(this.viewport);
		renderer.setRenderTarget(this.target);renderer.render(this.passScene,this.passCamera);
		renderer.setRenderTarget(oldTarget);renderer.setViewport(this.viewport);
	}
}
