import * as THREE from 'three';
import { weatherGlsl } from './WeatherGlsl.js';

// Distant precipitation shafts bridge the visible cloud deck and nearby particle volume.
// Small overlapping slabs are drawn only over wet weather cells, with feathered edges.
export class RainCurtains {
	constructor(scene, shared) {
		this.shared=shared;this.version=-1;this.centers=[];
		const g=new THREE.PlaneGeometry(1,1);
		this.mesh=new THREE.InstancedMesh(g,new THREE.ShaderMaterial({
			uniforms:shared.weather.uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
			vertexShader: `varying vec3 vWorld; varying vec2 vUv; void main(){vUv=uv;vec4 p=modelMatrix*instanceMatrix*vec4(position,1.0);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
			fragmentShader: /* glsl */`
				varying vec3 vWorld; varying vec2 vUv;
				${weatherGlsl}
				void main(){
					vec4 w=weatherAt(vWorld.xz);
					float edge=sin(vUv.x*3.14159);edge*=edge;
					float vertical=smoothstep(0.0,0.2,vUv.y)*(1.0-smoothstep(0.78,1.0,vUv.y));
					float streak=0.65+0.2*sin(vWorld.x*0.025+vWorld.z*0.023+sin(vWorld.y*0.006-uWeatherTime)*0.7);
					float dist=distance(vWorld,cameraPosition);
					float alpha=edge*vertical*min(1.0, dot(weatherPrecipitation(vWorld), vec3(1.0)))*streak*0.17*smoothstep(150.0,500.0,dist)*(1.0-smoothstep(10000.0,16000.0,dist));
					vec3 tone=mix(vec3(0.22,0.20,0.32),vec3(0.085,0.07,0.13),w.b);
					tone=mix(tone,vec3(0.32,0.34,0.44),weatherSnow(vWorld));
					gl_FragColor=vec4(tone+uLightning*0.35,alpha);
				}`,
		}),64);
		this.mesh.count=0;this.mesh.frustumCulled=false;scene.add(this.mesh);
		this.dummy=new THREE.Object3D();
	}
	update(position,base) {
		const m=this.shared.weather.model;
		// Stable columns fade with interpolated precipitation; ranking wet cells caused shafts to pop.
		if (!this.centers.length) {
			const stride = Math.ceil((m.res - 2) / 8);
			for (let z=1; z<m.res-1; z+=stride) for (let x=1; x<m.res-1; x+=stride) {
				this.centers.push({x:m.originX+x*m.cell,z:m.originZ+z*m.cell,y:Math.max(0,m.ground[z*m.res+x])});
			}
		}

		this.mesh.count=this.centers.length;
		for(let i=0;i<this.centers.length;i++){
			const c=this.centers[i],d=this.dummy,height=Math.max(100,base-c.y);
			d.position.set(c.x,c.y+height/2,c.z);d.rotation.set(0,Math.atan2(position.x-c.x,position.z-c.z),0);
			d.scale.set(m.cell*4,height,1);d.updateMatrix();this.mesh.setMatrixAt(i,d.matrix);
		}
		this.mesh.instanceMatrix.needsUpdate=true;
	}
}
