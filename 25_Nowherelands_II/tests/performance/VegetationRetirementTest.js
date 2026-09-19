import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};if(s.startsWith('three/addons/'))return{url:new URL('../../../common/libs/three-0.185/examples/jsm/'+s.slice(13),import.meta.url).href,shortCircuit:true};return next(s,c);}});
globalThis.location={search:'?seed=retirement'};
globalThis.matchMedia=()=>({matches:false});
const THREE=await import('three');
const {Vegetation}=await import('../../js/world/Vegetation.js');

function fixture(){
 const vegetation=Object.create(Vegetation.prototype),scene=new THREE.Scene(),material=new THREE.MeshBasicMaterial();
 Object.assign(vegetation,{scene,chunks:new Map(),farChunks:new Map(),retiredMeshes:[],shared:{colliders:[]}});
 const counts={geometry:0,instance:0,material:0};material.addEventListener('dispose',()=>counts.material++);
 const make=()=>{const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),material,1);mesh.geometry.addEventListener('dispose',()=>counts.geometry++);mesh.addEventListener('dispose',()=>counts.instance++);scene.add(mesh);return mesh;};
 return {vegetation,scene,material,counts,make};
}
test('retirement detaches geometry and collisions immediately and releases only its own resources later',()=>{
 const {vegetation:v,scene,material,counts,make}=fixture(),collider={},retained={};
 const old=[make(),make()];v.chunks.set('0,0',{meshes:old,colliders:[collider]});v.shared.colliders=[collider,retained];
 v.removeChunk('0,0',true);assert.equal(v.chunks.size,0);assert.equal(scene.children.length,0);assert.deepEqual(v.shared.colliders,[retained]);assert.equal(counts.geometry,0);
 const replacement=make();v.chunks.set('0,0',{meshes:[replacement],colliders:[]});
 v.disposeRetired(-Infinity);assert.equal(v.retiredMeshes.length,2);assert.equal(counts.geometry,0);
 v.disposeRetired(Infinity);assert.deepEqual(counts,{geometry:2,instance:2,material:0});assert.equal(v.chunks.get('0,0').meshes[0],replacement);assert.equal(replacement.parent,scene);
 v.disposeRetired(Infinity);assert.equal(counts.geometry,2);v.removeChunk('0,0');assert.deepEqual(counts,{geometry:3,instance:3,material:0});material.dispose();
});
test('far mesh disposal stops at the shared deadline between resources',()=>{
 const {vegetation:v,counts,make,material}=fixture(),meshes=[make(),make(),make()];v.farChunks.set('0,0',{meshes});v.removeFarChunk('0,0',true);
 let clock=0;const original=performance.now;performance.now=()=>clock++;
 try{v.disposeRetired(1);assert.equal(counts.geometry,1);assert.equal(v.retiredMeshes.length,2);}finally{performance.now=original;}
 v.disposeRetired(Infinity);assert.deepEqual(counts,{geometry:3,instance:3,material:0});material.dispose();
});
