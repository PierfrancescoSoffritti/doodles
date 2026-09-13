import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(s,c);}});
const THREE=await import('three');const{StaticMeshSurface}=await import('../../js/world/fauna/StaticMeshSurface.js?v=stable-30-5');
test('static surface retains the nearest native double-sided ray hit and range clipping',()=>{
 let seed=7;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 let hits=0,checks=0;
 for(const indexed of [true,false])for(const partial of [true,false]){
  let geometry=new THREE.TorusKnotGeometry(4,1.3,64,8);if(!indexed)geometry=geometry.toNonIndexed();
  if(partial)geometry.setDrawRange(18,126);
  const surface=new StaticMeshSurface(geometry),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  mesh.position.set(340,-25,-740);mesh.rotation.set(.14,.89,.23);mesh.scale.set(2.3,4.1,1.2);mesh.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),point=new THREE.Vector3();
  for(let i=0;i<1000;i++){
   const origin=new THREE.Vector3(rnd()*40-20,rnd()*40-20,rnd()*40-20).add(mesh.position);
   const aim=new THREE.Vector3(rnd()*12-6,rnd()*12-6,rnd()*12-6).add(mesh.position);
   ray.set(origin,aim.sub(origin).normalize());ray.near=i%3===0?5:0;ray.far=i%4===0?15:100;
   const expected=ray.intersectObject(mesh,false)[0],actual=surface.intersect(mesh.matrixWorld,ray,point);checks++;
   assert.equal(!!actual,!!expected);if(expected){hits++;assert.deepEqual(actual.toArray(),expected.point.toArray());}
  }
  geometry.dispose();mesh.material.dispose();
 }
 assert.equal(checks,4000);assert.ok(hits>100);
});
