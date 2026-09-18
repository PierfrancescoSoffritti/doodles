import * as THREE from 'three';
import { WATER_RADIUS } from './WaterStudy.js';

// One shared 118-triangle fish. Pigment, fins and flat eyes share one material.
// Parts: 0 body/eyes, 1 tail, 2 left fin, 3 right fin.
export function createWaterFishGeometry() {
 const positions=[],colors=[],parts=[];
 const pigment=new THREE.Color('#ffffff'),finColor=new THREE.Color('#d8c2c2'),eyeColor=new THREE.Color('#20151d');
 function tri(a,b,c,color,part=0){for(const p of [a,b,c]){positions.push(...p);colors.push(color.r,color.g,color.b);parts.push(part);}}
 const rings=[[-.72,.025],[-.52,.21],[-.23,.34],[.12,.38],[.42,.29],[.64,.13],[.70,0]],n=8;
 const point=(i,j)=>{const [x,r]=rings[i],a=j/n*Math.PI*2;return [x,Math.cos(a)*r,Math.sin(a)*r*.72];};
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<n;j++){
  tri(point(i,j),point(i,j+1),point(i+1,j),pigment);
  tri(point(i,j+1),point(i+1,j+1),point(i+1,j),pigment);
 }
 tri([-.7,0,0],[-1.25,.37,0],[-1.16,0,0],finColor,1);
 tri([-.7,0,0],[-1.16,0,0],[-1.25,-.37,0],finColor,1);
 for(const side of [-1,1]){
  const a=[.12,-.09,side*.24],b=[-.15,-.12,side*.6],c=[-.36,-.12,side*.49],d=[-.06,-.09,side*.24],part=side<0?2:3;
  tri(a,b,c,finColor,part);tri(a,c,d,finColor,part);
  const center=[.48,.105,side*.194];
  for(let j=0;j<8;j++){
   const at=k=>[center[0]+Math.cos(k/8*Math.PI*2)*.04,center[1]+Math.sin(k/8*Math.PI*2)*.04,center[2]];
   tri(center,at(j),at(j+1),eyeColor,4);
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 g.setAttribute('aPart',new THREE.Float32BufferAttribute(parts,1));
 g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

export class WaterFish {
 constructor(parent,model){
  this.model=model;this.lastTime=-1;this.mesh=null;this.pose=new THREE.Object3D();
  if(!model.fish.length)return;
  this.geometry=createWaterFishGeometry();
  this.geometry.setAttribute('aBeat',new THREE.InstancedBufferAttribute(new Float32Array(model.fish.map(f=>f.beat)),1));
  this.geometry.setAttribute('aMark',new THREE.InstancedBufferAttribute(new Float32Array(model.fish.map(f=>f.marking||0)),1));
  this.burst=new THREE.InstancedBufferAttribute(new Float32Array(model.fish.length),1).setUsage(THREE.DynamicDrawUsage);this.geometry.setAttribute('aBurst',this.burst);
  this.uniforms={uFishTime:{value:0}};
  this.material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.85,flatShading:true,side:THREE.DoubleSide});
  this.material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.uniforms);
   shader.vertexShader='attribute float aBurst; attribute float aPart; attribute float aBeat; attribute float aMark; uniform float uFishTime; varying vec3 vFishPoint; varying float vFishMark; varying float vFishPart;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vFishPoint=position;vFishMark=aMark;vFishPart=aPart;
    if(aPart>.5&&aPart<1.5){
     float a=(sin(uFishTime*5.+aBeat)*.15+sin(uFishTime*22.+aBeat)*aBurst*.3);
     vec2 p=transformed.xz-vec2(-.7,0.);transformed.xz=vec2(cos(a)*p.x+sin(a)*p.y,-sin(a)*p.x+cos(a)*p.y)+vec2(-.7,0.);
    }else if(aPart>1.5&&aPart<3.5){
     float side=aPart<2.5?-1.:1.;float a=side*(.18+sin(uFishTime*4.+aBeat)*.22);
     vec2 p=transformed.yz-vec2(-.09,side*.24);transformed.yz=vec2(cos(a)*p.x-sin(a)*p.y,sin(a)*p.x+cos(a)*p.y)+vec2(-.09,side*.24);
    }`);
   shader.fragmentShader='varying vec3 vFishPoint; varying float vFishMark; varying float vFishPart;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    if(vFishPart<.5){
     float markMask=0.;
     if(vFishMark>.5&&vFishMark<1.5)markMask=smoothstep(.07,.13,vFishPoint.y)*.55;
     else if(vFishMark>1.5&&vFishMark<2.5)markMask=(1.-smoothstep(.11,.18,abs(vFishPoint.x+.15)))*.68;
     else if(vFishMark>2.5)markMask=(1.-smoothstep(.07,.15,abs(vFishPoint.y+.04)))*.7;
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.76,.40),markMask);
    }`);
  };
  this.material.customProgramCacheKey=()=> 'water-fish-instanced-4';
  this.mesh=new THREE.InstancedMesh(this.geometry,this.material,model.fish.length);this.mesh.name='scarlet-fish-batch';
  this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  this.mesh.castShadow=false;this.mesh.receiveShadow=false;
  // A conservative pool-sized bound includes animated fins and every route.
  this.mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,-.9,0),WATER_RADIUS+1);
  const color=new THREE.Color();model.fish.forEach((f,i)=>this.mesh.setColorAt(i,color.set(f.color||'#ef332b').offsetHSL(f.hue||0,0,0)));
  parent.add(this.mesh);this.update();
 }
 update(){
  if(!this.mesh||this.lastTime===this.model.time)return;
  const t=this.model.time;this.lastTime=t;this.uniforms.uFishTime.value=t;
  this.model.fish.forEach((s,i)=>{
   this.burst.setX(i,s.burst||0);
   this.pose.position.set(s.x,s.y,s.z);this.pose.rotation.set(0,s.yaw,Math.sin(t*2+s.beat)*.025);this.pose.scale.set(s.size*(s.bodyLength||1),s.size*(s.bodyWidth ? .2*s.bodyWidth+.8 : 1),s.size*(s.bodyWidth||1));this.pose.updateMatrix();this.mesh.setMatrixAt(i,this.pose.matrix);
  });
  this.mesh.instanceMatrix.needsUpdate=true;this.burst.needsUpdate=true;
 }
 dispose(){if(!this.mesh)return;this.mesh.removeFromParent();this.mesh.dispose();this.geometry.dispose();this.material.dispose();}
}
