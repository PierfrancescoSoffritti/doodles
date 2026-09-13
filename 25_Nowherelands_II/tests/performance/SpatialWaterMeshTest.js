import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){if(s==='three')return{url:new URL('../../../common/libs/three-0.185/build/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(s,c);}});
const THREE=await import('three'),{spatialWaterMesh}=await import('../../js/world/SpatialWaterMesh.js?v=stable-30-5');

test('partitioning retains every triangle, shared attributes, callbacks and conservative bounds',()=>{
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-10,0,-10,10,0,-10,10,0,10,5000,50,0,5100,50,0,5000,50,100],3));g.setIndex([0,1,2,3,4,5]);
 const material=new THREE.MeshBasicMaterial(),source=new THREE.Mesh(g,material),callback=()=>{};source.onBeforeRender=callback;source.renderOrder=2;source.position.set(12,3,-4);
 const root=spatialWaterMesh(source,1024,2);assert.equal(root.children.length,2);assert.deepEqual(root.position,source.position);
 const triangles=[];
 for(const mesh of root.children){assert.equal(mesh.material,material);assert.equal(mesh.onBeforeRender,callback);assert.equal(mesh.renderOrder,2);assert.equal(mesh.geometry.attributes.position,g.attributes.position);const ids=[...mesh.geometry.index.array];triangles.push(ids.join(','));for(const id of ids){const p=new THREE.Vector3().fromBufferAttribute(g.attributes.position,id);assert.ok(mesh.geometry.boundingBox.containsPoint(p));assert.ok(mesh.geometry.boundingSphere.containsPoint(p));}}
 assert.deepEqual(triangles.sort(),['0,1,2','3,4,5']);assert.deepEqual([...g.index.array],[0,1,2,3,4,5]);
 const camera=new THREE.PerspectiveCamera(60,1,1,1000);camera.position.set(0,100,200);camera.lookAt(0,0,0);camera.updateMatrixWorld();const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));root.updateMatrixWorld();assert.equal(root.children.filter(m=>frustum.intersectsObject(m)).length,1);
});

test('point partitions retain individual attributes and shader displacement padding',()=>{
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,5000,0,0],3));g.setAttribute('aInfo',new THREE.Float32BufferAttribute([1,2,3,4,5,6,7,8],4));const source=new THREE.Points(g,new THREE.PointsMaterial()),root=spatialWaterMesh(source,1024,120);
 assert.equal(root.children.length,2);assert.equal(root.userData.primitiveCount,2);
 for(const m of root.children){assert.ok(m.isPoints);assert.equal(m.geometry.attributes.aInfo,g.attributes.aInfo);const p=new THREE.Vector3().fromBufferAttribute(g.attributes.position,m.geometry.index.getX(0));assert.ok(m.geometry.boundingBox.containsPoint(p.clone().addScalar(120)));}
});

test('static partitions preserve transforms, manual matrices and moving-parent propagation',()=>{
 for(const manual of [false,true]) {
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([1,2,3,4,5,6,7,8,9],3));
  const source=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());source.position.set(12,3,-4);source.rotation.set(.2,.4,-.3);source.scale.set(2,.7,1.3);source.updateMatrix();
  if(manual){source.matrixAutoUpdate=false;source.matrix.elements[4]+=.12;}
  const root=spatialWaterMesh(source),parent=new THREE.Group();parent.position.set(7,11,-5);parent.add(source,root);parent.updateMatrixWorld();
  assert.deepEqual(root.matrixWorld.elements,source.matrixWorld.elements);
  for(const mesh of root.children)assert.deepEqual(mesh.matrixWorld.elements,source.matrixWorld.elements);
  let localUpdates=0;
  root.traverse(object=>{assert.equal(object.matrixAutoUpdate,false);object.updateMatrix=()=>{localUpdates++;};});
  for(let i=0;i<60;i++){parent.position.x+=.25;parent.updateMatrixWorld();for(const mesh of root.children)assert.deepEqual(mesh.matrixWorld.elements,source.matrixWorld.elements);}
  assert.equal(localUpdates,0);
 }
});
