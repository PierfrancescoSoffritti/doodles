import * as THREE from 'three';
import { config } from '../../core/Config.js';
import { Random } from '../../core/Random.js';
import { damp } from '../../core/Utils.js';
import { weatherGlsl } from './WeatherGlsl.js';

// Rain ribbons extend along world-space fall velocity; snow and hail use round billboards.
// All particles sample the same weather map, collide with terrain/water, and share integrated wind.
export class Precipitation {
	constructor(scene, shared, kind) {
		this.shared = shared; this.kind = kind; this.amount = 0; this.fall = 0;
		const snow = kind === 'snow', hail = kind === 'hail';
		const count = Math.round((snow ? 14000 : hail ? 1600 : 8500) * (config.isTouch ? 0.6 : 1));
		const random = new Random(config.seed + ':' + kind);
		const base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
		g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
		const seed = new Float32Array(count * 4);
		for (let i=0; i<count*4; i++) seed[i] = random.next();
		g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4)); g.instanceCount = count;
		this.uniforms = { ...shared.weather.uniforms, ...shared.shoreMap.uniforms,
			uParticleTime: { value: 0 }, uFall: { value: 0 }, uCenter: { value: new THREE.Vector3() },
			uTravel: { value: new THREE.Vector2() }, uLocalWind: { value: new THREE.Vector2() },
		};
		this.points = new THREE.Mesh(g, new THREE.ShaderMaterial({
			uniforms: this.uniforms, transparent: true, depthWrite: false,
			vertexShader: /* glsl */`
				attribute vec4 aSeed;
				uniform float uParticleTime, uFall;
				uniform vec3 uCenter;
				uniform vec2 uTravel,uLocalWind;
				varying vec2 vUv; varying float vAlpha; varying vec3 vWorldPosition;
				${weatherGlsl}
				${shared.shoreMap.glsl}
				void main(){
					vec3 p=vec3(aSeed.x*240.0,0.0,aSeed.y*240.0);
					p.xz += uTravel * ${snow ? '0.85' : hail ? '0.6' : '1.0'};
					${snow ? 'p.xz += vec2(sin(uParticleTime*0.8+aSeed.z*30.0),cos(uParticleTime*0.65+aSeed.w*35.0))*4.0;' : ''}
					p.xz=uCenter.xz+mod(p.xz-uCenter.xz+120.0,240.0)-120.0;
					vec4 surface=shoreSample(p.xz);
					float floorY=max(surface.r,surface.g);
					p.y=uCenter.y+mod(aSeed.z*170.0-uFall*(0.8+aSeed.w*0.4)-uCenter.y+45.0,170.0)-45.0;
					${hail ? `
					float phase=fract(aSeed.z+uFall*(0.8+aSeed.w*0.4)/170.0);
					// Water absorbs the impact. At zero bounce height the existing floor clip
					// hides the pellet until its next fall; only exposed solid ground rebounds.
					float bounce=surface.r>surface.g ? sin((phase-0.88)/0.12*3.14159)*1.8 : 0.0;
					p.y=floorY+(phase<0.88 ? (1.0-phase/0.88)*170.0 : bounce);` : ''}
					vec4 w=weatherAt(p.xz);
					float amount=weatherPrecipitation(p).${snow ? 'y' : hail ? 'z' : 'x'};
					float dist=distance(p,cameraPosition);
					vec3 local=p-uCenter;
					float edge=(1.0-smoothstep(100.0,120.0,max(abs(local.x),abs(local.z))));
					${hail ? '' : 'edge*=smoothstep(-45.0,-30.0,local.y)*(1.0-smoothstep(105.0,125.0,local.y));'}
					vAlpha=smoothstep(aSeed.w-0.035,aSeed.w+0.035,amount)*min(1.0,amount*3.0)*edge*smoothstep(2.5,8.0,dist)*(1.0-smoothstep(75.0,140.0,dist))*step(floorY+0.05,p.y);
					vec3 cameraRight=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
					vec3 cameraUp=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
					float width=${snow ? '0.22+aSeed.w*0.22' : hail ? '0.18+aSeed.w*0.15' : '(0.07+aSeed.w*0.045)*(1.0+w.b*0.35)'};
					${snow || hail ? 'p+=(cameraRight*position.x+cameraUp*position.y)*width;' : `
					// Perspective-project an actual falling segment, rather than normalizing its screen direction.
					// This naturally shortens a drop seen end-on and stays correct in reflection cameras too.
					vec3 velocity=vec3(uLocalWind.x,-95.0*(0.8+aSeed.w*0.4),uLocalWind.y);
					vec3 across=cross(velocity,normalize(p-cameraPosition));
					across=length(across)>0.001 ? normalize(across) : cameraRight;
					float shutter=0.022+w.b*0.028+aSeed.z*0.009;
					p+=across*position.x*width-velocity*position.y*shutter;`}

					vWorldPosition=p; vUv=uv; gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);
				}`,
			fragmentShader: /* glsl */`
				varying vec2 vUv; varying float vAlpha; varying vec3 vWorldPosition;
				uniform float uLightning;
				${shared.shoreMap.glsl}
				void main(){
					// Shelter belongs to the drop's position. Clip the whole ribbon below terrain/roof,
					// rather than hiding outdoor rain when the camera enters a cave.
					if(vWorldPosition.y<=max(terrainHeightAt(vWorldPosition.xz),waterLevelAt(vWorldPosition.xz))+0.05)discard;
					vec2 p=vUv*2.0-1.0;
					float shape=${snow || hail ? '1.0-smoothstep(0.35,1.0,length(p))' : '(1.0-smoothstep(0.15,1.0,abs(p.x)))*(1.0-smoothstep(0.55,1.0,abs(p.y)))'};
					float a=shape*vAlpha*${snow ? '0.85' : hail ? '0.95' : '0.72'};
					if(a<0.005)discard;
					gl_FragColor=vec4(vec3(${snow ? '0.75,0.78,0.88' : hail ? '0.65,0.75,0.9' : '0.46,0.51,0.66'})+uLightning*0.7,a);
				}`,
		}));
		// Water writes depth but blends late. Draw precipitation after sea AND inland water;
		// retain depth testing so waves, terrain and cave walls still occlude the drops.
		this.points.renderOrder = 4;
		this.points.frustumCulled = false; this.points.visible = false; scene.add(this.points);
	}

	advance(worldDt, dt, cameraPos) {
		const { shared: s, uniforms: u } = this;
		const target = s.state[this.kind] || 0;
		this.amount = damp(this.amount,target,2,dt);
		// Listener intensity remains sheltered for sound/fog. Outdoor particles use their own position.
		const allowed = s.weather.exposure * (this.kind === 'snow' && cameraPos.y <= 700 ? 0 : 1);
		s.state[this.kind + 'Visible'] = this.amount * allowed;
		this.points.visible = s.weather.precipitationNearby && s.surfaceStreaming !== false && s.shoreMap.covers(cameraPos.x, cameraPos.z);
		s.weather.particleLayers[this.kind] = this.points.visible;
		this.fall += worldDt * (this.kind === 'snow' ? 18 : this.kind === 'hail' ? 65 : 95);
		u.uParticleTime.value += worldDt; u.uFall.value = this.fall;
		u.uCenter.value.copy(cameraPos); u.uTravel.value.copy(s.weather.travel); u.uLocalWind.value.copy(s.weather.wind);
	}
}
