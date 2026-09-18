import * as THREE from 'three';
import { WaterFish } from './WaterFish.js?v=3';
import { lilyPetal as blade, lilyPad } from './WaterLilyGeometry.js';
import { Random } from '../core/Random.js';
import { WATER_RADIUS, BED_Y } from './WaterStudy.js';

const TAU=Math.PI*2;
export class WaterMeshes {
 constructor(scene,model) {
  this.model=model;this.root=new THREE.Group();scene.add(this.root);this.geometries=new Set();this.materials=new Set();
  this.lilies=[];this.rings=[];this.picks=[];this.night=false;this.clarity=.72;
  this.geo=g=>{this.geometries.add(g);return g;};
  this.mat=(color,options={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.85,flatShading:true,...options});this.materials.add(m);return m;};
  this.mesh=(g,m,parent=this.root)=>{const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  this.stoneGeo=this.geo(new THREE.IcosahedronGeometry(1,1));this.ballGeo=this.geo(new THREE.SphereGeometry(1,12,8));
  this.buildPool();this.fish=new WaterFish(this.root,model);this.buildLilies();
  this.update(new THREE.PerspectiveCamera());
 }
 buildPool() {
  const rnd=new Random('water-study-bed'),bedMat=this.mat('#657b73'),bankMat=this.mat('#72717b');
  this.bed=this.mesh(this.geo(new THREE.CylinderGeometry(WATER_RADIUS,WATER_RADIUS,.25,64)),bedMat);this.bed.position.y=BED_Y-.13;
  const base=this.mesh(this.geo(new THREE.CylinderGeometry(WATER_RADIUS+.18,WATER_RADIUS-.15,.45,64)),this.mat('#52575a'));base.position.y=BED_Y-.42;
  // Keep the middle of the pool open for the fish.
  for(let i=0;i<42;i++){
   const a=rnd.range(0,TAU),r=rnd.range(5.5,6.8),s=rnd.range(.16,.55),rock=this.mesh(this.stoneGeo,bankMat);
   rock.position.set(Math.cos(a)*r,BED_Y+s*.3,Math.sin(a)*r);rock.scale.set(s*1.3,s*.6,s);rock.rotation.set(rnd.range(0,1),a,0);
  }
  for(let i=0;i<48;i++){const a=rnd.range(0,TAU),r=rnd.range(.7,5.4),s=rnd.range(.045,.14),rock=this.mesh(this.stoneGeo,bankMat);rock.position.set(Math.cos(a)*r,BED_Y+s*.15,Math.sin(a)*r);rock.scale.set(s*1.6,s*.35,s);rock.rotation.y=a;}
  const plantMat=this.mat('#435b53',{side:THREE.DoubleSide}),leafGeo=this.geo(blade(1.2,.13));
  for(let i=0;i<12;i++){const a=i/12*TAU,r=5.7;for(let j=0;j<3;j++){
   const leaf=this.mesh(leafGeo,plantMat);leaf.position.set(Math.cos(a)*r,BED_Y,Math.sin(a)*r);leaf.rotation.set(.15*j,a+j*.7,1.1+j*.13);leaf.scale.setScalar(rnd.range(.5,1.2));
  }}
  const waterMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
   uniforms:{time:{value:0},clarity:{value:this.clarity},night:{value:0}},
   vertexShader:`varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
   fragmentShader:`uniform float time,clarity,night;varying vec3 vWorld;
    void main(){vec2 p=vWorld.xz;vec3 n=normalize(vec3(sin(p.x*2.1+time*.5)*.018,1.,cos(p.y*2.8-time*.35)*.024));
    vec3 view=normalize(cameraPosition-vWorld);float f=pow(1.-max(0.,dot(n,view)),3.);
    float wave=pow(max(0.,sin(p.x*5.+p.y*2.+sin(p.y*3.-time*.5)+time*.45)),22.);
    vec3 tint=mix(vec3(.26,.48,.43),vec3(.10,.16,.22),night);tint+=wave*.014+f*.10;
    gl_FragColor=vec4(tint,(1.-clarity)*.5+.05+f*.23);}`});
  this.materials.add(waterMat);this.water=this.mesh(this.geo(new THREE.CircleGeometry(WATER_RADIUS,96)),waterMat);this.water.rotation.x=-Math.PI/2;this.water.renderOrder=3;this.water.castShadow=false;this.picks.push(this.water);
  const edgeMat=this.mat('#769c92',{transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide});
  const edge=this.mesh(this.geo(new THREE.CylinderGeometry(WATER_RADIUS,WATER_RADIUS,-BED_Y,96,1,true)),edgeMat);edge.position.y=BED_Y/2;edge.castShadow=false;edge.renderOrder=2;
  const rim=this.mesh(this.geo(new THREE.RingGeometry(WATER_RADIUS-.015,WATER_RADIUS+.015,96)),this.mat('#99b5aa',{transparent:true,opacity:.45,side:THREE.DoubleSide}));rim.rotation.x=-Math.PI/2;rim.position.y=.005;rim.castShadow=false;
  this.waterExtras=[edge,rim];
  const ringGeo=this.geo(new THREE.RingGeometry(.97,1,80));
  for(let i=0;i<4;i++){const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{alpha:{value:0}},
   vertexShader:`varying vec2 world;void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xz;gl_Position=projectionMatrix*viewMatrix*p;}`,
   fragmentShader:`uniform float alpha;varying vec2 world;void main(){if(length(world)>6.8)discard;gl_FragColor=vec4(.7,.75,.85,alpha);}`});
   this.materials.add(mat);const ring=this.mesh(ringGeo,mat);ring.rotation.x=-Math.PI/2;ring.position.y=.024;ring.renderOrder=5;ring.castShadow=false;this.rings.push(ring);}
 }
 buildLilies() {
  const padGeo=this.geo(lilyPad()),petalGeo=this.geo(blade(.68,.22));
  const padMat=this.mat('#647e45',{side:THREE.DoubleSide,vertexColors:true});
  const glowGeo=this.geo(new THREE.PlaneGeometry(2,2));
  for(const p of this.model.plants){
   const root=new THREE.Group();root.position.set(p.x,0,p.z);root.rotation.y=p.turn;root.scale.setScalar(p.size);this.root.add(root);
   const pads=[];
   for(let j=0;j<2;j++){
    const pad=this.mesh(padGeo,padMat,root);pad.rotation.set(-Math.PI/2,0,j*1.4);pad.position.set(j?-.5:.7,.032,j?.68:.3);pad.scale.setScalar(j?.62:.9);pad.castShadow=false;pads.push(pad);this.picks.push(pad);pad.userData.plant=p.index;
   }
   // The flower cup rests on the surface; no submerged stalks.
   const flower=new THREE.Group();flower.position.set(-.23,.008,0);root.add(flower);
   const petals=[],petalMat=this.mat('#f5ecd4',{side:THREE.DoubleSide,emissive:'#efb87b',emissiveIntensity:0});
   const cup=this.mesh(this.geo(new THREE.SphereGeometry(1,12,4,0,TAU,Math.PI/2,Math.PI/2)),petalMat,flower);
   cup.name='flower-cup';cup.scale.set(.23,.10,.23);cup.position.y=.10;
   for(let j=0;j<12;j++){
    const pivot=new THREE.Group();pivot.rotation.y=j%6/6*TAU+(j>=6?.5:0);flower.add(pivot);
    const petal=this.mesh(petalGeo,petalMat,pivot);petal.position.set(.10,.05,0);petal.scale.setScalar(j>=6?.7:1);petals.push(petal);
   }
   const coreMat=this.mat('#f5ca72',{emissive:'#ffc06e',emissiveIntensity:.12});const core=this.mesh(this.ballGeo,coreMat,flower);core.scale.set(.16,.055,.16);core.position.y=.115;this.picks.push(core);core.userData.plant=p.index;
   const light=new THREE.PointLight('#ffc786',0,2.4,2);light.position.set(p.x,.35,p.z);this.root.add(light);
   const reflectionMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{strength:{value:0},time:{value:0}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float strength,time;varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;float a=exp(-dot(p,p)*5.)*(.55+.45*sin(vUv.y*100.+time*2.));gl_FragColor=vec4(1.,.68,.28,a*strength);}`});
   this.materials.add(reflectionMat);const reflection=this.mesh(glowGeo,reflectionMat);reflection.position.set(p.x,.022,p.z+.8);reflection.rotation.x=-Math.PI/2;reflection.scale.set(.6,1,1);reflection.renderOrder=4;reflection.castShadow=false;
   this.lilies.push({root,pads,flower,cup,petals,petalMat,core,coreMat,light,reflection,spec:p});
  }
 }
 setSurface(visible){this.water.visible=visible;for(const m of this.waterExtras)m.visible=visible;for(const l of this.lilies)l.reflection.visible=visible;}
 update(camera) {
  const t=this.model.time;this.water.material.uniforms.time.value=t;this.water.material.uniforms.clarity.value=this.clarity;this.water.material.uniforms.night.value=this.night?1:0;
  this.fish.update();
  for(const l of this.lilies){
   const p=l.spec,bob=Math.sin(t*.8+p.phase)*.013;l.root.position.y=bob;
   l.pads.forEach((pad,j)=>pad.rotation.x=-Math.PI/2+Math.sin(t*.7+j+p.phase)*.015);
   l.petals.forEach((petal,j)=>petal.rotation.z=.65-p.open*.60+(j>=6?.13:0));
   l.petalMat.emissiveIntensity=p.glow*.45;l.coreMat.emissiveIntensity=.12+p.glow*2.3;
   l.light.intensity=p.glow*(this.night?1.5:.4);l.reflection.material.uniforms.strength.value=p.glow*(this.night?.5:.2);l.reflection.material.uniforms.time.value=t;
  }
  this.rings.forEach((ring,i)=>{const r=this.model.ripples[i];ring.visible=!!r&&this.water.visible;if(!r)return;const age=t-r.born;ring.position.set(r.x,.024,r.z);ring.scale.setScalar(.05+age*1.5);ring.material.uniforms.alpha.value=Math.max(0,.44*(1-age/4));
  });
 }
 dispose(){this.fish.dispose();this.root.removeFromParent();for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();}
}
