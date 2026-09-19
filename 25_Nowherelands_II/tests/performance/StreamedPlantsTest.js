import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};if(s.startsWith('three/addons/'))return{url:new URL('../../../common/libs/three-0.185/examples/jsm/'+s.slice(13),import.meta.url).href,shortCircuit:true};return next(s,c);}});
const THREE=await import('three');
const {PlantMeshBatch}=await import('../../js/world/PlantMeshBatch.js');
const {WorldPlants}=await import('../../js/world/WorldPlants.js');
const {warmStreamedMaterials}=await import('../../js/fx/StreamedMaterialWarmup.js');

test('indexed plant batches preserve every triangle, normal and articulated part',()=>{
 const parent=new THREE.Group(),root=new THREE.Group();parent.add(root);
 const geometries=[new THREE.BoxGeometry(),new THREE.SphereGeometry(1,8,6)],materials=geometries.map(()=>new THREE.MeshStandardMaterial());
 const parts=geometries.map((g,i)=>{const m=new THREE.Mesh(g,materials[i]);m.position.x=i*3;root.add(m);return m;});
 const batch=new PlantMeshBatch({root},parent),g=batch.batches[0].mesh.geometry;
 let at=0;
 for(const [id,part] of parts.entries()){
  const source=part.geometry;
  for(let i=0;i<source.index.count;i++){
   const before=source.index.getX(i),after=g.index.getX(at++);
   for(const attr of ['position','normal'])for(let k=0;k<3;k++)assert.equal(g.attributes[attr].array[after*3+k],source.attributes[attr].array[before*3+k]);
   assert.equal(g.attributes.aPlantPart.getX(after),id);
  }
 }
 assert.equal(g.attributes.position.count,geometries.reduce((n,g)=>n+g.attributes.position.count,0));
 assert.ok(g.attributes.position.count<g.index.count/2);
 batch.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
});

function fixture(){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),shared={scene,camera,world:{rivers:[]},player:{position:camera.position},colliders:[]};
 const hm={sample:()=>2,habitat:()=>({alt:1})};
 const plants=new WorldPlants(scene,hm,shared,[],'stream-test');
 const site={id:'reed',species:'bell-reed',form:'mature',x:0,y:2,z:0,scale:3,companions:[]};
 return {plants,shared,site};
}
test('batched willows keep their visible vertices and sway without rebuilding hidden leaves',()=>{
 const {plants,shared,site}=fixture();
 const entry=plants.add({...site,species:'veil-willow',pendants:false});
 const leaf=entry.rig.leaves.find(l=>l.geometry),geometry=entry.batch.batches[0].mesh.geometry;
 const positions=geometry.attributes.position.array.slice(),sourceVersion=leaf.geometry.attributes.position.version,rotation=leaf.pivot.rotation.z;
 entry.model.update(.5);entry.rig.update(shared.camera);entry.batch.update();
 assert.notEqual(leaf.pivot.rotation.z,rotation);
 assert.equal(leaf.geometry.attributes.position.version,sourceVersion);
 assert.deepEqual(geometry.attributes.position.array,positions);
 assert.ok(entry.batch.texture.version>1);plants.dispose();
});
test('partial plant construction stays private and cancellation disposes its resources',()=>{
 for(const steps of [1,5,15,30]){
  const {plants,shared,site}=fixture(),work=plants.buildEntry(site);
  for(let i=0;i<steps;i++){const step=work.next();if(step.done)break;}
  assert.equal(plants.entries.size,0);assert.equal(plants.root.children.length,0);assert.equal(shared.colliders.length,0);
  work.return();assert.equal(plants.entries.size,0);plants.dispose();assert.equal(shared.scene.children.length,0);
 }
});
test('streaming cancels an unfinished patch after a distant jump and publishes complete replacements',()=>{
 const {plants,shared,site}=fixture();plants.sites=[site];plants.stream();
 shared.player.position.x=10000;plants.stream();assert.equal(plants.pendingBuild,null);assert.equal(plants.entries.size,0);
 shared.player.position.x=0;plants.stream(true);assert.equal(plants.entries.size,1);
 const entry=plants.entries.get(site.id);assert.ok(entry.batch.batches[0].mesh.geometry.index);assert.ok(entry.rig.stems.length);plants.dispose();
});
test('shader warmup shares retained material owners and restores the caller render target',async()=>{
 const world=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),root=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial();
 const mesh=new THREE.Mesh(geometry,material);root.add(mesh);world.add(new THREE.PointLight());
 const original={},targets=[];let current=original;
 const renderer={getRenderTarget:()=>current,getActiveCubeFace:()=>2,getActiveMipmapLevel:()=>1,setRenderTarget:t=>{current=t;targets.push(t);},compileAsync:async scene=>{
  assert.equal(scene.getObjectsByProperty('isLight',true).length,1);
  assert.equal(scene.getObjectsByProperty('isMesh',true)[0].material,material);
 },render:()=>{assert.notEqual(current,original);}};
 await warmStreamedMaterials({renderer,scene:world,camera},[root]);assert.equal(current,original);assert.equal(mesh.parent,root);
 renderer.compileAsync=async()=>{throw Error('compile failed');};await assert.rejects(warmStreamedMaterials({renderer,scene:world,camera},[root]),/compile failed/);assert.equal(current,original);
 geometry.dispose();material.dispose();
});

test('reply masks warm separately with the same zero-light layout used by the mask pass',async()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),root=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();
 const body=new THREE.Mesh(geometry,material),mask=new THREE.Mesh(geometry,material.clone());mask.layers.set(30);body.add(mask);root.add(body);scene.add(new THREE.PointLight());
 const counts=[];let target=null;
 const renderer={getRenderTarget:()=>target,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,setRenderTarget:t=>target=t,compileAsync:async (s,c)=>counts.push([c.layers.mask,s.getObjectsByProperty('isLight',true).length,s.getObjectsByProperty('isMesh',true).length]),render:()=>{}};
 await warmStreamedMaterials({scene,camera,renderer},[root]);assert.deepEqual(counts,[[1,1,1],[1<<30,0,1]]);
 material.dispose();mask.material.dispose();geometry.dispose();
});

test('unanswered scalar reply masks skip the render pass and become visible on the same update as the reply',async()=>{
 const {replyOutline}=await import('../../js/world/fauna/ReplyOutline.js');
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(geometry,material),reply=replyOutline(mesh);
 assert.equal(reply.outline.visible,false);reply.setSignal(.4);assert.equal(reply.outline.visible,true);assert.equal(reply.signal.value,.4);
 reply.setSignal(.009);assert.equal(reply.outline.visible,false);reply.setSignal(1);assert.equal(reply.outline.visible,true);
 reply.dispose();geometry.dispose();material.dispose();
});

test('deferred retirement immediately removes picking and cannot delete a replacement at the same site',()=>{
 const {plants,site}=fixture(),old=plants.add(site);let disposed=0;old.batch.texture.addEventListener('dispose',()=>disposed++);
 plants.retire(old);assert.equal(old.root.parent,null);assert.equal(plants.targets.length,0);assert.equal(disposed,0);
 const replacement=plants.add(site);plants.disposeRetired();assert.equal(disposed,1);assert.equal(plants.entries.get(site.id),replacement);assert.equal(replacement.root.parent,plants.root);plants.dispose();
});

test('empty retained instance pools receive a real warmup draw without changing the live pool',async()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();
 const pool=new THREE.InstancedMesh(geometry,material,4);pool.count=0;
 let target=null,draws=0;
 const renderer={getRenderTarget:()=>target,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,setRenderTarget:t=>target=t,compileAsync:async()=>{},render:s=>{
  const clone=s.children.find(m=>m.isInstancedMesh);assert.equal(clone.count,1);assert.equal(clone.geometry,geometry);draws++;
 }};
 await warmStreamedMaterials({scene,camera,renderer},[pool]);assert.equal(draws,1);assert.equal(pool.count,0);assert.equal(pool.instanceMatrix.count,4);
 pool.dispose();geometry.dispose();material.dispose();
});
