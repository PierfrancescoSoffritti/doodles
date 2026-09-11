import { CaveFloorSurface } from './CaveFloorSurface.js';
import { caveLightingGlsl } from './CaveLighting.js';
import { EntranceDressing } from './EntranceDressing.js';
import * as THREE from 'three';
import { WaterOptics } from '../WaterOptics.js';
import { Ripples } from '../Ripples.js?v=player-notes-13';
import { noiseGlsl,terrainLightGlsl } from '../TerrainMaterial.js?v=player-notes-13';

const vertex=/* glsl */`
varying vec3 vWorldPos;
void main(){vWorldPos=position;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.0);}`;
const lighting=/* glsl */`
uniform vec3 uCamera,uEntrance,uSecondEntrance;
uniform float uLamp;
float daylight(vec3 p){return exp(-min(distance(p,uEntrance),distance(p,uSecondEntrance))*.024);}
${caveLightingGlsl}
vec3 caveLight(vec3 base,vec3 p,vec3 n){
 return caveLighting(base,p,n,daylight(p),uLamp,uCamera);
}`;

export class Caves {
	constructor(scene,heightmap,shared,data) {
		heightmap.caveFloorSurface=new CaveFloorSurface(data);
		this.heightmap=heightmap;this.shared=shared;this.groups=[];this.materials=[];this.optics=[];this.waterMeshes=[];
		const dressing=new EntranceDressing(shared);
		for(const cave of heightmap.world.caves || []) {
			const group=new THREE.Group();group.name=`cave-${cave.id}`; scene.add(group);
			const second=cave.entrances?.[1]||cave.entrance;
			const uniforms={uSecondEntrance:{value:new THREE.Vector3(second.x,second.y,second.z)},uCamera:{value:new THREE.Vector3()},uEntrance:{value:new THREE.Vector3(cave.entrance.x,cave.entrance.y,cave.entrance.z)},uLamp:{value:0}};
			for(const k of ['uMoonDir','uMoonColor','uMoonIntensity','uSunDir','uSunColor','uSunIntensity','uSkyColor','uGroundColor'])uniforms[k]=shared.terrainUniforms[k];
			uniforms.uLightning=shared.weather.uniforms.uLightning;
			Object.assign(uniforms,shared.ripples.uniforms,{uTime:{value:0}});
			const rock=new THREE.ShaderMaterial({uniforms,side:THREE.DoubleSide,vertexShader:vertex,fragmentShader:/* glsl */`
			varying vec3 vWorldPos;${noiseGlsl}${lighting}
			uniform vec3 uMoonDir,uMoonColor,uSunDir,uSunColor,uSkyColor,uGroundColor;
			uniform float uMoonIntensity,uSunIntensity,uLightning,uTime;
			${terrainLightGlsl}
			${Ripples.glsl()}
			void main(){
			 vec3 p=vWorldPos,n=normalize(cross(dFdx(p),dFdy(p)));
			 vec3 view=normalize(uCamera-p);if(dot(n,view)<0.0)n=-n;
			 float grains=fbm2(p.xz*.11+p.y*.037);
			 float layers=sin(p.y*.24+fbm2(p.xz*.055)*3.4);
			 float seam=1.0-smoothstep(.03,.19,abs(layers));
			 float wet=fbm2(p.xz*.028+p.y*.006);
			 vec3 limestone=mix(vec3(.25,.21,.29),vec3(.62,.55,.58),grains);
			 float floorMask=smoothstep(.45,.8,n.y);
			 limestone*=1.0-seam*.2*(1.0-floorMask);
			 vec3 gravel=mix(vec3(.16,.125,.15),vec3(.36,.3,.32),fbm2(p.xz*.65));
			 float sediment=smoothstep(.25,.7,fbm2(p.xz*.07));
			 limestone=mix(limestone,gravel,floorMask*(.5+.45*sediment));
			 limestone=mix(limestone,limestone*vec3(.63,.72,.74),smoothstep(.52,.72,wet)*.7);
			 vec3 color=caveLight(limestone,p,n);
			 // Daylit rock and sediment share the surface lighting across the threshold.
			 float exposure=smoothstep(.12,.7,daylight(p));
			 color=mix(color,terrainLight(limestone*.65,n),exposure);
			 color+=rippleGlow(p.xz,uTime)*1.4*floorMask;
			 float sheen=pow(max(dot(reflect(-view,n),view),0.0),24.0)*smoothstep(.55,.75,wet)*uLamp/(1.0+distance(p,uCamera)*.03);
			 gl_FragColor=vec4(color+sheen*vec3(.06,.055,.07),1.0);
			}`});
			dressing.add(group,(heightmap.world.caveHabitat||[]).filter(h=>h.cave===cave.id),rock);
			for(const chunk of [...data.chunks,...data.decorations].filter(c=>c.cave===cave.id)) {
				const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(chunk.position,3));geometry.computeBoundingSphere();
				group.add(new THREE.Mesh(geometry,rock));
			}
			const water=data.water.find(w=>w.cave===cave.id);
			if(water) {
				const u={...uniforms,uTime:{value:0},uSceneColor:{value:null},uHasScene:{value:0},uResolution:{value:new THREE.Vector2()}};
				const optics=new WaterOptics(shared,u);this.optics.push(optics);
				const material=new THREE.ShaderMaterial({uniforms:u,side:THREE.DoubleSide,transparent:true,vertexShader:/* glsl */`
				attribute vec2 aFlow;attribute float aDepth;uniform float uTime;
				varying vec2 vFlow;varying float vDepth;varying vec3 vWorldPos;
				void main(){vFlow=aFlow;vDepth=aDepth;vec3 p=position;
				 p.y+=sin(aFlow.x*.25+uTime*.25)*.065*smoothstep(0.0,1.0,aDepth);
				 vWorldPos=p;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);}`,
				fragmentShader:/* glsl */`
				uniform float uTime,uHasScene;uniform sampler2D uSceneColor;uniform vec2 uResolution;
				varying vec2 vFlow;varying float vDepth;varying vec3 vWorldPos;${lighting}
				${Ripples.glsl()}
				void main(){
				 if(vDepth<.03)discard;
				 vec3 p=vWorldPos,n=normalize(cross(dFdx(p),dFdy(p)));if(n.y<0.0)n=-n;
				 vec3 view=normalize(uCamera-p);
				 float wave=sin(vFlow.x*.6+uTime*.6+sin(vFlow.x*.13+vFlow.y*7.0)*1.7)*.5+.5;
				 vec2 uv=gl_FragCoord.xy/uResolution+vec2(wave-.5,0.0)*.0015*smoothstep(0.0,1.0,vDepth);
				 vec3 behind=texture2D(uSceneColor,clamp(uv,vec2(.002),vec2(.998))).rgb;
				 vec3 tint=caveLight(vec3(.075,.22,.24),p,n);
				 vec3 transmission=exp(-vec3(.36,.13,.1)*vDepth);
				 vec3 color=mix(tint,behind,transmission*uHasScene);
				 float fresnel=.025+.85*pow(1.0-max(dot(n,view),0.0),5.0);
				 color=mix(color,caveLight(vec3(.3,.35,.42),p,n),fresnel);
				 float riffle=pow(wave,12.0)*(1.0-smoothstep(.4,1.5,vDepth));
				 color+=caveLight(vec3(.65),p,n)*riffle*.075;
				 color+=rippleGlow(p.xz,uTime)*.8;
				 gl_FragColor=vec4(color,1.0);
				}`});
				const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(water.position,3));
				geometry.setAttribute('aFlow',new THREE.BufferAttribute(water.flow,2));geometry.setAttribute('aDepth',new THREE.BufferAttribute(water.depth,1));
				geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=3;mesh.onBeforeRender=(...args)=>optics.capture(...args);
				shared.mirrorHide.add(mesh);this.waterMeshes.push(mesh);group.add(mesh);this.materials.push(material);
			}
			this.materials.push(rock);this.groups.push({group,cave});
		}
	}
	update(time,pos) {
		const column=this.heightmap.caves.column(pos.x,pos.z,pos.y);
		const cover=column ? this.heightmap.height(pos.x,pos.z)-pos.y : 0;
		this.shared.caveAmount=column ? THREE.MathUtils.smoothstep(cover,0,18) : 0;
		this.shared.caveColumn=cover>0?column:null;
		for(const m of this.materials) {m.uniforms.uCamera.value.copy(pos);m.uniforms.uLamp.value=this.shared.caveAmount; if(m.uniforms.uTime)m.uniforms.uTime.value=time;}
		for(const o of this.optics)o.beginFrame();
		for(const {group,cave} of this.groups) group.visible=cave.paths.some(path=>path.points.some(p=>Math.hypot(pos.x-p.x,pos.z-p.z)<550 && Math.abs(pos.y-p.floor)<500));
	}
}
