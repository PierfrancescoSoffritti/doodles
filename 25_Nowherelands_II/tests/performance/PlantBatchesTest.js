import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
const T=await import('three'),{PlantBatches}=await import('../../js/world/PlantBatches.js?v=stable-30-3'),{sharedPlantGeometry}=await import('../../js/world/SharedPlantGeometry.js?v=stable-30-3');
function setup(){
 const world=new T.Scene(),base=new T.BoxGeometry(),material=new T.MeshBasicMaterial(),sources=[];
 for(let i=0;i<3;i++){const g=sharedPlantGeometry(base),mesh=new T.InstancedMesh(g,material,1);mesh.plantGeometry=base;g.setAttribute('aBorn',new T.InstancedBufferAttribute(new Float32Array([i]),1));mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(i*2,0,-5));mesh.computeBoundingSphere();world.add(mesh);sources.push(mesh);}
 const camera=new T.PerspectiveCamera(90,1,.1,100),renderer={render(){}};
 const dispose=()=>{for(const s of sources){s.geometry.dispose();s.dispose();}base.dispose();material.dispose();};
 return{world,base,material,sources,camera,renderer,dispose};
}
test('plant batches track growth, visibility and retired chunks without retaining instance buffers',()=>{
 const f=setup(),seen=[];f.renderer.render=()=>{seen.push(f.world.children.filter(m=>m.isInstancedMesh&&m.visible).map(m=>({count:m.count,born:[...m.geometry.attributes.aBorn.array.slice(0,m.count)]})));};const b=new PlantBatches(f.renderer,f.world);
 try{f.renderer.render(f.world,f.camera);assert.deepEqual(seen.at(-1),[{count:3,born:[0,1,2]}]);assert.ok(f.sources.every(s=>s.visible));const uploads=b.stats.uploads;
 f.renderer.render(f.world,f.camera);assert.equal(b.stats.uploads,uploads);
 f.sources[1].geometry.attributes.aBorn.setX(0,42);f.sources[1].geometry.attributes.aBorn.needsUpdate=true;f.sources[2].visible=false;
 f.renderer.render(f.world,f.camera);assert.deepEqual(seen.at(-1),[{count:2,born:[0,42]}]);assert.equal(f.sources[2].visible,false);
 f.sources[0].removeFromParent();f.renderer.render(f.world,f.camera);assert.deepEqual(seen.at(-1),[{count:1,born:[42]}]);
 }finally{b.dispose();f.dispose();}
});
test('nested mirror renders retain source visibility and a transformed world bypasses batching',()=>{
 const f=setup(),mirror=f.camera.clone();mirror.position.x=2;let nesting=false,calls=0;
 f.renderer.render=()=>{calls++;if(!nesting){nesting=true;f.renderer.render(f.world,mirror);nesting=false;}assert.ok(f.world.children.some(m=>m.name==='batched-plants'&&m.visible));};const b=new PlantBatches(f.renderer,f.world);
 try{f.renderer.render(f.world,f.camera);assert.equal(calls,2);assert.ok(f.sources.every(s=>s.visible));assert.ok([...b.groups.values()].every(g=>!g.mesh.visible));
 b.original=()=>assert.ok(f.sources.every(s=>s.visible));f.world.position.x=20;f.renderer.render(f.world,f.camera);
 }finally{b.dispose();f.dispose();}
});

test('chunk culling copies complete matrix and growth spans and tracks replacement arrays',()=>{
 const f=setup();const b=new PlantBatches(f.renderer,f.world,{cullInstances:false});
 try{
  f.renderer.render(f.world,f.camera);const group=[...b.groups.values()][0];
  assert.deepEqual([...group.mesh.instanceMatrix.array.slice(0,48)],f.sources.flatMap(s=>[...s.instanceMatrix.array]));
  f.sources[0].geometry.attributes.aBorn.array=new Float32Array([77]);f.sources[0].geometry.attributes.aBorn.needsUpdate=true;
  const next=new Float32Array(f.sources[0].instanceMatrix.array);next[12]=.5;f.sources[0].instanceMatrix.array=next;f.sources[0].instanceMatrix.needsUpdate=true;
  f.renderer.render(f.world,f.camera);assert.equal(group.mesh.geometry.attributes.aBorn.array[0],77);assert.equal(group.mesh.instanceMatrix.array[12],.5);
  f.sources[0].removeFromParent();f.renderer.render(f.world,f.camera);assert.equal(group.mesh.count,2);assert.deepEqual([...group.mesh.geometry.attributes.aBorn.array.slice(0,2)],[1,2]);
 }finally{b.dispose();f.dispose();}
});
