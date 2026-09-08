import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// One instanced draw, with the same deformation in the colour and shadow pass.
// Parts share a compact pose; no per-frame vertex uploads or skeletal objects.
export const birdDeformation = /* glsl */`
attribute float aPart;
attribute float aSpecies;
attribute vec3 aSlender;
attribute vec3 aCrested;
attribute vec4 aWing;
attribute vec4 aPose;
attribute vec4 aFeet;
vec3 birdRoll(vec3 p, float a) { return vec3(p.x, cos(a)*p.y-sin(a)*p.z, sin(a)*p.y+cos(a)*p.z); }
vec3 birdPitch(vec3 p, float a) { return vec3(cos(a)*p.x-sin(a)*p.y, sin(a)*p.x+cos(a)*p.y, p.z); }
vec3 birdBody(vec3 p) { return birdPitch(birdRoll(p, aPose.y), aPose.x); }
vec3 birdFoot(float side) {
 vec3 tucked = vec3(-.22, -.16, side*.12);
 vec3 reaching = vec3(.12, -.42, side*.12);
 return mix(mix(birdBody(tucked), reaching, aFeet.x), vec3(.12, aFeet.z, side*.12), aFeet.y);
}
vec3 deformBird(vec3 p) {
 p = aSpecies < .5 ? p : aSpecies < 1.5 ? aSlender : aCrested;
 if (aPart > 4.5) {
  float side = (aPart == 5.0 || aPart == 7.0) ? -1.0 : 1.0;
  vec3 foot = birdFoot(side);
  if (aPart < 6.5) {
   vec3 hip = birdBody(vec3(.015, -.14, side*.12));
   return mix(hip, foot, p.y) + vec3(p.x, 0.0, p.z);
  }
  return foot + mix(birdBody(p), p, max(aFeet.y, aFeet.x));
 }
 if (aPart > 1.5 && aPart < 3.5) {
  float side = aPart == 2.0 ? -1.0 : 1.0;
  float span = abs(p.z), inner = min(span, .58), outer = max(0.0, span-.58);
  float shoulder = aWing.x, wrist = shoulder + aWing.y;
  vec3 flying = vec3(p.x - outer*max(aWing.y,0.0)*.16,
   .075 + sin(shoulder)*inner + sin(wrist)*outer,
   side*(.16 + cos(shoulder)*inner + cos(wrist)*outer));
  vec3 folded = vec3(.10 - span*.38 + (p.x+.2)*.32,
   .07 + span*.045 + p.x*.26,
   side*(.20*(1.0-.4*span/1.42) + sin(span/1.42*3.14159)*.035));
  p = mix(flying, folded, aWing.z);
 } else if (aPart > 3.5) {
  p.z *= 1.0 + aWing.w*.85;
  p = vec3(-.32, -.03, 0) + birdPitch(p-vec3(-.32,-.03,0), aWing.w*.25);
 } else if (aPart > .5) {
  vec3 pivot = vec3(.30,.17,0);
  p = birdPitch(p-pivot, aPose.w);
  p = vec3(cos(aPose.z)*p.x + sin(aPose.z)*p.z, p.y, -sin(aPose.z)*p.x + cos(aPose.z)*p.z) + pivot;
 }
 return birdBody(p);
}
`;

// Same topology and joints for all three anatomies; morph targets are immutable.
// Beak tips share a reach so the existing peck still meets the ground.
function shapeVertex(x,y,z,part,feature,species){
 if(feature==='crest')return species===2?[x,y,z]:[.22,.30,0];
 if(part===0){const scale=[[.9,1.12,1.08],[1.15,.85,.82],[1.14,1.16,1.2]][species];return [(x+.02)*scale[0]-.02,y*scale[1],z*scale[2]];}
 if(part===1){
  if(feature==='beak'){const length=[.7,1,.9][species],width=[.8,.7,1.1][species];return [.705+(x-.705)*length,.19+(y-.19)*width,z*width];}
  const scale=[[1.1,1.08,1.08],[.92,.9,.88],[1.06,1.08,1.06]][species];
  return [.31+(x-.31)*scale[0],.20+(y-.20)*scale[1],z*scale[2]];
 }
 if(part===2||part===3)return [x*[1.08,.76,1.2][species],y,z*[.88,1.1,1.12][species]];
 if(part===4)return [-.32+(x+.32)*[.6,1.65,1.12][species],y,z*[1.05,.7,1.2][species]];
 return [x,y,z];
}
function geometry() {
 const parts = [];
 function add(g, part, color, feature='') {
  if (g.index) { const old = g; g = g.toNonIndexed(); old.dispose(); }
  g.deleteAttribute('uv');
  const source=g.attributes.position.array.slice(),shapes=[0,1,2].map(species=>{
   const points=[];for(let i=0;i<source.length;i+=3)points.push(...shapeVertex(source[i],source[i+1],source[i+2],part,feature,species));return new THREE.Float32BufferAttribute(points,3);
  });
  g.setAttribute('position',shapes[0]);g.setAttribute('aSlender',shapes[1]);g.setAttribute('aCrested',shapes[2]);g.computeVertexNormals();
  const count = g.attributes.position.count, rgb = new THREE.Color(color), colors = new Float32Array(count*3);
  for (let i=0;i<count;i++) rgb.toArray(colors, i*3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(count).fill(part), 1));
  parts.push(g);
 }
 function ellipsoid(position, scale, part, color, detail=1) {
  const g=new THREE.IcosahedronGeometry(1,detail); g.scale(...scale); g.translate(...position); add(g,part,color);
 }
 ellipsoid([-.02,0,0],[.43,.255,.22],0,'#333640');
 ellipsoid([.31,.20,0],[.215,.205,.185],1,'#30343b');
 const beak = new THREE.ConeGeometry(.079,.28,4); beak.rotateZ(-Math.PI/2); beak.scale(1,.72,1); beak.translate(.565,.19,0); add(beak,1,'#252a2e','beak');
 for(let i=0;i<3;i++){
  const crest=new THREE.ConeGeometry(.075,.32+i*.065,3);crest.rotateZ(.38);crest.translate(.29-i*.085,.43+i*.025,0);add(crest,1,'#ab7244','crest');
 }
 for(const side of [-1,1]) ellipsoid([.383,.249,side*.153],[.022,.022,.012],1,'#101719',0);
 // Broad inner wing, tapered outer wing. Its angular outline stays legible at
 // walking distance; fold and wrist movement change the span, not the body.
 for(const side of [-1,1]) {
  const rows=[[0,.13,.32],[.58,.01,.52],[1.03,-.23,.43],[1.42,-.61,.045]], points=[], ids=[];
  for(const [span,leading,chord] of rows) for(let j=0;j<3;j++) points.push(leading-chord*j/2,0,side*span);
  for(let i=0;i<3;i++) for(let j=0;j<2;j++) {const a=i*3+j,b=a+3; ids.push(a,b,a+1,a+1,b,b+1);}
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(points,3)); g.setIndex(ids); g.computeVertexNormals(); add(g,side<0?2:3,'#414550');
 }
 const tail=new THREE.BufferGeometry();
 tail.setAttribute('position',new THREE.Float32BufferAttribute([-.30,-.03,-.08,-.96,-.09,-.155,-.98,-.09,.155,-.30,-.03,-.08,-.98,-.09,.155,-.30,-.03,.08],3)); tail.computeVertexNormals(); add(tail,4,'#2d333c');
 function toe(a,b,part) {
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);
  const g=new THREE.CylinderGeometry(.009,.011,d.length(),4,1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));
  g.translate(...start.add(end).multiplyScalar(.5).toArray()); add(g,part,'#252c30');
 }
 for(const side of [-1,1]) {
  const g=new THREE.CylinderGeometry(.014,.011,1,4,1); g.translate(0,.5,0); add(g,side<0?5:6,'#252c30');
  for(const z of [-.045,0,.045]) toe([0,.014,0],[.11,-.003,z],side<0?7:8);
  toe([0,.014,0],[-.055,-.008,0],side<0?7:8);
 }
 const merged=mergeGeometries(parts); parts.forEach(g=>g.dispose());
 return merged;
}

export class BirdMesh {
 constructor(scene, capacity=1) {
  this.geometry=geometry();
  for(const name of ['aWing','aPose','aFeet']) this.geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage));
  this.geometry.setAttribute('aSpecies',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1));
  this.geometry.setAttribute('aPalette',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1));
  const inject=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float aPalette;\n'+birdDeformation).replace('#include <begin_vertex>','vec3 transformed = deformBird(position);').replace('#include <color_vertex>',`#include <color_vertex>
   vec3 wing=aPalette<.5?vec3(.045,.34,.40):aPalette<1.5?vec3(.28,.12,.43):vec3(.07,.20,.52);
   vec3 breast=aPalette<.5?vec3(.82,.24,.09):aPalette<1.5?vec3(.88,.55,.13):vec3(.83,.37,.24);
   vec3 cream=vec3(.82,.73,.49);
   if(aPart<.5)vColor.rgb=mix(wing,breast,(1.-smoothstep(-.13,.08,position.y)));
   else if(aPart<1.5&&max(max(color.r,color.g),color.b)>.012){vColor.rgb=color.g<.026?cream:wing;if(aSpecies>1.5&&color.r>.2)vColor.rgb=mix(wing,cream,.65);}
   else if(aPart>1.5&&aPart<4.5){vColor.rgb=mix(wing,cream,smoothstep(.95,1.4,abs(position.z))*.7);}
  `);};
  this.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,flatShading:true,side:THREE.DoubleSide});
  this.material.onBeforeCompile=inject; this.material.customProgramCacheKey=()=> 'bird-three-anatomies-v3';
  this.depthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide}); this.depthMaterial.onBeforeCompile=inject;
  this.mesh=new THREE.InstancedMesh(this.geometry,this.material,capacity); this.mesh.count=0;
  this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.castShadow=true; this.mesh.frustumCulled=false; this.mesh.customDepthMaterial=this.depthMaterial;
  this.transform=new THREE.Object3D(); scene.add(this.mesh);
 }
 update(poses) {
  if(poses.length>this.mesh.instanceMatrix.count) throw new RangeError('Bird mesh capacity exceeded');
  this.mesh.count=poses.length;
  poses.forEach((p,i)=>{
   this.transform.position.set(p.position.x,p.position.y,p.position.z); this.transform.rotation.set(0,p.yaw,0); this.transform.scale.setScalar(p.size ?? 1); this.transform.updateMatrix(); this.mesh.setMatrixAt(i,this.transform.matrix);
   this.geometry.attributes.aSpecies.setX(i,p.species ?? 0);
   this.geometry.attributes.aPalette.setX(i,p.variant ?? i%3);
   this.geometry.attributes.aWing.setXYZW(i,p.shoulder,p.wrist,p.fold,p.tail);
   this.geometry.attributes.aPose.setXYZW(i,p.pitch,p.bank,p.headYaw,p.headPitch);
   this.geometry.attributes.aFeet.setXYZW(i,p.legs,p.contact,p.footY,0);
  });
  this.mesh.instanceMatrix.needsUpdate=true;
  for(const name of ['aWing','aPose','aFeet','aPalette','aSpecies']) this.geometry.attributes[name].needsUpdate=true;
 }
 dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.geometry.dispose(); this.material.dispose(); this.depthMaterial.dispose(); }
}
