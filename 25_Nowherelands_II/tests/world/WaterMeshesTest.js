import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier==='three')return {url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
const THREE=await import('three');
const {WaterStudy}=await import('../../js/atelier/WaterStudy.js');
const {WaterMeshes}=await import('../../js/atelier/WaterMeshes.js');

test('the fish share one small mesh without shadows or paused buffer uploads',()=>{
 const model=new WaterStudy({school:'large'}),meshes=new WaterMeshes(new THREE.Scene(),model),batch=meshes.fish.mesh;
 assert.equal(batch.count,20);assert.equal(batch.geometry.attributes.position.count/3,118);
 assert.equal(batch.geometry.groups.length,0);assert.equal(Array.isArray(batch.material),false);
 assert.equal(batch.castShadow,false);assert.equal(batch.receiveShadow,false);assert.equal(batch.frustumCulled,true);
 const version=batch.instanceMatrix.version;meshes.update();assert.equal(batch.instanceMatrix.version,version);
 model.update(1/30);meshes.update();assert.ok(batch.instanceMatrix.version>version);
 batch.updateMatrixWorld();const box=new THREE.Box3().setFromObject(batch);assert.ok(box.max.y<0);assert.ok(box.min.y>-1.8);
 const parts=batch.geometry.attributes.aPart,zs=batch.geometry.attributes.position;
 for(let i=0;i<parts.count;i++){if(parts.getX(i)===2)assert.ok(zs.getZ(i)<0);if(parts.getX(i)===3)assert.ok(zs.getZ(i)>0);}
 meshes.dispose();
});

test('flowers touch the surface and contain their cores, without underwater stalk geometry',()=>{
 const model=new WaterStudy({species:'light-lily'}),meshes=new WaterMeshes(new THREE.Scene(),model);
 assert.equal(meshes.fish.mesh,null);model.touch();
 for(let frame=0;frame<240;frame++){
  model.update(1/30);meshes.update();meshes.root.updateMatrixWorld(true);
  for(const l of meshes.lilies){
   const flower=new THREE.Box3().setFromObject(l.flower),wholePlant=new THREE.Box3().setFromObject(l.root);
   assert.ok(Math.abs(flower.min.y)<.03,'flower base rests on the water, including while responding');
   assert.ok(wholePlant.min.y>-.03,'there are no submerged stems');
   const coreBox=new THREE.Box3().setFromObject(l.core),cupBox=new THREE.Box3().setFromObject(l.cup);
   assert.ok(coreBox.min.y>cupBox.min.y+.02,'glowing core is above the cup floor');
   assert.ok(coreBox.max.y<flower.max.y-.05,'petals surround and rise above the core');
   assert.ok(coreBox.min.x>cupBox.min.x&&coreBox.max.x<cupBox.max.x,'core is within the cup width');
  }
 }
 meshes.dispose();
});

test('fish instance poses and animation uniforms ignore splashes',()=>{
 const quiet=new WaterStudy(),splashed=new WaterStudy();
 const a=new WaterMeshes(new THREE.Scene(),quiet),b=new WaterMeshes(new THREE.Scene(),splashed);
 splashed.touch(2,1,true);
 for(let i=0;i<90;i++){
  quiet.update(1/30);splashed.update(1/30);a.update();b.update();
  assert.deepEqual(a.fish.mesh.instanceMatrix.array,b.fish.mesh.instanceMatrix.array);
  assert.deepEqual(a.fish.uniforms,b.fish.uniforms);
 }
 a.dispose();b.dispose();
});

test('all remaining water studies have finite geometry and release every resource',()=>{
 for(const species of ['pool','scarlet-fish','light-lily']){
  const model=new WaterStudy({species}),scene=new THREE.Scene(),meshes=new WaterMeshes(scene,model);model.touch(0,0,true);
  for(let i=0;i<120;i++){model.update(1/30);meshes.update();meshes.root.updateMatrixWorld(true);}
  meshes.root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.geometry)for(const a of Object.values(o.geometry.attributes))assert.ok(a.array.every(Number.isFinite));});
  meshes.setSurface(false);assert.equal(meshes.water.visible,false);assert.ok(meshes.waterExtras.every(o=>!o.visible));
  const resources=new Set([...meshes.geometries,...meshes.materials]);if(meshes.fish.mesh){resources.add(meshes.fish.mesh);resources.add(meshes.fish.geometry);resources.add(meshes.fish.material);}
  const disposed=new Map();resources.forEach(r=>r.addEventListener('dispose',()=>disposed.set(r,(disposed.get(r)||0)+1)));
  meshes.dispose();assert.equal(scene.children.length,0);for(const r of resources)assert.equal(disposed.get(r),1);
 }
});
