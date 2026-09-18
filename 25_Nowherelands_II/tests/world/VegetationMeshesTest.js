import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){
 if(specifier==='three')return {url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};
 if(specifier.startsWith('three/addons/'))return {url:new URL('../../../common/libs/three-0.185/examples/jsm/'+specifier.slice(13),import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}});
const THREE=await import('three');
const {VegetationStudy}=await import('../../js/atelier/VegetationStudy.js');
const {VegetationMeshes}=await import('../../js/atelier/VegetationMeshes.js');

test('every plant form has finite geometry and rooted attachments through strong wind and gestures',()=>{
 for(const species of ['bell-reed','veil-willow']){
  const model=new VegetationStudy({species,form:'mixed',group:true}),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(8,6,15);
  const meshes=new VegetationMeshes(scene,model,camera);model.wind=1;model.brush();model.offerNote(1);model.touchMirror();
  const anchors=meshes.leaves.filter(l=>l.attachment).map(l=>l.pivot.position.clone());
  for(let i=0;i<360;i++){
   model.update(1/60);meshes.update(camera);meshes.root.updateMatrixWorld(true);
   meshes.root.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
  }
  meshes.root.traverse(o=>{if(o.geometry)for(const attr of Object.values(o.geometry.attributes))assert.ok(attr.array.every(Number.isFinite));});
  meshes.leaves.filter(l=>l.attachment).forEach((l,i)=>assert.ok(l.pivot.position.equals(anchors[i]),'wind does not detach a hanging leaf'));
  assert.ok(meshes.stems.every(s=>s.joints[0].position.length()===0),'stem roots remain fixed');
  assert.ok(meshes.mirrors.filter(m=>m.reflector.material===m.reflectionMaterial).length<=2);
  assert.ok(meshes.mirrors.every(m=>Math.abs(m.turn.rotation.y)<=.526),'mirrors turn only within their suspension');
  meshes.dispose();assert.equal(scene.children.length,0);
 }
});

test('replacing a specimen disposes all owned geometry, materials and mirror render targets once',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),model=new VegetationStudy({species:'veil-willow',form:'mixed',group:true});
 const meshes=new VegetationMeshes(scene,model,camera);meshes.update(camera);
 const resources=new Set();meshes.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});
 meshes.mirrors.forEach(m=>{resources.add(m.reflector.getRenderTarget());resources.add(m.reflectionMaterial);});
 const disposed=new Map();for(const resource of resources)resource.addEventListener('dispose',()=>disposed.set(resource,(disposed.get(resource)||0)+1));
 meshes.dispose();for(const resource of resources)assert.equal(disposed.get(resource),1);
});

test('ordinary willows have no reflector resources or clickable pendant targets',()=>{
 const scene=new THREE.Scene(),model=new VegetationStudy({species:'veil-willow',pendants:false}),meshes=new VegetationMeshes(scene,model,new THREE.PerspectiveCamera());
 assert.equal(meshes.mirrors.length,0);assert.equal(meshes.picks.length,0);meshes.dispose();
});

test('every reed has an attached dim bulb that brightens with its reply and settles again',()=>{
 for(const form of ['young','mature','weathered']){
  const model=new VegetationStudy({form}),camera=new THREE.PerspectiveCamera();
  const meshes=new VegetationMeshes(new THREE.Scene(),model,camera);meshes.update(camera);
  const resting=meshes.stems.map(({bulb,shell,spec})=>{
   assert.equal(bulb.parent,shell,'bulb follows its husk through wind and response');
   assert.ok(meshes.picks.includes(bulb),'visible bulb is part of the flower interaction target');
   bulb.geometry.computeBoundingBox();
   const bounds=bulb.geometry.boundingBox.clone().translate(bulb.position);
   assert.ok(bounds.max.y<-spec.size*.45,'bulb stays below the shoulder');
   assert.ok(bounds.min.y<-spec.size*1.5,'bulb peeks through the open mouth');
   assert.ok(bulb.material.emissiveIntensity>0&&bulb.material.emissiveIntensity<1);
   return bulb.material.emissiveIntensity;
  });
  const peaks=[...resting];model.offerNote(1);
  for(let frame=0;frame<600;frame++){
   model.update(1/60);meshes.update(camera);
   meshes.stems.forEach(({bulb},i)=>{peaks[i]=Math.max(peaks[i],bulb.material.emissiveIntensity);});
  }
  meshes.stems.forEach(({bulb},i)=>{
   assert.ok(peaks[i]>resting[i]*5,'each answering bulb has a distinct bright pulse');
   assert.ok(Math.abs(bulb.material.emissiveIntensity-resting[i])<.001,'response returns to dim light');
  });
  meshes.dispose();
 }
});

test('reed husks are one joined shell with only a single open mouth boundary',()=>{
 const meshes=new VegetationMeshes(new THREE.Scene(),new VegetationStudy({form:'mixed',group:true}),new THREE.PerspectiveCamera());
 for(const {shell,spec} of meshes.stems){
  const geometry=shell.children[0].geometry,positions=geometry.attributes.position,index=geometry.index.array,edges=new Map(),neighbors=new Map();
  for(let i=0;i<index.length;i+=3)for(let j=0;j<3;j++){
   const a=index[i+j],b=index[i+(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');
   edges.set(key,(edges.get(key)||0)+1);
   if(!neighbors.has(a))neighbors.set(a,new Set());neighbors.get(a).add(b);
   if(!neighbors.has(b))neighbors.set(b,new Set());neighbors.get(b).add(a);
  }
  const connected=new Set(),visit=[0];while(visit.length){const i=visit.pop();if(connected.has(i))continue;connected.add(i);visit.push(...neighbors.get(i));}
  assert.equal(connected.size,positions.count,'petals cannot be disconnected islands');
  const boundary=new Map();
  for(const [edge,count] of edges){
   assert.ok(count===1||count===2,'shell is manifold');
   if(count!==1)continue;
   const [a,b]=edge.split(':').map(Number);
   for(const i of [a,b]){assert.ok(positions.getY(i)<-spec.size*.85,'no openings along the crown or shoulder');boundary.set(i,(boundary.get(i)||0)+1);}
  }
  assert.equal(boundary.size,12,'one scalloped mouth remains open');assert.ok([...boundary.values()].every(n=>n===2));
  // Around the shoulder, every radial viewing direction hits the shell.
  const ray=new THREE.Raycaster(),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
  for(let i=0;i<72;i++){
   const angle=(i+.37)/72*Math.PI*2,dir=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle));
   ray.set(dir.clone().multiplyScalar(spec.size*2).setY(-spec.size*.72),dir.negate());
   assert.ok(ray.intersectObject(mesh).length>0,'no see-through petal seams');
  }
  mesh.material.dispose();
 }
 meshes.dispose();
});

test('willow crowns and leaf orientations occupy a volume across seeds and foliage forms',()=>{
 for(const seed of ['stillwater','shore','wind','grove']){
  const meshes=new VegetationMeshes(new THREE.Scene(),new VegetationStudy({species:'veil-willow',form:'mixed',group:true,seed}),new THREE.PerspectiveCamera());
  for(const plant of meshes.model.plants){
   const attachments=meshes.leaves.filter(l=>l.attachment&&l.plant===plant),points=attachments.map(l=>l.pivot.position);
   assert.equal(points.length,8);
   const cx=points.reduce((s,p)=>s+p.x,0)/points.length,cz=points.reduce((s,p)=>s+p.z,0)/points.length;
   let xx=0,zz=0,xz=0;for(const p of points){xx+=(p.x-cx)**2;zz+=(p.z-cz)**2;xz+=(p.x-cx)*(p.z-cz);}
   const discriminant=Math.hypot(xx-zz,2*xz),minor=(xx+zz-discriminant)/2,major=(xx+zz+discriminant)/2;
   assert.ok(minor/major>.35,'crown must retain depth even if rotated');
   const headings=attachments.map(l=>l.pivot.rotation.y);
   assert.ok(Math.max(...headings)-Math.min(...headings)>Math.PI,'leaf groups face around the crown');
   assert.ok(Math.max(...points.map(p=>p.z))-Math.min(...points.map(p=>p.z))>3,'side silhouette has substantial width');
  }
  meshes.dispose();
 }
});
